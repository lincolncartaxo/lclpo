CREATE OR REPLACE FUNCTION public.calcular_custo_composicao_recursivo(p_fonte text,p_codigo text,p_uf text,p_mes_ref text,p_regime text,p_caminho text[] DEFAULT ARRAY[]::text[]) RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_codigo text; v_mes text:=NULLIF(left(btrim(p_mes_ref),7),''); v_uf text:=COALESCE(NULLIF(upper(btrim(p_uf)),''),'PB'); v_chave text; v_item record; v_fonte text; v_preco numeric; v_total numeric:=0; v_has_items boolean:=false;
BEGIN
 IF p_regime NOT IN ('desonerado','nao_desonerado') THEN RAISE EXCEPTION 'Regime inválido' USING ERRCODE='22023'; END IF;
 IF v_mes IS NOT NULL AND v_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Mês de referência inválido' USING ERRCODE='22023'; END IF;
 SELECT codigo INTO v_codigo FROM public.catalogo_composicoes WHERE fonte=p_fonte AND ltrim(codigo,'0')=ltrim(btrim(p_codigo),'0') ORDER BY (codigo=btrim(p_codigo)) DESC LIMIT 1;
 v_codigo:=COALESCE(v_codigo,btrim(p_codigo)); v_chave:=p_fonte||':'||v_codigo;
 IF v_chave=ANY(p_caminho) THEN RAISE EXCEPTION 'Ciclo na composição %',v_chave USING ERRCODE='22023'; END IF;
 IF cardinality(p_caminho)>=50 THEN RAISE EXCEPTION 'Composição excede a profundidade máxima' USING ERRCODE='22023'; END IF;
 FOR v_item IN SELECT tipo_item,codigo_item,coeficiente,fonte_item FROM public.catalogo_composicao_itens WHERE fonte=p_fonte AND codigo_composicao=v_codigo LOOP
 v_has_items:=true; v_fonte:=COALESCE(NULLIF(btrim(v_item.fonte_item),''),p_fonte);
 IF p_fonte='PRÓPRIA' AND NULLIF(btrim(v_item.fonte_item),'') IS NULL THEN
 IF upper(v_item.tipo_item)='INSUMO' THEN
 SELECT fonte INTO v_fonte FROM public.precos_historicos_insumos WHERE ltrim(codigo_insumo,'0')=ltrim(btrim(v_item.codigo_item),'0') AND (uf=v_uf OR uf='BR') AND (v_mes IS NULL OR mes_ref=v_mes) ORDER BY (uf=v_uf) DESC,mes_ref DESC,fonte LIMIT 1;
 ELSE
 SELECT fonte INTO v_fonte FROM public.catalogo_composicoes WHERE ltrim(codigo,'0')=ltrim(btrim(v_item.codigo_item),'0') AND fonte<>'PRÓPRIA' ORDER BY fonte LIMIT 1;
 END IF;
 v_fonte:=COALESCE(v_fonte,p_fonte);
 END IF;
 IF upper(v_item.tipo_item)='INSUMO' THEN
 SELECT CASE WHEN p_regime='desonerado' THEN preco_desonerado ELSE preco_nao_desonerado END INTO v_preco FROM public.precos_historicos_insumos WHERE fonte=v_fonte AND ltrim(codigo_insumo,'0')=ltrim(btrim(v_item.codigo_item),'0') AND (uf=v_uf OR uf='BR') AND (v_mes IS NULL OR mes_ref=v_mes) ORDER BY (uf=v_uf) DESC,mes_ref DESC,(codigo_insumo=btrim(v_item.codigo_item)) DESC LIMIT 1;
 ELSE
 v_preco:=public.calcular_custo_composicao_recursivo(v_fonte,btrim(v_item.codigo_item),v_uf,COALESCE(v_mes,''),p_regime,array_append(p_caminho,v_chave));
 END IF;
 v_total:=v_total+trunc(COALESCE(v_preco,0)*COALESCE(v_item.coeficiente,0),2);
 END LOOP;
 IF v_has_items THEN RETURN v_total; END IF;
 SELECT CASE WHEN p_regime='desonerado' THEN custo_desonerado ELSE custo_nao_desonerado END INTO v_preco FROM public.precos_historicos_composicoes WHERE fonte=p_fonte AND ltrim(codigo_composicao,'0')=ltrim(v_codigo,'0') AND (uf=v_uf OR uf='BR') AND (v_mes IS NULL OR mes_ref=v_mes) ORDER BY (uf=v_uf) DESC,mes_ref DESC,(codigo_composicao=v_codigo) DESC LIMIT 1;
 RETURN COALESCE(v_preco,0);
END; $$;
REVOKE ALL ON FUNCTION public.calcular_custo_composicao_recursivo(text,text,text,text,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.calcular_custo_composicao_recursivo(text,text,text,text,text,text[]) TO authenticated,service_role;