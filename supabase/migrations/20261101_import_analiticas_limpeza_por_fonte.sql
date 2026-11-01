-- A importação do arquivo analítico representa a estrutura completa de uma
-- fonte. Limpar por uma lista com dezenas de milhares de códigos provoca
-- statement timeout; limpar pela fonte usa o índice fonte,codigo_composicao.
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

  -- O CSV analítico substitui a base inteira da fonte. O parâmetro p_codigos
  -- permanece na assinatura para compatibilidade com a versão anterior.
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
