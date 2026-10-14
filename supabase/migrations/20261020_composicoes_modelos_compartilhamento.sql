-- Composições próprias, modelos e compartilhamento entre empresas.
-- Compatível com instalações onde as tabelas base_propria_* não foram criadas.

ALTER TABLE public.catalogo_composicoes
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'private';

CREATE INDEX IF NOT EXISTS catalogo_composicoes_org_idx
  ON public.catalogo_composicoes(organization_id, fonte);

CREATE TABLE IF NOT EXISTS public.composicao_shares (
  composicao_id integer NOT NULL REFERENCES public.catalogo_composicoes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view','edit')),
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (composicao_id, organization_id)
);
ALTER TABLE public.composicao_shares ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.composicao_shares TO authenticated;

DROP POLICY IF EXISTS "composicao shares acesso" ON public.composicao_shares;
CREATE POLICY "composicao shares acesso" ON public.composicao_shares FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id) OR granted_by = auth.uid());
DROP POLICY IF EXISTS "composicao shares gerenciamento" ON public.composicao_shares;
CREATE POLICY "composicao shares gerenciamento" ON public.composicao_shares FOR ALL TO authenticated
USING (granted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (granted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER TABLE public.catalogo_composicoes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_composicoes TO authenticated;
DROP POLICY IF EXISTS "catalogo composicoes leitura autenticada" ON public.catalogo_composicoes;
DROP POLICY IF EXISTS "admin importa catalogo composicoes" ON public.catalogo_composicoes;
CREATE POLICY "catalogo composicoes visiveis" ON public.catalogo_composicoes FOR SELECT TO authenticated
USING (
  fonte <> 'PRÓPRIA'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.composicao_shares s WHERE s.composicao_id = id AND public.is_organization_member(s.organization_id))
);
CREATE POLICY "catalogo composicoes proprias inserir" ON public.catalogo_composicoes FOR INSERT TO authenticated
WITH CHECK (
  fonte = 'PRÓPRIA' AND created_by = auth.uid()
  AND organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "catalogo composicoes proprias alterar" ON public.catalogo_composicoes FOR UPDATE TO authenticated
USING (fonte = 'PRÓPRIA' AND (created_by = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))))
WITH CHECK (fonte = 'PRÓPRIA');
CREATE POLICY "catalogo composicoes proprias excluir" ON public.catalogo_composicoes FOR DELETE TO authenticated
USING (fonte = 'PRÓPRIA' AND (created_by = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))));

ALTER TABLE public.catalogo_composicao_itens ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_composicao_itens TO authenticated;
DROP POLICY IF EXISTS "catalogo itens visiveis" ON public.catalogo_composicao_itens;
CREATE POLICY "catalogo itens visiveis" ON public.catalogo_composicao_itens FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.catalogo_composicoes c WHERE c.codigo = codigo_composicao AND c.fonte = fonte));
DROP POLICY IF EXISTS "catalogo itens propria inserir" ON public.catalogo_composicao_itens;
CREATE POLICY "catalogo itens propria inserir" ON public.catalogo_composicao_itens FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.catalogo_composicoes c WHERE c.codigo = codigo_composicao AND c.fonte = fonte AND c.fonte = 'PRÓPRIA' AND c.created_by = auth.uid()));
DROP POLICY IF EXISTS "catalogo itens propria alterar" ON public.catalogo_composicao_itens;
CREATE POLICY "catalogo itens propria alterar" ON public.catalogo_composicao_itens FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.catalogo_composicoes c WHERE c.codigo = codigo_composicao AND c.fonte = fonte AND c.fonte = 'PRÓPRIA' AND c.created_by = auth.uid()));
DROP POLICY IF EXISTS "catalogo itens propria excluir" ON public.catalogo_composicao_itens;
CREATE POLICY "catalogo itens propria excluir" ON public.catalogo_composicao_itens FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.catalogo_composicoes c WHERE c.codigo = codigo_composicao AND c.fonte = fonte AND c.fonte = 'PRÓPRIA' AND c.created_by = auth.uid()));

