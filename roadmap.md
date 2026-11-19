# Roadmap

## Solicitação atual: tratar todas as pendências
- [x] Corrigir oito grupos de dependências vulneráveis e repetir 30 testes locais; picomatch sem correção publicada continua bloqueio externo.
- [ ] Verificar configuração e entrega automática Stripe; exercitar falha e cancelamento em modo teste. Erro real informado: HTTP 401 Invalid signature. Destino de teste e sete eventos conferidos via Stripe; 18 testes de cobrança/assinatura passaram. STRIPE_WEBHOOK_SECRET substituído pelo usuário no formulário seguro; aguarda reenvio pelo Stripe e resposta HTTP 200 (não comprovado por assinatura gerada localmente).
- [x] Criar e validar páginas de termos, privacidade e suporte com identificação e contato confirmados; publicação pendente.
- [x] Preparar endpoint de saúde e procedimento oficial de backup/restauração sem afetar produção.
- [x] Revisar pendências funcionais antigas e registrar o estado real no relatório.
- [x] Backup mais recente confirmado pelo usuário no painel: 18/11/2026, 09:39:02 UTC.
- [ ] Ensaio de restauração: aguarda ambiente separado do responsável; não restaurar produção.
- [ ] Alertas externos: aguarda conta de monitoramento; endpoint HTTP já disponível.
- [ ] Revisão jurídica: requer validação profissional, políticas de piloto já disponíveis.
- [ ] Atualização picomatch: aguarda versão corrigida do mantenedor; alerta não suprimido.

## Preparação para piloto comercial
- [x] Revisar o relatório de release enviado em 18/11 e atualizar evidências atuais.
- [x] Solicitar publicação; pagamento fictício BRL R$129 confirmado, evento assinado reenviado e plano Pro lido na tela.
- [x] Criar empresa Free automaticamente no cadastro; validar conta confirmada, login, portal e logout; implementar recuperação de senha.
- [ ] Confirmar entrega automática Stripe: pagamento só atualizou após reenvio manual; depende de conferir entrega original/chave do destino.
- [x] Entrega dos e-mails confirmada pelo usuário em 18/11/2026; conclusão pessoal da redefinição não foi informada.
- [x] Concluir a retomada: corrigir demora e verificar exportações analíticas XLSX/PDF em orçamento real.
- [x] Implementar cobrança Stripe por empresa, histórico e autorização de gestão.
- [ ] Ativar notificações automáticas: publicação e pagamento testados; entrega original Stripe ainda não comprovada.
- [x] Adicionar e executar testes de cálculos com referências reais e regras de preço.
- [x] Validar isolamento entre empresas e limites com testes de acesso (contas temporárias removidas).
- [x] Verificar acesso, orçamento existente, exportação XLSX sem analíticas, checkout e portal sem cobrança real.
- [x] Validar exportações completas XLSX/PDF com composições analíticas em orçamento real.
- [x] Entrega de confirmação/recuperação confirmada pelo usuário; criação automática da empresa e login já testados.

- [x] Permitir preenchimento do cronograma diretamente em percentual (0 a 100).
- [x] Corrigir o somatório automático das etapas e subetapas pela hierarquia dos itens.
- [x] Exportar Planilha Orçamentária em JSON no formato Transferegov (aba Relatório).
- [x] Frentes de obra / mês de conclusão já existem na estrutura PLE e são usados no JSON; envio ao órgão não repetido nesta rodada.
- [x] JSON Transferegov modalidade BM (parcelas do cronograma) + verificação de pendências.
- [x] Importar planilha Excel para orçamentos criados.
- [x] Importação enxuta: item, quantidade, código e fonte obrigatórios; descrição/unidade/preço vêm do banco por padrão.
- [x] Avaliar últimas alterações e registrar evidências e riscos no relatório.
- [x] Módulo de licitação: desconto individual adicionado ao linear existente; preço final salvo para relatórios e medições.
- [x] Módulo de medições BM01/BM02 por licitação com acumulado, saldo, XLSX/PDF; fluxo real verificado em orçamento temporário.
