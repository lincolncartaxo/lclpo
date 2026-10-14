-- Compatibilidade para bancos que receberam as migrations de orçamento fora de ordem.
-- A coluna é mantida separada de municipio para não confundir localização da obra
-- com a UF usada na seleção da base de preços.
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS localizacao text;

UPDATE public.orcamentos
SET localizacao = municipio
WHERE localizacao IS NULL
  AND municipio IS NOT NULL;
