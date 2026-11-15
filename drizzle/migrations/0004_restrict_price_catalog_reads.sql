DROP POLICY IF EXISTS "catalogo insumos leitura autenticada" ON public.catalogo_insumos;
DROP POLICY IF EXISTS "precos insumos leitura autenticada" ON public.precos_historicos_insumos;
DROP POLICY IF EXISTS "precos composicoes leitura autenticada" ON public.precos_historicos_composicoes;
CREATE POLICY "catalogo insumos leitura membros" ON public.catalogo_insumos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid()));
CREATE POLICY "precos insumos leitura membros" ON public.precos_historicos_insumos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid()));
CREATE POLICY "precos composicoes leitura membros" ON public.precos_historicos_composicoes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid()));