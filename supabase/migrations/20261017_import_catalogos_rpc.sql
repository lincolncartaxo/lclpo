-- Permite ao pipeline de importação atualizar os catálogos oficiais sem
-- conceder INSERT/UPDATE direto ao cliente autenticado.
CREATE OR REPLACE FUNCTION public.upsert_catalogo_insumos_lote(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.catalogo_insumos (codigo, fonte, descricao, unidade)
  SELECT
    btrim(rec->>'codigo'),
    upper(btrim(rec->>'fonte')),
    COALESCE(NULLIF(btrim(rec->>'descricao'), ''), '[Descrição não informada]'),
    NULLIF(btrim(rec->>'unidade'), '')
  FROM jsonb_array_elements(payload) AS rec
  WHERE NULLIF(btrim(rec->>'codigo'), '') IS NOT NULL
  ON CONFLICT (codigo, fonte) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    unidade = EXCLUDED.unidade;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_catalogo_composicoes_lote(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.catalogo_composicoes (codigo, fonte, descricao, unidade, classe)
  SELECT
    btrim(rec->>'codigo'),
    upper(btrim(rec->>'fonte')),
    COALESCE(NULLIF(btrim(rec->>'descricao'), ''), '[Descrição não informada]'),
    NULLIF(btrim(rec->>'unidade'), ''),
    NULLIF(btrim(rec->>'classe'), '')
  FROM jsonb_array_elements(payload) AS rec
  WHERE NULLIF(btrim(rec->>'codigo'), '') IS NOT NULL
  ON CONFLICT (codigo, fonte) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    unidade = EXCLUDED.unidade,
    classe = EXCLUDED.classe;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_catalogo_insumos_lote(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_catalogo_composicoes_lote(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_catalogo_insumos_lote(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_catalogo_composicoes_lote(jsonb) TO service_role;
