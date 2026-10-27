-- LclPlan — hardening mínimo para piloto comercial.
-- Aplicar somente após reconciliar o histórico do Supabase remoto e backup.

-- Bloqueia auto-vínculo de um usuário a outro tenant.
CREATE OR REPLACE FUNCTION public.guard_profile_tenant_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.id_empresa IS DISTINCT FROM NEW.id_empresa
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(),'admin'::public.app_role)
  THEN
    RAISE EXCEPTION 'Somente o administrador global pode alterar o vínculo da empresa' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_profile_tenant_change ON public.profiles;
CREATE TRIGGER guard_profile_tenant_change
BEFORE UPDATE OF id_empresa ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_tenant_change();

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', p.policyname);
  END LOOP;
END;
$$;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles FROM authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
CREATE POLICY "profiles comercial leitura" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid()=id OR (id_empresa IS NOT NULL AND public.is_organization_member(id_empresa)) OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "profiles comercial atualização" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid()=id OR public.has_role(auth.uid(),'admin'::public.app_role))
WITH CHECK (auth.uid()=id OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "profiles comercial exclusão admin" ON public.profiles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));

-- RPC administrativa com todos os papéis suportados pela aplicação.
CREATE OR REPLACE FUNCTION public.admin_update_user_scoped_roles(
  p_user_id uuid, p_nome text, p_id_empresa uuid, p_global_role text, p_organization_role text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Apenas administradores globais podem editar papéis' USING ERRCODE='42501'; END IF;
  IF p_global_role NOT IN ('admin','user') THEN RAISE EXCEPTION 'Papel global inválido' USING ERRCODE='22023'; END IF;
  IF p_organization_role NOT IN ('owner','admin','editor','viewer','member') THEN RAISE EXCEPTION 'Papel da empresa inválido' USING ERRCODE='22023'; END IF;
  UPDATE public.profiles SET nome=NULLIF(btrim(p_nome),''), id_empresa=p_id_empresa, updated_at=now() WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE='P0002'; END IF;
  DELETE FROM public.user_roles WHERE user_id=p_user_id;
  IF p_global_role='admin' THEN
    INSERT INTO public.user_roles(user_id,role) VALUES(p_user_id,'admin'::public.app_role) ON CONFLICT(user_id,role) DO NOTHING;
  END IF;
  DELETE FROM public.organization_members WHERE user_id=p_user_id;
  IF p_id_empresa IS NOT NULL THEN
    INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(p_id_empresa,p_user_id,p_organization_role);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_user_scoped_roles(uuid,text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_scoped_roles(uuid,text,uuid,text,text) TO authenticated,service_role;

-- Algumas instalações remotas ainda não possuem a tabela de compartilhamento,
-- embora as funções de autorização dependam dela. Criá-la aqui torna a
-- migration compatível com essas instalações sem apagar dados existentes.
CREATE TABLE IF NOT EXISTS public.orcamento_shares (
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view','edit')),
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (orcamento_id, organization_id)
);
ALTER TABLE public.orcamento_shares ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orcamento_shares TO authenticated;
DROP POLICY IF EXISTS "orcamento shares leitura comercial" ON public.orcamento_shares;
CREATE POLICY "orcamento shares leitura comercial" ON public.orcamento_shares FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id) OR granted_by=auth.uid());
DROP POLICY IF EXISTS "orcamento shares gerenciamento comercial" ON public.orcamento_shares;
CREATE POLICY "orcamento shares gerenciamento comercial" ON public.orcamento_shares FOR ALL TO authenticated
USING (granted_by=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))
WITH CHECK (granted_by=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));

-- Autorização centralizada para orçamento, itens e cronograma.
CREATE OR REPLACE FUNCTION public.can_read_orcamento(p_orcamento_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.orcamentos o WHERE o.id=p_orcamento_id AND (
 (o.organization_id IS NOT NULL AND (public.is_organization_member(o.organization_id) OR public.has_role(auth.uid(),'admin'::public.app_role)))
 OR (o.organization_id IS NULL AND o.user_id=auth.uid())
 OR EXISTS(SELECT 1 FROM public.orcamento_shares s WHERE s.orcamento_id=o.id AND public.is_organization_member(s.organization_id))));
$$;
CREATE OR REPLACE FUNCTION public.can_edit_orcamento(p_orcamento_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.orcamentos o WHERE o.id=p_orcamento_id AND (
 (o.organization_id IS NOT NULL AND (public.has_role(auth.uid(),'admin'::public.app_role) OR EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=o.organization_id AND m.user_id=auth.uid() AND m.role IN('owner','admin','editor','member'))))
 OR (o.organization_id IS NULL AND o.user_id=auth.uid())
 OR EXISTS(SELECT 1 FROM public.orcamento_shares s WHERE s.orcamento_id=o.id AND s.permission='edit' AND public.is_organization_member(s.organization_id))));
