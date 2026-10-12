-- Migration: Recriar views/funcoes dependentes do banco de precos e dropar velharias

-- Drop a funcao antiga
DROP FUNCTION IF EXISTS public.calcular_custo_composicao(character varying, character varying, character varying, character varying, character varying);

-- Cria a nova funcao para ler do catalogo e precos_historicos_insumos
-- Como no banco antigo nos tinhamos "base_composicao_itens", vamos precisar ter as Composicoes Analiticas (Itens da Composicao) na nova estrutura.
-- Ja criamos no passo anterior: `catalogo_composicao_itens`.
-- Essa funcao calcula o custo batendo diretamente na composicao_itens + historico.
CREATE OR REPLACE FUNCTION public.calcular_custo_composicao(p_fonte character varying, p_codigo character varying, p_uf character varying, p_mes_ref character varying DEFAULT ''::character varying, p_regime character varying DEFAULT 'nao_desonerado'::character varying)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_custo numeric := 0;
  v_item record;
  v_preco_item numeric;
  v_col_preco text;
  v_uf_search text := p_uf;
  v_mes_search text := p_mes_ref;
BEGIN
  -- Se p_uf for branco, assume PB
  IF p_uf IS NULL OR p_uf = '' THEN
    v_uf_search := 'PB';
  END IF;

  v_col_preco := CASE WHEN p_regime = 'desonerado' THEN 'preco_desonerado' ELSE 'preco_nao_desonerado' END;

  FOR v_item IN
    SELECT tipo_item, codigo_item, coeficiente 
    FROM public.catalogo_composicao_itens
    WHERE fonte = p_fonte AND codigo_composicao = p_codigo
  LOOP
    IF v_item.tipo_item = 'INSUMO' THEN
      v_preco_item := 0;
      
      IF v_mes_search IS NULL OR v_mes_search = '' THEN
        -- Pega o mês mais recente disponível para aquele insumo na UF
        EXECUTE format('
          SELECT %I FROM public.precos_historicos_insumos
          WHERE codigo_insumo = $1 AND fonte = $2 AND uf = $3
          ORDER BY mes_ref DESC LIMIT 1
        ', v_col_preco)
        INTO v_preco_item
        USING v_item.codigo_item, p_fonte, v_uf_search;
      ELSE
        -- Busca no mês exato
        EXECUTE format('
          SELECT %I FROM public.precos_historicos_insumos
          WHERE codigo_insumo = $1 AND fonte = $2 AND uf = $3 AND mes_ref = $4
          LIMIT 1
        ', v_col_preco)
        INTO v_preco_item
        USING v_item.codigo_item, p_fonte, v_uf_search, v_mes_search;
      END IF;

      v_custo := v_custo + (COALESCE(v_preco_item, 0) * v_item.coeficiente);
      
    ELSE
      -- Chamada recursiva para subcomposicao
      v_custo := v_custo + (public.calcular_custo_composicao(p_fonte, v_item.codigo_item, v_uf_search, v_mes_search, p_regime) * v_item.coeficiente);
    END IF;
  END LOOP;

  -- Se a composicao nao tem itens (ex: base_propria sem filhos, ou arquivo nao subido), tenta puxar do custo_historico direto (Sintetico)
  IF v_custo = 0 THEN
    v_col_preco := CASE WHEN p_regime = 'desonerado' THEN 'custo_desonerado' ELSE 'custo_nao_desonerado' END;
    IF v_mes_search IS NULL OR v_mes_search = '' THEN
      EXECUTE format('
        SELECT %I FROM public.precos_historicos_composicoes
        WHERE codigo_composicao = $1 AND fonte = $2 AND uf = $3
        ORDER BY mes_ref DESC LIMIT 1
      ', v_col_preco)
      INTO v_custo
      USING p_codigo, p_fonte, v_uf_search;
    ELSE
      EXECUTE format('
        SELECT %I FROM public.precos_historicos_composicoes
        WHERE codigo_composicao = $1 AND fonte = $2 AND uf = $3 AND mes_ref = $4
        LIMIT 1
      ', v_col_preco)
      INTO v_custo
      USING p_codigo, p_fonte, v_uf_search, v_mes_search;
    END IF;
  END IF;

  RETURN COALESCE(v_custo, 0);
END;
$function$;
