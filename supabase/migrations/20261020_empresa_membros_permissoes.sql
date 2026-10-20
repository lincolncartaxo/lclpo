-- Permissões de gestão de membros por empresa.
-- Admin global pode remover qualquer membro, exceto a si próprio.
-- Admin/owner da organização pode remover somente membros comuns.
-- Usuários comuns não podem remover ninguém.

CREATE OR REPLACE FUNCTION public.remove_organization_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_org uuid;
  v_target_org uuid;
  v_target_role text;
  v_global_admin boolean;
  v_company_admin boolean;
BEGIN
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é permitido remover o próprio usuário';
  END IF;

  v_global_admin := public.has_role(auth.uid(), 'admin'::public.app_role);

  SELECT id_empresa INTO v_actor_org
  FROM public.profiles
  WHERE id = auth.uid();

  SELECT id_empresa INTO v_target_org
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_target_org IS NULL THEN
    RAISE EXCEPTION 'Usuário não está vinculado a uma empresa';
  END IF;

  v_company_admin := EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = v_actor_org
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );

  IF NOT v_global_admin AND NOT v_company_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem remover membros da empresa';
  END IF;

  IF NOT v_global_admin AND v_actor_org IS DISTINCT FROM v_target_org THEN
    RAISE EXCEPTION 'O membro não pertence à sua empresa';
  END IF;

  SELECT role INTO v_target_role
  FROM public.organization_members
  WHERE organization_id = v_target_org
    AND user_id = p_user_id;

  IF NOT v_global_admin AND COALESCE(v_target_role, 'member') IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Somente um administrador global pode remover outro administrador';
  END IF;

  UPDATE public.profiles
  SET id_empresa = NULL, updated_at = now()
  WHERE id = p_user_id
    AND (v_global_admin OR id_empresa = v_actor_org);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado ou fora da empresa';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_organization_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_organization_member(uuid) TO authenticated, service_role;
