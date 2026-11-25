-- Cotações corporativas reutilizáveis nos orçamentos da empresa.
CREATE TABLE IF NOT EXISTS public.cotacoes_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  orcamento_id uuid NULL REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  tipo_item text NOT NULL DEFAULT 'servico' CHECK (tipo_item IN ('servico','material','insumo','composicao')),
  codigo text NULL,
  fonte text NULL,
  descricao text NOT NULL CHECK (btrim(descricao) <> ''),
  unidade text NOT NULL DEFAULT 'UN' CHECK (btrim(unidade) <> ''),
  data_cotacao date NOT NULL DEFAULT current_date,
  quantidade_propostas_desejadas integer NOT NULL DEFAULT 3 CHECK (quantidade_propostas_desejadas > 0),
  metodo_calculo text NOT NULL DEFAULT 'mediana' CHECK (metodo_calculo IN ('mediana','media','menor')),
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cotacao_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes_empresa(id) ON DELETE CASCADE,
  descricao text NULL,
  unidade text NOT NULL DEFAULT 'UN' CHECK (btrim(unidade) <> ''),
  data_proposta date NOT NULL DEFAULT current_date,
  fornecedor_nome text NOT NULL CHECK (btrim(fornecedor_nome) <> ''),
  fornecedor_cnpj text NULL,
  fornecedor_contato text NULL,
  fornecedor_email text NULL,
  nome_contato text NULL,
  valor numeric(18,4) NOT NULL CHECK (valor >= 0),
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamento_itens
  ADD COLUMN IF NOT EXISTS cotacao_id uuid NULL REFERENCES public.cotacoes_empresa(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cotacoes_empresa_org_idx ON public.cotacoes_empresa(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS cotacoes_empresa_orcamento_idx ON public.cotacoes_empresa(orcamento_id);
CREATE INDEX IF NOT EXISTS cotacao_propostas_cotacao_idx ON public.cotacao_propostas(cotacao_id, data_proposta);
CREATE INDEX IF NOT EXISTS orcamento_itens_cotacao_idx ON public.orcamento_itens(cotacao_id);

CREATE OR REPLACE FUNCTION public.touch_cotacoes_empresa_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS touch_cotacoes_empresa_updated_at ON public.cotacoes_empresa;
CREATE TRIGGER touch_cotacoes_empresa_updated_at
BEFORE UPDATE ON public.cotacoes_empresa FOR EACH ROW
EXECUTE FUNCTION public.touch_cotacoes_empresa_updated_at();

ALTER TABLE public.cotacoes_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_propostas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotacoes_empresa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotacao_propostas TO authenticated;

DROP POLICY IF EXISTS "cotacoes empresa membros" ON public.cotacoes_empresa;
CREATE POLICY "cotacoes empresa membros" ON public.cotacoes_empresa
FOR ALL TO authenticated
USING (public.is_organization_member(organization_id))
WITH CHECK (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS "propostas cotacao empresa membros" ON public.cotacao_propostas;
CREATE POLICY "propostas cotacao empresa membros" ON public.cotacao_propostas
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.cotacoes_empresa c WHERE c.id = cotacao_id AND public.is_organization_member(c.organization_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.cotacoes_empresa c WHERE c.id = cotacao_id AND public.is_organization_member(c.organization_id)));

CREATE OR REPLACE FUNCTION public.calcular_cotacao(p_cotacao_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_metodo text;
  v_result numeric;
BEGIN
  SELECT organization_id, metodo_calculo INTO v_org, v_metodo
  FROM public.cotacoes_empresa WHERE id = p_cotacao_id;
  IF v_org IS NULL OR NOT public.is_organization_member(v_org) THEN
    RAISE EXCEPTION 'Cotação não encontrada ou sem acesso';
  END IF;
  IF v_metodo = 'menor' THEN
    SELECT min(valor) INTO v_result FROM public.cotacao_propostas WHERE cotacao_id = p_cotacao_id;
  ELSIF v_metodo = 'media' THEN
    SELECT avg(valor) INTO v_result FROM public.cotacao_propostas WHERE cotacao_id = p_cotacao_id;
  ELSE
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY valor) INTO v_result
    FROM public.cotacao_propostas WHERE cotacao_id = p_cotacao_id;
  END IF;
  RETURN round(COALESCE(v_result, 0), 4);
END;
$$;
REVOKE ALL ON FUNCTION public.calcular_cotacao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calcular_cotacao(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.aplicar_cotacao_orcamento(p_cotacao_id uuid, p_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cotacao public.cotacoes_empresa;
  v_item public.orcamento_itens;
  v_preco numeric;
BEGIN
  SELECT * INTO v_cotacao FROM public.cotacoes_empresa WHERE id = p_cotacao_id;
  SELECT * INTO v_item FROM public.orcamento_itens WHERE id = p_item_id;
  IF v_cotacao.id IS NULL OR v_item.id IS NULL OR NOT public.is_organization_member(v_cotacao.organization_id) THEN
    RAISE EXCEPTION 'Cotação ou item não encontrado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = v_item.orcamento_id AND o.organization_id = v_cotacao.organization_id) THEN
    RAISE EXCEPTION 'O item não pertence à empresa da cotação';
  END IF;
  v_preco := public.calcular_cotacao(p_cotacao_id);
  IF v_preco <= 0 THEN RAISE EXCEPTION 'A cotação ainda não possui propostas com valor'; END IF;
  UPDATE public.orcamento_itens
  SET cotacao_id = p_cotacao_id, preco_unitario = v_preco, fonte = 'COTAÇÃO'
  WHERE id = p_item_id;
END;
$$;
REVOKE ALL ON FUNCTION public.aplicar_cotacao_orcamento(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aplicar_cotacao_orcamento(uuid, uuid) TO authenticated;
