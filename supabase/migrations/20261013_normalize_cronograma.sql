-- Normalização de dados legados do Cronograma F/F.
-- Registros antigos armazenavam 20 em vez de 0,20 para representar 20%.
UPDATE public.orcamento_cronograma
SET percentual = percentual / 100
WHERE percentual > 1 AND percentual <= 100;

-- Corrige a variação de nomenclatura que fazia a mesma etapa aparecer
-- como duas chaves diferentes entre usuários/navegadores.
-- A versão plural é a utilizada pelos itens atuais do orçamento.
DELETE FROM public.orcamento_cronograma old
WHERE old.etapa = '1 - Serviço Preliminares'
  AND EXISTS (
    SELECT 1
    FROM public.orcamento_cronograma current_row
    WHERE current_row.orcamento_id = old.orcamento_id
      AND current_row.etapa = '1 - Serviços Preliminares'
      AND current_row.mes = old.mes
  );

UPDATE public.orcamento_cronograma
SET etapa = '1 - Serviços Preliminares'
WHERE etapa = '1 - Serviço Preliminares';
