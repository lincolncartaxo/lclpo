-- Compatibilidade com instalações antigas onde catalogo_composicoes não possui id.
-- A chave funcional do catálogo é (fonte, codigo).

ALTER TABLE public.catalogo_composicoes
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'private';

ALTER TABLE public.catalogo_composicao_itens
  ADD COLUMN IF NOT EXISTS fonte_item varchar(20);

CREATE OR REPLACE FUNCTION public.calcular_custo_composicao(
  p_fonte text, p_codigo text, p_uf text,
  p_mes_ref text DEFAULT '', p_regime text DEFAULT 'nao_desonerado'
)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_custo numeric := 0; v_item record; v_preco_item numeric;
  v_col_preco text; v_item_fonte text;
  v_uf_search text := upper(NULLIF(btrim(p_uf), ''));
  v_mes_search text := NULLIF(btrim(p_mes_ref), '');
BEGIN
  v_uf_search := COALESCE(v_uf_search, 'PB');
  IF v_mes_search ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN v_mes_search := left(v_mes_search, 7); END IF;
  v_col_preco := CASE WHEN p_regime = 'desonerado' THEN 'preco_desonerado' ELSE 'preco_nao_desonerado' END;

  FOR v_item IN SELECT tipo_item, codigo_item, coeficiente, fonte_item
    FROM public.catalogo_composicao_itens
    WHERE fonte = p_fonte AND codigo_composicao = p_codigo
  LOOP
    v_item_fonte := COALESCE(NULLIF(btrim(v_item.fonte_item), ''), p_fonte);
    IF upper(v_item.tipo_item) = 'INSUMO' THEN
      IF v_mes_search IS NULL THEN
        EXECUTE format('SELECT %I FROM public.precos_historicos_insumos WHERE codigo_insumo=$1 AND fonte=$2 AND (uf=$3 OR uf=''BR'') ORDER BY (uf=$3) DESC, mes_ref DESC LIMIT 1', v_col_preco)
          INTO v_preco_item USING btrim(v_item.codigo_item), v_item_fonte, v_uf_search;
      ELSE
        EXECUTE format('SELECT %I FROM public.precos_historicos_insumos WHERE codigo_insumo=$1 AND fonte=$2 AND (uf=$3 OR uf=''BR'') AND mes_ref=$4 ORDER BY (uf=$3) DESC LIMIT 1', v_col_preco)
          INTO v_preco_item USING btrim(v_item.codigo_item), v_item_fonte, v_uf_search, v_mes_search;
      END IF;
      v_custo := v_custo + COALESCE(v_preco_item, 0) * COALESCE(v_item.coeficiente, 0);
    ELSE
      v_custo := v_custo + public.calcular_custo_composicao(v_item_fonte, btrim(v_item.codigo_item), v_uf_search, COALESCE(v_mes_search, ''), p_regime) * COALESCE(v_item.coeficiente, 0);
    END IF;
  END LOOP;

  IF v_custo = 0 THEN
    v_col_preco := CASE WHEN p_regime = 'desonerado' THEN 'custo_desonerado' ELSE 'custo_nao_desonerado' END;
    IF v_mes_search IS NULL THEN
      EXECUTE format('SELECT %I FROM public.precos_historicos_composicoes WHERE codigo_composicao=$1 AND fonte=$2 AND (uf=$3 OR uf=''BR'') ORDER BY (uf=$3) DESC, mes_ref DESC LIMIT 1', v_col_preco)
        INTO v_custo USING btrim(p_codigo), p_fonte, v_uf_search;
    ELSE
      EXECUTE format('SELECT %I FROM public.precos_historicos_composicoes WHERE codigo_composicao=$1 AND fonte=$2 AND (uf=$3 OR uf=''BR'') AND mes_ref=$4 ORDER BY (uf=$3) DESC LIMIT 1', v_col_preco)
        INTO v_custo USING btrim(p_codigo), p_fonte, v_uf_search, v_mes_search;
    END IF;
  END IF;
  RETURN COALESCE(v_custo, 0);
END; $$;
GRANT EXECUTE ON FUNCTION public.calcular_custo_composicao(text,text,text,text,text) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.composicao_shares (
  fonte varchar(20) NOT NULL,
  codigo_composicao varchar(50) NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view','edit')),
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fonte, codigo_composicao, organization_id)
);
ALTER TABLE public.composicao_shares ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.composicao_shares TO authenticated;

