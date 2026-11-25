-- Separa a UF do empreendimento da UF usada como referência de preços.
-- Compatibilidade: registros antigos mantêm o comportamento anterior porque a
-- aplicação usa COALESCE(uf_precos, uf) ao consultar preços.
alter table public.orcamentos
  add column if not exists uf_precos text null;

comment on column public.orcamentos.uf_precos is
  'UF da base de preços adotada no orçamento. NULL mantém compatibilidade e usa a UF do empreendimento.';

alter table public.orcamentos
  drop constraint if exists orcamentos_uf_precos_check;

alter table public.orcamentos
  add constraint orcamentos_uf_precos_check
  check (uf_precos is null or uf_precos = 'BR' or uf_precos in (
    'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA',
    'PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
  ));
