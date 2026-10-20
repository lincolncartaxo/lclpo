-- Tabela detalhada de encargos sociais por orçamento.
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS encargos_sociais jsonb,
  ADD COLUMN IF NOT EXISTS encargos_modalidade text NOT NULL DEFAULT 'horista';

ALTER TABLE public.orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_encargos_modalidade_check;

ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_encargos_modalidade_check
  CHECK (encargos_modalidade IN ('horista', 'mensalista'));
