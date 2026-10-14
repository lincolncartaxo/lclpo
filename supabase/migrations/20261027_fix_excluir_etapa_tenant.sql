-- Permite que qualquer membro do tenant exclua uma etapa compartilhada.
-- A versão anterior autorizava apenas o user_id criador do orçamento.
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
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = p_orcamento_id
      AND (
        o.user_id = auth.uid()
        OR (o.organization_id IS NOT NULL AND public.is_organization_member(o.organization_id))
      )
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
        AND (
          trim(coalesce(item, '')) = v_prefix
          OR trim(coalesce(item, '')) LIKE v_prefix || '.%'
        )
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

REVOKE ALL ON FUNCTION public.excluir_etapa_orcamento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_etapa_orcamento(uuid, text) TO authenticated, service_role;
