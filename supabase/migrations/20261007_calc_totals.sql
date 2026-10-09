-- Create a function to get budget totals fast
CREATE OR REPLACE FUNCTION get_orcamento_totals()
RETURNS TABLE (orcamento_id UUID, total NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT i.orcamento_id, COALESCE(SUM(i.quantidade * i.preco_unitario), 0) AS total
  FROM public.orcamento_itens i
  GROUP BY i.orcamento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
