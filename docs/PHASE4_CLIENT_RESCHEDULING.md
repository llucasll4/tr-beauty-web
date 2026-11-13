# Fase 4 — Crescimento do estúdio / Etapa 1: reagendamento simplificado

## Escopo

Cliente autenticada pode tocar em **Reservas → Reagendar horário**, escolher
uma nova data/hora do mesmo serviço e enviar uma solicitação que ficará
**pendente de nova aprovação** pela Admin.

A implementação respeita o projeto Expo Web e mantém a paleta nude/creme,
serviços de unhas, horários configurados no banco e TR Points.

## Regras de negócio

- Somente a titular de uma reserva **pendente** ou **confirmada** pode reagendar
  pelo aplicativo; nunca uma reserva concluída ou cancelada.
- É necessário haver **mais de 24 horas** até o início original. O novo
  horário também precisa ocorrer após 24 horas e dentro dos próximos 90 dias.
- No celular, o calendário inicial oferece até 30 dias, com terça a sábado
  como dias úteis. A disponibilidade definitiva vem do Supabase.
- O **mesmo serviço** é mantido. Para pagamentos em reais, o valor originalmente
  agendado é preservado, mesmo se a tabela de preços mudar depois.
- Para agendamentos com TR Points, a operação estorna os pontos da reserva
  antiga e os debita novamente para a nova, **numa única transação**. Se o
  custo em pontos do serviço mudar, o reagendamento online é negado e a
  cliente deve procurar o estúdio; não há alteração silenciosa do saldo.
- O novo registro recebe o estado **pending**; não herda a confirmação do
  atendimento antigo. A Admin deve confirmar novamente.
- A reserva antiga permanece no histórico como **cancelada**. Um vínculo
  imutável `appointment_reschedules` registra as duas reservas, horário
  original, novo horário e estado anterior.

## Segurança e concorrência

- `public.available_reschedule_slots(appointment_id,date)` reutiliza
  a lógica atual de lacunas de agenda, fuso `America/Sao_Paulo`, bloqueios,
  expediente e buffer de **15 minutos**, ignorando somente a própria reserva
  ao calcular horários alternativos. A função **verifica ownership** no SQL.
- `public.reschedule_appointment(appointment_id,new_start)` confere o
  proprietário via `auth.uid()`, bloqueia o perfil e a reserva, valida a
  janela de 24h, cancela a reserva antiga e chama a função **existente**
  `book_appointment` ou `book_appointment_with_points`.
- Se a nova reserva falhar por conflito, bloco administrativo, horário,
  saldo de pontos ou qualquer outra razão, toda a transação é desfeita,
  inclusive cancelamento, estorno, novo débito e eventuais mensagens.
- O índice GiST de exclusão e o lock contra `calendar_blocks` existentes
  continuam como últimas defesas contra reservas simultâneas.
- Os gatilhos atuais de cancelamento e novo pedido continuam encarregados
  dos alertas, e-mails e notificações, **respeitando o consentimento atual**.
  Não há disparo de e-mails pelo cliente nem nova integração WhatsApp.
- As duas RPCs são executáveis apenas pelo papel `authenticated`;
  a titular da reserva é conferida novamente no servidor. A tabela auditada
  habilita RLS e permite apenas SELECT da própria cliente ou Admin.
  Nenhum INSERT/UPDATE/DELETE direto é concedido ao aplicativo.

## Testes e rollout

- Testes PostgreSQL descartáveis: horário próprio ignorado na consulta,
  datas iguais, horário conflitante, guarda de 24h, outra conta, reserva
  confirmada → pendente, preço original, custo de TR Points alterado,
  devolução + novo débito sem duplicidade, trilha de auditoria e RLS.
- Testes Playwright Chromium: abrir Reservas, tocar em Reagendar, consultar
  horário, confirmar uma vez com Supabase inteiramente fictício e verificar
  o retorno visual. Nenhuma reserva real é criada no CI.
- **A migration já foi aplicada ao Supabase oficial** e as novas funções/RLS foram verificadas sem alterar reservas existentes. Usar a migration
  `supabase/migrations/20261113122237_phase4_client_rescheduling.sql`
  versionada para reproduzir o schema em novos ambientes; não reaplicá-la à produção.
- Por segurança, publicar o frontend **após** a migração e verificação da
  política RLS. Uma prévia com backend ainda não atualizado pode exibir erro
  de RPC ausente; isso não é confirmação de horário.
- Na revisão manual iPhone/Safari, conferir reservas confirmadas/pedidas,
  calendário, mensagem sobre nova aprovação, histórico e saldo TR Points.
  **Não realizar reagendamentos fictícios no ambiente de produção.**
- Reverter deploy da Vercel não reverte agendamentos efetivamente realizados;
  portanto rollback de dados é uma operação separada e não automática.

## Etapas seguintes

- Indicadores de ocupação, cancelamentos e ausências.
- Sugestões de manutenção recorrente.
- Campanhas de relacionamento com consentimento.

Referências: https://supabase.com/docs/guides/database/functions
e https://supabase.com/docs/guides/database/postgres/row-level-security
