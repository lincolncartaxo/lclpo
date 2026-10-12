# Auditoria do LclPlan para evolução a microSaaS comercial

**Data:** 12/10/2026
**Repositório analisado:** `lincolncartaxo/lclpo`
**Commit analisado:** `8b15eee` localmente antes da auditoria
**Escopo:** arquitetura, banco, segurança, multiempresa, importação de preços, qualidade do código, operação, experiência do produto e prontidão comercial.

---

## 1. Resumo executivo

O LclPlan já possui um núcleo de produto válido para um MVP:

- autenticação com Supabase;
- cadastro de orçamentos;
- planilha orçamentária;
- bases SINAPI/DER e composição recursiva;
- BDI e encargos;
- cronograma físico-financeiro;
- memória de cálculo, QCI e exportações;
- importação de Excel/CSV;
- integração inicial com Transferegov;
- cálculo recursivo de composições funcionando para o caso validado `88316`.

Entretanto, a aplicação ainda está mais próxima de um **protótipo avançado/MVP técnico** do que de um SaaS comercial pronto para clientes pagantes. Os principais bloqueadores são:

1. **Multi-tenancy incompleto:** orçamentos estão vinculados a `user_id`, mas não a uma empresa/organização; usuários da mesma empresa não compartilham naturalmente seus dados.
2. **RLS e permissões das novas tabelas precisam ser formalizados:** as tabelas globais de catálogo/preços não têm uma política de acesso claramente definida na migration nova; RPCs `SECURITY DEFINER` precisam de revogação explícita de `PUBLIC`/`anon` quando aplicável.
3. **Não existe billing comercial:** há `empresas.plano`, mas não há assinatura, checkout, limites, inadimplência, feature flags ou enforcement de plano.
4. **Pipeline de importação não é transacional nem observável:** cargas grandes podem ficar parcialmente gravadas; há parsing de valores monetários frágil na Edge Function.
5. **Dívida de arquitetura:** `orcamento.$id.tsx`, `bases.tsx` e `admin.tsx` concentram responsabilidades demais; o maior arquivo tem aproximadamente 106 mil bytes.
6. **Qualidade automatizada insuficiente:** `tsc` passa e o build passa, mas não existem testes automatizados relevantes e o lint acusa milhares de problemas de formatação/estilo.
7. **Migrations conflitantes:** o histórico mistura tabelas antigas `base_*` com a arquitetura nova `catalogo_*`, incluindo migrations destrutivas e funções duplicadas/ sobrecarregadas.

**Conclusão:** é possível transformar o projeto em um microSaaS, mas a prioridade inicial deve ser **fundação SaaS e segurança**, não adicionar mais módulos de negócio.

---

## 2. Evidências técnicas principais

| Área | Evidência encontrada | Impacto |
|---|---|---|
| Código | `src/routes/_authenticated/orcamento.$id.tsx` possui aproximadamente 106 KB | Alta dificuldade de manutenção e regressões |
| Código | `src/routes/_authenticated/bases.tsx` e `admin.tsx` também são grandes | Baixa testabilidade e responsabilidades misturadas |
| Testes | Não há suíte real de `test/spec` no projeto | Regressões em cálculos e importações podem chegar à produção |
| Tipagem | `npx tsc --noEmit` passou | Ponto positivo, mas há muitos `any` no código |
| Build | `npm run build` passou | Ponto positivo |
| Lint | `npm run lint` acusa cerca de 2.153 erros, principalmente Prettier | Pipeline CI não está pronto |
| Schema | `drizzle/schema.ts` está vazio e marcado como gerado | Drizzle não é fonte confiável do modelo |
| Banco | Existem 22 migrations Supabase com versões antigas e novas coexistindo | Alto risco de banco novo ser criado em estado inconsistente |
| Dados | `base_*` são removidas em `20261012_limpar_bases_antigas.sql` | Migrations antigas continuam referenciando tabelas removidas |
| Segurança | `20261011_refatoracao_precos.sql` cria catálogo/preços sem políticas RLS equivalentes explícitas | Risco de exposição ou alteração indevida via API |
| Segurança | RPCs `SECURITY DEFINER` com grants amplos e sem revogação explícita de `PUBLIC` | Possível escalada de acesso ou alteração de dados |
| Multiempresa | `orcamentos` tem `user_id`, mas não `id_empresa` | Não há colaboração real entre membros da empresa |
| Comercial | Existe `empresas.plano`, mas não há assinatura/cobrança/limites | Não há monetização operacional |
| Importação | Edge Function converte preço com `.replace('.', '').replace(',', '.')` | Valores decimais com ponto podem ser multiplicados por 10.000 |
| Segredos | `.env` aparece versionado pelo Git | Risco de exposição de configuração e chaves públicas |

