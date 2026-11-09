# Home — saudação e notificações no site

## Recursos publicados
- Cabeçalho da **Home** inspirado na referência enviada: foto redonda à esquerda, saudação "Bom dia", "Boa tarde" ou "Boa noite" conforme o fuso do estúdio (America/Sao_Paulo), primeiro nome em destaque e sino circular à direita.
- O nome e o avatar vêm da conta autenticada em `profiles`; atualizações na foto e no nome são refletidas na Home sem novo login. Usuários sem conta veem o nome "Visitante" e devem entrar para acessar as notificações.
- O sino apresenta contador de avisos **não lidos**. Ao tocar, abre **Notificações**, com histórico das mensagens, opção de marcar cada aviso e marcar todas como lidas, atualizar e consultar reservas.
- Novos avisos chegam por Supabase Realtime quando disponível; a tela também sincroniza ao abrir e a cada minuto (para liberar lembretes no momento devido).
- Os avisos são separados dos canais externos: e-mail e WhatsApp seguem as preferências da cliente e o fluxo P4 não foi modificado.

## Eventos (mesmos eventos da P4)
- `booking_requested` — Recebemos seu pedido de agendamento.
- `booking_confirmed` — Seu agendamento foi confirmado.
- `booking_cancelled` — Seu agendamento foi cancelado.
- `reminder_24h` — Lembrete do seu atendimento, visível até 24h antes, conforme a mesma janela P4 e apenas para confirmações com pelo menos 2h de antecedência.

O evento inclui serviço, data e horário no fuso America/Sao_Paulo. Lembretes agendados e ainda não exibidos são descartados se a sessão for cancelada ou concluída. Os eventos de alteração de status existentes não são modificados, nem se altera o envio de e-mail/WhatsApp.

## Banco e segurança
Migração: `supabase/migrations/20261109_home_inapp_notifications.sql`, **já aplicada em produção**.

`public.notifications` contém `profile_id`, `appointment_id`, `type`, `title`, `body`, `visible_at`, `created_at`, `read_at`.

- RLS permite que a cliente consulte somente suas próprias notificações e edite somente o campo `read_at` das suas linhas.
- `anon` não possui SELECT. `authenticated` não possui INSERT nem UPDATE de `profile_id`.
- Trigger `private.push_appointment_notification` cria os eventos dentro das transações de agendamentos; a cliente não pode criar avisos falsos.
- A tabela foi adicionada à publicação `supabase_realtime`, para atualizações por sessão.
- Notificações anteriores à instalação não são reconstruídas porque não temos eventos históricos completos confiáveis.

## Testes técnicos concluídos
- [x] Geração de pedido recebido, confirmação, lembrete agendado, cancelamento e remoção de lembrete futuro.
- [x] RLS: leitura limitada ao próprio usuário; cliente consegue marcar próprio aviso como lido.
- [x] `anon` sem acesso; cliente sem permissão para inserir ou trocar proprietário.
- [x] Tabelas publicadas no Realtime.
- [x] Build da branch Vercel READY.
- [x] Todos os dados usados nos testes do banco foram revertidos (ROLLBACK).

## Aceite visual pendente
1. Entrar na conta da cliente e abrir **Início**. Conferir avatar, saudação do horário, primeiro nome e sino.
2. Criar novo agendamento. Conferir contador, abrir sino e ler o aviso de pedido recebido.
3. No Admin, confirmar o agendamento. Na conta da cliente, conferir a nova notificação de confirmação e o contador.
4. No Admin, cancelar um pedido de teste. Verificar aviso de cancelamento.
5. Marcar aviso lido; conferir redução do contador.
6. Confirmar foto/nome alterados no Perfil e seu reflexo na Home.
7. Validar o comportamento em celular e navegador de desktop.

## Observações
- A tela exibe as 100 notificações visíveis mais recentes, mas calcula o total não lido com contagem exata.
- O sino não é push do sistema operacional; é uma caixa de mensagens **dentro do site**.
- As notificações são registradas a partir desta publicação. Não há necessidade de chaves ou segredos adicionais.
