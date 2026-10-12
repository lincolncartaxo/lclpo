-- Fundação SaaS: membros de empresa e compartilhamento seguro de orçamentos.
-- Mantém o acesso individual existente para usuários sem empresa.

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS organization_members_user_idx
  ON public.organization_members(user_id);

INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT p.id_empresa, p.id, CASE WHEN ur.user_id IS NOT NULL THEN 'admin' ELSE 'member' END
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'
WHERE p.id_empresa IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;

DROP POLICY IF EXISTS "organization members self read" ON public.organization_members;
CREATE POLICY "organization members self read"
ON public.organization_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "organization members admin write" ON public.organization_members;
CREATE POLICY "organization members admin write"
ON public.organization_members FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_organization_member(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_organization_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated, service_role;

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orcamentos_organization_idx
  ON public.orcamentos(organization_id);

UPDATE public.orcamentos o
SET organization_id = p.id_empresa
FROM public.profiles p
WHERE p.id = o.user_id
  AND p.id_empresa IS NOT NULL
  AND o.organization_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_orcamento_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT p.id_empresa INTO NEW.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_orcamento_organization ON public.orcamentos;
CREATE TRIGGER set_orcamento_organization
BEFORE INSERT ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.set_orcamento_organization();

DROP POLICY IF EXISTS "orc membros da organizacao" ON public.orcamentos;
CREATE POLICY "orc membros da organizacao"
ON public.orcamentos FOR ALL TO authenticated
USING (organization_id IS NOT NULL AND public.is_organization_member(organization_id))
WITH CHECK (organization_id IS NOT NULL AND public.is_organization_member(organization_id));

DROP POLICY IF EXISTS "orc itens membros da organizacao" ON public.orcamento_itens;
CREATE POLICY "orc itens membros da organizacao"
ON public.orcamento_itens FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.id = orcamento_id
    AND o.organization_id IS NOT NULL
    AND public.is_organization_member(o.organization_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.id = orcamento_id
    AND o.organization_id IS NOT NULL
    AND public.is_organization_member(o.organization_id)
));

DROP POLICY IF EXISTS "orc cronograma membros da organizacao" ON public.orcamento_cronograma;
CREATE POLICY "orc cronograma membros da organizacao"
ON public.orcamento_cronograma FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.id = orcamento_id
    AND o.organization_id IS NOT NULL
    AND public.is_organization_member(o.organization_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.id = orcamento_id
    AND o.organization_id IS NOT NULL
    AND public.is_organization_member(o.organization_id)
));
