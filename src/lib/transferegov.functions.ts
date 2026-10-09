import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AUTH_URL = "https://idp.transferegov.sistema.gov.br/idp/jwt";
const PO_URL = "https://mandatarias.transferegov.sistema.gov.br/projeto-basico/api/v1/po";

async function autenticar() {
  const epcad = process.env["TRANSFEREGOV_EP_CAD_TOKEN"];
  const user = process.env["TRANSFEREGOV_USUARIO"];
  const pass = process.env["TRANSFEREGOV_SENHA"];
  if (!epcad || !user || !pass) throw new Error("Credenciais do Transferegov não configuradas.");
  const url = `${AUTH_URL}?usuario=${encodeURIComponent(user)}&senha=${encodeURIComponent(pass)}`;
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${epcad}`, "Content-Type": "application/json" } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Falha na autenticação Transferegov [${r.status}]: ${txt.slice(0, 300)}`);
  let token: string | undefined;
  try { token = JSON.parse(txt).token; } catch { /* */ }
  if (!token) throw new Error("Transferegov não retornou token.");
  return { token, epcad };
}

const propSchema = z.object({
  nrproposta: z.string().regex(/^\d{1,10}$/),
  anoproposta: z.string().regex(/^\d{4}$/),
});

export const consultarPropostaTG = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => propSchema.parse(d))
  .handler(async ({ data }) => {
    const { token, epcad } = await autenticar();
    const r = await fetch(`${PO_URL}?nrproposta=${data.nrproposta}&anoproposta=${data.anoproposta}`, {
      headers: { "EP-CAD": epcad, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const txt = await r.text();
    if (!r.ok) return { ok: false as const, status: r.status, mensagem: txt.slice(0, 500) };
    let j: any = {};
    try { j = JSON.parse(txt); } catch { /* */ }
    return {
      ok: true as const,
      status: r.status,
      sistema: String(j?.sistemaOrigem ?? ""),
      proposta: j?.proposta ? `${j.proposta.numero}/${j.proposta.ano}` : "",
                  metas: (j?.qci?.metas ?? []).map((m: any) => ({
        numero: m.numero, 
        descricao: String(m.descricao ?? ""),
        submetas: (m.submetas ?? []).map((s: any) => ({ 
          numero: s.numero, 
          descricao: String(s.descricao ?? ""),
          regimeExecucao: s.regimeExecucaoObra ?? "",
          numeroLote: s.numLote ?? "",
          valorContrapartida: s.valorContrapartida ?? 0,
          valorRepasse: s.valorRepasse ?? 0,
          previsaoInicioObra: s.po?.previsaoInicioObra ?? "",
          acompanhamentoPorEventos: s.po?.indAcompanhamentoEventos ? "Sim" : "Não",
          duracaoObraMeses: s.po?.duracaoObra ?? "",
          dataBase: s.po?.dataBase ?? "",
          ufLocalidade: s.po?.localidade ?? "",
          obraDesonerada: s.po?.indDesonerado ? "Sim" : "Não",
          submetaViaApi: s.po?.indSubmetaViaAPI ? "Sim" : "Não"
        })),
      })),
      })),
      raw: j
    };
  });

export const enviarPOTransferegov = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => propSchema.extend({
    nrmeta: z.string().regex(/^\d{1,5}$/),
    nrsubmeta: z.string().regex(/^\d{1,5}$/),
    payload: z.record(z.string(), z.any()),
  }).parse(d))
  .handler(async ({ data }) => {
    const { token, epcad } = await autenticar();
    const q = `nrproposta=${data.nrproposta}&anoproposta=${data.anoproposta}&nrmeta=${data.nrmeta}&nrsubmeta=${data.nrsubmeta}`;
    const r = await fetch(`${PO_URL}?${q}`, {
      method: "POST",
      headers: { "EP-CAD": epcad, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data.payload),
    });
    const txt = await r.text();
    if (!r.ok) console.error(`Transferegov envio [${r.status}]: ${txt}`);
    return { ok: r.ok, status: r.status, mensagem: txt.slice(0, 1000) };
  });
