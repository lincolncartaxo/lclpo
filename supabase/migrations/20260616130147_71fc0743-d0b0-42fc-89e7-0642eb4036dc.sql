UPDATE public.base_insumos b
SET preco_desonerado = s.preco
FROM public._stage_insumos_cd s
WHERE b.fonte = s.fonte
  AND b.codigo = s.codigo
  AND b.uf = s.uf
  AND b.mes_ref::date = s.mes_ref;

INSERT INTO public.base_insumos (fonte, codigo, descricao, unidade, uf, mes_ref, preco_desonerado, origem, user_id)
SELECT s.fonte, s.codigo, s.descricao, NULLIF(s.unidade,''), s.uf, s.mes_ref::text, s.preco, s.origem, '00000000-0000-0000-0000-000000000000'::uuid
FROM public._stage_insumos_cd s
LEFT JOIN public.base_insumos b
  ON b.fonte = s.fonte AND b.codigo = s.codigo AND b.uf = s.uf AND b.mes_ref::date = s.mes_ref
WHERE b.id IS NULL;

DROP TABLE IF EXISTS public._stage_insumos_cd;