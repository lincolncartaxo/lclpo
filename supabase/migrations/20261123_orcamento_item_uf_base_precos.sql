-- Permite combinar bases/UFs diferentes no mesmo orçamento.
-- NULL significa: usar orcamentos.uf_precos; se também for NULL, usar orcamentos.uf.
alter table public.orcamento_itens
  add column if not exists uf_precos text null;

comment on column public.orcamento_itens.uf_precos is
  'UF da referência de preços deste item. NULL usa a UF padrão do orçamento.';

alter table public.orcamento_itens
  drop constraint if exists orcamento_itens_uf_precos_check;

alter table public.orcamento_itens
  add constraint orcamento_itens_uf_precos_check
  check (uf_precos is null or uf_precos = 'BR' or uf_precos in (
    'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA',
    'PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
  ));
