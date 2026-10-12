CREATE OR REPLACE FUNCTION public.listar_bases_precos(p_uf text)
 RETURNS TABLE(fonte character varying, mes_ref character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.fonte, p.mes_ref
  FROM public.precos_historicos_insumos p
  WHERE p.uf = p_uf OR p.uf = 'BR'
  ORDER BY p.fonte, p.mes_ref DESC;
END;
$function$;
