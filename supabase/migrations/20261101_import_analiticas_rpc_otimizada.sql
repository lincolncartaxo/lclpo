-- Versão enxuta da RPC usada pelos lotes pequenos do importador.
-- O frontend já valida e deduplica as linhas; aqui evitamos varrer o JSON
-- duas vezes antes do INSERT.
CREATE OR REPLACE FUNCTION public.inserir_catalogo_composicao_itens_lote(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_import_admin();
  INSERT INTO public.catalogo_composicao_itens
    (codigo_composicao, fonte, tipo_item, codigo_item, coeficiente)
  SELECT btrim(rec.codigo_composicao),
         upper(btrim(rec.fonte)),
         upper(btrim(rec.tipo_item)),
         btrim(rec.codigo_item),
         COALESCE(NULLIF(replace(btrim(rec.coeficiente), ',', '.'), '')::numeric, 0)
  FROM jsonb_to_recordset(payload) AS rec(
    codigo_composicao text,
    fonte text,
    tipo_item text,
    codigo_item text,
    coeficiente text
  )
  WHERE NULLIF(btrim(rec.codigo_composicao), '') IS NOT NULL
    AND NULLIF(btrim(rec.codigo_item), '') IS NOT NULL
    AND upper(NULLIF(btrim(rec.tipo_item), '')) IN ('INSUMO', 'COMPOSICAO')
  ON CONFLICT (codigo_composicao, fonte, tipo_item, codigo_item)
  DO UPDATE SET coeficiente = EXCLUDED.coeficiente;
END;
$$;
