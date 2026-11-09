# Central de Controle de Notificações — Admin

## Objetivo
Separar as notificações operacionais da administração das mensagens pessoais das clientes, mantendo a privacidade de cada conta Admin e permitindo decisões imediatas sobre agendamentos.

## Navegação
- Admin → **Início** → sino de notificações: abre **Central de Controle**.
- Admin → painel administrativo → botão **Central de Controle**: abre a mesma tela.
- Clientes continuam utilizando `ClientNotifications.js` e `public.notifications`, sem mudanças de interface.
- Administradoras possuem caixas independentes; o estado *lido/não lido* de uma conta não afeta outras administradoras.

## Tipos e prioridade
1. **URGENTE · CANCELAMENTO** (vermelho): uma solicitação foi cancelada pela própria conta da cliente (ator `auth.uid()=appointments.client_id`). Classificação crítica e apresentação acima das outras.
2. **CRÍTICO · SISTEMA** (vermelho): envio de uma notificação da P4 por e-mail ou WhatsApp falhou, representado pelo status `failed` em `notification_outbox`. Dados de erros internos e credenciais não são copiados para o texto exibido.
3. **NOVO PEDIDO** (âmbar): agendamento solicitado por cliente com status inicial `pending`, ainda aguardando decisão. Ação direta **Aprovar**, **Recusar** ou **Visualizar**.

A ordenação da Central exibe cancelamentos primeiro, falhas do sistema em seguida e pedidos de agendamento depois, com os mais recentes primeiro dentro de cada grupo. Filtros: **Todos**, **Aguardando decisão**, **Críticos**.

## Ações rápidas
- **Aprovar:** atualiza a reserva de `pending` para `confirmed` usando as policies administrativas existentes. A trigger P4 continuará enviando as notificações de confirmação.
- **Recusar:** requer uma segunda confirmação no próprio card antes de definir o status `cancelled`; a P4 informará a cliente pelo canal configurado.
- **Visualizar:** expande detalhes do pedido (cliente, contato, serviço, data, pagamento e observações) **sem mudar de tela**; também marca o alerta como lido.
- Os botões de aprovar/recusar aparecem somente enquanto a reserva continua `pending` e o alerta não foi encerrado.
- A atualização do status tem condição `status='pending'` no SQL, de forma que um clique tardio **não substitui** uma decisão tomada por outra Admin.
- Todos os cards possuem **Marcar lido**; existe também **Marcar tudo como lido**.
- Alterar o status de uma reserva pela agenda tradicional encerra imediatamente os botões do alerta original.

## Tempo real e persistência
- `public.admin_notifications` habilitada na publicação `supabase_realtime`.
- A tela e o contador no sino se atualizam por Postgres Changes, ao abrir a Home/central e por sincronização complementar a cada 30 segundos.
- 150 alertas recentes por administradora são carregados; a contagem de não lidos considera todo o histórico, sem o limite da lista.
- Pedidos pendentes existentes na instalação foram importados como tarefas aguardando análise.

## Segurança
A tabela `public.admin_notifications` usa:
- RLS `recipient_id=(select auth.uid()) AND (select private.is_admin())` tanto para SELECT quanto UPDATE.
- Cliente autenticada recebe somente SELECT e UPDATE da coluna `read_at` quando é Admin; não pode inserir, alterar prioridade, trocar destinatário ou status de reserva via interface da cliente.
- Sem acesso para `anon`; geração dos eventos por triggers `private.enqueue_admin_appointment_alert` e `private.enqueue_admin_delivery_failure` com `search_path=''` e sem EXECUTE público.
- Cada conta Admin recebe seu próprio alerta ao ocorrer o evento, sem compartilhamento indevido do estado de leitura.
- `notifications` das clientes e a função P4 de e-mail/WhatsApp permanecem intactas.

**Migração aplicada no Supabase em produção:**
`supabase/migrations/20261109_admin_control_center.sql`. **Não executar novamente.**

## Testes técnicos realizados
- [x] Criar pedido pendente insere um aviso para cada Admin.
- [x] Confirmar marca o pedido anterior como resolvido.
- [x] Tentar decidir uma segunda vez com condição `status='pending'` não modifica a reserva.
- [x] Simular status `failed` na fila de envio produz alerta crítico.
- [x] Simular cancelamento realizado por `auth.uid()=client_id` produz alerta de prioridade crítica e encerra o pedido anterior.
- [x] Uma Admin só pode consultar/editar seu próprio estado de leitura; segunda Admin mantém seu próprio.
- [x] Cliente não visualiza a tabela; `anon` não tem SELECT; INSERT da API autenticada está revogado.
- [x] Realtime habilitado e build de prévia da Vercel READY.
- [x] Testes transacionais revertidos por ROLLBACK, sem deixar agendamentos ou falhas fictícias.

## Aceite visual recomendado
1. Entrar como Admin e abrir a **Central de Controle** pelo sino ou pelo botão no painel.
2. Conferir se pedidos já pendentes aparecem com **Aprovar**, **Recusar** e **Visualizar**.
3. Toque **Visualizar** para expandir detalhes dentro do card.
4. Crie um pedido de teste com uma conta de cliente, confira a atualização do sino e escolha **Aprovar**. Verifique o status em Admin → Agenda e o e-mail da cliente.
5. Crie outro pedido e selecione **Recusar**. Confirme na segunda etapa; verifique cancelamento e mensagem da cliente.
6. Teste marcar um alerta como lido; confirme contador.
7. Entre com outra Admin e confirme que seu estado de leitura é independente.
8. Verifique layout mobile, filtros e hierarquia de urgência.

## Limites deste escopo
- **O site ainda não oferece um botão de cancelamento para a cliente**. O alerta de cancelamento pela própria cliente está preparado e foi testado com o contexto de autenticação do usuário, mas só ocorrerá quando esse fluxo for habilitado em uma futura melhoria.
- A Central não substitui logs técnicos, não cria notificações push do sistema operacional e não permite redigir notificações arbitrárias.