DROP POLICY IF EXISTS "composicao shares acesso" ON public.composicao_shares;
CREATE POLICY "composicao shares acesso" ON public.composicao_shares FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id) OR granted_by = auth.uid());
DROP POLICY IF EXISTS "composicao shares gerenciamento" ON public.composicao_shares;
CREATE POLICY "composicao shares gerenciamento" ON public.composicao_shares FOR ALL TO authenticated
USING (granted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (granted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.criar_composicao_propria(payload jsonb, itens jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  SELECT id_empresa INTO v_org FROM public.profiles WHERE id = auth.uid();
  IF v_org IS NULL THEN RAISE EXCEPTION 'Usuário não está vinculado a uma empresa'; END IF;
  INSERT INTO public.catalogo_composicoes (codigo, fonte, descricao, unidade, organization_id, created_by, access_mode)
  VALUES (btrim(payload->>'codigo'), 'PRÓPRIA', btrim(payload->>'descricao'), NULLIF(btrim(payload->>'unidade'), ''), v_org, auth.uid(), 'private');
  INSERT INTO public.catalogo_composicao_itens (codigo_composicao, fonte, fonte_item, tipo_item, codigo_item, coeficiente)
  SELECT btrim(payload->>'codigo'), 'PRÓPRIA', NULLIF(btrim(rec->>'fonte_item'), ''), upper(rec->>'tipo_item'), btrim(rec->>'codigo_item'), COALESCE(NULLIF(rec->>'coeficiente','')::numeric,0)
  FROM jsonb_array_elements(itens) rec;
  RETURN btrim(payload->>'codigo');
END; $$;
REVOKE ALL ON FUNCTION public.criar_composicao_propria(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_composicao_propria(jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.duplicar_composicao_propria(p_fonte_origem text, p_codigo_origem text, p_codigo text, p_descricao text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_src record; v_org uuid; v_new text;
BEGIN
  SELECT codigo, fonte, descricao, unidade, organization_id, created_by INTO v_src
  FROM public.catalogo_composicoes
  WHERE fonte = p_fonte_origem AND codigo = p_codigo_origem AND fonte = 'PRÓPRIA';
  IF NOT FOUND THEN RAISE EXCEPTION 'Composição própria não encontrada'; END IF;
  SELECT id_empresa INTO v_org FROM public.profiles WHERE id = auth.uid();
  IF v_org IS NULL OR NOT (v_src.organization_id = v_org OR v_src.created_by = auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para duplicar esta composição'; END IF;
  v_new := btrim(p_codigo);
  INSERT INTO public.catalogo_composicoes(codigo, fonte, descricao, unidade, organization_id, created_by, access_mode)
  VALUES(v_new, 'PRÓPRIA', COALESCE(NULLIF(btrim(p_descricao),''), v_src.descricao || ' - Cópia'), v_src.unidade, v_org, auth.uid(), 'private');
  INSERT INTO public.catalogo_composicao_itens(codigo_composicao,fonte,fonte_item,tipo_item,codigo_item,coeficiente)
  SELECT v_new,'PRÓPRIA',fonte_item,tipo_item,codigo_item,coeficiente FROM public.catalogo_composicao_itens
  WHERE codigo_composicao=p_codigo_origem AND fonte=p_fonte_origem;
  RETURN v_new;
END; $$;
REVOKE ALL ON FUNCTION public.duplicar_composicao_propria(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicar_composicao_propria(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.compartilhar_composicao(p_fonte text, p_codigo text, p_organization_id uuid, p_permission text DEFAULT 'view')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.catalogo_composicoes WHERE fonte=p_fonte AND codigo=p_codigo AND fonte='PRÓPRIA';
  IF v_org IS NULL OR NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id=v_org AND user_id=auth.uid() AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'Somente o administrador da empresa proprietária pode compartilhar'; END IF;
  INSERT INTO public.composicao_shares(fonte,codigo_composicao,organization_id,permission,granted_by)
  VALUES(p_fonte,p_codigo,p_organization_id,CASE WHEN p_permission='edit' THEN 'edit' ELSE 'view' END,auth.uid())
  ON CONFLICT(fonte,codigo_composicao,organization_id) DO UPDATE SET permission=EXCLUDED.permission;
END; $$;
REVOKE ALL ON FUNCTION public.compartilhar_composicao(text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compartilhar_composicao(text,text,uuid,text) TO authenticated;
