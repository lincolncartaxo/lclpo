
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nome text,
  empresa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles self read" on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);
create policy "profiles self insert" on public.profiles for insert with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome) values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Bases (públicas para autenticados)
create table public.base_composicoes (
  id bigserial primary key,
  fonte text not null,                 -- 'SINAPI' | 'DER'
  codigo text not null,
  descricao text not null,
  unidade text,
  custo_unitario numeric(14,4),
  classe text,
  mes_ref text,
  created_at timestamptz not null default now()
);
create index on public.base_composicoes (fonte);
create index on public.base_composicoes (codigo);
create index on public.base_composicoes using gin (to_tsvector('portuguese', descricao));
alter table public.base_composicoes enable row level security;
create policy "base comp read auth" on public.base_composicoes for select to authenticated using (true);

create table public.base_insumos (
  id bigserial primary key,
  fonte text not null default 'SINAPI',
  codigo text not null,
  descricao text not null,
  unidade text,
  preco numeric(14,4),
  origem text,
  mes_ref text,
  created_at timestamptz not null default now()
);
create index on public.base_insumos (codigo);
create index on public.base_insumos using gin (to_tsvector('portuguese', descricao));
alter table public.base_insumos enable row level security;
create policy "base ins read auth" on public.base_insumos for select to authenticated using (true);

-- Orçamentos
create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  nome text not null,
  objeto text,
  contrato text,
  orgao text,
  municipio text,
  uf text,
  engenheiro text,
  crea text,
  ref_precos text,
  encargos_pct numeric(6,4) not null default 0.8785,
  bdi_pct numeric(6,4) not null default 0.2288,
  status text not null default 'rascunho',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orcamentos (user_id);
alter table public.orcamentos enable row level security;
create policy "orc owner all" on public.orcamentos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos on delete cascade,
  ordem int not null default 0,
  etapa text,                  -- agrupamento (ex.: "1 - Serviços Preliminares")
  item text,                   -- numeração (ex.: "1.1.1")
  fonte text,                  -- 'SINAPI' | 'DER' | 'COMP'
  codigo text,
  descricao text not null,
  unidade text,
  quantidade numeric(16,4) not null default 0,
  preco_unitario numeric(16,4) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.orcamento_itens (orcamento_id);
alter table public.orcamento_itens enable row level security;
create policy "orc itens owner" on public.orcamento_itens for all
  using (exists (select 1 from public.orcamentos o where o.id = orcamento_id and o.user_id = auth.uid()))
  with check (exists (select 1 from public.orcamentos o where o.id = orcamento_id and o.user_id = auth.uid()));

create table public.orcamento_cronograma (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos on delete cascade,
  etapa text not null,
  mes int not null,
  percentual numeric(7,4) not null default 0,
  created_at timestamptz not null default now(),
  unique (orcamento_id, etapa, mes)
);
alter table public.orcamento_cronograma enable row level security;
create policy "orc crono owner" on public.orcamento_cronograma for all
  using (exists (select 1 from public.orcamentos o where o.id = orcamento_id and o.user_id = auth.uid()))
  with check (exists (select 1 from public.orcamentos o where o.id = orcamento_id and o.user_id = auth.uid()));
