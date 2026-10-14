-- Cada subitem mantém sua fonte original. UF, mês e regime continuam sendo
-- resolvidos dinamicamente conforme o orçamento que usa a composição.
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

  FOR v_item IN
    SELECT tipo_item, codigo_item, coeficiente, fonte_item
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

CREATE OR REPLACE FUNCTION public.criar_composicao_propria(payload jsonb, itens jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_id integer;
BEGIN
  SELECT id_empresa INTO v_org FROM public.profiles WHERE id = auth.uid();
  IF v_org IS NULL THEN RAISE EXCEPTION 'Usuário não está vinculado a uma empresa'; END IF;
  INSERT INTO public.catalogo_composicoes (codigo, fonte, descricao, unidade, organization_id, created_by, access_mode)
  VALUES (btrim(payload->>'codigo'), 'PRÓPRIA', btrim(payload->>'descricao'), NULLIF(btrim(payload->>'unidade'), ''), v_org, auth.uid(), 'private')
  RETURNING id INTO v_id;
  INSERT INTO public.catalogo_composicao_itens (codigo_composicao, fonte, fonte_item, tipo_item, codigo_item, coeficiente)
  SELECT btrim(payload->>'codigo'), 'PRÓPRIA', NULLIF(btrim(rec->>'fonte_item'), ''), upper(rec->>'tipo_item'), btrim(rec->>'codigo_item'), COALESCE(NULLIF(rec->>'coeficiente','')::numeric,0)
  FROM jsonb_array_elements(itens) rec;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.duplicar_composicao_propria(p_composicao_id integer, p_codigo text, p_descricao text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_src public.catalogo_composicoes%ROWTYPE; v_org uuid; v_new integer;
BEGIN
  SELECT * INTO v_src FROM public.catalogo_composicoes WHERE id=p_composicao_id AND fonte='PRÓPRIA';
  IF NOT FOUND THEN RAISE EXCEPTION 'Composição própria não encontrada'; END IF;
  SELECT id_empresa INTO v_org FROM public.profiles WHERE id=auth.uid();
  IF v_org IS NULL OR NOT (v_src.organization_id=v_org OR v_src.created_by=auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para duplicar esta composição'; END IF;
  INSERT INTO public.catalogo_composicoes(codigo,fonte,descricao,unidade,organization_id,created_by,access_mode)
  VALUES (btrim(p_codigo),'PRÓPRIA',COALESCE(NULLIF(btrim(p_descricao),''),v_src.descricao||' - Cópia'),v_src.unidade,v_org,auth.uid(),'private') RETURNING id INTO v_new;
  INSERT INTO public.catalogo_composicao_itens(codigo_composicao,fonte,fonte_item,tipo_item,codigo_item,coeficiente)
  SELECT btrim(p_codigo),'PRÓPRIA',fonte_item,tipo_item,codigo_item,coeficiente FROM public.catalogo_composicao_itens
  WHERE codigo_composicao=v_src.codigo AND fonte='PRÓPRIA';
  RETURN v_new;
END; $$;
