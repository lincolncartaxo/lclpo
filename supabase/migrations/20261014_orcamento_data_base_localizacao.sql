ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS localizacao text;
UPDATE public.orcamentos SET localizacao = municipio WHERE localizacao IS NULL AND municipio IS NOT NULL;

-- Garante que novas consultas possam escolher a base mais recente disponível.
CREATE OR REPLACE FUNCTION public.listar_bases_precos(p_uf text)
RETURNS TABLE(fonte varchar, mes_ref varchar)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT p.fonte, p.mes_ref
  FROM public.precos_historicos_insumos p
  WHERE upper(p.uf) IN (upper(p_uf), 'BR')
  ORDER BY p.mes_ref DESC, p.fonte;
$$;
GRANT EXECUTE ON FUNCTION public.listar_bases_precos(text) TO authenticated;
