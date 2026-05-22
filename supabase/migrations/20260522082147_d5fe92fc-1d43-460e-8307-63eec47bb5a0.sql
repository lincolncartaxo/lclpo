
ALTER TABLE public.base_composicoes
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS custo_desonerado numeric,
  ADD COLUMN IF NOT EXISTS custo_nao_desonerado numeric;

ALTER TABLE public.base_insumos
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS preco_desonerado numeric,
  ADD COLUMN IF NOT EXISTS preco_nao_desonerado numeric;

CREATE INDEX IF NOT EXISTS idx_base_comp_filtros ON public.base_composicoes (fonte, uf, mes_ref);
CREATE INDEX IF NOT EXISTS idx_base_ins_filtros ON public.base_insumos (fonte, uf, mes_ref);
