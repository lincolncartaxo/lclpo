-- Recalcula automaticamente os itens de orçamento que usam uma composição
-- própria sempre que sua estrutura ou seus subitens forem alterados.

CREATE OR REPLACE FUNCTION public.recalcular_orcamentos_da_composicao(
  p_fonte text,
  p_codigo text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_orc record;
  v_preco numeric;
  v_mes text;
BEGIN
  FOR v_orc IN
    SELECT o.id, o.uf, o.ref_precos, o.regime
    FROM public.orcamentos o
    JOIN public.orcamento_itens oi ON oi.orcamento_id = o.id
    WHERE oi.fonte = p_fonte AND oi.codigo = p_codigo
    GROUP BY o.id, o.uf, o.ref_precos, o.regime
  LOOP
    v_mes := substring(COALESCE(v_orc.ref_precos, '') from '[0-9]{4}-[0-9]{2}');
    v_preco := public.calcular_custo_composicao(
      p_fonte,
      p_codigo,
      COALESCE(NULLIF(v_orc.uf, ''), 'PB'),
      COALESCE(v_mes, ''),
      COALESCE(NULLIF(v_orc.regime, ''), 'nao_desonerado')
    );

    UPDATE public.orcamento_itens
    SET preco_unitario = COALESCE(v_preco, 0)
    WHERE orcamento_id = v_orc.id
      AND fonte = p_fonte
      AND codigo = p_codigo;

    v_total := v_total + 1;
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_orcamentos_da_composicao(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_orcamentos_da_composicao(text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_recalcular_orcamentos_composicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'catalogo_composicao_itens' THEN
    PERFORM public.recalcular_orcamentos_da_composicao(
      COALESCE(NEW.fonte, OLD.fonte),
      COALESCE(NEW.codigo_composicao, OLD.codigo_composicao)
    );
  ELSE
    PERFORM public.recalcular_orcamentos_da_composicao(
      COALESCE(NEW.fonte, OLD.fonte),
      COALESCE(NEW.codigo, OLD.codigo)
    );
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_orcamentos_composicao ON public.catalogo_composicoes;
CREATE TRIGGER trg_refresh_orcamentos_composicao
AFTER UPDATE OF descricao, unidade ON public.catalogo_composicoes
FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_orcamentos_composicao();

DROP TRIGGER IF EXISTS trg_refresh_orcamentos_composicao_itens ON public.catalogo_composicao_itens;
CREATE TRIGGER trg_refresh_orcamentos_composicao_itens
AFTER INSERT OR UPDATE OR DELETE ON public.catalogo_composicao_itens
FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_orcamentos_composicao();

-- Corrige imediatamente os orçamentos existentes após a instalação da migration.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT fonte, codigo FROM public.orcamento_itens WHERE fonte IS NOT NULL AND codigo IS NOT NULL LOOP
    PERFORM public.recalcular_orcamentos_da_composicao(r.fonte, r.codigo);
  END LOOP;
END;
$$;
