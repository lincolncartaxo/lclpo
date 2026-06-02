ALTER TABLE public.base_composicao_itens
  DROP COLUMN IF EXISTS preco_desonerado,
  DROP COLUMN IF EXISTS preco_nao_desonerado;