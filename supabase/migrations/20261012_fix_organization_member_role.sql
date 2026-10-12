-- Corrige instalações em que a migration de organizações foi parcialmente aplicada.
-- O papel member é o papel padrão de um usuário comum da organização.

DO $$
BEGIN
  IF to_regclass('public.organization_members') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.organization_members
    DROP CONSTRAINT IF EXISTS organization_members_role_check;

  ALTER TABLE public.organization_members
    ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'member'));
END
$$;

-- Reexecutável: completa os vínculos que ficaram pendentes na primeira tentativa.
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT p.id_empresa, p.id, CASE WHEN ur.user_id IS NOT NULL THEN 'admin' ELSE 'member' END
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'
WHERE p.id_empresa IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;
