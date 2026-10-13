-- Corrige duas situações da primeira implementação dos limites:
-- 1) organizações existentes ficaram com assinatura free mesmo quando empresas.plano
--    era enterprise/pro;
-- 2) editar o papel de um membro já existente era interpretado como novo membro.

INSERT INTO public.plan_definitions (code, name, max_users, max_budgets, max_import_rows, features)
VALUES
  ('enterprise', 'Enterprise', 100, 5000, 1000000, '{"exports": true, "transferegov": true, "audit": true, "priority_support": true}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  max_users = EXCLUDED.max_users,
  max_budgets = EXCLUDED.max_budgets,
  max_import_rows = EXCLUDED.max_import_rows,
  features = EXCLUDED.features;

-- Compatibiliza os nomes usados no cadastro administrativo antigo.
UPDATE public.organization_subscriptions s
SET plan_code = CASE lower(trim(e.plano))
  WHEN 'enterprise' THEN 'enterprise'
  WHEN 'business' THEN 'business'
  WHEN 'pro' THEN 'pro'
  WHEN 'basic' THEN 'free'
  WHEN 'free' THEN 'free'
  ELSE s.plan_code
END,
updated_at = now()
FROM public.empresas e
WHERE e.id = s.organization_id
  AND lower(trim(coalesce(e.plano, ''))) IN ('enterprise', 'business', 'pro', 'basic', 'free');

CREATE OR REPLACE FUNCTION public.enforce_organization_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  -- INSERT ... ON CONFLICT DO UPDATE dispara o trigger de INSERT antes de
  -- atualizar um membro existente. Alteração de papel não consome nova vaga.
  IF EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = NEW.organization_id
      AND m.user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT p.max_users INTO v_limit
  FROM public.organization_subscriptions s
  JOIN public.plan_definitions p ON p.code = s.plan_code
  WHERE s.organization_id = NEW.organization_id
    AND s.status IN ('trialing', 'active');

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.organization_members m
  WHERE m.organization_id = NEW.organization_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite do plano atingido: esta organização pode ter até % usuário(s).', v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_organization_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
BEGIN
  v_plan := CASE lower(trim(coalesce(NEW.plano, '')))
    WHEN 'enterprise' THEN 'enterprise'
    WHEN 'business' THEN 'business'
    WHEN 'pro' THEN 'pro'
    WHEN 'basic' THEN 'free'
    WHEN 'free' THEN 'free'
    ELSE NULL
  END;

  IF v_plan IS NOT NULL THEN
    INSERT INTO public.organization_subscriptions (organization_id, plan_code, status, updated_at)
    VALUES (NEW.id, v_plan, 'active', now())
    ON CONFLICT (organization_id) DO UPDATE
      SET plan_code = EXCLUDED.plan_code, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_organization_plan ON public.empresas;
CREATE TRIGGER sync_organization_plan
AFTER INSERT OR UPDATE OF plano ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.sync_organization_plan();
