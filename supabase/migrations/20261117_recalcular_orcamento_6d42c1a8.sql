-- Recalcula somente o orçamento informado pelo usuário.
-- Executar após 20261117_corrigir_preco_composicao_hierarquica.sql.
DO $$
DECLARE
  r record;
  v_preco numeric;
BEGIN
  FOR r IN
    SELECT oi.id, oi.fonte, oi.codigo, o.uf, o.ref_precos, o.regime
    FROM public.orcamento_itens oi
    JOIN public.orcamentos o ON o.id = oi.orcamento_id
    -- O identificador informado na interface é exibido abreviado. A coluna
    -- contém o UUID completo; por isso comparamos o prefixo como texto.
    WHERE oi.orcamento_id::text LIKE '6d42c1a8%'
      AND oi.fonte IS NOT NULL
      AND oi.codigo IS NOT NULL
  LOOP
    v_preco := public.calcular_custo_composicao(
      r.fonte,
      r.codigo,
      r.uf,
      COALESCE(NULLIF(split_part(COALESCE(r.ref_precos, ''), '|', 2), ''), ''),
      COALESCE(r.regime, 'nao_desonerado')
    );
    IF v_preco > 0 THEN
      UPDATE public.orcamento_itens
         SET preco_unitario = v_preco
       WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;
