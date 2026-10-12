-- Compatibilidade entre instalações antigas e o catálogo novo.
ALTER TABLE IF EXISTS public.catalogo_insumos
  ADD COLUMN IF NOT EXISTS origem varchar(50);
