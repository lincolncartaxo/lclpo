ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS desconto_licitacao numeric NOT NULL DEFAULT 0 CHECK (desconto_licitacao >= 0 AND desconto_licitacao <= 100);
ALTER TABLE public.orcamento_licitacoes ADD COLUMN IF NOT EXISTS precos_itens jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.orcamento_licitacoes DROP CONSTRAINT IF EXISTS orcamento_licitacoes_modo_check;
ALTER TABLE public.orcamento_licitacoes ADD CONSTRAINT orcamento_licitacoes_modo_check CHECK (modo IN ('linear','linear_2_casas','individual'));
CREATE TABLE public.orcamento_medicoes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE, numero integer NOT NULL CHECK(numero>0), data_medicao date NOT NULL, observacao text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(orcamento_id,numero));
GRANT SELECT ON public.orcamento_medicoes TO authenticated;
GRANT ALL ON public.orcamento_medicoes TO service_role;
ALTER TABLE public.orcamento_medicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medicoes leitura orçamento" ON public.orcamento_medicoes FOR SELECT TO authenticated USING(public.can_read_orcamento(orcamento_id));
CREATE TABLE public.orcamento_medicao_itens (medicao_id uuid NOT NULL REFERENCES public.orcamento_medicoes(id) ON DELETE CASCADE, item_id uuid NOT NULL REFERENCES public.orcamento_itens(id) ON DELETE RESTRICT, quantidade numeric NOT NULL CHECK(quantidade>0), preco_unitario numeric NOT NULL CHECK(preco_unitario>=0), bdi numeric NOT NULL CHECK(bdi>=0), PRIMARY KEY(medicao_id,item_id));
GRANT SELECT ON public.orcamento_medicao_itens TO authenticated;
GRANT ALL ON public.orcamento_medicao_itens TO service_role;
ALTER TABLE public.orcamento_medicao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medicao itens leitura orçamento" ON public.orcamento_medicao_itens FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.orcamento_medicoes m WHERE m.id=medicao_id AND public.can_read_orcamento(m.orcamento_id)));
CREATE INDEX ON public.orcamento_medicao_itens(item_id);
CREATE OR REPLACE FUNCTION public.registrar_medicao(p_orcamento_id uuid,p_data date,p_observacao text,p_itens jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_num integer; v_row record; v_item record; v_prev numeric; v_factor numeric; v_total numeric; v_alvo numeric; v_mode text; v_prices jsonb; v_price numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_edit_orcamento(p_orcamento_id) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.orcamentos WHERE id=p_orcamento_id FOR UPDATE;
 IF p_data IS NULL OR length(COALESCE(p_observacao,''))>2000 OR jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens)=0 OR jsonb_array_length(p_itens)>10000 THEN RAISE EXCEPTION 'Medição inválida'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_itens) AS x(item_id uuid,quantidade numeric) GROUP BY item_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Item duplicado'; END IF;
 SELECT valor_final,modo,precos_itens INTO v_alvo,v_mode,v_prices FROM public.orcamento_licitacoes WHERE orcamento_id=p_orcamento_id;
 IF v_alvo IS NULL THEN RAISE EXCEPTION 'Salve a licitação antes de registrar medições'; END IF;
 SELECT sum(i.quantidade*i.preco_unitario*(1+COALESCE(b.bdi_pct,o.bdi_pct,0))) INTO v_total FROM public.orcamento_itens i JOIN public.orcamentos o ON o.id=i.orcamento_id LEFT JOIN public.orcamento_bdis b ON b.id=i.bdi_id WHERE i.orcamento_id=p_orcamento_id;
 IF v_total IS NULL OR v_total<=0 THEN RAISE EXCEPTION 'Orçamento sem valor'; END IF;
 v_factor:=v_alvo/v_total;
 SELECT COALESCE(max(numero),0)+1 INTO v_num FROM public.orcamento_medicoes WHERE orcamento_id=p_orcamento_id;
 INSERT INTO public.orcamento_medicoes(orcamento_id,numero,data_medicao,observacao) VALUES(p_orcamento_id,v_num,p_data,COALESCE(p_observacao,'')) RETURNING id INTO v_id;
 FOR v_row IN SELECT * FROM jsonb_to_recordset(p_itens) AS x(item_id uuid,quantidade numeric) LOOP
  SELECT i.*,COALESCE(b.bdi_pct,o.bdi_pct,0) AS item_bdi INTO v_item FROM public.orcamento_itens i JOIN public.orcamentos o ON o.id=i.orcamento_id LEFT JOIN public.orcamento_bdis b ON b.id=i.bdi_id WHERE i.id=v_row.item_id AND i.orcamento_id=p_orcamento_id FOR UPDATE OF i;
  IF NOT FOUND OR v_row.quantidade IS NULL OR v_row.quantidade<=0 OR v_row.quantidade::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Item ou quantidade inválida'; END IF;
  SELECT COALESCE(sum(mi.quantidade),0) INTO v_prev FROM public.orcamento_medicao_itens mi JOIN public.orcamento_medicoes m ON m.id=mi.medicao_id WHERE mi.item_id=v_row.item_id AND m.orcamento_id=p_orcamento_id;
  IF v_prev+v_row.quantidade>v_item.quantidade THEN RAISE EXCEPTION 'Quantidade medida excede o saldo do item %',v_item.item; END IF;
  v_price:=COALESCE((v_prices->>v_row.item_id::text)::numeric,CASE WHEN v_mode='individual' THEN v_item.preco_unitario*(1-v_item.desconto_licitacao/100) WHEN v_mode='linear_2_casas' THEN round(v_item.preco_unitario*v_factor,2) ELSE v_item.preco_unitario*v_factor END);
  IF v_price<0 OR v_price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Preço licitado inválido'; END IF;
  INSERT INTO public.orcamento_medicao_itens(medicao_id,item_id,quantidade,preco_unitario,bdi) VALUES(v_id,v_row.item_id,v_row.quantidade,v_price,v_item.item_bdi);
 END LOOP;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_medicao(uuid,date,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_medicao(uuid,date,text,jsonb) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guard_measured_item_quantity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_used numeric;
BEGIN SELECT COALESCE(sum(quantidade),0) INTO v_used FROM public.orcamento_medicao_itens WHERE item_id=NEW.id; IF NEW.quantidade<v_used THEN RAISE EXCEPTION 'Quantidade contratada não pode ser inferior ao total medido'; END IF; RETURN NEW; END;
$$;
CREATE TRIGGER guard_measured_item_quantity BEFORE UPDATE OF quantidade ON public.orcamento_itens FOR EACH ROW EXECUTE FUNCTION public.guard_measured_item_quantity();