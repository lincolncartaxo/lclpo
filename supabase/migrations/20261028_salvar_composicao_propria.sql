-- Unifica criação e edição de composições próprias no catálogo analítico.
-- A operação e a troca da lista de itens são atômicas; não depende da tabela
-- legada base_propria_composicoes, ausente em algumas instalações.
CREATE OR REPLACE FUNCTION public.salvar_composicao_propria(payload jsonb, itens jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_codigo text := NULLIF(btrim(payload->>'codigo'), '');
  v_descricao text := NULLIF(btrim(payload->>'descricao'), '');
  v_unidade text := NULLIF(btrim(payload->>'unidade'), '');
  v_existing record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  IF v_codigo IS NULL OR v_descricao IS NULL THEN
    RAISE EXCEPTION 'Código e descrição são obrigatórios';
  END IF;
  IF jsonb_typeof(itens) <> 'array' THEN
    RAISE EXCEPTION 'A lista de itens deve ser um array';
  END IF;

  SELECT id_empresa INTO v_org FROM public.profiles WHERE id = auth.uid();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuário não está vinculado a uma empresa';
  END IF;

  SELECT organization_id, created_by
    INTO v_existing
    FROM public.catalogo_composicoes
   WHERE fonte = 'PRÓPRIA' AND codigo = v_codigo
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing.organization_id IS DISTINCT FROM v_org
       AND v_existing.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Sem permissão para alterar esta composição';
    END IF;
    UPDATE public.catalogo_composicoes
       SET descricao = v_descricao, unidade = v_unidade
     WHERE fonte = 'PRÓPRIA' AND codigo = v_codigo;
  ELSE
    INSERT INTO public.catalogo_composicoes
      (codigo, fonte, descricao, unidade, organization_id, created_by, access_mode)
    VALUES
      (v_codigo, 'PRÓPRIA', v_descricao, v_unidade, v_org, auth.uid(), 'private');
  END IF;

  DELETE FROM public.catalogo_composicao_itens
   WHERE fonte = 'PRÓPRIA' AND codigo_composicao = v_codigo;

  INSERT INTO public.catalogo_composicao_itens
    (codigo_composicao, fonte, fonte_item, tipo_item, codigo_item, coeficiente)
  SELECT v_codigo,
         'PRÓPRIA',
         NULLIF(btrim(rec->>'fonte_item'), ''),
         upper(btrim(rec->>'tipo_item')),
         btrim(rec->>'codigo_item'),
         COALESCE(NULLIF(replace(rec->>'coeficiente', ',', '.'), '')::numeric, 0)
    FROM jsonb_array_elements(itens) AS rec
   WHERE NULLIF(btrim(rec->>'codigo_item'), '') IS NOT NULL
     AND upper(btrim(rec->>'tipo_item')) IN ('INSUMO', 'COMPOSICAO');

  IF (SELECT count(*) FROM jsonb_array_elements(itens)) <>
     (SELECT count(*) FROM jsonb_array_elements(itens) rec
       WHERE NULLIF(btrim(rec->>'codigo_item'), '') IS NOT NULL
         AND upper(btrim(rec->>'tipo_item')) IN ('INSUMO', 'COMPOSICAO')) THEN
    RAISE EXCEPTION 'Há item sem código ou tipo válido';
  END IF;

  RETURN v_codigo;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_composicao_propria(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_composicao_propria(jsonb, jsonb) TO authenticated;
