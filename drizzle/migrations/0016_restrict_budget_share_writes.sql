DROP POLICY IF EXISTS "orcamento shares gerenciamento comercial" ON public.orcamento_shares;
CREATE POLICY "orcamento shares gerenciamento comercial" ON public.orcamento_shares FOR ALL TO authenticated
USING (public.can_delete_orcamento(orcamento_id))
WITH CHECK (granted_by = auth.uid() AND public.can_delete_orcamento(orcamento_id) AND permission IN ('view','edit'));