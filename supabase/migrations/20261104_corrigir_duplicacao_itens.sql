-- Corrige a duplicação de orçamentos quando há itens com a mesma ordem.
-- A versão anterior reconstruía o mapa por ordem, que não é uma chave única.
CREATE OR REPLACE FUNCTION public.duplicar_orcamento(p_orcamento_id uuid, p_nome text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new uuid;
  v_src public.orcamentos%ROWTYPE;
  v_item_new uuid;
  v_item record;
BEGIN
  SELECT * INTO v_src FROM public.orcamentos WHERE id = p_orcamento_id;
  IF NOT FOUND OR NOT (v_src.user_id = auth.uid() OR public.is_organization_member(v_src.organization_id)) THEN
    RAISE EXCEPTION 'Orçamento não encontrado ou sem permissão';
  END IF;

  INSERT INTO public.orcamentos (
    user_id, organization_id, nome, objeto, contrato, orgao, municipio, localizacao,
    uf, engenheiro, crea, ref_precos, regime, encargos_pct, encargos_modalidade,
    encargos_sociais, bdi_pct, bdi_ac, bdi_s, bdi_r, bdi_g, bdi_l, bdi_i,
    bdi_cf, bdi_pis, bdi_cofins, bdi_tax_inss, bdi_tax_estadual, bdi_iss,
    interesse_transferegov, interesse_licitacao, status
  )
  VALUES (
    auth.uid(), v_src.organization_id, COALESCE(NULLIF(p_nome, ''), v_src.nome || ' - Cópia'),
    v_src.objeto, v_src.contrato, v_src.orgao, v_src.municipio, v_src.localizacao,
    v_src.uf, v_src.engenheiro, v_src.crea, v_src.ref_precos, v_src.regime,
    v_src.encargos_pct, v_src.encargos_modalidade, v_src.encargos_sociais,
    v_src.bdi_pct, v_src.bdi_ac, v_src.bdi_s, v_src.bdi_r, v_src.bdi_g, v_src.bdi_l,
    v_src.bdi_i, v_src.bdi_cf, v_src.bdi_pis, v_src.bdi_cofins, v_src.bdi_tax_inss,
    v_src.bdi_tax_estadual, v_src.bdi_iss, v_src.interesse_transferegov,
    v_src.interesse_licitacao, 'rascunho'
  )
  RETURNING id INTO v_new;

  CREATE TEMP TABLE _bdi_map_fix (old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  INSERT INTO public.orcamento_bdis (
    orcamento_id, nome, bdi_pct, bdi_ac, bdi_s, bdi_r, bdi_g, bdi_l, bdi_i,
    bdi_cf, bdi_pis, bdi_cofins, bdi_tax_inss, bdi_tax_estadual, bdi_iss
  )
  SELECT v_new, nome, bdi_pct, bdi_ac, bdi_s, bdi_r, bdi_g, bdi_l, bdi_i,
         bdi_cf, bdi_pis, bdi_cofins, bdi_tax_inss, bdi_tax_estadual, bdi_iss
  FROM public.orcamento_bdis WHERE orcamento_id = p_orcamento_id;
  INSERT INTO _bdi_map_fix
  SELECT old.id, new.id
  FROM public.orcamento_bdis old
  JOIN public.orcamento_bdis new ON new.orcamento_id = v_new AND new.nome = old.nome
  WHERE old.orcamento_id = p_orcamento_id;

  -- Inserção linha a linha mantém a relação exata entre cada ID antigo e novo,
  -- mesmo que existam ordens repetidas no orçamento de origem.
  CREATE TEMP TABLE _item_map_fix (old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  FOR v_item IN
    SELECT i.*, bm.new_id AS mapped_bdi_id
    FROM public.orcamento_itens i
    LEFT JOIN _bdi_map_fix bm ON bm.old_id = i.bdi_id
    WHERE i.orcamento_id = p_orcamento_id
    ORDER BY i.ordem, i.id
  LOOP
    INSERT INTO public.orcamento_itens (
      orcamento_id, ordem, etapa, item, fonte, codigo, descricao, unidade,
      quantidade, preco_unitario, memoria, evento_id, bdi_id
    )
    VALUES (
      v_new, v_item.ordem, v_item.etapa, v_item.item, v_item.fonte, v_item.codigo,
      v_item.descricao, v_item.unidade, v_item.quantidade, v_item.preco_unitario,
      v_item.memoria, NULL, v_item.mapped_bdi_id
    )
    RETURNING id INTO v_item_new;
    INSERT INTO _item_map_fix (old_id, new_id) VALUES (v_item.id, v_item_new);
  END LOOP;

  CREATE TEMP TABLE _event_map_fix (old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  INSERT INTO public.orcamento_eventos (orcamento_id, numero, titulo)
  SELECT v_new, numero, titulo FROM public.orcamento_eventos WHERE orcamento_id = p_orcamento_id;
  INSERT INTO _event_map_fix
  SELECT old.id, new.id FROM public.orcamento_eventos old
  JOIN public.orcamento_eventos new ON new.orcamento_id = v_new AND new.numero = old.numero
  WHERE old.orcamento_id = p_orcamento_id;
  UPDATE public.orcamento_itens ni SET evento_id = em.new_id
  FROM _item_map_fix im
  JOIN public.orcamento_itens oi ON oi.id = im.old_id
  JOIN _event_map_fix em ON em.old_id = oi.evento_id
  WHERE ni.id = im.new_id;

  CREATE TEMP TABLE _front_map_fix (old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  INSERT INTO public.orcamento_frentes (orcamento_id, numero, nome)
  SELECT v_new, numero, nome FROM public.orcamento_frentes WHERE orcamento_id = p_orcamento_id;
  INSERT INTO _front_map_fix
  SELECT old.id, new.id FROM public.orcamento_frentes old
  JOIN public.orcamento_frentes new ON new.orcamento_id = v_new AND new.numero = old.numero
  WHERE old.orcamento_id = p_orcamento_id;
  INSERT INTO public.orcamento_item_frentes (orcamento_id, item_id, frente_id, quantidade, mes_conclusao)
  SELECT v_new, im.new_id, fm.new_id, f.quantidade, f.mes_conclusao
  FROM public.orcamento_item_frentes f
  JOIN _item_map_fix im ON im.old_id = f.item_id
  JOIN _front_map_fix fm ON fm.old_id = f.frente_id
  WHERE f.orcamento_id = p_orcamento_id;

  INSERT INTO public.orcamento_cronograma (orcamento_id, etapa, mes, percentual)
  SELECT v_new, etapa, mes, percentual FROM public.orcamento_cronograma WHERE orcamento_id = p_orcamento_id;
  INSERT INTO public.orcamento_licitacoes (orcamento_id, valor_final, modo)
  SELECT v_new, valor_final, modo FROM public.orcamento_licitacoes WHERE orcamento_id = p_orcamento_id;

  RETURN v_new;
END;
$$;
GRANT EXECUTE ON FUNCTION public.duplicar_orcamento(uuid, text) TO authenticated;
