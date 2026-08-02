CREATE OR REPLACE FUNCTION public.calcular_custo_composicao(
  p_fonte text,
  p_codigo text,
  p_uf text,
  p_mes_ref text,
  p_regime text DEFAULT 'nao_desonerado'::text
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric := 0;
  v_child numeric;
  r record;
  v_price_col text := CASE WHEN p_regime = 'desonerado' THEN 'preco_desonerado' ELSE 'preco_nao_desonerado' END;
  v_price numeric;
  v_mes text;
BEGIN
  IF p_mes_ref IS NULL OR btrim(p_mes_ref) = '' THEN
    SELECT max(mes_ref)
      INTO v_mes
      FROM public.base_insumos
     WHERE fonte = p_fonte
       AND uf = p_uf
       AND mes_ref ~ '^\d{4}-\d{2}-\d{2}$';
  ELSE
    v_mes := CASE
      WHEN p_mes_ref ~ '^\d{4}-\d{2}$' THEN p_mes_ref || '-01'
      ELSE p_mes_ref
    END;
  END IF;

  FOR r IN
    SELECT tipo, insumo_codigo, coeficiente
      FROM public.base_composicao_itens
     WHERE fonte = p_fonte
       AND composicao_codigo = p_codigo
  LOOP
    IF r.tipo = 'COMPOSICAO' THEN
      v_child := public.calcular_custo_composicao(p_fonte, r.insumo_codigo, p_uf, v_mes, p_regime);
    ELSE
      EXECUTE format(
        'SELECT %I FROM public.base_insumos WHERE fonte=$1 AND codigo=$2 AND uf=$3 AND mes_ref=$4 ORDER BY id DESC LIMIT 1',
        v_price_col
      ) INTO v_price USING p_fonte, r.insumo_codigo, p_uf, v_mes;
      v_child := coalesce(v_price, 0);
    END IF;
    v_total := v_total + coalesce(r.coeficiente, 0) * coalesce(v_child, 0);
  END LOOP;

  RETURN v_total;
END;
$function$;