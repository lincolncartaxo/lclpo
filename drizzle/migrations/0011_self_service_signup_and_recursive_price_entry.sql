CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_org uuid; v_name text;
BEGIN
 v_name:=COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'nome'),''),NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'),''),'Nova conta');
 INSERT INTO public.empresas(nome,plano,status) VALUES(left(v_name,160)||' — Empresa','basic','ativo') RETURNING id INTO v_org;
 INSERT INTO public.profiles(id,nome,id_empresa) VALUES(NEW.id,left(v_name,160),v_org);
 INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(v_org,NEW.id,'owner') ON CONFLICT(organization_id,user_id) DO UPDATE SET role='owner';
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.calcular_custo_composicao(p_fonte text,p_codigo text,p_uf text,p_mes_ref text DEFAULT '',p_regime text DEFAULT 'nao_desonerado') RETURNS numeric LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT public.calcular_custo_composicao_recursivo(p_fonte,p_codigo,p_uf,p_mes_ref,p_regime); $$;
REVOKE ALL ON FUNCTION public.calcular_custo_composicao(text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.calcular_custo_composicao(text,text,text,text,text) TO authenticated,service_role;