-- O preço direto da composição é a referência oficial quando existir.
-- O cálculo analítico só prevalece quando todos os subitens possuem preço.

CREATE OR REPLACE FUNCTION public.calcular_custo_composicao(
  p_fonte text, p_codigo text, p_uf text,
  p_mes_ref text DEFAULT '', p_regime text DEFAULT 'nao_desonerado'
)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_custo numeric := 0; v_item record; v_preco_item numeric; v_child numeric;
  v_col_preco text; v_item_fonte text; v_missing boolean := false;
  v_uf_search text := upper(NULLIF(btrim(p_uf), ''));
  v_mes_search text := NULLIF(btrim(p_mes_ref), '');
  v_codigo_item text;
  v_direct numeric;
BEGIN
  v_uf_search := COALESCE(v_uf_search, 'PB');
  IF v_mes_search ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN v_mes_search := left(v_mes_search, 7); END IF;
  v_col_preco := CASE WHEN p_regime = 'desonerado' THEN 'preco_desonerado' ELSE 'preco_nao_desonerado' END;

  FOR v_item IN SELECT tipo_item, codigo_item, coeficiente, fonte_item
    FROM public.catalogo_composicao_itens
    WHERE fonte = p_fonte AND codigo_composicao = p_codigo
  LOOP
    v_codigo_item := btrim(v_item.codigo_item);
    v_item_fonte := NULLIF(btrim(v_item.fonte_item), '');
    IF v_item_fonte IS NULL AND p_fonte = 'PRÓPRIA' THEN
      IF upper(v_item.tipo_item) = 'INSUMO' THEN
        SELECT p.fonte INTO v_item_fonte FROM public.precos_historicos_insumos p
        WHERE (p.codigo_insumo = v_codigo_item OR ltrim(p.codigo_insumo, '0') = ltrim(v_codigo_item, '0'))
          AND (p.uf = v_uf_search OR p.uf = 'BR')
          AND (v_mes_search IS NULL OR p.mes_ref = v_mes_search)
        ORDER BY (p.uf = v_uf_search) DESC, p.mes_ref DESC LIMIT 1;
      ELSE
        SELECT c.fonte INTO v_item_fonte FROM public.catalogo_composicoes c
        WHERE (c.codigo = v_codigo_item OR ltrim(c.codigo, '0') = ltrim(v_codigo_item, '0')) AND c.fonte <> 'PRÓPRIA'
        ORDER BY c.fonte LIMIT 1;
      END IF;
    END IF;
    v_item_fonte := COALESCE(v_item_fonte, p_fonte);
    v_preco_item := NULL;

    IF upper(v_item.tipo_item) = 'INSUMO' THEN
      IF v_mes_search IS NULL THEN
        EXECUTE format('SELECT %I FROM public.precos_historicos_insumos WHERE (codigo_insumo=$1 OR ltrim(codigo_insumo,''0'')=ltrim($1,''0'')) AND fonte=$2 AND (uf=$3 OR uf=''BR'') ORDER BY (uf=$3) DESC, mes_ref DESC LIMIT 1', v_col_preco)
          INTO v_preco_item USING v_codigo_item, v_item_fonte, v_uf_search;
      ELSE
        EXECUTE format('SELECT %I FROM public.precos_historicos_insumos WHERE (codigo_insumo=$1 OR ltrim(codigo_insumo,''0'')=ltrim($1,''0'')) AND fonte=$2 AND (uf=$3 OR uf=''BR'') AND mes_ref=$4 ORDER BY (uf=$3) DESC LIMIT 1', v_col_preco)
          INTO v_preco_item USING v_codigo_item, v_item_fonte, v_uf_search, v_mes_search;
      END IF;
      IF v_preco_item IS NULL THEN v_missing := true; END IF;
      v_custo := v_custo + COALESCE(v_preco_item, 0) * COALESCE(v_item.coeficiente, 0);
    ELSE
      v_child := public.calcular_custo_composicao(v_item_fonte, v_codigo_item, v_uf_search, COALESCE(v_mes_search, ''), p_regime);
      IF v_child IS NULL OR v_child = 0 THEN v_missing := true; END IF;
      v_custo := v_custo + COALESCE(v_child, 0) * COALESCE(v_item.coeficiente, 0);
    END IF;
  END LOOP;

  v_direct := NULL;
  v_col_preco := CASE WHEN p_regime = 'desonerado' THEN 'custo_desonerado' ELSE 'custo_nao_desonerado' END;
  IF v_mes_search IS NULL THEN
    EXECUTE format('SELECT %I FROM public.precos_historicos_composicoes WHERE (codigo_composicao=$1 OR ltrim(codigo_composicao,''0'')=ltrim($1,''0'')) AND fonte=$2 AND (uf=$3 OR uf=''BR'') ORDER BY (uf=$3) DESC, mes_ref DESC LIMIT 1', v_col_preco)
      INTO v_direct USING btrim(p_codigo), p_fonte, v_uf_search;
  ELSE
    EXECUTE format('SELECT %I FROM public.precos_historicos_composicoes WHERE (codigo_composicao=$1 OR ltrim(codigo_composicao,''0'')=ltrim($1,''0'')) AND fonte=$2 AND (uf=$3 OR uf=''BR'') AND mes_ref=$4 ORDER BY (uf=$3) DESC LIMIT 1', v_col_preco)
      INTO v_direct USING btrim(p_codigo), p_fonte, v_uf_search, v_mes_search;
  END IF;

  IF v_direct IS NOT NULL AND (v_missing OR v_custo = 0) THEN
    RETURN v_direct;
  END IF;
  RETURN COALESCE(v_custo, v_direct, 0);
END; $$;

GRANT EXECUTE ON FUNCTION public.calcular_custo_composicao(text,text,text,text,text) TO authenticated, service_role;

-- Recalcula imediatamente os orçamentos afetados pela nova regra.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT fonte, codigo FROM public.orcamento_itens WHERE fonte IS NOT NULL AND codigo IS NOT NULL LOOP
    PERFORM public.recalcular_orcamentos_da_composicao(r.fonte, r.codigo);
  END LOOP;
END;
$$;
