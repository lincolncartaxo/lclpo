-- Compatibilidade com projetos onde catalogo_composicoes foi criada sem classe.
-- A importação não depende dessa coluna para funcionar.
ALTER TABLE public.catalogo_composicoes
  ADD COLUMN IF NOT EXISTS classe varchar(50);

CREATE OR REPLACE FUNCTION public.upsert_catalogo_composicoes_lote(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_import_admin();

  INSERT INTO public.catalogo_composicoes (codigo, fonte, descricao, unidade)
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

REVOKE ALL ON FUNCTION public.upsert_catalogo_composicoes_lote(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_catalogo_composicoes_lote(jsonb)
  TO authenticated, service_role;
