-- Compatibilidade com versões do frontend que ainda enviam as linhas
-- marcadoras (codigo_composicao;;;). Elas não representam itens analíticos.
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

  -- Linhas sem código do item/tipo são marcadores de composição e devem ser
  -- ignoradas. Um tipo diferente de INSUMO/COMPOSICAO em uma linha completa
  -- continua sendo erro para não gravar estrutura corrompida.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(payload) rec
    WHERE NULLIF(btrim(rec->>'codigo_composicao'), '') IS NOT NULL
      AND NULLIF(btrim(rec->>'codigo_item'), '') IS NOT NULL
      AND upper(NULLIF(btrim(rec->>'tipo_item'), '')) NOT IN ('INSUMO', 'COMPOSICAO')
  ) THEN
    RAISE EXCEPTION 'Payload analítico contém tipo de item inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(payload) rec
    WHERE NULLIF(btrim(rec->>'codigo_composicao'), '') IS NOT NULL
      AND NULLIF(btrim(rec->>'codigo_item'), '') IS NOT NULL
      AND upper(NULLIF(btrim(rec->>'tipo_item'), '')) IN ('INSUMO', 'COMPOSICAO')
  ) THEN
    RAISE EXCEPTION 'Payload analítico não contém itens válidos';
  END IF;

  -- A composição não varia por data-base. Para cada código recebido,
  -- substitui-se a estrutura anterior inteira, removendo itens obsoletos.
  DELETE FROM public.catalogo_composicao_itens ci
  USING (
    SELECT DISTINCT btrim(rec->>'codigo_composicao') AS codigo_composicao,
           upper(btrim(rec->>'fonte')) AS fonte
    FROM jsonb_array_elements(payload) rec
    WHERE NULLIF(btrim(rec->>'codigo_composicao'), '') IS NOT NULL
      AND NULLIF(btrim(rec->>'codigo_item'), '') IS NOT NULL
      AND upper(NULLIF(btrim(rec->>'tipo_item'), '')) IN ('INSUMO', 'COMPOSICAO')
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
  FROM jsonb_array_elements(payload) rec
  WHERE NULLIF(btrim(rec->>'codigo_composicao'), '') IS NOT NULL
    AND NULLIF(btrim(rec->>'codigo_item'), '') IS NOT NULL
    AND upper(NULLIF(btrim(rec->>'tipo_item'), '')) IN ('INSUMO', 'COMPOSICAO');
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_catalogo_composicao_itens_lote(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_catalogo_composicao_itens_lote(jsonb) TO authenticated, service_role;
