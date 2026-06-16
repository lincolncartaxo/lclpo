DROP TABLE IF EXISTS public._stage_insumos_cd;
CREATE TABLE public._stage_insumos_cd (
  fonte text,
  codigo text,
  descricao text,
  unidade text,
  uf text,
  mes_ref date,
  preco numeric,
  origem text
);
GRANT SELECT, INSERT, TRUNCATE ON public._stage_insumos_cd TO PUBLIC;
ALTER TABLE public._stage_insumos_cd ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stage open" ON public._stage_insumos_cd FOR ALL USING (true) WITH CHECK (true);