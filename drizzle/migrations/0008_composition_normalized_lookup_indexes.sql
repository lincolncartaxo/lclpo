CREATE INDEX IF NOT EXISTS catalogo_composicoes_normalized_lookup_idx ON public.catalogo_composicoes (fonte, (ltrim(codigo, '0')));
CREATE INDEX IF NOT EXISTS precos_insumos_normalized_lookup_idx ON public.precos_historicos_insumos (fonte, (ltrim(codigo_insumo, '0')), uf, mes_ref);
CREATE INDEX IF NOT EXISTS precos_composicoes_normalized_lookup_idx ON public.precos_historicos_composicoes (fonte, (ltrim(codigo_composicao, '0')), uf, mes_ref);
CREATE INDEX IF NOT EXISTS precos_insumos_normalized_source_idx ON public.precos_historicos_insumos ((ltrim(codigo_insumo, '0')), uf, mes_ref);
CREATE INDEX IF NOT EXISTS catalogo_composicoes_normalized_source_idx ON public.catalogo_composicoes ((ltrim(codigo, '0')), fonte);