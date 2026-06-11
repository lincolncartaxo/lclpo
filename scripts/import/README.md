# Importação de Bases (SINAPI)

Os **coeficientes** das composições SINAPI são universais (não variam por UF,
mês ou regime de desoneração). Apenas os **preços de insumos** variam por
`UF + mês de referência`, e cada preço tem duas versões: **desonerado** e
**não desonerado**.

Modelo de dados:

| Tabela | Único por | O que armazena |
|---|---|---|
| `base_composicoes` | `fonte + codigo` | metadados da composição (uf/mes_ref = NULL) |
| `base_composicao_itens` | `fonte + composicao_codigo + insumo_codigo` | filhos com `coeficiente` (uf/mes_ref = NULL) |
| `base_insumos` | `fonte + codigo + uf + mes_ref` | `preco_desonerado` e `preco_nao_desonerado` |

O custo de uma composição é **sempre calculado em tempo de consulta** como:

```
custo(comp, uf, mes_ref, regime) = Σ coef_i × custo(filho_i, uf, mes_ref, regime)
```

resolvido recursivamente — INSUMO busca em `base_insumos`, COMPOSICAO recorre.

## Pré-requisitos

```bash
export SUPABASE_URL='...'
export SUPABASE_SERVICE_ROLE_KEY='...'   # chave de serviço, NUNCA no client
```

## 1. Importar composições (uma vez por release SINAPI)

Use o relatório **"Analítico de Composições"** publicado pela CAIXA.

```bash
bun run scripts/import/composicoes-sinapi.ts ./composicoes-sinapi.xlsx
```

Idempotente — pode rodar quantas vezes quiser; faz `UPSERT`.

## 2. Importar preços de insumos (uma vez por UF × mês)

Use o relatório **"Insumos por UF"** (ISD/CSD ou equivalente).

```bash
# Exemplo: Paraíba, abril/2026
bun run scripts/import/insumos-precos-sinapi.ts ./insumos-pb-2026-04.xlsx --uf=PB --mes=2026-04
```

Repita para cada UF que você precisa atender (PB, PE, CE, ...) e para cada mês.

## 3. Consulta na aplicação

Na aba **Bases** e no seletor dentro do orçamento:

- Filtro `UF` (default **PB**) — apenas UFs com preço carregado aparecem.
- Filtro `Mês de Referência` (default = **maior `mes_ref` disponível**).
- Resultado exibe duas colunas: **Preço desonerado** e **Preço não desonerado**.
- Para composições, o preço é o somatório recursivo dos filhos × coeficiente.
