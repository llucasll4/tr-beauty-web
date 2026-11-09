# Agenda — horários dinâmicos e buffer obrigatório de 15 minutos

## Regra de negócio

- Uma reserva ocupa o período do serviço `[starts_at, ends_at)` **e mais 15 minutos** para limpeza e preparação: `[starts_at, ends_at + 15 min)`.
- A disponibilidade é calculada no banco, conforme `public.business_hours` e todas as reservas com status `pending` ou `confirmed`. Reservas canceladas e concluídas não bloqueiam horários futuros.
- Cada lacuna (gap) é percorrida a partir do **instante exato** de liberação. Os candidatos são oferecidos de 15 em 15 minutos **relativos ao início da lacuna**, não em uma grade fixa baseada no relógio. Isso permite horários como **12:22** quando o atendimento anterior terminou às 12:07.
- A duração **do serviço escolhido, mais os 15 minutos finais**, precisa caber integralmente antes da próxima reserva ou do fechamento do estúdio.
- A primeira lacuna começa na abertura do expediente. As lacunas seguintes começam em `ends_at + 15 min`. Nunca sugerir uma reserva passada.
- O calendário da cliente usa a mesma RPC da agenda manual da administração e continua respeitando os dias habilitados.
- Horários persistidos/retornados como `timestamptz` são instantes absolutos (ex.: ISO 8601 em UTC); o front-end usa `Intl.DateTimeFormat(..., { timeZone: 'America/Sao_Paulo' })` para exibir horários de Brasília.

## Segurança do agendamento

- A RPC `available_slots(service, date)` faz a consulta dinâmica. A RPC `book_appointment(service, starts_at)` **valida novamente** o horário no momento do pedido.
- A restrição de exclusão GiST em `appointments` impede sobreposições mesmo com duas tentativas simultâneas: compara os períodos com buffer de 15 minutos, em UTC.
- A RPC `book_appointment_with_points` já utiliza `book_appointment`; o agendamento manual valida o mesmo `available_slots`. Não houve necessidade de criar outra regra por forma de pagamento.
- As RPCs permanecem restritas a usuários autenticados. Nenhuma política RLS ou permissão extra foi criada.

## Cenários de regressão

| Cenário | Resultado esperado |
| --- | --- |
| Serviço 10:00–12:00 | Próximo início **12:15** |
| Serviço termina 12:07 | Próximo início **12:22**, sem arredondar para 12:30 |
| Agendamento 09:00–10:00 e outro às 13:00; novo serviço 120 min | **10:15, 10:30 e 10:45** cabem; **11:00** não cabe antes das 13:00 |
| Expediente termina 18:00; serviço 120 min | Último início válido **15:45** incluindo setup até 18:00 |
| Tentativa de reserva 12:14 após término 12:00 | Rejeitada pela restrição, inclusive em concorrência |
| Tentativa de reserva 12:15 após término 12:00 | Aceita se os demais critérios forem satisfeitos |
| Reserva cancelada | Não bloqueia os novos horários |
| Data sem expediente | Nenhum slot retornado |
| Front-end no fuso local | Horário apresentado em **America/Sao_Paulo**, sem depender do fuso do dispositivo |

## Arquivos

- `supabase/migrations/20261109_dynamic_slots_buffer_15.sql`: alteração transacional da restrição de não sobreposição e das RPCs.
- `App.js`: reconsulta a disponibilidade após uma reserva e quando ocorre conflito.
- `BookingWizard.js` e `AdminManualBooking.js`: explicam o buffer para cliente e administradora.

Testes de regressão do algoritmo e do GiST foram executados em **transações com ROLLBACK** usando dados de teste isolados, sem alterar agendamentos reais.
