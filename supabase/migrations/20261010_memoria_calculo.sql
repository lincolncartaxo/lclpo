ALTER TABLE public.orcamento_itens 
ADD COLUMN IF NOT EXISTS memoria JSONB DEFAULT '[]'::jsonb;