---

## 3. Classificação de prioridade

### P0 — bloquear lançamento comercial

1. **Revisar RLS e grants de todas as tabelas expostas pelo PostgREST.**
2. **Implementar isolamento por organização/empresa em todas as entidades de negócio.**
3. **Corrigir e tornar transacional o pipeline de importação de preços.**
4. **Eliminar migrations conflitantes e definir uma única fonte de verdade do schema.**
5. **Criar testes de cálculo e de autorização antes de aceitar dados de clientes.**
6. **Remover `.env` do versionamento e rotacionar qualquer credencial que tenha sido exposta.**

### P1 — necessário para vender com segurança

1. Billing e limites por plano.
2. Auditoria de alterações e histórico de importações.
3. Tratamento de erros visível ao usuário.
4. Observabilidade, logs estruturados e monitoramento.
5. Modularização das telas grandes.
6. Fluxo de onboarding e recuperação de conta.
7. Backups e estratégia de restauração.

### P2 — crescimento e diferenciação

1. Colaboração e comentários por orçamento.
2. Aprovação/versionamento de orçamento.
3. Medições, licitação e integrações adicionais.
4. Catálogo proprietário por empresa.
5. Portal do cliente e compartilhamento seguro.
6. Otimização de busca e cache de preços.

---

## 4. Segurança e isolamento de dados

### 4.1. Multi-tenancy ainda não está completo

A estrutura inicial vincula `orcamentos` a `user_id`. A estrutura de empresas adiciona `profiles.id_empresa`, mas não há `id_empresa` em `orcamentos`, `orcamento_itens`, cronogramas, memórias e demais entidades relacionadas.

Isso impede uma regra clara como:

> Todo dado de negócio pertence a uma organização; todo usuário acessa somente organizações das quais é membro.

### Modelo recomendado

Criar entidades explícitas:

```text
organizations
organization_members
organization_roles
subscriptions
projects/orcamentos
```

Estratégia mínima:

- `organizations(id, name, slug, status, created_at)`;
- `organization_members(organization_id, user_id, role, status)`;
- `orcamentos.organization_id` obrigatório;
- políticas RLS baseadas em uma função `is_org_member(auth.uid(), organization_id)`;
- papéis separados: `owner`, `admin`, `editor`, `viewer`;
- evitar usar `profiles.empresa` como texto para controle de acesso.

### 4.2. RLS das tabelas novas

As migrations novas criam `catalogo_insumos`, `catalogo_composicoes`, `precos_historicos_insumos` e `precos_historicos_composicoes`, mas a estratégia de leitura/escrita não está documentada de forma uniforme.

Definir explicitamente:

- catálogos oficiais: leitura para usuários autenticados; escrita somente por pipeline/admin;
- preços oficiais: leitura para usuários autenticados; escrita somente por pipeline/admin;
- bases próprias: leitura/escrita apenas por membros da organização;
- composição analítica própria: mesma regra da organização;
- tabelas de staging: nunca públicas.

Não depender dos defaults do Postgres/Supabase.

### 4.3. `SECURITY DEFINER`

As funções com `SECURITY DEFINER` devem:

- possuir `SET search_path = public` — isso já foi feito em parte;
- validar explicitamente a autorização do chamador quando alterarem dados;
- usar `REVOKE ALL ON FUNCTION ... FROM PUBLIC`;
- conceder somente a roles necessárias;
- evitar conceder cálculo a `anon` se o produto exige autenticação;
- separar RPC de leitura/cálculo da RPC administrativa de ingestão.

Exemplo de política para ingestão:

```sql
REVOKE ALL ON FUNCTION public.upsert_precos_insumos_lote(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_precos_insumos_lote(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_precos_insumos_lote(jsonb) TO service_role;
```

A Edge Function deve ser o ponto de entrada autenticado/admin para importação.

### 4.4. Administração

A UI verifica `has_role`, mas a proteção real deve existir no banco. Toda operação administrativa precisa ser segura mesmo que alguém ignore a interface e chame o endpoint diretamente.

Recomendações:

- `has_role` com `SECURITY DEFINER`, `search_path` fixo e sem permitir autoelevação;
- nunca aceitar `role` ou `id_empresa` do cliente sem validação de permissão;
- registrar auditoria de mudanças de usuários, empresas e preços;
- adicionar MFA para administradores quando o produto entrar em produção.

