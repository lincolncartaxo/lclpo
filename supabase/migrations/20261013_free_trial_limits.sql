-- Limites efetivos do modo gratuito/teste.
-- Os limites são aplicados no banco para não depender do frontend.

CREATE OR REPLACE FUNCTION public.enforce_organization_budget_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.max_budgets INTO v_limit
  FROM public.organization_subscriptions s
  JOIN public.plan_definitions p ON p.code = s.plan_code
  WHERE s.organization_id = NEW.organization_id
    AND s.status IN ('trialing', 'active');

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.orcamentos o
  WHERE o.organization_id = NEW.organization_id
    AND (TG_OP = 'UPDATE' OR o.id <> NEW.id);

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite do plano atingido: esta organização pode manter até % orçamento(s).', v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_organization_budget_limit ON public.orcamentos;
CREATE TRIGGER enforce_organization_budget_limit
BEFORE INSERT ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_budget_limit();

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
  WHERE m.organization_id = NEW.organization_id
    AND NOT (TG_OP = 'UPDATE' AND m.user_id = NEW.user_id);

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite do plano atingido: esta organização pode ter até % usuário(s).', v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_organization_member_limit ON public.organization_members;
CREATE TRIGGER enforce_organization_member_limit
BEFORE INSERT ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_member_limit();

CREATE OR REPLACE FUNCTION public.get_my_plan_summary()
RETURNS TABLE (
  organization_id uuid,
  plan_code text,
  plan_name text,
  status text,
  budgets_used bigint,
  budgets_limit integer,
  users_used bigint,
  users_limit integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.organization_id,
         s.plan_code,
         p.name,
         s.status,
         (SELECT count(*) FROM public.orcamentos o WHERE o.organization_id = s.organization_id),
         p.max_budgets,
         (SELECT count(*) FROM public.organization_members m WHERE m.organization_id = s.organization_id),
         p.max_users
  FROM public.organization_subscriptions s
  JOIN public.plan_definitions p ON p.code = s.plan_code
  WHERE public.is_organization_member(s.organization_id)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.enforce_organization_budget_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_organization_member_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_plan_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_plan_summary() TO authenticated;
