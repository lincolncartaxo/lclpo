-- Importação analítica em duas fases para evitar repetir DELETE em cada lote.
-- A estrutura de uma composição não varia por data-base; os códigos recebidos
-- são removidos uma vez e depois os itens são inseridos em lotes.
CREATE OR REPLACE FUNCTION public.limpar_catalogo_composicao_itens_importacao(
  p_fonte text,
  p_codigos text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_import_admin();
  IF NULLIF(btrim(p_fonte), '') IS NULL OR p_codigos IS NULL OR cardinality(p_codigos) = 0 THEN
    RAISE EXCEPTION 'Parâmetros de limpeza analítica inválidos';
  END IF;

  DELETE FROM public.catalogo_composicao_itens
   WHERE fonte = upper(btrim(p_fonte))
     AND codigo_composicao = ANY(p_codigos);
END;
$$;

CREATE OR REPLACE FUNCTION public.inserir_catalogo_composicao_itens_lote(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_import_admin();
  IF jsonb_typeof(payload) <> 'array' THEN
    RAISE EXCEPTION 'Payload analítico inválido: esperado um array';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload) rec
    WHERE NULLIF(btrim(rec->>'codigo_composicao'), '') IS NULL
       OR NULLIF(btrim(rec->>'codigo_item'), '') IS NULL
       OR upper(NULLIF(btrim(rec->>'tipo_item'), '')) NOT IN ('INSUMO', 'COMPOSICAO')
  ) THEN
    RAISE EXCEPTION 'Payload analítico contém item inválido';
  END IF;

  INSERT INTO public.catalogo_composicao_itens
    (codigo_composicao, fonte, tipo_item, codigo_item, coeficiente)
  SELECT btrim(rec->>'codigo_composicao'),
         upper(btrim(rec->>'fonte')),
         upper(btrim(rec->>'tipo_item')),
         btrim(rec->>'codigo_item'),
         COALESCE(NULLIF(replace(btrim(rec->>'coeficiente'), ',', '.'), '')::numeric, 0)
  FROM jsonb_array_elements(payload) rec
  ON CONFLICT (codigo_composicao, fonte, tipo_item, codigo_item)
  DO UPDATE SET coeficiente = EXCLUDED.coeficiente;
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_catalogo_composicao_itens_importacao(text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inserir_catalogo_composicao_itens_lote(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limpar_catalogo_composicao_itens_importacao(text, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inserir_catalogo_composicao_itens_lote(jsonb) TO authenticated, service_role;
