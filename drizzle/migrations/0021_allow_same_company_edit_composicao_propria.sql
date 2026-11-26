CREATE OR REPLACE FUNCTION public.salvar_composicao_propria(payload jsonb, itens jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_codigo text := NULLIF(btrim(payload->>'codigo'), '');
  v_descricao text := NULLIF(btrim(payload->>'descricao'), '');
  v_unidade text := NULLIF(btrim(payload->>'unidade'), '');
  v_existing record;
  v_invalid integer;
  v_can_edit boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;
  IF v_codigo IS NULL OR v_descricao IS NULL THEN
    RAISE EXCEPTION 'Código e descrição são obrigatórios';
  END IF;
  IF jsonb_typeof(itens) <> 'array' OR jsonb_array_length(itens) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos um componente';
  END IF;

  SELECT count(*) INTO v_invalid
  FROM jsonb_array_elements(itens) AS rec
  WHERE NULLIF(btrim(rec->>'codigo_item'), '') IS NULL
     OR upper(btrim(rec->>'tipo_item')) NOT IN ('INSUMO', 'COMPOSICAO')
     OR NULLIF(btrim(rec->>'fonte_item'), '') IS NULL
     OR NULLIF(replace(rec->>'coeficiente', ',', '.'), '') IS NULL;
  IF v_invalid > 0 THEN
    RAISE EXCEPTION 'Cada componente deve informar fonte, código, tipo e coeficiente';
  END IF;

  SELECT id_empresa INTO v_org
  FROM public.profiles
  WHERE id = auth.uid();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuário não está vinculado a uma empresa';
  END IF;

  SELECT organization_id, created_by
    INTO v_existing
    FROM public.catalogo_composicoes
   WHERE fonte = 'PRÓPRIA' AND codigo = v_codigo
   FOR UPDATE;

  IF FOUND THEN
    v_can_edit := (
      v_existing.created_by = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (
        v_existing.organization_id IS NOT NULL
        AND v_existing.organization_id = v_org
        AND public.is_organization_member(v_existing.organization_id)
      )
    );
    IF NOT v_can_edit THEN
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
         btrim(rec->>'fonte_item'),
         upper(btrim(rec->>'tipo_item')),
         btrim(rec->>'codigo_item'),
         replace(rec->>'coeficiente', ',', '.')::numeric
    FROM jsonb_array_elements(itens) AS rec;

  RETURN v_codigo;
END;
$function$;