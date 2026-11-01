-- Importações analíticas oficiais podem conter dezenas de milhares de vínculos.
-- O trigger antigo recalculava todos os orçamentos a cada linha apagada/inserida,
-- fazendo a RPC exceder o statement_timeout. Composições PRÓPRIA continuam
-- recalculando imediatamente; catálogos oficiais são consultados dinamicamente
-- pela resolução de preços e não devem disparar esse recálculo por linha.

CREATE OR REPLACE FUNCTION public.trg_recalcular_orcamentos_composicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fonte text;
  v_codigo text;
BEGIN
  -- O mesmo trigger é usado nas tabelas com estruturas diferentes.
  -- Não referenciar NEW.codigo_composicao no trigger de catalogo_composicoes.
  IF TG_TABLE_NAME = 'catalogo_composicao_itens' THEN
    v_fonte := upper(btrim(COALESCE(NEW.fonte, OLD.fonte, '')));
    v_codigo := btrim(COALESCE(NEW.codigo_composicao, OLD.codigo_composicao, ''));
  ELSE
    v_fonte := upper(btrim(COALESCE(NEW.fonte, OLD.fonte, '')));
    v_codigo := btrim(COALESCE(NEW.codigo, OLD.codigo, ''));
  END IF;

  -- SINAPI, SICRO, ORSE e demais catálogos oficiais são importados em lote.
  -- O recálculo individual aqui transforma uma carga de 55 mil linhas em
  -- dezenas de milhares de consultas repetidas e causa timeout.
  IF v_fonte <> 'PRÓPRIA' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF v_codigo <> '' THEN
    PERFORM public.recalcular_orcamentos_da_composicao(v_fonte, v_codigo);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
