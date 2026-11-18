-- Remove toda a base de preços SINAPI/PB de 2026-06.
--
-- Escopo confirmado: fonte SINAPI, UF PB, mês 2026-06, nas tabelas de
-- preços de insumos e de composições.
--
-- Os catálogos NÃO são apagados: catalogo_insumos e catalogo_composicoes
-- são globais, não possuem mês/UF e podem ser reutilizados em outras bases.
-- A migration anterior baseada na lista do CSV não precisa ser executada.

BEGIN;

CREATE TABLE IF NOT EXISTS public._backup_20261118_precos_insumos_sinapi_pb_202606
AS SELECT p.*
   FROM public.precos_historicos_insumos p
   WHERE false;

CREATE UNIQUE INDEX IF NOT EXISTS _backup_20261118_precos_insumos_sinapi_pb_202606_key_idx
  ON public._backup_20261118_precos_insumos_sinapi_pb_202606
     (codigo_insumo, fonte, uf, mes_ref);

CREATE TABLE IF NOT EXISTS public._backup_20261118_precos_composicoes_sinapi_pb_202606
AS SELECT p.*
   FROM public.precos_historicos_composicoes p
   WHERE false;

CREATE UNIQUE INDEX IF NOT EXISTS _backup_20261118_precos_composicoes_sinapi_pb_202606_key_idx
  ON public._backup_20261118_precos_composicoes_sinapi_pb_202606
     (codigo_composicao, fonte, uf, mes_ref);

DO $$
DECLARE
  v_insumos integer;
  v_composicoes integer;
BEGIN
  SELECT count(*) INTO v_insumos
    FROM public.precos_historicos_insumos p
   WHERE upper(btrim(p.fonte)) = 'SINAPI'
     AND upper(btrim(p.uf)) = 'PB'
     AND p.mes_ref = '2026-06';

  SELECT count(*) INTO v_composicoes
    FROM public.precos_historicos_composicoes p
   WHERE upper(btrim(p.fonte)) = 'SINAPI'
     AND upper(btrim(p.uf)) = 'PB'
     AND p.mes_ref = '2026-06';

  IF v_insumos + v_composicoes = 0 THEN
    RAISE NOTICE 'Nenhum registro SINAPI/PB/2026-06 foi encontrado; nada a remover.';
  END IF;

  RAISE NOTICE 'Registros encontrados: % insumos e % composicoes', v_insumos, v_composicoes;
END $$;

INSERT INTO public._backup_20261118_precos_insumos_sinapi_pb_202606
SELECT p.*
  FROM public.precos_historicos_insumos p
 WHERE upper(btrim(p.fonte)) = 'SINAPI'
   AND upper(btrim(p.uf)) = 'PB'
   AND p.mes_ref = '2026-06'
ON CONFLICT (codigo_insumo, fonte, uf, mes_ref) DO NOTHING;

INSERT INTO public._backup_20261118_precos_composicoes_sinapi_pb_202606
SELECT p.*
  FROM public.precos_historicos_composicoes p
 WHERE upper(btrim(p.fonte)) = 'SINAPI'
   AND upper(btrim(p.uf)) = 'PB'
   AND p.mes_ref = '2026-06'
ON CONFLICT (codigo_composicao, fonte, uf, mes_ref) DO NOTHING;

DELETE FROM public.precos_historicos_insumos p
 WHERE upper(btrim(p.fonte)) = 'SINAPI'
   AND upper(btrim(p.uf)) = 'PB'
   AND p.mes_ref = '2026-06';

DELETE FROM public.precos_historicos_composicoes p
 WHERE upper(btrim(p.fonte)) = 'SINAPI'
   AND upper(btrim(p.uf)) = 'PB'
   AND p.mes_ref = '2026-06';

COMMIT;
