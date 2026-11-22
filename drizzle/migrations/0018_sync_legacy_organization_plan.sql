-- Mantém empresas.plano (painel administrativo legado) e a assinatura comercial
-- coerentes para organizações que ainda não possuem uma assinatura Stripe.
-- Assinaturas Stripe ativas não são sobrescritas por esse legado.

CREATE OR REPLACE FUNCTION public.normalize_legacy_organization_plan(p_plan text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(coalesce(p_plan, '')))
    WHEN 'enterprise' THEN 'enterprise'
    WHEN 'business' THEN 'business'
    WHEN 'pro' THEN 'pro'
    WHEN 'basic' THEN 'free'
    WHEN 'free' THEN 'free'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.normalize_legacy_organization_plan(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_legacy_organization_plan(text) TO authenticated, service_role;

-- Corrige organizações existentes que foram cadastradas pelo painel antigo.
UPDATE public.organization_subscriptions s
SET plan_code = public.normalize_legacy_organization_plan(e.plano),
    status = 'active',
    updated_at = now()
FROM public.empresas e
WHERE e.id = s.organization_id
  AND s.provider IS DISTINCT FROM 'stripe'
  AND public.normalize_legacy_organization_plan(e.plano) IS NOT NULL
  AND s.plan_code IS DISTINCT FROM public.normalize_legacy_organization_plan(e.plano);

CREATE OR REPLACE FUNCTION public.sync_legacy_organization_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text := public.normalize_legacy_organization_plan(NEW.plano);
BEGIN
  IF v_plan IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.organization_subscriptions (organization_id, plan_code, status, updated_at)
  VALUES (NEW.id, v_plan, 'active', now())
  ON CONFLICT (organization_id) DO UPDATE
  SET plan_code = EXCLUDED.plan_code,
      status = 'active',
      updated_at = now()
  -- A assinatura Stripe é a fonte de verdade quando existe.
  WHERE public.organization_subscriptions.provider IS DISTINCT FROM 'stripe';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_legacy_organization_plan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_legacy_organization_plan() TO service_role;

DROP TRIGGER IF EXISTS sync_legacy_organization_plan ON public.empresas;
CREATE TRIGGER sync_legacy_organization_plan
AFTER INSERT OR UPDATE OF plano ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_organization_plan();