---

## 5. Banco de dados e migrations

### 5.1. Escolher uma única fonte de verdade

Hoje há:

- migrations Supabase SQL;
- diretório Drizzle;
- `drizzle/schema.ts` vazio;
- migrations antigas que referenciam `base_*` já removidas;
- migrations novas com `catalogo_*`;
- funções `calcular_custo_composicao` com assinaturas históricas diferentes.

Isso já causou o problema observado da função antiga continuar chamando `base_composicao_itens`.

**Recomendação:** usar Supabase SQL migrations como fonte única no curto prazo e remover/arquivar o Drizzle até que ele esteja realmente sincronizado.

### 5.2. Não fazer `DROP TABLE` destrutivo em migration de produção

A migration que remove `base_*` é perigosa para um SaaS com dados reais. Antes de remover:

1. migrar dados;
2. validar contagens e amostras;
3. criar backup;
4. manter período de compatibilidade;
5. remover somente em migration posterior e controlada.

### 5.3. Restrições ausentes

Adicionar constraints/checks:

- `uf` com formato válido;
- `mes_ref` com formato `YYYY-MM`;
- `tipo_item IN ('INSUMO', 'COMPOSICAO')`;
- `fonte` normalizada em maiúsculas;
- coeficiente não negativo;
- preços não negativos, quando aplicável;
- unicidade de itens sem duplicidade lógica;
- prevenção de composição referenciar a si própria.

### 5.4. Ciclos na composição

A RPC é recursiva, mas não há proteção explícita contra ciclos como:

```text
A -> B -> C -> A
```

Isso pode causar recursão infinita ou erro de profundidade. Implementar:

- `visited_codes`/array de caminho na função;
- erro explícito ao detectar ciclo;
- validação no importador antes do upsert;
- limite máximo de profundidade.

### 5.5. Retorno de diagnóstico do cálculo

Retornar somente `numeric` esconde problemas. Uma composição pode retornar zero porque:

- não há item;
- há item sem preço;
- existe subcomposição ausente;
- preço é realmente zero.

Criar uma RPC de diagnóstico que retorne:

```text
custo
itens_total
itens_sem_preco
subcomposicoes_ausentes
mes_aplicado
uf_aplicada
regime
avisos
```

Isso reduzirá muito o suporte manual.

---

## 6. Pipeline de importação de preços

### 6.1. Erro de parsing monetário

Na Edge Function `src/lib/import-precos.functions.ts`, a conversão usa:

```ts
parseFloat(String(rawPd).replace('.', '').replace(',', '.'))
```

Para uma entrada como `1.8200`, isso vira `18200`, não `1.82`.

Criar um parser único e testado que diferencie:

- `1.8200` → `1.82`;
- `1,8200` → `1.82`;
- `1.234,56` → `1234.56`;
- `1234.56` → `1234.56`;
- células vazias → erro ou zero conforme regra explícita.

Esse parser deve ser compartilhado entre CSV, Excel e scripts CLI.

### 6.2. Transação e idempotência

A carga atual divide lotes e grava em etapas. Se o lote 7 falhar, os seis anteriores ficam gravados sem um registro claro da execução.

Criar:

- `import_jobs`;
- status `queued/running/succeeded/failed/partial`;
- arquivo original e hash;
- usuário/organização;
- fonte, UF, mês e tipo;
- contadores de lidos, aceitos, rejeitados e atualizados;
- log de erros por linha;
- opção de rollback lógico ou limpeza por `import_job_id`.

Para grandes cargas, usar staging + validação + publicação atômica:

```text
upload -> staging -> validação -> preview -> commit -> auditoria
```

### 6.3. Validações de importação

Antes de gravar:

- confirmar cabeçalhos;
- verificar formato de mês/UF;
- verificar códigos duplicados;
- conferir itens referenciados;
- detectar composição sem catálogo;
- detectar ciclo;
- comparar quantidade esperada com quantidade processada;
- mostrar preview ao usuário.

### 6.4. Codificação

A descrição `CAPACITA��O` indica problema de encoding na origem ou leitura. O importador deve detectar UTF-8, Windows-1252/Latin-1 quando necessário e normalizar texto antes de gravar.

---

## 7. Arquitetura e qualidade do código

### 7.1. Modularização urgente

`orcamento.$id.tsx` concentra:

- dados gerais;
- encargos;
- BDI;
- composição;
- planilha;
- cronograma;
- curva ABC;
- QCI;
- relatório;
- exportação XLSX/PDF/JSON;
- validações.

Separar em módulos:

