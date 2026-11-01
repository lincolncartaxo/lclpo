-- Importação de composição analítica:
-- cada código de composição representa uma estrutura única, sem variação por data-base.
-- A data-base altera os preços dos insumos, não os coeficientes.
CREATE OR REPLACE FUNCTION public.upsert_catalogo_composicao_itens_lote(payload jsonb)
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

  -- O frontend já elimina cabeçalhos e agrupa por composição. Esta validação
  -- também protege chamadas diretas à RPC contra linhas sem código.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(payload) rec
    WHERE NULLIF(btrim(rec->>'codigo_composicao'), '') IS NULL
       OR NULLIF(btrim(rec->>'codigo_item'), '') IS NULL
       OR upper(NULLIF(btrim(rec->>'tipo_item'), '')) NOT IN ('INSUMO', 'COMPOSICAO')
  ) THEN
    RAISE EXCEPTION 'Payload analítico contém item sem código de composição, código do item ou tipo válido';
  END IF;

  -- Remove a estrutura anterior inteira para os códigos recebidos. Assim,
  -- itens que deixaram de existir na nova versão não ficam resíduos no banco.
  DELETE FROM public.catalogo_composicao_itens ci
  USING (
    SELECT DISTINCT btrim(rec->>'codigo_composicao') AS codigo_composicao,
           upper(btrim(rec->>'fonte')) AS fonte
    FROM jsonb_array_elements(payload) rec
  ) incoming
  WHERE ci.codigo_composicao = incoming.codigo_composicao
    AND ci.fonte = incoming.fonte;

  INSERT INTO public.catalogo_composicao_itens
    (codigo_composicao, fonte, tipo_item, codigo_item, coeficiente)
  SELECT btrim(rec->>'codigo_composicao'),
         upper(btrim(rec->>'fonte')),
         upper(btrim(rec->>'tipo_item')),
         btrim(rec->>'codigo_item'),
         COALESCE(NULLIF(replace(btrim(rec->>'coeficiente'), ',', '.'), '')::numeric, 0)
  FROM jsonb_array_elements(payload) rec;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_catalogo_composicao_itens_lote(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_catalogo_composicao_itens_lote(jsonb) TO authenticated, service_role;
