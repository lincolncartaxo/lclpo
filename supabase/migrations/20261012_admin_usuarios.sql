-- Operações administrativas de usuários com autorização no banco.
-- O frontend não recebe service_role; a função valida o administrador pelo JWT.

CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  p_user_id uuid,
  p_nome text,
  p_id_empresa uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar usuários';
  END IF;

  IF p_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Papel inválido';
  END IF;

  v_role := p_role::public.app_role;

  UPDATE public.profiles
  SET nome = NULLIF(btrim(p_nome), ''), id_empresa = p_id_empresa, updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  IF v_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF p_id_empresa IS NOT NULL AND to_regclass('public.organization_members') IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (p_id_empresa, p_user_id, CASE WHEN v_role = 'admin' THEN 'admin' ELSE 'member' END)
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = EXCLUDED.role;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_profile(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é permitido excluir o próprio usuário administrador';
  END IF;

  DELETE FROM public.organization_members WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_profile(uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_user_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_profile(uuid) TO authenticated, service_role;
