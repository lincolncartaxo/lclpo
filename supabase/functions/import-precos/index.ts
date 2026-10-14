import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as Papa from "https://esm.sh/papaparse@5.4.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");
    if (user.user_metadata?.role !== "admin") throw new Error("Forbidden");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fonte = formData.get("fonte") as string; // 'SINAPI', 'SICRO', 'ORSE'
    const uf = formData.get("uf") as string; // 'PB', 'SP', 'BR'
    const mes_ref = formData.get("mes_ref") as string; // '2026-08'
    const tipo = formData.get("tipo") as string; // 'insumo' ou 'composicao'

    if (!file || !fonte || !uf || !mes_ref || !tipo) throw new Error("Missing required fields");

    const bytes = new Uint8Array(await file.arrayBuffer());
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder("windows-1252").decode(bytes);
    }

    // O formato de subida EXIGIDO será sempre um CSV padronizado
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: text.split(/\r?\n/, 1)[0]?.includes(";") ? ";" : ",",
      transformHeader: (header) =>
        header
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase(),
    });
    if (parsed.errors.length > 0) {
      throw new Error(
        `CSV inválido na linha ${parsed.errors[0].row ?? "?"}: ${parsed.errors[0].message}`,
      );
    }

    const metadados = [];
    const precos = [];

    for (const row of parsed.data as any[]) {
      const codigo = String(row.codigo ?? "").trim();
      if (!codigo) continue;
      metadados.push({
        codigo,
        fonte: fonte.trim().toUpperCase(),
        descricao: String(row.descricao ?? "").trim(),
        unidade: String(row.unidade ?? "").trim(),
      });

      // Fix column names mapped from CAIXA/DER
      precos.push({
        codigo_insumo: tipo === "insumo" ? codigo : undefined,
        codigo_composicao: tipo === "composicao" ? codigo : undefined,
        fonte: fonte.trim().toUpperCase(),
        uf: uf.trim().toUpperCase(),
        mes_ref: mes_ref,
        preco_desonerado: parseFloat(
          String(row.preco_desonerado ?? "")
            .replace(/\./g, "")
            .replace(",", ".") || "0",
        ),
        preco_nao_desonerado: parseFloat(
          String(row.preco_nao_desonerado ?? "")
            .replace(/\./g, "")
            .replace(",", ".") || "0",
        ),
      });
    }

    const catalogoRpc =
      tipo === "insumo" ? "upsert_catalogo_insumos_lote" : "upsert_catalogo_composicoes_lote";
    const { error: catalogoError } = await supabase.rpc(catalogoRpc, {
      payload: metadados,
    });
    if (catalogoError) throw new Error(`Erro no catálogo: ${catalogoError.message}`);

    const rpcName =
      tipo === "insumo" ? "upsert_precos_insumos_lote" : "upsert_precos_composicoes_lote";
    const { error: rpcError } = await supabase.rpc(rpcName, { payload: precos });

    if (rpcError) throw new Error(`Erro na injeção de preços: ${rpcError.message}`);

    return new Response(
      JSON.stringify({
        message: `Sucesso! ${precos.length} preços atualizados para ${fonte} ${uf} (${mes_ref}).`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
