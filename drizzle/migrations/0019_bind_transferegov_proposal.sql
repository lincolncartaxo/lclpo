ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS transferegov_proposta text;
CREATE UNIQUE INDEX IF NOT EXISTS orcamentos_transferegov_proposta_uq ON public.orcamentos (transferegov_proposta) WHERE transferegov_proposta IS NOT NULL;
CREATE OR REPLACE FUNCTION public.vincular_proposta_transferegov(p_orcamento_id uuid, p_proposta text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_atual text;
BEGIN
  IF NOT public.can_edit_orcamento(p_orcamento_id) THEN RAISE EXCEPTION 'Sem permissão para este orçamento'; END IF;
  SELECT transferegov_proposta INTO v_atual FROM public.orcamentos WHERE id = p_orcamento_id FOR UPDATE;
  IF v_atual IS NOT NULL AND v_atual <> p_proposta THEN
    RAISE EXCEPTION 'Este orçamento já está vinculado à proposta %', v_atual; END IF;
  IF EXISTS (SELECT 1 FROM public.orcamentos WHERE transferegov_proposta = p_proposta AND id <> p_orcamento_id) THEN
    RAISE EXCEPTION 'Esta proposta já está vinculada a outro orçamento'; END IF;
  UPDATE public.orcamentos SET transferegov_proposta = p_proposta WHERE id = p_orcamento_id;
END $$;
REVOKE ALL ON FUNCTION public.vincular_proposta_transferegov(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_proposta_transferegov(uuid, text) TO authenticated;