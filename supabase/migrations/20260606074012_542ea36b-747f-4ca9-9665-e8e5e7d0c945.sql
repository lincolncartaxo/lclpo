
-- Add user_id columns (nullable for existing non-PRÓPRIA rows)
ALTER TABLE public.base_composicoes ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.base_insumos ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.base_composicao_itens ADD COLUMN IF NOT EXISTS user_id uuid;

-- Auto-stamp user_id on insert for PRÓPRIA rows
CREATE OR REPLACE FUNCTION public.set_base_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_id_base_composicoes ON public.base_composicoes;
CREATE TRIGGER set_user_id_base_composicoes
  BEFORE INSERT ON public.base_composicoes
  FOR EACH ROW EXECUTE FUNCTION public.set_base_user_id();

DROP TRIGGER IF EXISTS set_user_id_base_insumos ON public.base_insumos;
CREATE TRIGGER set_user_id_base_insumos
  BEFORE INSERT ON public.base_insumos
  FOR EACH ROW EXECUTE FUNCTION public.set_base_user_id();

DROP TRIGGER IF EXISTS set_user_id_base_composicao_itens ON public.base_composicao_itens;
CREATE TRIGGER set_user_id_base_composicao_itens
  BEFORE INSERT ON public.base_composicao_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_base_user_id();

-- Tighten DELETE/UPDATE policies to row owner
DROP POLICY IF EXISTS "base comp itens delete propria" ON public.base_composicao_itens;
DROP POLICY IF EXISTS "base comp itens update propria" ON public.base_composicao_itens;
DROP POLICY IF EXISTS "base comp itens insert propria" ON public.base_composicao_itens;

CREATE POLICY "base comp itens insert own propria"
  ON public.base_composicao_itens FOR INSERT TO authenticated
  WITH CHECK (fonte = 'PRÓPRIA' AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "base comp itens update own propria"
  ON public.base_composicao_itens FOR UPDATE TO authenticated
  USING (fonte = 'PRÓPRIA' AND user_id = auth.uid())
  WITH CHECK (fonte = 'PRÓPRIA' AND user_id = auth.uid());

CREATE POLICY "base comp itens delete own propria"
  ON public.base_composicao_itens FOR DELETE TO authenticated
  USING (fonte = 'PRÓPRIA' AND user_id = auth.uid());

DROP POLICY IF EXISTS "base comp delete propria" ON public.base_composicoes;
DROP POLICY IF EXISTS "base comp update propria" ON public.base_composicoes;
DROP POLICY IF EXISTS "base comp insert propria" ON public.base_composicoes;

CREATE POLICY "base comp insert own propria"
  ON public.base_composicoes FOR INSERT TO authenticated
  WITH CHECK (fonte = 'PRÓPRIA' AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "base comp update own propria"
  ON public.base_composicoes FOR UPDATE TO authenticated
  USING (fonte = 'PRÓPRIA' AND user_id = auth.uid())
  WITH CHECK (fonte = 'PRÓPRIA' AND user_id = auth.uid());

CREATE POLICY "base comp delete own propria"
  ON public.base_composicoes FOR DELETE TO authenticated
  USING (fonte = 'PRÓPRIA' AND user_id = auth.uid());

DROP POLICY IF EXISTS "base insumos delete propria" ON public.base_insumos;
DROP POLICY IF EXISTS "base insumos update propria" ON public.base_insumos;
DROP POLICY IF EXISTS "base insumos insert propria" ON public.base_insumos;

CREATE POLICY "base insumos insert own propria"
  ON public.base_insumos FOR INSERT TO authenticated
  WITH CHECK (fonte = 'PRÓPRIA' AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "base insumos update own propria"
  ON public.base_insumos FOR UPDATE TO authenticated
  USING (fonte = 'PRÓPRIA' AND user_id = auth.uid())
  WITH CHECK (fonte = 'PRÓPRIA' AND user_id = auth.uid());

CREATE POLICY "base insumos delete own propria"
  ON public.base_insumos FOR DELETE TO authenticated
  USING (fonte = 'PRÓPRIA' AND user_id = auth.uid());
