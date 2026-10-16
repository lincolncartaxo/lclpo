-- Estrutura PLE: eventos, frentes de obra e distribuição dos itens.
-- Compatível com orçamentos existentes: os novos campos são opcionais.

ALTER TABLE public.orcamento_itens
  ADD COLUMN IF NOT EXISTS evento_id uuid;

CREATE TABLE IF NOT EXISTS public.orcamento_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  titulo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orcamento_id, numero),
  UNIQUE (orcamento_id, titulo)
);

CREATE TABLE IF NOT EXISTS public.orcamento_frentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orcamento_id, numero),
  UNIQUE (orcamento_id, nome)
);

CREATE TABLE IF NOT EXISTS public.orcamento_item_frentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.orcamento_itens(id) ON DELETE CASCADE,
  frente_id uuid NOT NULL REFERENCES public.orcamento_frentes(id) ON DELETE CASCADE,
  quantidade numeric(16,4) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  mes_conclusao integer CHECK (mes_conclusao IS NULL OR mes_conclusao > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, frente_id)
);

ALTER TABLE public.orcamento_itens
  DROP CONSTRAINT IF EXISTS orcamento_itens_evento_id_fkey;
ALTER TABLE public.orcamento_itens
  ADD CONSTRAINT orcamento_itens_evento_id_fkey
  FOREIGN KEY (evento_id) REFERENCES public.orcamento_eventos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orcamento_eventos_orcamento ON public.orcamento_eventos(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_frentes_orcamento ON public.orcamento_frentes(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_item_frentes_item ON public.orcamento_item_frentes(item_id);

ALTER TABLE public.orcamento_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_frentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_item_frentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PLE eventos do orçamento" ON public.orcamento_eventos;
CREATE POLICY "PLE eventos do orçamento" ON public.orcamento_eventos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id AND (o.user_id = auth.uid() OR public.is_organization_member(o.organization_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id AND (o.user_id = auth.uid() OR public.is_organization_member(o.organization_id))));

DROP POLICY IF EXISTS "PLE frentes do orçamento" ON public.orcamento_frentes;
CREATE POLICY "PLE frentes do orçamento" ON public.orcamento_frentes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id AND (o.user_id = auth.uid() OR public.is_organization_member(o.organization_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id AND (o.user_id = auth.uid() OR public.is_organization_member(o.organization_id))));

DROP POLICY IF EXISTS "PLE distribuição do orçamento" ON public.orcamento_item_frentes;
CREATE POLICY "PLE distribuição do orçamento" ON public.orcamento_item_frentes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id AND (o.user_id = auth.uid() OR public.is_organization_member(o.organization_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id AND (o.user_id = auth.uid() OR public.is_organization_member(o.organization_id))));

-- Permite que o vínculo de evento acompanhe as mesmas regras dos itens existentes.
COMMENT ON COLUMN public.orcamento_itens.evento_id IS 'Evento PLE ao qual o item pertence';
