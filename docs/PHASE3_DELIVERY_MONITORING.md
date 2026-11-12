# Fase 3 — Etapa 3: monitoramento de notificações e entregas

## Propósito
Permitir que a administração veja **e-mails e WhatsApp** com falha, atrasados,
pendentes ou aceitos pelo provedor, sem acessar telefones, e-mails, tokens,
`provider_message_id`, `last_error` bruto ou texto pessoal.

## Como funciona
- Fonte: tabela existente `public.notification_outbox`, sem alterar a fila
  nem a rotina de envio da Edge Function `p4-notifications`.
- Backend: `public.p3_delivery_health()` é `SECURITY INVOKER` e rejeita
  identidades sem perfil Admin. Ele acessa uma função privada protegida em
  `private.phase3_delivery_health_internal()`, também com validação Admin.
  A função privada tem `SECURITY DEFINER` para ler a fila sem dar
  `SELECT` direto aos usuários autenticados, que continua bloqueado.
- Apenas o resumo sanitizado é retornado; 20 problemas recentes no máximo.
- A tela é acessível por **Admin → Configurações → Monitoramento de entregas**,
  atualiza a cada 60 segundos enquanto aberta e permite atualização manual.

## Semântica dos indicadores
- **Na fila**: itens com `status='pending'` (inclui agendados para o futuro).
- **Atrasadas**: `pending` com `scheduled_for` anterior a **15 minutos**
  atrás do horário atual no servidor; itens futuros não contam como atraso.
- **Em processamento**: registros `processing`. O sistema não grava início
  exato do processamento; portanto não os chama automaticamente de travados.
- **Aceitas pelo provedor**: `sent`. **Não** comprova que a mensagem chegou,
  foi lida ou que existiu confirmação de entrega.
- **Falhas**: `failed`, exigem inspeção pela administração. Não há retentativa
  automática; especialmente no WhatsApp, repetir envio sem idempotência pode
  duplicar mensagens.
- **Ignoradas**: `skipped`, por mudança de status, falta de consentimento etc.
  Não equivale a falha operacional.

O monitoramento considera todo o histórico existente, não somente um mês.
As métricas por canal distinguem `email` e `whatsapp` mesmo quando um
canal não possui registros.

## Limites importantes
- **WhatsApp Business permanece não ativado**. O painel não conecta
  automaticamente à Meta, não cria tokens nem ativa consentimentos.
- O painel mede a fila no banco. Ele **não** diagnostica falhas de infraestrutura
  anteriores à criação do item no outbox, nem substitui observabilidade do
  cron, do provedor ou confirmações de entrega.
- Não existe botão de reenvio nem edição de status dos trabalhos.
- As falhas de envio geram alertas na Central de Controle via trigger
  existente `private.enqueue_admin_delivery_failure`. O painel complementa
  esses alertas com os itens ainda pendentes.
- Nenhuma tabela nova, nenhuma credencial nova e nenhuma alteração de dados.
- A função agregadora não retorna clientes, destinatários, IDs ou erro bruto.
- Senhas vazadas desativadas continuam uma pendência de segurança de
  configuração do Supabase Auth, fora deste PR.

## Proteções e testes
- SQL real em `supabase/migrations/20261112134721_phase3_delivery_monitoring.sql`.
- Testes Postgres 17 em ambiente descartável:
  - status por canal, limite de atraso, `processing` e `sent`;
  - recusa para clientes e visitantes, inclusive função privada;
  - nenhum `SELECT` direto no outbox via usuário normal;
  - ausência de chaves e informações pessoais no relatório;
  - banco de origem não modificado pelo monitoramento.
- Navegador Chromium com dados fictícios valida navegação e indicadores
  de notificações, incluindo formulário em tela de 390px.
- Migração aplicada no Supabase em 12/11/2026, versão `20261112134721`, após CI e revisão. A produção web continua no commit anterior até aprovação e publicação do PR.
  Validar no iPhone e conta Admin. Não criar notificações fictícias em produção.

## Continuação da Fase 3
Etapa 4: revisar acessibilidade e desempenho em celulares reais.