CREATE OR REPLACE FUNCTION public.criar_composicao_propria(payload jsonb, itens jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_id integer;
BEGIN
  SELECT id_empresa INTO v_org FROM public.profiles WHERE id = auth.uid();
  IF v_org IS NULL THEN RAISE EXCEPTION 'Usuário não está vinculado a uma empresa'; END IF;
  INSERT INTO public.catalogo_composicoes (codigo, fonte, descricao, unidade, organization_id, created_by, access_mode)
  VALUES (btrim(payload->>'codigo'), 'PRÓPRIA', btrim(payload->>'descricao'), NULLIF(btrim(payload->>'unidade'), ''), v_org, auth.uid(), 'private')
  RETURNING id INTO v_id;
  INSERT INTO public.catalogo_composicao_itens (codigo_composicao, fonte, tipo_item, codigo_item, coeficiente)
  SELECT btrim(payload->>'codigo'), 'PRÓPRIA', upper(rec->>'tipo_item'), btrim(rec->>'codigo_item'), COALESCE(NULLIF(rec->>'coeficiente','')::numeric,0)
  FROM jsonb_array_elements(itens) rec;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.criar_composicao_propria(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_composicao_propria(jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.duplicar_orcamento(p_orcamento_id uuid, p_nome text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new uuid; v_src public.orcamentos%ROWTYPE;
BEGIN
  SELECT * INTO v_src FROM public.orcamentos WHERE id = p_orcamento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado ou sem permissão'; END IF;
  IF NOT (public.is_organization_member(v_src.organization_id) OR v_src.user_id = auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para duplicar este orçamento'; END IF;
  INSERT INTO public.orcamentos (user_id, nome, objeto, contrato, orgao, municipio, uf, engenheiro, crea, ref_precos, encargos_pct, bdi_pct, status)
  VALUES (auth.uid(), COALESCE(NULLIF(p_nome,''), v_src.nome || ' - Cópia'), v_src.objeto, v_src.contrato, v_src.orgao, v_src.municipio, v_src.uf, v_src.engenheiro, v_src.crea, v_src.ref_precos, v_src.encargos_pct, v_src.bdi_pct, 'rascunho') RETURNING id INTO v_new;
  INSERT INTO public.orcamento_itens (orcamento_id, ordem, etapa, item, fonte, codigo, descricao, unidade, quantidade, preco_unitario)
  SELECT v_new, ordem, etapa, item, fonte, codigo, descricao, unidade, quantidade, preco_unitario FROM public.orcamento_itens WHERE orcamento_id = p_orcamento_id;
  INSERT INTO public.orcamento_cronograma (orcamento_id, etapa, mes, percentual)
  SELECT v_new, etapa, mes, percentual FROM public.orcamento_cronograma WHERE orcamento_id = p_orcamento_id;
  RETURN v_new;
END; $$;
GRANT EXECUTE ON FUNCTION public.duplicar_orcamento(uuid,text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.orcamento_shares (
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view','edit')),
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (orcamento_id, organization_id)
);
ALTER TABLE public.orcamento_shares ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_shares TO authenticated;
DROP POLICY IF EXISTS "orcamento shares leitura" ON public.orcamento_shares;
CREATE POLICY "orcamento shares leitura" ON public.orcamento_shares FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id) OR granted_by = auth.uid());
DROP POLICY IF EXISTS "orcamento shares gerenciamento" ON public.orcamento_shares;
CREATE POLICY "orcamento shares gerenciamento" ON public.orcamento_shares FOR ALL TO authenticated
USING (granted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (granted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.compartilhar_orcamento(p_orcamento_id uuid, p_organization_id uuid, p_permission text DEFAULT 'view')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT organization_id INTO v_owner FROM public.orcamentos WHERE id = p_orcamento_id;
  IF v_owner IS NULL OR NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = v_owner AND user_id = auth.uid() AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'Somente o administrador da empresa proprietária pode compartilhar'; END IF;
  INSERT INTO public.orcamento_shares(orcamento_id, organization_id, permission, granted_by) VALUES (p_orcamento_id,p_organization_id,CASE WHEN p_permission='edit' THEN 'edit' ELSE 'view' END,auth.uid()) ON CONFLICT (orcamento_id,organization_id) DO UPDATE SET permission=EXCLUDED.permission;
END; $$;
GRANT EXECUTE ON FUNCTION public.compartilhar_orcamento(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.duplicar_composicao_propria(p_composicao_id integer, p_codigo text, p_descricao text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_src public.catalogo_composicoes%ROWTYPE; v_org uuid; v_new integer;
BEGIN
  SELECT * INTO v_src FROM public.catalogo_composicoes WHERE id = p_composicao_id AND fonte = 'PRÓPRIA';
  IF NOT FOUND THEN RAISE EXCEPTION 'Composição própria não encontrada'; END IF;
  SELECT id_empresa INTO v_org FROM public.profiles WHERE id = auth.uid();
  IF v_org IS NULL OR NOT (v_src.organization_id = v_org OR v_src.created_by = auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para duplicar esta composição'; END IF;
  INSERT INTO public.catalogo_composicoes(codigo, fonte, descricao, unidade, organization_id, created_by, access_mode)
  VALUES (btrim(p_codigo), 'PRÓPRIA', COALESCE(NULLIF(btrim(p_descricao),''), v_src.descricao || ' - Cópia'), v_src.unidade, v_org, auth.uid(), 'private')
  RETURNING id INTO v_new;
  INSERT INTO public.catalogo_composicao_itens(codigo_composicao, fonte, tipo_item, codigo_item, coeficiente)
  SELECT btrim(p_codigo), 'PRÓPRIA', tipo_item, codigo_item, coeficiente
  FROM public.catalogo_composicao_itens
  WHERE codigo_composicao = v_src.codigo AND fonte = 'PRÓPRIA';
  RETURN v_new;
END; $$;
REVOKE ALL ON FUNCTION public.duplicar_composicao_propria(integer,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicar_composicao_propria(integer,text,text) TO authenticated;

-- A empresa destinatária também pode visualizar/editar o orçamento conforme
-- a permissão concedida pelo proprietário.
DROP POLICY IF EXISTS "orcamentos por tenant ou proprietário sem empresa" ON public.orcamentos;
CREATE POLICY "orcamentos por tenant ou compartilhamento" ON public.orcamentos FOR ALL TO authenticated
USING (
  (organization_id IS NOT NULL AND (public.is_organization_member(organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)))
  OR (organization_id IS NULL AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.orcamento_shares s WHERE s.orcamento_id = id AND public.is_organization_member(s.organization_id))
)
WITH CHECK (
  (organization_id IS NOT NULL AND (public.is_organization_member(organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "itens por tenant do orçamento" ON public.orcamento_itens;
CREATE POLICY "itens por tenant ou compartilhamento" ON public.orcamento_itens FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id=orcamento_id AND (
  (o.organization_id IS NOT NULL AND (public.is_organization_member(o.organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)))
  OR (o.organization_id IS NULL AND o.user_id=auth.uid())
  OR EXISTS (SELECT 1 FROM public.orcamento_shares s WHERE s.orcamento_id=o.id AND public.is_organization_member(s.organization_id))
)))
WITH CHECK (EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id=orcamento_id AND (
  (o.organization_id IS NOT NULL AND (public.is_organization_member(o.organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)))
  OR (o.organization_id IS NULL AND o.user_id=auth.uid())
  OR EXISTS (SELECT 1 FROM public.orcamento_shares s WHERE s.orcamento_id=o.id AND public.is_organization_member(s.organization_id) AND s.permission='edit')
)));

CREATE OR REPLACE FUNCTION public.compartilhar_composicao(p_composicao_id integer, p_organization_id uuid, p_permission text DEFAULT 'view')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.catalogo_composicoes WHERE id=p_composicao_id AND fonte='PRÓPRIA';
  IF v_org IS NULL OR NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id=v_org AND user_id=auth.uid() AND role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'Somente o administrador da empresa proprietária pode compartilhar';
  END IF;
  INSERT INTO public.composicao_shares(composicao_id,organization_id,permission,granted_by)
  VALUES(p_composicao_id,p_organization_id,CASE WHEN p_permission='edit' THEN 'edit' ELSE 'view' END,auth.uid())
  ON CONFLICT(composicao_id,organization_id) DO UPDATE SET permission=EXCLUDED.permission;
END; $$;
GRANT EXECUTE ON FUNCTION public.compartilhar_composicao(integer,uuid,text) TO authenticated;
