# Agenda dinâmica — buffer obrigatório de 15 minutos

## Implementação

A disponibilidade é calculada no banco pela RPC `public.available_slots(uuid,date)`, consultada tanto pela agenda da cliente quanto pela agenda manual da administradora.

- A função percorre reservas com status `pending` ou `confirmed` em ordem cronológica.
- Cada reserva ocupa `[starts_at, ends_at + 15 minutos)`.
- Uma lacuna começa na abertura do estúdio ou **exatamente 15 minutos após o fim** da reserva anterior.
- Um serviço novo cabe na lacuna apenas quando `início + duração do serviço + 15 minutos <= próximo início ocupado` (ou horário de fechamento).
- Dentro de cada lacuna, as sugestões adicionais avançam de **15 em 15 minutos a partir do início daquela lacuna**, sem grade fixa de horas cheias. Um atendimento terminando às 12h07 gera a possibilidade de iniciar às 12h22, não força 13h.
- O calendário da cliente consulta `business_hours` para habilitar os dias efetivamente abertos, sem restringir datas a uma semana fixa.
- O horário de Brasília (`America/Sao_Paulo`) determina a data e os limites do expediente; o banco recebe/devolve `timestamptz`, convertido em ISO 8601 para o aplicativo.
- Para hoje, apenas horários futuros são ofertados. A janela máxima permanece em 90 dias no backend, e o calendário da cliente mantém sua janela atual de 30 dias.
- Reservas canceladas e concluídas não bloqueiam novos horários.

## Regra antifraude e concorrência

A restrição de exclusão `no_overlapping_appointments` cobre o intervalo `[starts_at, ends_at + 15 min)` e bloqueia conflitos independentemente de duas solicitações concorrentes. A comparação do índice é feita em UTC e o buffer não altera o campo `ends_at`, que continua representando o fim real do atendimento.

`book_appointment` valida novamente que o horário exato ainda consta em `available_slots` e que serviço **mais buffer** terminam dentro do expediente. `book_appointment_with_points` reutiliza essa validação; a reserva manual Admin também consulta a mesma disponibilidade. Nenhuma permissão anônima foi adicionada; clientes consultam slots sem enxergar agendas de outras clientes.

## Cenários testados (transação desfeita ao final)

1. Serviço de 120 min às **10h**, fim às **12h**, buffer até **12h15**: 12h15 ofertado, 12h não ofertado.
2. Segundo atendimento às **16h**: um serviço de 90 min pode iniciar às **14h15** (fim 15h45 e buffer até 16h), mas **14h30** não cabe.
3. Fechamento às **18h**: não apresentar horários que façam o serviço e seu buffer ultrapassarem o expediente.
4. Inserção que invade o buffer é rejeitada pela restrição GiST, mesmo sem uso da RPC.
5. Tentativa de agendar diretamente 12h17 quando esse não é um slot ofertado é rejeitada pelo backend.

## Arquivos

- `supabase/migrations/20261109_dynamic_slots_buffer_15.sql`
- `App.js` (dias habilitados conforme `business_hours`)
- `BookingWizard.js` e `AdminManualBooking.js` (orientação de 15 minutos na tela)

## Observação

O buffer se aplica **após todo atendimento, inclusive o último**. Portanto, se o expediente encerra às 18h, a última reserva deve terminar seu atendimento até 17h45 para que a preparação finalize às 18h.
