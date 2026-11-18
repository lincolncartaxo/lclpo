CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_org uuid; v_name text;
BEGIN
 v_name:=COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'nome'),''),NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'),''),'Nova conta');
 INSERT INTO public.empresas(nome,plano,status) VALUES(left(v_name,160)||' — Empresa','basic','ativo') RETURNING id INTO v_org;
 INSERT INTO public.profiles(id,nome,id_empresa) VALUES(NEW.id,left(v_name,160),v_org);
 UPDATE public.organization_members SET role='owner' WHERE organization_id=v_org AND user_id=NEW.id;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;