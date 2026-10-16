-- Permite distribuir o mesmo item na mesma frente em meses diferentes.
-- A combinação item + frente + mês passa a identificar uma distribuição.

ALTER TABLE public.orcamento_item_frentes
  DROP CONSTRAINT IF EXISTS orcamento_item_frentes_item_id_frente_id_key;

-- Registros antigos sem mês permanecem válidos como mês 1.
UPDATE public.orcamento_item_frentes
SET mes_conclusao = 1
WHERE mes_conclusao IS NULL;

ALTER TABLE public.orcamento_item_frentes
  ALTER COLUMN mes_conclusao SET DEFAULT 1,
  ALTER COLUMN mes_conclusao SET NOT NULL;

ALTER TABLE public.orcamento_item_frentes
  ADD CONSTRAINT orcamento_item_frentes_item_frente_mes_key
  UNIQUE (item_id, frente_id, mes_conclusao);

CREATE INDEX IF NOT EXISTS idx_orcamento_item_frentes_item_mes
  ON public.orcamento_item_frentes(item_id, mes_conclusao);
