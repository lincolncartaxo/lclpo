CREATE OR REPLACE FUNCTION public.compartilhar_orcamento(p_orcamento_id uuid, p_organization_id uuid, p_permission text DEFAULT 'view')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão inválida'; END IF;
  IF p_permission NOT IN ('view','edit') THEN RAISE EXCEPTION 'Permissão inválida'; END IF;
  IF NOT public.can_delete_orcamento(p_orcamento_id) THEN RAISE EXCEPTION 'Somente o dono ou responsável da empresa pode compartilhar este orçamento'; END IF;
  SELECT organization_id INTO v_org FROM public.orcamentos WHERE id = p_orcamento_id;
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_organization_id) THEN RAISE EXCEPTION 'Empresa não encontrada; confira o código'; END IF;
  IF p_organization_id = v_org THEN RAISE EXCEPTION 'O orçamento já pertence a esta empresa'; END IF;
  INSERT INTO public.orcamento_shares(orcamento_id, organization_id, permission, granted_by)
  VALUES (p_orcamento_id, p_organization_id, p_permission, auth.uid())
  ON CONFLICT (orcamento_id, organization_id) DO UPDATE SET permission = EXCLUDED.permission, granted_by = EXCLUDED.granted_by;
END $$;

CREATE OR REPLACE FUNCTION public.listar_compartilhamentos_orcamento(p_orcamento_id uuid)
RETURNS TABLE(organization_id uuid, empresa_nome text, permission text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.can_delete_orcamento(p_orcamento_id) THEN RETURN; END IF;
  RETURN QUERY SELECT s.organization_id, e.nome, s.permission, s.created_at
    FROM public.orcamento_shares s JOIN public.empresas e ON e.id = s.organization_id
    WHERE s.orcamento_id = p_orcamento_id ORDER BY e.nome;
END $$;

CREATE OR REPLACE FUNCTION public.revogar_compartilhamento_orcamento(p_orcamento_id uuid, p_organization_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.can_delete_orcamento(p_orcamento_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  DELETE FROM public.orcamento_shares WHERE orcamento_id = p_orcamento_id AND organization_id = p_organization_id;
END $$;

CREATE OR REPLACE FUNCTION public.can_manage_composicao_propria(p_fonte text, p_codigo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.catalogo_composicoes c WHERE c.fonte = p_fonte AND c.codigo = p_codigo AND c.fonte = 'PRÓPRIA' AND c.organization_id IS NOT NULL
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = c.organization_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))));
$$;

CREATE OR REPLACE FUNCTION public.compartilhar_composicao(p_fonte text, p_codigo text, p_organization_id uuid, p_permission text DEFAULT 'view')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão inválida'; END IF;
  IF p_permission IS DISTINCT FROM 'view' THEN RAISE EXCEPTION 'Composições só podem ser compartilhadas para uso (leitura)'; END IF;
  IF NOT public.can_manage_composicao_propria(p_fonte, p_codigo) THEN RAISE EXCEPTION 'Somente o responsável ou administrador da empresa dona pode compartilhar esta composição'; END IF;
  SELECT organization_id INTO v_org FROM public.catalogo_composicoes WHERE fonte = p_fonte AND codigo = p_codigo;
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_organization_id) THEN RAISE EXCEPTION 'Empresa não encontrada; confira o código'; END IF;
  IF p_organization_id = v_org THEN RAISE EXCEPTION 'A composição já pertence a esta empresa'; END IF;
  INSERT INTO public.composicao_shares(fonte, codigo_composicao, organization_id, permission, granted_by)
  VALUES (p_fonte, p_codigo, p_organization_id, 'view', auth.uid())
  ON CONFLICT (fonte, codigo_composicao, organization_id) DO UPDATE SET permission = EXCLUDED.permission;
END $$;

CREATE OR REPLACE FUNCTION public.listar_compartilhamentos_composicao(p_fonte text, p_codigo text)
RETURNS TABLE(organization_id uuid, empresa_nome text, permission text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.can_manage_composicao_propria(p_fonte, p_codigo) THEN RETURN; END IF;
  RETURN QUERY SELECT s.organization_id, e.nome, s.permission, s.created_at
    FROM public.composicao_shares s JOIN public.empresas e ON e.id = s.organization_id
    WHERE s.fonte = p_fonte AND s.codigo_composicao = p_codigo ORDER BY e.nome;
END $$;

CREATE OR REPLACE FUNCTION public.revogar_compartilhamento_composicao(p_fonte text, p_codigo text, p_organization_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.can_manage_composicao_propria(p_fonte, p_codigo) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  DELETE FROM public.composicao_shares WHERE fonte = p_fonte AND codigo_composicao = p_codigo AND organization_id = p_organization_id;
END $$;

REVOKE ALL ON FUNCTION public.compartilhar_orcamento(uuid,uuid,text), public.listar_compartilhamentos_orcamento(uuid), public.revogar_compartilhamento_orcamento(uuid,uuid), public.can_manage_composicao_propria(text,text), public.compartilhar_composicao(text,text,uuid,text), public.listar_compartilhamentos_composicao(text,text), public.revogar_compartilhamento_composicao(text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compartilhar_orcamento(uuid,uuid,text), public.listar_compartilhamentos_orcamento(uuid), public.revogar_compartilhamento_orcamento(uuid,uuid), public.can_manage_composicao_propria(text,text), public.compartilhar_composicao(text,text,uuid,text), public.listar_compartilhamentos_composicao(text,text), public.revogar_compartilhamento_composicao(text,text,uuid) TO authenticated;