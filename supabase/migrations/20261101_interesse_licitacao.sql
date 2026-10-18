ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS interesse_licitacao boolean NOT NULL DEFAULT false;