```text
features/orcamentos/
  api/
  domain/
  components/
    DadosGeraisTab.tsx
    BdiTab.tsx
    PlanilhaTab.tsx
    CronogramaTab.tsx
    RelatorioTab.tsx
  hooks/
  calculations/
  export/
```

O cálculo deve sair dos componentes React e ter testes unitários puros.

### 7.2. Remover `any`

Há uso extenso de `(supabase as any)` e `as any`. Isso reduz a capacidade do TypeScript de detectar exatamente os erros que ocorreram nas mudanças de schema.

Depois de estabilizar as migrations:

1. regenerar `types.ts` a partir do banco;
2. incluir tabelas novas e RPCs;
3. tipar os retornos de cada query;
4. eliminar `any` por módulo.

### 7.3. Cliente de dados por domínio

Criar serviços tipados:

```text
priceCatalogRepository
budgetRepository
compositionCalculator
importJobService
organizationService
billingService
```

Componentes não devem montar strings de tabelas/colunas diretamente em dezenas de lugares.

### 7.4. Tratamento de erros

Existem consultas que ignoram `error` e convertem erro de API em lista vazia. Foi exatamente o que mascarou o problema da explosão de composição.

Regra recomendada:

```ts
const { data, error } = await query;
if (error) throw new AppError(...);
```

Adicionar estado de erro visível e botão de tentar novamente.

---

## 8. Testes e CI/CD

### Situação atual

- `npx tsc --noEmit`: aprovado;
- `npm run build`: aprovado;
- `npm run lint`: falha com cerca de 2.153 problemas;
- testes de unidade/integração: praticamente inexistentes.

### Suíte mínima necessária

#### Cálculos

- composição simples;
- composição com subcomposição;
- regime desonerado/não desonerado;
- UF específica e fallback `BR`;
- mês exato e mês mais recente;
- preço ausente;
- código inexistente;
- ciclo de composição;
- arredondamento.

#### Importação

- CSV com `1,82`;
- CSV com `1.82`;
- CSV com `1.234,56`;
- encoding UTF-8/Latin-1;
- duplicidade;
- lote parcial;
- composição analítica sem catálogo;
- reprocessamento idempotente.

#### Segurança

- usuário A não lê orçamento de B;
- membro de empresa A não lê empresa B;
- usuário comum não importa preços oficiais;
- usuário comum não altera papéis;
- anon não executa RPC administrativa.

#### E2E

Criar pelo menos os cenários:

1. criar conta;
2. criar orçamento;
3. selecionar `88316`;
4. abrir composição na Planilha Orçamentária;
5. validar aproximadamente R$ 24,05;
6. alterar regime;
7. exportar relatório;
8. sair e entrar novamente.

### Pipeline recomendado

```text
pull request
  -> format check
  -> lint
  -> typecheck
  -> unit tests
  -> migration check
  -> build
  -> preview
  -> deploy manual/automático
```

---

## 9. Produto e modelo comercial

### 9.1. Escolher um primeiro segmento

O produto tenta atender engenheiros, orçamento de obras, licitações, Transferegov, bases SINAPI/DER e empresas. Para vender melhor, começar com um segmento:

**Sugestão:** pequenas empresas de engenharia e profissionais que elaboram orçamentos para licitações públicas.

Promessa de valor:

> Criar, revisar e exportar um orçamento público com bases oficiais, composição rastreável e documentação pronta em menos tempo.

### 9.2. Pacote mínimo vendável

Antes de módulos avançados, garantir:

- onboarding em menos de 5 minutos;
- primeiro orçamento guiado;
- catálogo e preços confiáveis;
- composição explicável;
- importação Excel previsível;
- exportação PDF/XLSX/Transferegov;
- duplicar orçamento;
- histórico de versões;
- compartilhamento por equipe;
- suporte e recuperação de erro.

### 9.3. Planos sugeridos

| Plano | Perfil | Limites/recursos |
|---|---|---|
| Free | avaliação | poucos orçamentos, exportações limitadas, sem equipe |
| Pro | profissional | mais orçamentos, todas exportações, histórico, importações |
| Equipe | pequena empresa | membros, compartilhamento, bases próprias, auditoria |
| Empresa | operação maior | suporte, limites elevados, integrações e SLA |

Os limites devem ser medidos no backend, nunca somente escondidos na UI.

### 9.4. Billing

Implementar:

- `subscriptions`;
- `subscription_events`/webhooks;
- `plan_entitlements`;
- estado `trialing/active/past_due/canceled`;
- idempotência de eventos;
- portal de cobrança;
- bloqueio gradual, não destrutivo, para inadimplência;
- logs de cobrança sem dados sensíveis.

