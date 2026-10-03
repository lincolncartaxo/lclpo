CREATE INDEX IF NOT EXISTS idx_base_insumos_uf_fonte_mes ON public.base_insumos(uf, fonte, mes_ref);
CREATE OR REPLACE FUNCTION public.listar_bases_precos(p_uf text)
RETURNS TABLE(fonte text, mes_ref date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT b.fonte, b.mes_ref::date FROM public.base_insumos b
  WHERE b.uf = p_uf AND b.mes_ref IS NOT NULL
  ORDER BY 2 DESC, 1;
$$;
GRANT EXECUTE ON FUNCTION public.listar_bases_precos(text) TO authenticated;