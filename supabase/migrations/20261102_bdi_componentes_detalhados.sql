ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS bdi_cf numeric(8,4),
  ADD COLUMN IF NOT EXISTS bdi_pis numeric(8,4),
  ADD COLUMN IF NOT EXISTS bdi_cofins numeric(8,4),
  ADD COLUMN IF NOT EXISTS bdi_tax_inss numeric(8,4),
  ADD COLUMN IF NOT EXISTS bdi_tax_estadual numeric(8,4),
  ADD COLUMN IF NOT EXISTS bdi_iss numeric(8,4);

-- Defaults para novos orçamentos: reproduzem o modelo BDI anexado
-- (AC 5,50; MI 2,07; CF 1,39; MC 6,38; T 6,15; BDI 23,63%).
-- A alteração de DEFAULT não sobrescreve valores já gravados.
ALTER TABLE public.orcamentos
  ALTER COLUMN bdi_pct SET DEFAULT 0.2363,
  ALTER COLUMN bdi_ac SET DEFAULT 5.5000,
  ALTER COLUMN bdi_s SET DEFAULT 2.0700,
  ALTER COLUMN bdi_r SET DEFAULT 0,
  ALTER COLUMN bdi_g SET DEFAULT 0,
  ALTER COLUMN bdi_l SET DEFAULT 6.3800,
  ALTER COLUMN bdi_i SET DEFAULT 6.1500,
  ALTER COLUMN bdi_cf SET DEFAULT 1.3900,
  ALTER COLUMN bdi_pis SET DEFAULT 0.6500,
  ALTER COLUMN bdi_cofins SET DEFAULT 3.0000,
  ALTER COLUMN bdi_tax_inss SET DEFAULT 0,
  ALTER COLUMN bdi_tax_estadual SET DEFAULT 0,
  ALTER COLUMN bdi_iss SET DEFAULT 2.5000;

COMMENT ON COLUMN public.orcamentos.bdi_cf IS 'Custo financeiro do BDI, percentual informado pelo usuário.';
COMMENT ON COLUMN public.orcamentos.bdi_pis IS 'Alíquota de PIS que compõe os tributos federais do BDI.';
COMMENT ON COLUMN public.orcamentos.bdi_cofins IS 'Alíquota de COFINS que compõe os tributos federais do BDI.';
COMMENT ON COLUMN public.orcamentos.bdi_tax_inss IS 'Alíquota de INSS que compõe os tributos federais do BDI.';
COMMENT ON COLUMN public.orcamentos.bdi_tax_estadual IS 'Total das alíquotas de tributos estaduais do BDI.';
COMMENT ON COLUMN public.orcamentos.bdi_iss IS 'Alíquota de ISS/tributos municipais do BDI.';

-- Mantém os parâmetros do BDI ao duplicar um orçamento. Campos novos em
-- orçamentos antigos permanecem NULL até serem salvos pelo formulário.
CREATE OR REPLACE FUNCTION public.duplicar_orcamento(p_orcamento_id uuid, p_nome text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new uuid;
  v_src public.orcamentos%ROWTYPE;
BEGIN
  SELECT * INTO v_src
  FROM public.orcamentos
  WHERE id = p_orcamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado ou sem permissão';
  END IF;

  IF NOT (public.is_organization_member(v_src.organization_id) OR v_src.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para duplicar este orçamento';
  END IF;

  INSERT INTO public.orcamentos (
    user_id, nome, objeto, contrato, orgao, municipio, uf, engenheiro, crea,
    ref_precos, encargos_pct, bdi_pct, bdi_ac, bdi_s, bdi_r, bdi_g, bdi_l, bdi_i,
    bdi_cf, bdi_pis, bdi_cofins, bdi_tax_inss, bdi_tax_estadual, bdi_iss, status
  )
  VALUES (
    auth.uid(), COALESCE(NULLIF(p_nome, ''), v_src.nome || ' - Cópia'), v_src.objeto,
    v_src.contrato, v_src.orgao, v_src.municipio, v_src.uf, v_src.engenheiro, v_src.crea,
    v_src.ref_precos, v_src.encargos_pct, v_src.bdi_pct, v_src.bdi_ac, v_src.bdi_s,
    v_src.bdi_r, v_src.bdi_g, v_src.bdi_l, v_src.bdi_i, v_src.bdi_cf, v_src.bdi_pis,
    v_src.bdi_cofins, v_src.bdi_tax_inss, v_src.bdi_tax_estadual, v_src.bdi_iss, 'rascunho'
  )
  RETURNING id INTO v_new;

  INSERT INTO public.orcamento_itens (
    orcamento_id, ordem, etapa, item, fonte, codigo, descricao, unidade, quantidade, preco_unitario
  )
  SELECT v_new, ordem, etapa, item, fonte, codigo, descricao, unidade, quantidade, preco_unitario
  FROM public.orcamento_itens
  WHERE orcamento_id = p_orcamento_id;

  INSERT INTO public.orcamento_cronograma (orcamento_id, etapa, mes, percentual)
  SELECT v_new, etapa, mes, percentual
  FROM public.orcamento_cronograma
  WHERE orcamento_id = p_orcamento_id;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.duplicar_orcamento(uuid, text) TO authenticated;
