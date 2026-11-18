-- Persiste configurações do orçamento que antes ficavam somente no navegador.
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS cronograma_meses integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS contrapartida_pct numeric(7,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orcamentos.cronograma_meses IS 'Quantidade de meses exibida no cronograma físico-financeiro.';
COMMENT ON COLUMN public.orcamentos.contrapartida_pct IS 'Percentual de contrapartida usado no QCI, de 0 a 100.';

ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_cronograma_meses_range CHECK (cronograma_meses BETWEEN 1 AND 36),
  ADD CONSTRAINT orcamentos_contrapartida_pct_range CHECK (contrapartida_pct BETWEEN 0 AND 100);
