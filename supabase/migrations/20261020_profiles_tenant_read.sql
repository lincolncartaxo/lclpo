-- Permite que usuários visualizem os demais membros da própria empresa.
-- A política anterior "profiles self read" permitia somente o próprio perfil,
-- fazendo cada usuário enxergar uma lista de equipe diferente.
-- A função is_organization_member é SECURITY DEFINER e evita recursão de RLS.

DROP POLICY IF EXISTS "profiles tenant read" ON public.profiles;

CREATE POLICY "profiles tenant read"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR (
    id_empresa IS NOT NULL
    AND public.is_organization_member(id_empresa)
  )
);
