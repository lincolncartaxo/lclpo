# Importação de Bases (SINAPI)

A aplicação usa a arquitetura comercial nova:

| Tabela | Conteúdo |
|---|---|
| `catalogo_insumos` | código, descrição e unidade do insumo |
| `precos_historicos_insumos` | preço por insumo, fonte, UF e mês (`YYYY-MM`) |
| `catalogo_composicoes` | código, descrição e unidade da composição |
| `catalogo_composicao_itens` | insumos/subcomposições e coeficientes |
| `precos_historicos_composicoes` | custos sintéticos por UF e mês, quando disponíveis |

O custo analítico de uma composição é calculado pela RPC `calcular_custo_composicao`:

```text
custo = soma(coeficiente × preço do filho)
```

## Pré-requisitos

```bash
export SUPABASE_URL='...'
export SUPABASE_SERVICE_ROLE_KEY='...' # nunca usar no frontend
```

Aplique primeiro todas as migrations do diretório `supabase/migrations`, especialmente:

```text
20261011_refatoracao_precos.sql
20261012_limpar_bases_antigas.sql
20261012_rebuild_calc.sql
20261012_fix_precos_integridade.sql
```

## Composições e vínculos analíticos

```bash
bun run scripts/import/composicoes-sinapi.ts \
  ./composicoes-sinapi.xlsx \
  --fonte=SINAPI
```

Esse comando alimenta `catalogo_composicoes`, `catalogo_insumos` e `catalogo_composicao_itens`.

## Preços dos insumos

```bash
bun run scripts/import/insumos-precos-sinapi.ts \
  ./insumos-pb-2026-08.xlsx \
  --uf=PB \
  --mes=2026-08 \
  --fonte=SINAPI
```

O mês deve ser informado como `YYYY-MM`. Os scripts normalizam a UF para maiúsculas e fazem upsert idempotente.