$$;
CREATE OR REPLACE FUNCTION public.can_delete_orcamento(p_orcamento_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.orcamentos o WHERE o.id=p_orcamento_id AND (
 public.has_role(auth.uid(),'admin'::public.app_role)
 OR (o.organization_id IS NULL AND o.user_id=auth.uid())
 OR EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=o.organization_id AND m.user_id=auth.uid() AND m.role IN('owner','admin'))));
$$;
REVOKE ALL ON FUNCTION public.can_read_orcamento(uuid),public.can_edit_orcamento(uuid),public.can_delete_orcamento(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_orcamento(uuid),public.can_edit_orcamento(uuid),public.can_delete_orcamento(uuid) TO authenticated,service_role;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN('orcamentos','orcamento_itens','orcamento_cronograma') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,p.tablename);
  END LOOP;
END;
$$;
CREATE POLICY "orcamentos comercial leitura" ON public.orcamentos FOR SELECT TO authenticated USING(public.can_read_orcamento(id));
CREATE POLICY "orcamentos comercial inserção" ON public.orcamentos FOR INSERT TO authenticated
WITH CHECK(user_id=auth.uid() AND (organization_id IS NULL OR public.is_organization_member(organization_id) OR public.has_role(auth.uid(),'admin'::public.app_role)));
CREATE POLICY "orcamentos comercial atualização" ON public.orcamentos FOR UPDATE TO authenticated USING(public.can_edit_orcamento(id)) WITH CHECK(public.can_edit_orcamento(id));
CREATE POLICY "orcamentos comercial exclusão" ON public.orcamentos FOR DELETE TO authenticated USING(public.can_delete_orcamento(id));
CREATE POLICY "itens orçamento comercial leitura" ON public.orcamento_itens FOR SELECT TO authenticated USING(public.can_read_orcamento(orcamento_id));
CREATE POLICY "itens orçamento comercial inserção" ON public.orcamento_itens FOR INSERT TO authenticated WITH CHECK(public.can_edit_orcamento(orcamento_id));
CREATE POLICY "itens orçamento comercial atualização" ON public.orcamento_itens FOR UPDATE TO authenticated USING(public.can_edit_orcamento(orcamento_id)) WITH CHECK(public.can_edit_orcamento(orcamento_id));
CREATE POLICY "itens orçamento comercial exclusão" ON public.orcamento_itens FOR DELETE TO authenticated USING(public.can_edit_orcamento(orcamento_id));
CREATE POLICY "cronograma orçamento comercial leitura" ON public.orcamento_cronograma FOR SELECT TO authenticated USING(public.can_read_orcamento(orcamento_id));
CREATE POLICY "cronograma orçamento comercial inserção" ON public.orcamento_cronograma FOR INSERT TO authenticated WITH CHECK(public.can_edit_orcamento(orcamento_id));
CREATE POLICY "cronograma orçamento comercial atualização" ON public.orcamento_cronograma FOR UPDATE TO authenticated USING(public.can_edit_orcamento(orcamento_id)) WITH CHECK(public.can_edit_orcamento(orcamento_id));
CREATE POLICY "cronograma orçamento comercial exclusão" ON public.orcamento_cronograma FOR DELETE TO authenticated USING(public.can_edit_orcamento(orcamento_id));

-- Quotas bloqueiam assinatura ausente/inativa e serializam inserções por tenant.
CREATE OR REPLACE FUNCTION public.enforce_organization_budget_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_limit integer; v_count bigint; v_org uuid:=NEW.organization_id;
BEGIN
  IF v_org IS NULL THEN SELECT p.id_empresa INTO v_org FROM public.profiles p WHERE p.id=COALESCE(NEW.user_id,auth.uid()); END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Orçamento precisa estar vinculado a uma empresa' USING ERRCODE='check_violation'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text,41001));
  SELECT p.max_budgets INTO v_limit FROM public.organization_subscriptions s JOIN public.plan_definitions p ON p.code=s.plan_code AND p.active
  WHERE s.organization_id=v_org AND ((s.status='active' AND (s.current_period_end IS NULL OR s.current_period_end>now())) OR (s.status='trialing' AND (s.trial_ends_at IS NULL OR s.trial_ends_at>now())));
  IF v_limit IS NULL THEN RAISE EXCEPTION 'A organização não possui uma assinatura ativa' USING ERRCODE='check_violation'; END IF;
  SELECT count(*) INTO v_count FROM public.orcamentos o WHERE o.organization_id=v_org AND (TG_OP='UPDATE' OR o.id<>NEW.id);
  IF v_count>=v_limit THEN RAISE EXCEPTION 'Limite do plano atingido: até % orçamento(s)',v_limit USING ERRCODE='check_violation'; END IF;
  NEW.organization_id:=v_org; RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.enforce_organization_member_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_limit integer; v_count bigint;
