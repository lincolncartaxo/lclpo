-- Permite que o importador server-side use a sessão autenticada do administrador
-- quando Edge Functions não estão disponíveis no projeto Lovable.
-- Nenhuma tabela fica aberta para usuários comuns.

CREATE OR REPLACE FUNCTION public.assert_import_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem importar bases de preços';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_catalogo_insumos_lote(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_import_admin();
  INSERT INTO public.catalogo_insumos (codigo, fonte, descricao, unidade)
  SELECT btrim(rec->>'codigo'), upper(btrim(rec->>'fonte')),
         COALESCE(NULLIF(btrim(rec->>'descricao'), ''), '[Descrição não informada]'),
         NULLIF(btrim(rec->>'unidade'), '')
  FROM jsonb_array_elements(payload) rec
  WHERE NULLIF(btrim(rec->>'codigo'), '') IS NOT NULL
  ON CONFLICT (codigo, fonte) DO UPDATE SET descricao = EXCLUDED.descricao, unidade = EXCLUDED.unidade;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_catalogo_composicoes_lote(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_import_admin();
  INSERT INTO public.catalogo_composicoes (codigo, fonte, descricao, unidade, classe)
  SELECT btrim(rec->>'codigo'), upper(btrim(rec->>'fonte')),
         COALESCE(NULLIF(btrim(rec->>'descricao'), ''), '[Descrição não informada]'),
         NULLIF(btrim(rec->>'unidade'), ''), NULLIF(btrim(rec->>'classe'), '')
  FROM jsonb_array_elements(payload) rec
  WHERE NULLIF(btrim(rec->>'codigo'), '') IS NOT NULL
  ON CONFLICT (codigo, fonte) DO UPDATE SET descricao = EXCLUDED.descricao, unidade = EXCLUDED.unidade, classe = EXCLUDED.classe;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_precos_insumos_lote(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_import_admin();
  INSERT INTO public.precos_historicos_insumos
    (codigo_insumo, fonte, uf, mes_ref, preco_desonerado, preco_nao_desonerado)
  SELECT btrim(rec->>'codigo_insumo'), upper(btrim(rec->>'fonte')), upper(btrim(rec->>'uf')),
         btrim(rec->>'mes_ref'), COALESCE(NULLIF(rec->>'preco_desonerado', '')::numeric, 0),
         COALESCE(NULLIF(rec->>'preco_nao_desonerado', '')::numeric, 0)
  FROM jsonb_array_elements(payload) rec
  ON CONFLICT (codigo_insumo, fonte, uf, mes_ref) DO UPDATE SET
    preco_desonerado = EXCLUDED.preco_desonerado, preco_nao_desonerado = EXCLUDED.preco_nao_desonerado;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_precos_composicoes_lote(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_import_admin();
  INSERT INTO public.precos_historicos_composicoes
    (codigo_composicao, fonte, uf, mes_ref, custo_desonerado, custo_nao_desonerado)
  SELECT btrim(rec->>'codigo_composicao'), upper(btrim(rec->>'fonte')), upper(btrim(rec->>'uf')),
         btrim(rec->>'mes_ref'), COALESCE(NULLIF(rec->>'preco_desonerado', '')::numeric, 0),
         COALESCE(NULLIF(rec->>'preco_nao_desonerado', '')::numeric, 0)
  FROM jsonb_array_elements(payload) rec
  ON CONFLICT (codigo_composicao, fonte, uf, mes_ref) DO UPDATE SET
    custo_desonerado = EXCLUDED.custo_desonerado, custo_nao_desonerado = EXCLUDED.custo_nao_desonerado;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_catalogo_composicao_itens_lote(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_import_admin();
  INSERT INTO public.catalogo_composicao_itens
    (codigo_composicao, fonte, tipo_item, codigo_item, coeficiente)
  SELECT btrim(rec->>'codigo_composicao'), upper(btrim(rec->>'fonte')),
         upper(btrim(rec->>'tipo_item')), btrim(rec->>'codigo_item'),
         COALESCE(NULLIF(rec->>'coeficiente', '')::numeric, 0)
  FROM jsonb_array_elements(payload) rec
  ON CONFLICT (codigo_composicao, fonte, tipo_item, codigo_item) DO UPDATE SET coeficiente = EXCLUDED.coeficiente;
END; $$;

REVOKE ALL ON FUNCTION public.assert_import_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_import_admin() TO service_role;
REVOKE ALL ON FUNCTION public.upsert_catalogo_insumos_lote(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_catalogo_composicoes_lote(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_precos_insumos_lote(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_precos_composicoes_lote(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_catalogo_composicao_itens_lote(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_catalogo_insumos_lote(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_catalogo_composicoes_lote(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_precos_insumos_lote(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_precos_composicoes_lote(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_catalogo_composicao_itens_lote(jsonb) TO authenticated, service_role;

-- Compatibilidade imediata com a versão do frontend que ainda faz upsert direto.
GRANT INSERT, UPDATE ON TABLE public.catalogo_insumos, public.catalogo_composicoes,
  public.precos_historicos_insumos, public.precos_historicos_composicoes,
  public.catalogo_composicao_itens TO authenticated;

DROP POLICY IF EXISTS "admin importa catalogo insumos" ON public.catalogo_insumos;
CREATE POLICY "admin importa catalogo insumos" ON public.catalogo_insumos FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "admin importa catalogo composicoes" ON public.catalogo_composicoes;
CREATE POLICY "admin importa catalogo composicoes" ON public.catalogo_composicoes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "admin importa precos insumos" ON public.precos_historicos_insumos;
CREATE POLICY "admin importa precos insumos" ON public.precos_historicos_insumos FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "admin importa precos composicoes" ON public.precos_historicos_composicoes;
CREATE POLICY "admin importa precos composicoes" ON public.precos_historicos_composicoes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "admin importa itens analiticos" ON public.catalogo_composicao_itens;
CREATE POLICY "admin importa itens analiticos" ON public.catalogo_composicao_itens FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
