
DROP FUNCTION IF EXISTS public.calcular_custo_composicao(text, text, text, date, text);

CREATE OR REPLACE FUNCTION public.calcular_custo_composicao(
  p_fonte text,
  p_codigo text,
  p_uf text,
  p_mes_ref text,
  p_regime text DEFAULT 'nao_desonerado'
) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_total numeric := 0;
  v_child numeric;
  r RECORD;
  v_price_col text := CASE WHEN p_regime = 'desonerado' THEN 'preco_desonerado' ELSE 'preco_nao_desonerado' END;
  v_price numeric;
  v_mes text;
BEGIN
  IF p_mes_ref IS NULL OR p_mes_ref = '' THEN
    SELECT MAX(mes_ref) INTO v_mes FROM base_insumos WHERE fonte = p_fonte;
  ELSE
    v_mes := p_mes_ref;
  END IF;

  FOR r IN
    SELECT tipo, insumo_codigo, coeficiente
    FROM base_composicao_itens
    WHERE fonte = p_fonte AND composicao_codigo = p_codigo
  LOOP
    IF r.tipo = 'COMPOSICAO' THEN
      v_child := public.calcular_custo_composicao(p_fonte, r.insumo_codigo, p_uf, v_mes, p_regime);
    ELSE
      EXECUTE format(
        'SELECT %I FROM base_insumos WHERE fonte=$1 AND codigo=$2 AND uf=$3 AND mes_ref=$4 LIMIT 1',
        v_price_col
      ) INTO v_price USING p_fonte, r.insumo_codigo, p_uf, v_mes;
      v_child := COALESCE(v_price, 0);
    END IF;
    v_total := v_total + COALESCE(r.coeficiente,0) * COALESCE(v_child,0);
  END LOOP;
  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_custo_composicao(text, text, text, text, text) TO authenticated, anon, service_role;
