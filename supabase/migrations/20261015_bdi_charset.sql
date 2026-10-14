ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS bdi_ac numeric(8,4) NOT NULL DEFAULT 4.0,
  ADD COLUMN IF NOT EXISTS bdi_s numeric(8,4) NOT NULL DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS bdi_r numeric(8,4) NOT NULL DEFAULT 0.97,
  ADD COLUMN IF NOT EXISTS bdi_g numeric(8,4) NOT NULL DEFAULT 8.04,
  ADD COLUMN IF NOT EXISTS bdi_l numeric(8,4) NOT NULL DEFAULT 6.16,
  ADD COLUMN IF NOT EXISTS bdi_i numeric(8,4) NOT NULL DEFAULT 5.0;

-- Registros já gravados como “�” não podem ser reconstruídos com segurança sem a fonte original.
-- Reimporte os CSVs originais após a correção de charset da tela administrativa.
