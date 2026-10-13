-- Controle comercial no painel administrativo.
CREATE OR REPLACE FUNCTION public.admin_list_organization_plans()
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  legacy_plan text,
  organization_status text,
  plan_code text,
  subscription_status text,
  users_used bigint,
  users_limit integer,
  budgets_used bigint,
  budgets_limit integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar os planos das empresas';
  END IF;

  RETURN QUERY
  SELECT e.id,
         e.nome,
         e.plano,
         e.status,
         COALESCE(s.plan_code, CASE lower(trim(coalesce(e.plano, '')))
           WHEN 'enterprise' THEN 'enterprise'
           WHEN 'business' THEN 'business'
           WHEN 'pro' THEN 'pro'
           ELSE 'free'
         END),
         COALESCE(s.status, 'active'),
         (SELECT count(*) FROM public.organization_members m WHERE m.organization_id = e.id),
         COALESCE(p.max_users, 1),
         (SELECT count(*) FROM public.orcamentos o WHERE o.organization_id = e.id),
         COALESCE(p.max_budgets, 3)
  FROM public.empresas e
  LEFT JOIN public.organization_subscriptions s ON s.organization_id = e.id
  LEFT JOIN public.plan_definitions p ON p.code = COALESCE(s.plan_code, CASE lower(trim(coalesce(e.plano, '')))
    WHEN 'enterprise' THEN 'enterprise'
    WHEN 'business' THEN 'business'
    WHEN 'pro' THEN 'pro'
    ELSE 'free'
  END)
  ORDER BY e.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_organization_plans() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_organization_plans() TO authenticated, service_role;
