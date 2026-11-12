# Fase 3 — Operação profissional / Etapa 1: controle financeiro

## Objetivo
Separar com clareza o **valor estimado dos serviços realizados** dos
**recebimentos informados manualmente**. O registro manual não confirma uma
transação na instituição financeira e não substitui a conciliação bancária.

## Modelo
- `public.appointments.price_at_booking` de serviços com `status='completed'`:
  valor dos atendimentos concluídos, **não dinheiro recebido**.
- `public.appointment_payments`: tabela nova, auditada, somente para
  lançamentos manuais da Admin, em reais. Guarda forma de pagamento,
  `received_at`, autora e histórico de anulações.
- Pagamentos parciais são aceitos, mas a soma ativa **não pode exceder o preço
  reservado**: o gatilho bloqueia concorrência travando a linha do agendamento.
- Lançamentos para serviços não concluídos ou resgatados em TR Points (preço
  em reais igual a zero) são rejeitados.
- Edição e exclusão de lançamento são proibidas. Correções são **anulações
  justificadas**, mantendo a linha histórica. Anulação **não é reembolso**.
- Os saldos sem registro não devem ser chamados automaticamente de
  inadimplência: atendimentos antigos podem ter sido pagos fora do sistema.

## Períodos e indicadores
A nova função `public.p3_financial_snapshot(p_year,p_month)` utiliza
`America/Sao_Paulo` para mensal/anual e devolve:
1. **Serviços concluídos:** soma do valor agendado para atendimentos concluídos
   dentro do período do atendimento.
2. **Recebido no período:** lançamentos ativos por data de recebimento,
   inclusive por serviços realizados em períodos anteriores.
3. **Sem registro:** valor concluído no período menos pagamentos ativos
   vinculados àqueles atendimentos, independentemente da data do pagamento.
4. **Registrado para serviços concluídos:** pagamentos vinculados aos
   atendimentos do período (não é fluxo de caixa do período).

O painel continua com os gráficos antigos de serviços e agendamentos; suas
etiquetas deixam explícito que são **estimativas**. A parte nova não aparece
como R$ 0 se o backend estiver ausente: exibe um aviso de indisponibilidade.
A lista exibe até 60 atendimentos e até 40 recebimentos recentes do período;
os totais consideram todos.

## Segurança
- Migração gerada com Supabase CLI e versionada em
  `supabase/migrations/20261112131729_phase3_financial_receipts.sql`.
- RLS habilitada, SELECT/INSERT/UPDATE restritos à Admin usando a função
  existente `private.is_admin()` (sem confiar em `user_metadata`).
- Apenas colunas específicas são inseríveis/atualizáveis; campos de
  valor e autoria são imutáveis por Data API.
- RPC `SECURITY INVOKER`, verificação interna de papel admin, apenas
  `authenticated` pode executar. Rotinas de trigger têm EXECUTE público
  revogado.
- Nenhum token `service_role` no frontend.
- Esta entrega **não** aciona gateway de pagamentos, não envia cobranças,
  não modifica notificações e não altera a geração dos TR Points.

## Estado de implementação (12/11/2026)
- [x] Migração financeira aplicada no Supabase **tr-beauty-web** como versão
  `20261112131729` (registrada no histórico de migrações).
- [x] A tabela `appointment_payments`, a RPC `p3_financial_snapshot`, RLS
  e permissões foram verificadas após a aplicação, sem criar lançamentos.
- [x] A regressão SQL isolada e os testes Chromium passaram no PR #49.
- [ ] Publicar o frontend após a atualização deste documento e a revisão final do CI.
- [ ] Validar manualmente no Safari/iPhone com conta Admin e conta Cliente:
  painel, recebimento parcial/integral, anulação, formulário e período mensal/anual.
  **Não registrar valores fictícios no ambiente de produção.**

Reverter o deploy web não remove registros financeiros existentes. Para
eventuais correções estruturais, produzir migração incremental; nunca excluir
o ledger em produção sem avaliação de preservação de registros.

## Testes adicionados
`tests/db/phase3-finance-setup.sql` e `phase3-finance-regression.sql`:
segregação prevista/recebida, pagamento parcial, pagamento acima do saldo,
anulação auditada, proibição de edição e RLS de cliente não-admin.
Os testes são executados somente no PostgreSQL isolado da CI.

## Próximas etapas do roadmap
- Fase 3/2: exclusão de contas administrativa e rastreável.
- Fase 3/3: monitoramento de falhas de entrega de notificações.
- Fase 3/4: acessibilidade e desempenho em celulares reais.
- Fase 4: reagendamento, indicadores e relacionamento com consentimento.
