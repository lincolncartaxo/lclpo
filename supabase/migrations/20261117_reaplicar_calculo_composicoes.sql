-- Reaplica a função final de cálculo para instalações que executaram migrations anteriores.
-- Esta versão calcula PRÓPRIA exclusivamente pelo analítico e arredonda o total.
--
-- Cenário corrigido: 102488 -> 95277. O código 95277 é uma COMPOSIÇÃO,
-- portanto deve ser calculado recursivamente. Um registro sintético com valor
-- zero não pode prevalecer sobre o custo analítico válido.
-- Também aceita códigos com/sem zeros à esquerda em todas as relações.

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
  v_child numeric;
  v_direct numeric;
  v_col_preco text;
  v_item_fonte text;
  v_uf_search text := upper(NULLIF(btrim(p_uf), ''));
  v_mes_search text := NULLIF(btrim(p_mes_ref), '');
  v_codigo text := btrim(p_codigo);
  v_codigo_item text;
  v_missing boolean := false;
BEGIN
  v_uf_search := COALESCE(v_uf_search, 'PB');
  IF v_mes_search ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    v_mes_search := left(v_mes_search, 7);
  END IF;

  v_col_preco := CASE
    WHEN p_regime = 'desonerado' THEN 'preco_desonerado'
    ELSE 'preco_nao_desonerado'
  END;

  -- A comparação sem zeros à esquerda é necessária porque as planilhas
  -- misturam, por exemplo, 95277 e 00095277.
  FOR v_item IN
    SELECT tipo_item, codigo_item, coeficiente, fonte_item
    FROM public.catalogo_composicao_itens
    WHERE fonte = p_fonte
      AND (
        codigo_composicao = v_codigo
        OR ltrim(codigo_composicao, '0') = ltrim(v_codigo, '0')
      )
  LOOP
    v_codigo_item := btrim(v_item.codigo_item);
    v_item_fonte := NULLIF(btrim(v_item.fonte_item), '');

    -- Composições próprias podem referenciar itens de fontes diferentes.
    IF v_item_fonte IS NULL AND upper(p_fonte) IN ('PRÓPRIA', 'PROPRIA') THEN
      IF upper(v_item.tipo_item) = 'INSUMO' THEN
        SELECT p.fonte INTO v_item_fonte
        FROM public.precos_historicos_insumos p
        WHERE (p.codigo_insumo = v_codigo_item
               OR ltrim(p.codigo_insumo, '0') = ltrim(v_codigo_item, '0'))
          AND (p.uf = v_uf_search OR p.uf = 'BR')
          AND (v_mes_search IS NULL OR p.mes_ref = v_mes_search)
        ORDER BY (p.uf = v_uf_search) DESC, p.mes_ref DESC
        LIMIT 1;
      ELSE
        SELECT c.fonte INTO v_item_fonte
        FROM public.catalogo_composicoes c
        WHERE (c.codigo = v_codigo_item
               OR ltrim(c.codigo, '0') = ltrim(v_codigo_item, '0'))
          AND upper(c.fonte) NOT IN ('PRÓPRIA', 'PROPRIA')
        ORDER BY c.fonte
        LIMIT 1;
      END IF;
    END IF;
    v_item_fonte := COALESCE(v_item_fonte, p_fonte);
    v_preco_item := NULL;

    IF upper(v_item.tipo_item) = 'INSUMO' THEN
      IF v_mes_search IS NULL THEN
        EXECUTE format(
          'SELECT %I
             FROM public.precos_historicos_insumos
            WHERE (codigo_insumo = $1 OR ltrim(codigo_insumo, ''0'') = ltrim($1, ''0''))
              AND fonte = $2
              AND (uf = $3 OR uf = ''BR'')
            ORDER BY (uf = $3) DESC, mes_ref DESC
            LIMIT 1', v_col_preco
        ) INTO v_preco_item
        USING v_codigo_item, v_item_fonte, v_uf_search;
      ELSE
        EXECUTE format(
          'SELECT %I
             FROM public.precos_historicos_insumos
            WHERE (codigo_insumo = $1 OR ltrim(codigo_insumo, ''0'') = ltrim($1, ''0''))
              AND fonte = $2
              AND (uf = $3 OR uf = ''BR'')
              AND mes_ref = $4
            ORDER BY (uf = $3) DESC
            LIMIT 1', v_col_preco
        ) INTO v_preco_item
        USING v_codigo_item, v_item_fonte, v_uf_search, v_mes_search;
      END IF;

      IF v_preco_item IS NULL THEN
        v_missing := true;
      END IF;
      v_custo := v_custo + COALESCE(v_preco_item, 0) * COALESCE(v_item.coeficiente, 0);
    ELSE
      v_child := public.calcular_custo_composicao(
        v_item_fonte,
        v_codigo_item,
        v_uf_search,
        COALESCE(v_mes_search, ''),
        p_regime
      );
      IF v_child IS NULL OR v_child <= 0 THEN
        v_missing := true;
      END IF;
      v_custo := v_custo + COALESCE(v_child, 0) * COALESCE(v_item.coeficiente, 0);
    END IF;
  END LOOP;

  -- O custo sintético é usado como referência quando é positivo. Valor zero
  -- significa ausência de preço para aquele regime/mês e deve permitir o
  -- fallback analítico (caso 95277).
  v_col_preco := CASE
    WHEN p_regime = 'desonerado' THEN 'custo_desonerado'
    ELSE 'custo_nao_desonerado'
  END;

  IF v_mes_search IS NULL THEN
    EXECUTE format(
      'SELECT %I
         FROM public.precos_historicos_composicoes
        WHERE (codigo_composicao = $1 OR ltrim(codigo_composicao, ''0'') = ltrim($1, ''0''))
          AND fonte = $2
          AND (uf = $3 OR uf = ''BR'')
          AND %I > 0
        ORDER BY (uf = $3) DESC, mes_ref DESC
        LIMIT 1', v_col_preco, v_col_preco
    ) INTO v_direct
    USING v_codigo, p_fonte, v_uf_search;
  ELSE
    EXECUTE format(
      'SELECT %I
         FROM public.precos_historicos_composicoes
        WHERE (codigo_composicao = $1 OR ltrim(codigo_composicao, ''0'') = ltrim($1, ''0''))
          AND fonte = $2
          AND (uf = $3 OR uf = ''BR'')
          AND mes_ref = $4
          AND %I > 0
        ORDER BY (uf = $3) DESC
        LIMIT 1', v_col_preco, v_col_preco
    ) INTO v_direct
    USING v_codigo, p_fonte, v_uf_search, v_mes_search;
  END IF;

  -- Quando a base possui custo sintético positivo, ele é o valor oficial da
  -- composição. O analítico continua sendo fallback para bases sem custo
  -- sintético, evitando divergências de centavos por arredondamento.
  IF v_direct IS NOT NULL
     AND upper(COALESCE(p_fonte, '')) NOT IN ('PRÓPRIA', 'PROPRIA') THEN
    RETURN v_direct;
  END IF;
  IF v_custo > 0 THEN
    -- O arredondamento é feito no total, e não em cada parcela. Assim, por
    -- exemplo, 4,6557 torna-se 4,66 em uma composição própria.
    RETURN round(v_custo, 2);
  END IF;
  RETURN COALESCE(v_direct, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_custo_composicao(text, text, text, text, text)
  TO authenticated, service_role;

-- O recálculo dos itens existentes deve ser executado separadamente e por
-- orçamento. Não o fazemos aqui para evitar timeout em bases comerciais.
