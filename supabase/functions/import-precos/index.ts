import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Papa from "https://esm.sh/papaparse@5.4.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parsePrice(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  // Aceita números CSV brasileiros (1.234,56) e decimais com ponto (1234.56).
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HttpError(400, "O CSV contém um preço inválido.");
  }
  return parsed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  try {
    const authorization = req.headers.get("Authorization")?.trim() ?? "";
    const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
    if (!bearerMatch) throw new HttpError(401, "Autenticação necessária.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      console.error("SUPABASE_URL ou SUPABASE_ANON_KEY ausente na Edge Function.");
      throw new HttpError(500, "Serviço de importação indisponível.");
    }

    // As consultas e RPCs mantêm o JWT do chamador: auth.uid(), RLS e as
    // verificações SQL de administrador continuam valendo. Não usar service_role.
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(bearerMatch[1]);
    if (authError || !user) throw new HttpError(401, "Sessão inválida ou expirada.");

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleError) {
      console.error("Falha ao validar papel administrativo:", roleError.message);
      throw new HttpError(503, "Não foi possível validar as permissões.");
    }
    if (!isAdmin) throw new HttpError(403, "Somente administradores podem importar bases de preços.");

    const formData = await req.formData();
    const file = formData.get("file");
    const fonte = String(formData.get("fonte") ?? "").trim().toUpperCase();
    const uf = String(formData.get("uf") ?? "").trim().toUpperCase();
    const mesRef = String(formData.get("mes_ref") ?? "").trim();
    const tipo = String(formData.get("tipo") ?? "").trim();

    if (!(file instanceof File)) throw new HttpError(400, "Arquivo CSV obrigatório.");
    if (file.size === 0 || file.size > 8 * 1024 * 1024) {
      throw new HttpError(413, "O arquivo deve ter até 8 MB e não pode estar vazio.");
    }
    if (!/^[\p{L}\p{N} _.-]{1,64}$/u.test(fonte)) throw new HttpError(400, "Fonte inválida.");
    if (!/^(BR|[A-Z]{2})$/.test(uf)) throw new HttpError(400, "UF inválida.");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesRef)) throw new HttpError(400, "Mês de referência inválido; use AAAA-MM.");
    if (tipo !== "insumo" && tipo !== "composicao") throw new HttpError(400, "Tipo de catálogo inválido.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder("windows-1252").decode(bytes);
    }

    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: text.split(/\r?\n/, 1)[0]?.includes(";") ? ";" : ",",
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim().toLowerCase(),
    });
    if (parsed.errors.length > 0) {
      throw new HttpError(400, "CSV inválido; confira o delimitador, o cabeçalho e as linhas do arquivo.");
    }
    if (parsed.data.length > 20_000) throw new HttpError(413, "O CSV excede o limite de 20.000 linhas.");

    const metadados: Array<Record<string, string>> = [];
    const precos: Array<Record<string, string | number | undefined>> = [];

    for (const row of parsed.data) {
      const codigo = String(row.codigo ?? "").trim();
      if (!codigo) continue;

      const valorDesonerado = parsePrice(row.preco_desonerado);
      const valorNaoDesonerado = parsePrice(row.preco_nao_desonerado);
      metadados.push({
        codigo,
        fonte,
        descricao: String(row.descricao ?? "").trim(),
        unidade: String(row.unidade ?? "").trim(),
      });
      precos.push({
        codigo_insumo: tipo === "insumo" ? codigo : undefined,
        codigo_composicao: tipo === "composicao" ? codigo : undefined,
        fonte,
        uf,
        mes_ref: mesRef,
        preco_desonerado: valorDesonerado,
        preco_nao_desonerado: valorNaoDesonerado,
      });
    }

    if (precos.length === 0) throw new HttpError(400, "Nenhuma linha válida com código foi encontrada no CSV.");

    const catalogoRpc = tipo === "insumo"
      ? "upsert_catalogo_insumos_lote"
      : "upsert_catalogo_composicoes_lote";
    const precoRpc = tipo === "insumo"
      ? "upsert_precos_insumos_lote"
      : "upsert_precos_composicoes_lote";
    const batchSize = 500;

    for (let i = 0; i < metadados.length; i += batchSize) {
      const { error } = await supabase.rpc(catalogoRpc, {
        payload: metadados.slice(i, i + batchSize),
      });
      if (error) {
        console.error("Falha ao atualizar catálogo:", error.message);
        throw new HttpError(422, "Falha ao atualizar o catálogo; confira o arquivo e tente novamente.");
      }
    }

    for (let i = 0; i < precos.length; i += batchSize) {
      const { error } = await supabase.rpc(precoRpc, {
        payload: precos.slice(i, i + batchSize),
      });
      if (error) {
        console.error("Falha ao atualizar preços:", error.message);
        throw new HttpError(422, "Falha ao atualizar os preços; confira o arquivo e tente novamente.");
      }
    }

    return jsonResponse({
      message: `Sucesso! ${precos.length} preços atualizados para ${fonte} ${uf} (${mesRef}).`,
    });
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status);
    console.error("Erro inesperado na Edge Function import-precos:", error);
    return jsonResponse({ error: "Falha inesperada na importação." }, 500);
  }
});
