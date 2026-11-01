-- A RPC substitui estruturas por (fonte, codigo_composicao). Este índice
-- evita varreduras quando o catálogo já possui muitos itens analíticos.
CREATE INDEX IF NOT EXISTS catalogo_composicao_itens_fonte_codigo_idx
  ON public.catalogo_composicao_itens (fonte, codigo_composicao);
