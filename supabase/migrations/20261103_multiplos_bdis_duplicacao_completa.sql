-- Permite vários perfis de BDI por orçamento e a escolha do perfil em cada item.
CREATE TABLE IF NOT EXISTS public.orcamento_bdis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  bdi_pct numeric(12,8) NOT NULL DEFAULT 0,
  bdi_ac numeric(8,4) NOT NULL DEFAULT 0,
  bdi_s numeric(8,4) NOT NULL DEFAULT 0,
  bdi_r numeric(8,4) NOT NULL DEFAULT 0,
  bdi_g numeric(8,4) NOT NULL DEFAULT 0,
  bdi_l numeric(8,4) NOT NULL DEFAULT 0,
  bdi_i numeric(8,4) NOT NULL DEFAULT 0,
  bdi_cf numeric(8,4),
  bdi_pis numeric(8,4),
  bdi_cofins numeric(8,4),
  bdi_tax_inss numeric(8,4),
  bdi_tax_estadual numeric(8,4),
  bdi_iss numeric(8,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orcamento_id, nome)
);
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS bdi_id uuid;
ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_bdi_id_fkey;
ALTER TABLE public.orcamento_itens ADD CONSTRAINT orcamento_itens_bdi_id_fkey FOREIGN KEY (bdi_id) REFERENCES public.orcamento_bdis(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orcamento_bdis_orcamento ON public.orcamento_bdis(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_bdi ON public.orcamento_itens(bdi_id);

ALTER TABLE public.orcamento_bdis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BDIs do orçamento" ON public.orcamento_bdis;
CREATE POLICY "BDIs do orçamento" ON public.orcamento_bdis FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id AND (o.user_id = auth.uid() OR public.is_organization_member(o.organization_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_id AND (o.user_id = auth.uid() OR public.is_organization_member(o.organization_id))));

-- Migra o BDI legado de cada orçamento para um perfil inicial e o aplica aos itens antigos.
DO $$
DECLARE r record; v_bdi uuid;
BEGIN
  FOR r IN SELECT * FROM public.orcamentos LOOP
    SELECT id INTO v_bdi FROM public.orcamento_bdis WHERE orcamento_id = r.id ORDER BY created_at LIMIT 1;
    IF v_bdi IS NULL THEN
      INSERT INTO public.orcamento_bdis (orcamento_id, nome, bdi_pct, bdi_ac, bdi_s, bdi_r, bdi_g, bdi_l, bdi_i, bdi_cf, bdi_pis, bdi_cofins, bdi_tax_inss, bdi_tax_estadual, bdi_iss)
      VALUES (r.id, 'BDI padrão', COALESCE(r.bdi_pct, 0), COALESCE(r.bdi_ac, 0), COALESCE(r.bdi_s, 0), COALESCE(r.bdi_r, 0), COALESCE(r.bdi_g, 0), COALESCE(r.bdi_l, 0), COALESCE(r.bdi_i, 0), r.bdi_cf, r.bdi_pis, r.bdi_cofins, r.bdi_tax_inss, r.bdi_tax_estadual, r.bdi_iss)
      RETURNING id INTO v_bdi;
    END IF;
    UPDATE public.orcamento_itens SET bdi_id = v_bdi WHERE orcamento_id = r.id AND bdi_id IS NULL;
  END LOOP;
END $$;

-- A RPC é transacional e duplica configurações, memória, vínculos PLE, cronograma,
-- licitação e perfis de BDI, além dos dados da aba Orçamento.
CREATE OR REPLACE FUNCTION public.duplicar_orcamento(p_orcamento_id uuid, p_nome text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new uuid; v_src public.orcamentos%ROWTYPE;
BEGIN
  SELECT * INTO v_src FROM public.orcamentos WHERE id = p_orcamento_id;
  IF NOT FOUND OR NOT (v_src.user_id = auth.uid() OR public.is_organization_member(v_src.organization_id)) THEN
    RAISE EXCEPTION 'Orçamento não encontrado ou sem permissão';
  END IF;
  INSERT INTO public.orcamentos (user_id, organization_id, nome, objeto, contrato, orgao, municipio, localizacao, uf, engenheiro, crea, ref_precos, regime, encargos_pct, encargos_modalidade, encargos_sociais, bdi_pct, bdi_ac, bdi_s, bdi_r, bdi_g, bdi_l, bdi_i, bdi_cf, bdi_pis, bdi_cofins, bdi_tax_inss, bdi_tax_estadual, bdi_iss, interesse_transferegov, interesse_licitacao, status)
  VALUES (auth.uid(), v_src.organization_id, COALESCE(NULLIF(p_nome, ''), v_src.nome || ' - Cópia'), v_src.objeto, v_src.contrato, v_src.orgao, v_src.municipio, v_src.localizacao, v_src.uf, v_src.engenheiro, v_src.crea, v_src.ref_precos, v_src.regime, v_src.encargos_pct, v_src.encargos_modalidade, v_src.encargos_sociais, v_src.bdi_pct, v_src.bdi_ac, v_src.bdi_s, v_src.bdi_r, v_src.bdi_g, v_src.bdi_l, v_src.bdi_i, v_src.bdi_cf, v_src.bdi_pis, v_src.bdi_cofins, v_src.bdi_tax_inss, v_src.bdi_tax_estadual, v_src.bdi_iss, v_src.interesse_transferegov, v_src.interesse_licitacao, 'rascunho') RETURNING id INTO v_new;

  CREATE TEMP TABLE _bdi_map(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  INSERT INTO public.orcamento_bdis (orcamento_id, nome, bdi_pct, bdi_ac, bdi_s, bdi_r, bdi_g, bdi_l, bdi_i, bdi_cf, bdi_pis, bdi_cofins, bdi_tax_inss, bdi_tax_estadual, bdi_iss)
  SELECT v_new, nome, bdi_pct, bdi_ac, bdi_s, bdi_r, bdi_g, bdi_l, bdi_i, bdi_cf, bdi_pis, bdi_cofins, bdi_tax_inss, bdi_tax_estadual, bdi_iss FROM public.orcamento_bdis WHERE orcamento_id = p_orcamento_id;
  INSERT INTO _bdi_map SELECT old.id, new.id FROM public.orcamento_bdis old JOIN public.orcamento_bdis new ON new.orcamento_id = v_new AND new.nome = old.nome WHERE old.orcamento_id = p_orcamento_id;

  CREATE TEMP TABLE _item_map(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  INSERT INTO public.orcamento_itens (orcamento_id, ordem, etapa, item, fonte, codigo, descricao, unidade, quantidade, preco_unitario, memoria, evento_id, bdi_id)
  SELECT v_new, i.ordem, i.etapa, i.item, i.fonte, i.codigo, i.descricao, i.unidade, i.quantidade, i.preco_unitario, i.memoria, NULL, bm.new_id FROM public.orcamento_itens i LEFT JOIN _bdi_map bm ON bm.old_id = i.bdi_id WHERE i.orcamento_id = p_orcamento_id;
  INSERT INTO _item_map SELECT old.id, new.id FROM public.orcamento_itens old JOIN public.orcamento_itens new ON new.orcamento_id = v_new AND new.ordem = old.ordem WHERE old.orcamento_id = p_orcamento_id;

  CREATE TEMP TABLE _event_map(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  INSERT INTO public.orcamento_eventos (orcamento_id, numero, titulo) SELECT v_new, numero, titulo FROM public.orcamento_eventos WHERE orcamento_id = p_orcamento_id;
  INSERT INTO _event_map SELECT old.id, new.id FROM public.orcamento_eventos old JOIN public.orcamento_eventos new ON new.orcamento_id = v_new AND new.numero = old.numero WHERE old.orcamento_id = p_orcamento_id;
  UPDATE public.orcamento_itens ni SET evento_id = em.new_id FROM _item_map im JOIN public.orcamento_itens oi ON oi.id = im.old_id JOIN _event_map em ON em.old_id = oi.evento_id WHERE ni.id = im.new_id;

  CREATE TEMP TABLE _front_map(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  INSERT INTO public.orcamento_frentes (orcamento_id, numero, nome) SELECT v_new, numero, nome FROM public.orcamento_frentes WHERE orcamento_id = p_orcamento_id;
  INSERT INTO _front_map SELECT old.id, new.id FROM public.orcamento_frentes old JOIN public.orcamento_frentes new ON new.orcamento_id = v_new AND new.numero = old.numero WHERE old.orcamento_id = p_orcamento_id;
  INSERT INTO public.orcamento_item_frentes (orcamento_id, item_id, frente_id, quantidade, mes_conclusao)
  SELECT v_new, im.new_id, fm.new_id, f.quantidade, f.mes_conclusao FROM public.orcamento_item_frentes f JOIN _item_map im ON im.old_id=f.item_id JOIN _front_map fm ON fm.old_id=f.frente_id WHERE f.orcamento_id=p_orcamento_id;
  INSERT INTO public.orcamento_cronograma (orcamento_id, etapa, mes, percentual) SELECT v_new, etapa, mes, percentual FROM public.orcamento_cronograma WHERE orcamento_id=p_orcamento_id;
  INSERT INTO public.orcamento_licitacoes (orcamento_id, valor_final, modo) SELECT v_new, valor_final, modo FROM public.orcamento_licitacoes WHERE orcamento_id=p_orcamento_id;
  RETURN v_new;
END; $$;
GRANT EXECUTE ON FUNCTION public.duplicar_orcamento(uuid, text) TO authenticated;
