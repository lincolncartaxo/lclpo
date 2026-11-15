ALTER TABLE public.organization_subscriptions ADD COLUMN IF NOT EXISTS stripe_event_created bigint NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS subscription_stripe_customer_unique ON public.organization_subscriptions(provider_customer_id) WHERE provider_customer_id IS NOT NULL;
CREATE TABLE public.billing_events (event_id text PRIMARY KEY, organization_id uuid REFERENCES public.empresas(id), event_type text NOT NULL, event_created bigint NOT NULL, outcome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.can_manage_organization_billing(p_organization_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=p_organization_id AND m.user_id=auth.uid() AND m.role IN ('owner','admin')); $$;
REVOKE ALL ON FUNCTION public.can_manage_organization_billing(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_organization_billing(uuid) TO authenticated,service_role;
CREATE POLICY billing_events_manager_read ON public.billing_events FOR SELECT TO authenticated USING(public.can_manage_organization_billing(organization_id));
CREATE OR REPLACE FUNCTION public.bind_stripe_customer(p_organization_id uuid,p_customer_id text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_customer text;
BEGIN
 IF p_customer_id !~ '^cus_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'Invalid customer'; END IF;
 SELECT provider_customer_id INTO v_customer FROM public.organization_subscriptions WHERE organization_id=p_organization_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;
 IF v_customer IS NOT NULL AND v_customer<>p_customer_id THEN RAISE EXCEPTION 'Customer already bound'; END IF;
 UPDATE public.organization_subscriptions SET provider_customer_id=p_customer_id WHERE organization_id=p_organization_id;
 RETURN p_customer_id;
END; $$;
REVOKE ALL ON FUNCTION public.bind_stripe_customer(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bind_stripe_customer(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.apply_stripe_billing_event(p_event_id text,p_event_type text,p_event_created bigint,p_organization_id uuid,p_customer_id text,p_subscription_id text,p_plan_code text,p_status text,p_period_end timestamptz,p_trial_end timestamptz) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.organization_subscriptions%ROWTYPE; v_outcome text;
BEGIN
 SELECT * INTO s FROM public.organization_subscriptions WHERE organization_id=p_organization_id FOR UPDATE;
 IF NOT FOUND OR s.provider_customer_id IS DISTINCT FROM p_customer_id THEN RAISE EXCEPTION 'Unbound billing customer'; END IF;
 IF EXISTS(SELECT 1 FROM public.billing_events WHERE event_id=p_event_id) THEN RETURN 'duplicate'; END IF;
 IF p_status NOT IN ('active','trialing','past_due','canceled','paused') OR NOT EXISTS(SELECT 1 FROM public.plan_definitions WHERE code=p_plan_code AND active) THEN RAISE EXCEPTION 'Invalid subscription'; END IF;
 IF s.provider IS DISTINCT FROM 'stripe' AND s.plan_code<>'free' THEN v_outcome:='manual_preserved';
 ELSIF p_event_created<s.stripe_event_created THEN v_outcome:='stale';
 ELSE
 UPDATE public.organization_subscriptions SET provider='stripe',provider_subscription_id=p_subscription_id,plan_code=p_plan_code,status=p_status,current_period_end=p_period_end,trial_ends_at=p_trial_end,stripe_event_created=p_event_created,updated_at=now() WHERE organization_id=p_organization_id;
 v_outcome:='applied';
 END IF;
 INSERT INTO public.billing_events(event_id,organization_id,event_type,event_created,outcome) VALUES(p_event_id,p_organization_id,p_event_type,p_event_created,v_outcome);
 RETURN v_outcome;
END; $$;
REVOKE ALL ON FUNCTION public.apply_stripe_billing_event(text,text,bigint,uuid,text,text,text,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_billing_event(text,text,bigint,uuid,text,text,text,text,timestamptz,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.enforce_organization_budget_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_limit integer; v_count bigint; v_org uuid:=NEW.organization_id;
BEGIN
 IF TG_OP='UPDATE' AND OLD.organization_id IS NOT DISTINCT FROM NEW.organization_id THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Não é permitido transferir o orçamento para outra empresa' USING ERRCODE='42501'; END IF;
 IF v_org IS NULL THEN SELECT id_empresa INTO v_org FROM public.profiles WHERE id=COALESCE(NEW.user_id,auth.uid()); END IF;
 IF v_org IS NULL THEN RAISE EXCEPTION 'Orçamento precisa estar vinculado a uma empresa' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text,41001));
 SELECT p.max_budgets INTO v_limit FROM public.organization_subscriptions s JOIN public.plan_definitions p ON p.code=s.plan_code AND p.active WHERE s.organization_id=v_org AND ((s.status='active' AND (s.current_period_end IS NULL OR s.current_period_end>now())) OR (s.status='trialing' AND (s.trial_ends_at IS NULL OR s.trial_ends_at>now())));
 IF v_limit IS NULL THEN RAISE EXCEPTION 'A organização não possui uma assinatura ativa' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO v_count FROM public.orcamentos WHERE organization_id=v_org AND id<>NEW.id;
 IF v_count>=v_limit THEN RAISE EXCEPTION 'Limite do plano atingido: até % orçamento(s)',v_limit USING ERRCODE='23514'; END IF;
 NEW.organization_id:=v_org; RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.enforce_organization_member_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_limit integer; v_count bigint;
BEGIN
 IF TG_OP='UPDATE' AND OLD.organization_id=NEW.organization_id AND OLD.user_id=NEW.user_id THEN RETURN NEW; END IF;
 IF NEW.organization_id IS NULL THEN RAISE EXCEPTION 'Membro precisa estar vinculado a uma empresa' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text,41002));
 SELECT p.max_users INTO v_limit FROM public.organization_subscriptions s JOIN public.plan_definitions p ON p.code=s.plan_code AND p.active WHERE s.organization_id=NEW.organization_id AND ((s.status='active' AND (s.current_period_end IS NULL OR s.current_period_end>now())) OR (s.status='trialing' AND (s.trial_ends_at IS NULL OR s.trial_ends_at>now())));
 IF v_limit IS NULL THEN RAISE EXCEPTION 'A organização não possui uma assinatura ativa' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO v_count FROM public.organization_members WHERE organization_id=NEW.organization_id AND NOT(TG_OP='UPDATE' AND user_id=OLD.user_id AND organization_id=OLD.organization_id);
 IF v_count>=v_limit THEN RAISE EXCEPTION 'Limite do plano atingido: até % usuário(s)',v_limit USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;