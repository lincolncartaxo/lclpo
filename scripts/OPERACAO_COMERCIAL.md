# Operação comercial e recuperação

## Monitoramento
- Monitor HTTP: `https://lclpo.lovable.app/api/public/health`. Esperado: HTTP 200 e `status=ok`. É um sinal da aplicação, não uma prova de saúde do banco, login ou Stripe.
- Monitor funcional diário: entrar, abrir um orçamento, consultar SINAPI na referência adotada, exportar XLSX e sair.
- Stripe: acompanhar entregas em Developers/Workbench → Webhooks. Repetidas respostas 401 indicam assinatura incompatível; 500 são reprocessáveis. Não alterar a chave sem usar o formulário seguro e publicar.
- Verificar painel Analytics (erros e tempos) e registros de cobrança na página Planos. Um monitor externo com alertas ainda precisa de uma conta de monitoramento e destinatário definidos. Não há alerta de e-mail automático configurado.

## Backup e recuperação
Lovable Cloud documenta um backup diário do banco, com retenção de aproximadamente 14 dias. O inventário deste projeto não é acessível por ferramenta: a evidência deve vir de More → Database → Manage → Backups, com o timestamp UTC mais recente.

Antes de qualquer restauração: dados posteriores ao snapshot serão perdidos, o esquema também será revertido e a operação é permanente. Preserve o estado atual por exportação primeiro.

1. More → Database → Manage → Settings → Export project data → Export data → Database → Export → Start export.
2. Baixar o arquivo pelo link recebido por e-mail ou em More → Storage. Ele inclui estrutura, dados e contas com hashes de senha; guardar em local privado e criptografado, sem publicar.
3. Arquivos dos buckets não estão incluídos no backup nem no export; baixá-los separadamente em More → Storage.
4. Para ensaio sem tocar produção, restaurar o export em projeto separado que o responsável possua; reconfigurar chaves e provedores de login. O painel de Backups restaura somente o próprio banco no lugar.
5. Conferir login, acesso entre empresas, criação de orçamento, SINAPI, XLSX/PDF e assinatura. Nunca disparar cobrança real no ambiente de ensaio.
6. Registrar data UTC, export utilizado, ambiente de destino, resultados e tempo de recuperação. A existência deste roteiro não comprova uma restauração.

## Incidente e reversão de aplicação
Suspender divulgação e novas adesões enquanto o problema é investigado; não apagar dados. Anotar início, impacto e evidências sem credenciais. Corrigir em versão revisada, executar testes e publicar. Se esquema e código divergirem após restauração, aplicar migração nova para compatibilizar; não manipular metadados do repositório para reverter.

## Critérios para cobrança pública
- Preços e chave Stripe do mesmo modo (produção), portal e destino assinados nesse modo.
- Pagamento confirmado automaticamente, recusa e cancelamento testados, sem reenvio manual como prova de entrega original.
- Identificação legal e políticas aprovadas, canal de suporte confirmado, decisão sobre reembolso e retenção de dados documentada.
- Inventário de backups conferido e ensaio de recuperação comprovado.
- Dependências sem alertas ou riscos residuais avaliados explicitamente.