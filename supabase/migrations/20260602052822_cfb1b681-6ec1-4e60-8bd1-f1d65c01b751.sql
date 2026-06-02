
-- Permitir que usuários autenticados criem/editem/excluam registros próprios nas bases (fonte = 'PRÓPRIA')
CREATE POLICY "base comp insert propria" ON public.base_composicoes
  FOR INSERT TO authenticated WITH CHECK (fonte = 'PRÓPRIA');
CREATE POLICY "base comp update propria" ON public.base_composicoes
  FOR UPDATE TO authenticated USING (fonte = 'PRÓPRIA') WITH CHECK (fonte = 'PRÓPRIA');
CREATE POLICY "base comp delete propria" ON public.base_composicoes
  FOR DELETE TO authenticated USING (fonte = 'PRÓPRIA');

CREATE POLICY "base ins insert propria" ON public.base_insumos
  FOR INSERT TO authenticated WITH CHECK (fonte = 'PRÓPRIA');
CREATE POLICY "base ins update propria" ON public.base_insumos
  FOR UPDATE TO authenticated USING (fonte = 'PRÓPRIA') WITH CHECK (fonte = 'PRÓPRIA');
CREATE POLICY "base ins delete propria" ON public.base_insumos
  FOR DELETE TO authenticated USING (fonte = 'PRÓPRIA');

CREATE POLICY "base comp itens insert propria" ON public.base_composicao_itens
  FOR INSERT TO authenticated WITH CHECK (fonte = 'PRÓPRIA');
CREATE POLICY "base comp itens update propria" ON public.base_composicao_itens
  FOR UPDATE TO authenticated USING (fonte = 'PRÓPRIA') WITH CHECK (fonte = 'PRÓPRIA');
CREATE POLICY "base comp itens delete propria" ON public.base_composicao_itens
  FOR DELETE TO authenticated USING (fonte = 'PRÓPRIA');

GRANT INSERT, UPDATE, DELETE ON public.base_composicoes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.base_insumos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.base_composicao_itens TO authenticated;
