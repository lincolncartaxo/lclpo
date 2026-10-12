-- Corrige a ingestão e o cálculo na arquitetura catalogo_* + precos_historicos_*.

CREATE OR REPLACE FUNCTION public.upsert_precos_composicoes_lote(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.precos_historicos_composicoes (
    codigo_composicao, fonte, uf, mes_ref,
    custo_desonerado, custo_nao_desonerado
  )
  SELECT
    btrim(rec->>'codigo_composicao'),
    upper(btrim(rec->>'fonte')),
    upper(btrim(rec->>'uf')),
    CASE
      WHEN btrim(rec->>'mes_ref') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN left(btrim(rec->>'mes_ref'), 7)
      ELSE btrim(rec->>'mes_ref')
    END,
    COALESCE(NULLIF(rec->>'preco_desonerado', '')::numeric, 0),
    COALESCE(NULLIF(rec->>'preco_nao_desonerado', '')::numeric, 0)
  FROM jsonb_array_elements(payload) AS rec
  ON CONFLICT (codigo_composicao, fonte, uf, mes_ref)
  DO UPDATE SET
    custo_desonerado = EXCLUDED.custo_desonerado,
    custo_nao_desonerado = EXCLUDED.custo_nao_desonerado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_precos_composicoes_lote(jsonb)
  TO authenticated, service_role;

-- A aplicação trabalha com YYYY-MM. Aceita YYYY-MM-01 para compatibilidade
-- com cargas antigas, mas sempre consulta a chave canônica YYYY-MM.
-- A versão antiga usa TEXT. VARCHAR criaria uma sobrecarga diferente e
-- deixaria a função antiga (que lê base_composicao_itens) sendo chamada.
DROP FUNCTION IF EXISTS public.calcular_custo_composicao(varchar, varchar, varchar, varchar, varchar);

CREATE OR REPLACE FUNCTION public.calcular_custo_composicao(
  p_fonte text,
  p_codigo text,
  p_uf text,
  p_mes_ref text DEFAULT '',
  p_regime text DEFAULT 'nao_desonerado'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_custo numeric := 0;
  v_item record;
  v_preco_item numeric;
  v_col_preco text;
  v_uf_search text := upper(NULLIF(btrim(p_uf), ''));
  v_mes_search text := NULLIF(btrim(p_mes_ref), '');
BEGIN
  v_uf_search := COALESCE(v_uf_search, 'PB');
  IF v_mes_search ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    v_mes_search := left(v_mes_search, 7);
  END IF;

  v_col_preco := CASE WHEN p_regime = 'desonerado'
    THEN 'preco_desonerado' ELSE 'preco_nao_desonerado' END;

  FOR v_item IN
    SELECT tipo_item, codigo_item, coeficiente
    FROM public.catalogo_composicao_itens
    WHERE fonte = p_fonte AND codigo_composicao = p_codigo
  LOOP
    IF upper(v_item.tipo_item) = 'INSUMO' THEN
      IF v_mes_search IS NULL THEN
        EXECUTE format(
          'SELECT %I FROM public.precos_historicos_insumos
           WHERE codigo_insumo = $1 AND fonte = $2 AND (uf = $3 OR uf = ''BR'')
           ORDER BY (uf = $3) DESC, mes_ref DESC LIMIT 1', v_col_preco)
        INTO v_preco_item
        USING btrim(v_item.codigo_item), p_fonte, v_uf_search;
      ELSE
        EXECUTE format(
          'SELECT %I FROM public.precos_historicos_insumos
           WHERE codigo_insumo = $1 AND fonte = $2 AND (uf = $3 OR uf = ''BR'') AND mes_ref = $4
           ORDER BY (uf = $3) DESC LIMIT 1', v_col_preco)
        INTO v_preco_item
        USING btrim(v_item.codigo_item), p_fonte, v_uf_search, v_mes_search;
      END IF;
      v_custo := v_custo + COALESCE(v_preco_item, 0) * COALESCE(v_item.coeficiente, 0);
    ELSE
      v_custo := v_custo + public.calcular_custo_composicao(
        p_fonte, btrim(v_item.codigo_item), v_uf_search, COALESCE(v_mes_search, ''), p_regime
      ) * COALESCE(v_item.coeficiente, 0);
    END IF;
  END LOOP;

  IF v_custo = 0 THEN
    v_col_preco := CASE WHEN p_regime = 'desonerado'
      THEN 'custo_desonerado' ELSE 'custo_nao_desonerado' END;
    IF v_mes_search IS NULL THEN
      EXECUTE format(
        'SELECT %I FROM public.precos_historicos_composicoes
         WHERE codigo_composicao = $1 AND fonte = $2 AND (uf = $3 OR uf = ''BR'')
         ORDER BY (uf = $3) DESC, mes_ref DESC LIMIT 1', v_col_preco)
      INTO v_custo USING btrim(p_codigo), p_fonte, v_uf_search;
    ELSE
      EXECUTE format(
        'SELECT %I FROM public.precos_historicos_composicoes
         WHERE codigo_composicao = $1 AND fonte = $2 AND (uf = $3 OR uf = ''BR'') AND mes_ref = $4
         ORDER BY (uf = $3) DESC LIMIT 1', v_col_preco)
      INTO v_custo USING btrim(p_codigo), p_fonte, v_uf_search, v_mes_search;
    END IF;
  END IF;

  RETURN COALESCE(v_custo, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_custo_composicao(text, text, text, text, text)
  TO anon, authenticated, service_role;