Não colocar regra de plano apenas em React.

---

## 10. UX e comercialização

### Melhorias de alto retorno

1. **Demo sem cadastro:** abrir um orçamento de exemplo somente leitura.
2. **Onboarding:** escolher tipo de obra, UF, base e mês em um wizard.
3. **Estados de dados:** explicar claramente “composição encontrada, mas preço ausente”.
4. **Diagnóstico na UI:** mostrar UF, mês, regime, quantidade de itens e itens sem preço.
5. **Rastreabilidade:** cada preço deve mostrar fonte, mês e UF.
6. **Ações em lote:** duplicar orçamento, substituir mês de referência e recalcular.
7. **Autosave e histórico:** evitar perda de trabalho.
8. **Acessibilidade:** foco, teclado, contraste, labels e mensagens de erro.
9. **Mobile/tablet:** planilha precisa ser utilizável em telas menores, mesmo que o foco seja desktop.
10. **Landing page:** incluir screenshots, vídeo curto, casos de uso, FAQ, planos e CTA de teste.

---

## 11. Operação e observabilidade

Adicionar:

- Sentry ou serviço equivalente para erros frontend/backend;
- logs estruturados por `request_id`, `user_id`, `organization_id`;
- métricas de RPC de cálculo;
- métricas de importação;
- alertas de falhas de Edge Functions;
- health check;
- backup e restauração testados;
- política de retenção;
- status page, se houver clientes pagantes.

Registrar especialmente:

- cálculo de composição com preço ausente;
- importação parcial;
- exportação falha;
- erro de autenticação;
- alteração de role/empresa;
- alteração/exclusão de orçamento.

---

## 12. Plano de execução recomendado

### Fase 0 — estabilização imediata

- [ ] Remover `.env` do Git e rotacionar qualquer segredo exposto.
- [ ] Corrigir parser monetário da Edge Function.
- [ ] Adicionar tratamento de `error` em todas as queries críticas.
- [ ] Criar testes do cálculo `88316/95378`.
- [ ] Padronizar a migration final da RPC.
- [ ] Documentar procedimento de carga e rollback.

### Fase 1 — fundação SaaS

- [ ] Criar `organizations` e `organization_members`.
- [ ] Migrar `orcamentos` para `organization_id`.
- [ ] Aplicar RLS consistente a todas as tabelas.
- [ ] Separar catálogo oficial, base própria e staging.
- [ ] Restringir RPCs de ingestão a service role/admin.
- [ ] Criar auditoria.
- [ ] Criar CI com typecheck, lint, testes e build.

### Fase 2 — produto vendável

- [ ] Onboarding guiado.
- [ ] Demo e orçamento modelo.
- [ ] Importação com preview e job rastreável.
- [ ] Histórico de versões e duplicação.
- [ ] Compartilhamento por equipe.
- [ ] Billing e limites de plano.
- [ ] Monitoramento e suporte.

### Fase 3 — diferenciação

- [ ] Licitação e descontos.
- [ ] Medições/BM.
- [ ] Frentes de obra.
- [ ] Portal do cliente.
- [ ] Integrações adicionais.
- [ ] Catálogo proprietário com composição visual.

---

## 13. Critério de prontidão para lançamento pago

O produto deve ser considerado pronto para os primeiros clientes quando:

- um usuário de uma empresa não consegue consultar dados de outra;
- não existe RPC administrativa executável por usuário não autorizado;
- uma importação falha sem deixar estado invisível ou inconsistente;
- o cálculo possui testes automatizados para casos reais;
- o cliente consegue saber por que um preço está ausente;
- existe backup e restauração testados;
- há assinatura, limites e cancelamento funcionando;
- erros críticos chegam a uma ferramenta de monitoramento;
- o CI bloqueia regressões de schema e cálculo;
- a aplicação suporta pelo menos um fluxo completo de ponta a ponta sem intervenção manual no SQL Editor.

---

## Conclusão

O LclPlan tem uma base funcional promissora e já resolve uma parte importante do fluxo de orçamento. O próximo salto não é adicionar mais abas: é transformar a base atual em uma plataforma confiável.

A ordem recomendada é:

> **Segurança e isolamento → dados e importação → testes → billing e limites → colaboração → novos módulos.**

Com esse caminho, o produto pode evoluir de um sistema individual de orçamento para um microSaaS vertical de engenharia e licitações, com maior previsibilidade operacional e menor risco de suporte.
