# Expediente do estúdio e último início às 20h

## Dias de funcionamento

| Dia | Abertura | Encerramento / regra de último início |
| --- | --- | --- |
| Domingo | Fechado | — |
| Segunda | Fechado | — |
| Terça | 09:00 | **18:00 é limite para encerrar atendimento + 15 min de preparação** |
| Quarta | 08:00 | **20:00 é último início possível** |
| Quinta | 09:00 | **18:00 é limite para encerrar atendimento + 15 min de preparação** |
| Sexta | 08:00 | **20:00 é último início possível** |
| Sábado | 08:00 | **20:00 é último início possível** |

O intervalo de preparo de **15 minutos** continua obrigatório em todos os dias; ele impede a próxima reserva de começar imediatamente após o serviço anterior.

Nas quartas, sextas e sábados, **20:00 significa o horário do último agendamento**, não o horário em que todos os serviços terminam. Um atendimento iniciado às 20:00 poderá terminar depois das 20:00. Essa exceção só vale nos dias explicitados.

Nas terças e quintas, todo atendimento e seus 15 minutos de preparação precisam terminar até **18:00**. Exemplos: um serviço de **120 min** pode começar no máximo às **15:45**; um serviço de **90 min**, no máximo às **16:15**, se esses horários estiverem realmente livres.

Os dias estão cadastrados em `public.business_hours` no Supabase, e a RPC `available_slots` calcula os intervalos com base nos agendamentos existentes (`pending` ou `confirmed`). Em uma lacuna real, o primeiro início ocorre exatamente após o buffer do atendimento anterior (sem obrigar horários redondos); nos dias de último início às 20:00, o horário **20:00** também é candidato explícito, mesmo quando a lacuna não coincide com múltiplos de 15 minutos.

A restrição GiST existente inclui o buffer `[starts_at, ends_at + 15min)`, protegendo contra reservas simultâneas conflitantes. Os dados são guardados como `timestamptz`, e a interface apresenta horários no fuso `America/Sao_Paulo`.

## Recarregamento após conflitos

- **Cliente:** ao tentar reservar um horário ocupado por outra cliente entre seleção e confirmação, o aplicativo atualiza os horários do dia e retorna à etapa de escolha do horário. A mensagem de conflito permanece visível.
- **Admin:** caso o agendamento manual encontre uma reserva concorrente, a seleção é limpa e a lista do dia é atualizada.
- Fluxos de pagamento normal e resgate de pontos reutilizam a mesma validação de disponibilidade no backend.

## Verificações

Os cenários de 120 minutos foram executados em transação com `ROLLBACK`: terça/quinta permitem último início **15:45**, quarta/sexta/sábado permitem **20:00**, domingo permanece fechado, e 20:00 de Brasília corresponde a **23:00 UTC** em novembro de 2026. Nenhuma reserva real foi inserida durante os testes.
