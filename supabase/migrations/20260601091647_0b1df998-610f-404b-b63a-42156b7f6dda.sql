
-- 1) Orçamento: regime tributário (desonerado / não desonerado)
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS regime text NOT NULL DEFAULT 'nao_desonerado'
    CHECK (regime IN ('desonerado','nao_desonerado'));

-- 2) Bases: substituir custo_unitario / preco pelas variantes desonerado / não desonerado.
-- Garante backfill antes do drop, caso ainda haja dados antigos.
UPDATE public.base_composicoes
  SET custo_nao_desonerado = COALESCE(custo_nao_desonerado, custo_unitario),
      custo_desonerado     = COALESCE(custo_desonerado, custo_unitario)
  WHERE custo_unitario IS NOT NULL;

ALTER TABLE public.base_composicoes DROP COLUMN IF EXISTS custo_unitario;

UPDATE public.base_insumos
  SET preco_nao_desonerado = COALESCE(preco_nao_desonerado, preco),
      preco_desonerado     = COALESCE(preco_desonerado, preco)
  WHERE preco IS NOT NULL;

ALTER TABLE public.base_insumos DROP COLUMN IF EXISTS preco;

-- 3) Composição → insumos (explosão / coeficientes)
CREATE TABLE IF NOT EXISTS public.base_composicao_itens (
  id bigserial PRIMARY KEY,
  fonte text NOT NULL,
  composicao_codigo text NOT NULL,
  insumo_codigo text,
  descricao text NOT NULL,
  unidade text,
  coeficiente numeric NOT NULL DEFAULT 0,
  preco_desonerado numeric,
  preco_nao_desonerado numeric,
  tipo text,
  uf text,
  mes_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_base_comp_itens_lookup
  ON public.base_composicao_itens (fonte, composicao_codigo, uf, mes_ref);

GRANT SELECT ON public.base_composicao_itens TO authenticated;
GRANT ALL ON public.base_composicao_itens TO service_role;

ALTER TABLE public.base_composicao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base comp itens read auth"
  ON public.base_composicao_itens
  FOR SELECT
  TO authenticated
  USING (true);
