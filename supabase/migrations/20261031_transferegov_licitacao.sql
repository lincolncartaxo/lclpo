-- Preferências e configuração comercial do orçamento.
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS interesse_transferegov boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.orcamento_licitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  valor_final numeric(18,6) NOT NULL CHECK (valor_final > 0),
  modo text NOT NULL DEFAULT 'linear' CHECK (modo IN ('linear', 'linear_2_casas')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orcamento_id)
);

ALTER TABLE public.orcamento_licitacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Licitação do orçamento" ON public.orcamento_licitacoes;
CREATE POLICY "Licitação do orçamento" ON public.orcamento_licitacoes FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.id = orcamento_id
    AND (o.user_id = auth.uid() OR public.is_organization_member(o.organization_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.id = orcamento_id
    AND (o.user_id = auth.uid() OR public.is_organization_member(o.organization_id))
));

CREATE INDEX IF NOT EXISTS idx_orcamento_licitacoes_orcamento
  ON public.orcamento_licitacoes(orcamento_id);
