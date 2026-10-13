-- Lista administrativa de usuários e papéis sem expor user_roles pelo PostgREST.
CREATE OR REPLACE FUNCTION public.admin_list_users_with_roles()
RETURNS TABLE (
  user_id uuid,
  nome text,
  id_empresa uuid,
  empresa_nome text,
  role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar usuários';
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.nome,
         p.id_empresa,
         e.nome,
         CASE WHEN EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.user_id = p.id AND ur.role = 'admin'::public.app_role
         ) THEN 'admin' ELSE 'user' END
  FROM public.profiles p
  LEFT JOIN public.empresas e ON e.id = p.id_empresa
  ORDER BY p.nome NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users_with_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users_with_roles() TO authenticated, service_role;
