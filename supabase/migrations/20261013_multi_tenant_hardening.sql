-- Hardening de Multi-Tenancy:
-- usuários vinculados a uma empresa compartilham os orçamentos do tenant;
-- usuários sem empresa continuam limitados aos próprios registros.

-- Garante que todo perfil vinculado tenha uma associação de tenant.
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT p.id_empresa,
       p.id,
       CASE WHEN EXISTS (
         SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = p.id AND ur.role = 'admin'::public.app_role
       ) THEN 'admin' ELSE 'member' END
FROM public.profiles p
WHERE p.id_empresa IS NOT NULL
ON CONFLICT (organization_id, user_id)
DO UPDATE SET role = CASE WHEN EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = EXCLUDED.user_id AND ur.role = 'admin'::public.app_role
) THEN 'admin' ELSE public.organization_members.role END;

-- Corrige orçamentos antigos que ainda não receberam o tenant.
UPDATE public.orcamentos o
SET organization_id = p.id_empresa
FROM public.profiles p
WHERE p.id = o.user_id
  AND p.id_empresa IS NOT NULL
  AND o.organization_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_profile_organization_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.id_empresa IS DISTINCT FROM NEW.id_empresa AND OLD.id_empresa IS NOT NULL THEN
    DELETE FROM public.organization_members
    WHERE organization_id = OLD.id_empresa AND user_id = NEW.id;
  END IF;

  IF NEW.id_empresa IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (
      NEW.id_empresa,
      NEW.id,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = NEW.id AND ur.role = 'admin'::public.app_role
      ) THEN 'admin' ELSE 'member' END
    )
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_organization_member ON public.profiles;
CREATE TRIGGER sync_profile_organization_member
AFTER INSERT OR UPDATE OF id_empresa ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_organization_member();

-- O tenant do orçamento é derivado do perfil autenticado; o cliente não pode
-- escolher outra empresa informando organization_id no payload.
CREATE OR REPLACE FUNCTION public.set_orcamento_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- O tenant e o criador são imutáveis depois da criação.
    NEW.organization_id := OLD.organization_id;
    NEW.user_id := OLD.user_id;
  ELSE
    SELECT p.id_empresa INTO v_org
    FROM public.profiles p
    WHERE p.id = auth.uid();
    NEW.organization_id := v_org;
  END IF;
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_orcamento_organization ON public.orcamentos;
CREATE TRIGGER set_orcamento_organization
BEFORE INSERT OR UPDATE OF organization_id, user_id ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.set_orcamento_organization();

-- Políticas antigas eram permissivas e continuavam permitindo acesso pelo
-- user_id. Em RLS, políticas do mesmo comando são combinadas com OR, por isso
-- é necessário removê-las explicitamente.
DROP POLICY IF EXISTS "orc owner all" ON public.orcamentos;
DROP POLICY IF EXISTS "orc membros da organizacao" ON public.orcamentos;
DROP POLICY IF EXISTS "orc itens owner" ON public.orcamento_itens;
DROP POLICY IF EXISTS "orc itens membros da organizacao" ON public.orcamento_itens;
DROP POLICY IF EXISTS "orc crono owner" ON public.orcamento_cronograma;
DROP POLICY IF EXISTS "orc cronograma membros da organizacao" ON public.orcamento_cronograma;

CREATE POLICY "orcamentos por tenant ou proprietário sem empresa"
ON public.orcamentos FOR ALL TO authenticated
USING (
  (organization_id IS NOT NULL AND (
    public.is_organization_member(organization_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ))
  OR (organization_id IS NULL AND user_id = auth.uid())
)
WITH CHECK (
  (organization_id IS NOT NULL AND (
    public.is_organization_member(organization_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ))
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "itens por tenant do orçamento"
ON public.orcamento_itens FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.id = orcamento_id
    AND (
      (o.organization_id IS NOT NULL AND (
        public.is_organization_member(o.organization_id)
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      ))
      OR (o.organization_id IS NULL AND o.user_id = auth.uid())
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.id = orcamento_id
    AND (
      (o.organization_id IS NOT NULL AND (
        public.is_organization_member(o.organization_id)
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      ))
      OR (o.organization_id IS NULL AND o.user_id = auth.uid())
    )
));

CREATE POLICY "cronograma por tenant do orçamento"
ON public.orcamento_cronograma FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.id = orcamento_id
    AND (
      (o.organization_id IS NOT NULL AND (
        public.is_organization_member(o.organization_id)
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      ))
      OR (o.organization_id IS NULL AND o.user_id = auth.uid())
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.id = orcamento_id
    AND (
      (o.organization_id IS NOT NULL AND (
        public.is_organization_member(o.organization_id)
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      ))
      OR (o.organization_id IS NULL AND o.user_id = auth.uid())
    )
));
