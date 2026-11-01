-- Carga completa de uma fonte analítica: limpa a fonte em blocos sem o
-- statement_timeout padrão da API e permite inserir sem ON CONFLICT.
CREATE OR REPLACE FUNCTION public.limpar_catalogo_composicao_itens_importacao(
  p_fonte text,
  p_codigos text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  PERFORM public.assert_import_admin();
  IF NULLIF(btrim(p_fonte), '') IS NULL THEN
    RAISE EXCEPTION 'Fonte da importação analítica inválida';
  END IF;

  -- Esta função é executada em uma chamada administrativa dedicada. O limite
  -- padrão de statement não deve interromper a limpeza da base completa.
  PERFORM set_config('statement_timeout', '0', true);

  LOOP
    DELETE FROM public.catalogo_composicao_itens
     WHERE ctid IN (
       SELECT ctid
       FROM public.catalogo_composicao_itens
       WHERE fonte = upper(btrim(p_fonte))
       LIMIT 1000
     );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    EXIT WHEN v_deleted = 0;
  END LOOP;
END;
$$;
