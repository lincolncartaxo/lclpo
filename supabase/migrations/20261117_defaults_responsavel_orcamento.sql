-- Dados padrão do responsável técnico para novos orçamentos.
ALTER TABLE public.orcamentos
  ALTER COLUMN engenheiro SET DEFAULT 'LINCOLN CARTAXO DE LIRA JÚNIOR',
  ALTER COLUMN crea SET DEFAULT '160814689-8';

-- Completa somente registros antigos sem responsável, preservando valores já
-- informados pelo usuário.
UPDATE public.orcamentos
   SET engenheiro = 'LINCOLN CARTAXO DE LIRA JÚNIOR'
 WHERE engenheiro IS NULL OR btrim(engenheiro) = '';

UPDATE public.orcamentos
   SET crea = '160814689-8'
 WHERE crea IS NULL OR btrim(crea) = '';
