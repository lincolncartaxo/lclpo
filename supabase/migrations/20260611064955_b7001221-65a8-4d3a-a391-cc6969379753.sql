
UPDATE public.base_composicoes SET uf = NULL, mes_ref = NULL WHERE uf IS NOT NULL OR mes_ref IS NOT NULL;
UPDATE public.base_composicao_itens SET uf = NULL, mes_ref = NULL WHERE uf IS NOT NULL OR mes_ref IS NOT NULL;

DELETE FROM public.base_composicoes a
USING public.base_composicoes b
WHERE a.id < b.id AND a.fonte = b.fonte AND a.codigo = b.codigo;

DELETE FROM public.base_composicao_itens a
USING public.base_composicao_itens b
WHERE a.id < b.id
  AND a.fonte = b.fonte
  AND a.composicao_codigo = b.composicao_codigo
  AND COALESCE(a.insumo_codigo,'') = COALESCE(b.insumo_codigo,'');

CREATE UNIQUE INDEX IF NOT EXISTS base_composicoes_fonte_codigo_uniq
  ON public.base_composicoes (fonte, codigo);

CREATE UNIQUE INDEX IF NOT EXISTS base_composicao_itens_fonte_comp_insumo_uniq
  ON public.base_composicao_itens (fonte, composicao_codigo, COALESCE(insumo_codigo,''));

CREATE UNIQUE INDEX IF NOT EXISTS base_insumos_fonte_codigo_uf_mes_uniq
  ON public.base_insumos (fonte, codigo, COALESCE(uf,''), COALESCE(mes_ref::text, ''));

CREATE INDEX IF NOT EXISTS base_insumos_codigo_idx ON public.base_insumos (codigo);
CREATE INDEX IF NOT EXISTS base_composicao_itens_comp_idx ON public.base_composicao_itens (fonte, composicao_codigo);
