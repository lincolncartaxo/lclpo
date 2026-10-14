-- Exclusão transacional de uma etapa do orçamento.
-- Remove itens pelo campo etapa e também pela numeração hierárquica.

CREATE OR REPLACE FUNCTION public.excluir_etapa_orcamento(
  p_orcamento_id uuid,
  p_etapa text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_deleted integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.orcamentos
    WHERE id = p_orcamento_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este orçamento';
  END IF;

  v_prefix := substring(trim(p_etapa) from '^([0-9]+(?:\.[0-9]+)*)');

  DELETE FROM public.orcamento_itens
  WHERE orcamento_id = p_orcamento_id
    AND (
      trim(coalesce(etapa, '')) = trim(p_etapa)
      OR (
        v_prefix IS NOT NULL
        AND trim(coalesce(item, '')) IN (v_prefix)
        OR v_prefix IS NOT NULL
        AND trim(coalesce(item, '')) LIKE v_prefix || '.%'
      )
    );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  DELETE FROM public.orcamento_cronograma
  WHERE orcamento_id = p_orcamento_id
    AND (
      trim(etapa) = trim(p_etapa)
      OR (
        v_prefix IS NOT NULL
        AND substring(trim(etapa) from '^([0-9]+(?:\.[0-9]+)*)') = v_prefix
      )
    );

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_etapa_orcamento(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_etapa_orcamento(uuid,text) TO authenticated, service_role;
