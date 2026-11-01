-- Correção da migration de limpeza da fonte analítica.
-- Execute este arquivo no lugar da versão anterior.
CREATE OR REPLACE FUNCTION public.limpar_catalogo_composicao_itens_importacao(
  p_fonte text,
  p_codigos text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  PERFORM public.assert_import_admin();

  IF NULLIF(btrim(p_fonte), '') IS NULL THEN
    RAISE EXCEPTION 'Fonte da importação analítica inválida';
  END IF;

  -- A chamada é administrativa e o limite padrão da API não deve cancelar
  -- a limpeza da fonte completa.
  PERFORM set_config('statement_timeout', '0', true);

  DELETE FROM public.catalogo_composicao_itens
   WHERE fonte = upper(btrim(p_fonte));
END;
$function$;

REVOKE ALL ON FUNCTION public.limpar_catalogo_composicao_itens_importacao(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limpar_catalogo_composicao_itens_importacao(text, text[]) TO authenticated, service_role;