BEGIN
  IF NEW.organization_id IS NULL THEN RAISE EXCEPTION 'Membro precisa estar vinculado a uma empresa' USING ERRCODE='check_violation'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text,41002));
  SELECT p.max_users INTO v_limit FROM public.organization_subscriptions s JOIN public.plan_definitions p ON p.code=s.plan_code AND p.active
  WHERE s.organization_id=NEW.organization_id AND ((s.status='active' AND (s.current_period_end IS NULL OR s.current_period_end>now())) OR (s.status='trialing' AND (s.trial_ends_at IS NULL OR s.trial_ends_at>now())));
  IF v_limit IS NULL THEN RAISE EXCEPTION 'A organização não possui uma assinatura ativa' USING ERRCODE='check_violation'; END IF;
  SELECT count(*) INTO v_count FROM public.organization_members m WHERE m.organization_id=NEW.organization_id AND NOT(TG_OP='UPDATE' AND m.user_id=NEW.user_id);
  IF v_count>=v_limit THEN RAISE EXCEPTION 'Limite do plano atingido: até % usuário(s)',v_limit USING ERRCODE='check_violation'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_organization_budget_limit ON public.orcamentos;
CREATE TRIGGER enforce_organization_budget_limit BEFORE INSERT OR UPDATE ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_budget_limit();
DROP TRIGGER IF EXISTS enforce_organization_member_limit ON public.organization_members;
CREATE TRIGGER enforce_organization_member_limit BEFORE INSERT OR UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_member_limit();

-- O cálculo não deve ser público nem ignorar RLS.
ALTER FUNCTION public.calcular_custo_composicao(text,text,text,text,text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.calcular_custo_composicao(text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.calcular_custo_composicao(text,text,text,text,text) TO authenticated,service_role;

-- Qualifica a linha protegida nas policies dos itens analíticos.
DROP POLICY IF EXISTS "catalogo itens visiveis" ON public.catalogo_composicao_itens;
DROP POLICY IF EXISTS "catalogo itens propria inserir" ON public.catalogo_composicao_itens;
DROP POLICY IF EXISTS "catalogo itens propria alterar" ON public.catalogo_composicao_itens;
DROP POLICY IF EXISTS "catalogo itens propria excluir" ON public.catalogo_composicao_itens;
DROP POLICY IF EXISTS "admin importa itens analiticos" ON public.catalogo_composicao_itens;
CREATE POLICY "catalogo itens comercial leitura" ON public.catalogo_composicao_itens FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.catalogo_composicoes c WHERE c.codigo=catalogo_composicao_itens.codigo_composicao AND c.fonte=catalogo_composicao_itens.fonte));
CREATE POLICY "catalogo itens comercial inserção" ON public.catalogo_composicao_itens FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.catalogo_composicoes c WHERE c.codigo=catalogo_composicao_itens.codigo_composicao AND c.fonte=catalogo_composicao_itens.fonte AND c.fonte='PRÓPRIA' AND(c.created_by=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));
CREATE POLICY "catalogo itens comercial atualização" ON public.catalogo_composicao_itens FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.catalogo_composicoes c WHERE c.codigo=catalogo_composicao_itens.codigo_composicao AND c.fonte=catalogo_composicao_itens.fonte AND c.fonte='PRÓPRIA' AND(c.created_by=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role)))) WITH CHECK(EXISTS(SELECT 1 FROM public.catalogo_composicoes c WHERE c.codigo=catalogo_composicao_itens.codigo_composicao AND c.fonte=catalogo_composicao_itens.fonte AND c.fonte='PRÓPRIA' AND(c.created_by=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));
CREATE POLICY "catalogo itens comercial exclusão" ON public.catalogo_composicao_itens FOR DELETE TO authenticated USING(EXISTS(SELECT 1 FROM public.catalogo_composicoes c WHERE c.codigo=catalogo_composicao_itens.codigo_composicao AND c.fonte=catalogo_composicao_itens.fonte AND c.fonte='PRÓPRIA' AND(c.created_by=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));
