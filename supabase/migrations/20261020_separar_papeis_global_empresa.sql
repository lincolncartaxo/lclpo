-- Separa claramente o administrador global do administrador/owner da empresa.
-- user_roles: administração da plataforma.
-- organization_members.role: autorização dentro do tenant.

DROP POLICY IF EXISTS "organization members tenant read" ON public.organization_members;
CREATE POLICY "organization members tenant read"
ON public.organization_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_organization_member(organization_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.admin_list_users_with_scoped_roles()
RETURNS TABLE (
  user_id uuid,
  nome text,
  id_empresa uuid,
  empresa_nome text,
  global_role text,
  organization_role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores globais podem consultar usuários';
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.nome,
         p.id_empresa,
         e.nome,
         CASE WHEN EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.user_id = p.id AND ur.role = 'admin'::public.app_role
         ) THEN 'admin' ELSE 'user' END,
         COALESCE(om.role, CASE WHEN EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.user_id = p.id AND ur.role = 'admin'::public.app_role
         ) THEN 'admin' ELSE 'member' END)
  FROM public.profiles p
  LEFT JOIN public.empresas e ON e.id = p.id_empresa
  LEFT JOIN public.organization_members om
    ON om.organization_id = p.id_empresa AND om.user_id = p.id
  ORDER BY p.nome NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_scoped_roles(
  p_user_id uuid,
  p_nome text,
  p_id_empresa uuid,
  p_global_role text,
  p_organization_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores globais podem editar papéis';
  END IF;

  IF p_global_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Papel global inválido';
  END IF;

  IF p_organization_role NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Papel da empresa inválido';
  END IF;

  UPDATE public.profiles
  SET nome = NULLIF(btrim(p_nome), ''), id_empresa = p_id_empresa, updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  IF p_global_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  DELETE FROM public.organization_members WHERE user_id = p_user_id;
  IF p_id_empresa IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (p_id_empresa, p_user_id, p_organization_role);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users_with_scoped_roles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_user_scoped_roles(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users_with_scoped_roles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_user_scoped_roles(uuid, text, uuid, text, text) TO authenticated, service_role;
