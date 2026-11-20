-- Protege os backups criados pela migration 20261118_remover_toda_base_sinapi_pb_202606.
-- Eles são cópias administrativas e não devem ser acessíveis pelo aplicativo.
-- O acesso administrativo/service_role permanece disponível para restauração controlada.

BEGIN;

ALTER TABLE IF EXISTS public._backup_20261118_precos_insumos_sinapi_pb_202606
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public._backup_20261118_precos_composicoes_sinapi_pb_202606
  ENABLE ROW LEVEL SECURITY;

-- Remove privilégios herdados de PUBLIC e dos papéis usados pelo PostgREST.
-- Sem privilégios de tabela, anon/authenticated não conseguem consultar nem mutar
-- os backups, mesmo que uma política permissiva seja adicionada futuramente.
REVOKE ALL ON TABLE
  public._backup_20261118_precos_insumos_sinapi_pb_202606,
  public._backup_20261118_precos_composicoes_sinapi_pb_202606
FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public._backup_20261118_precos_insumos_sinapi_pb_202606') IS NOT NULL THEN
    DROP POLICY IF EXISTS "backup insumos sem acesso ao aplicativo"
      ON public._backup_20261118_precos_insumos_sinapi_pb_202606;
    CREATE POLICY "backup insumos sem acesso ao aplicativo"
      ON public._backup_20261118_precos_insumos_sinapi_pb_202606
      FOR ALL TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;

  IF to_regclass('public._backup_20261118_precos_composicoes_sinapi_pb_202606') IS NOT NULL THEN
    DROP POLICY IF EXISTS "backup composicoes sem acesso ao aplicativo"
      ON public._backup_20261118_precos_composicoes_sinapi_pb_202606;
    CREATE POLICY "backup composicoes sem acesso ao aplicativo"
      ON public._backup_20261118_precos_composicoes_sinapi_pb_202606
      FOR ALL TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END;
$$;

COMMIT;
