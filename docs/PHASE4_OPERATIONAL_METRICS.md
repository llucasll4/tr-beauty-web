# TR Beauty Concept — Fase 4 / Etapa 2
## Indicadores de ocupação, cancelamentos e ausências

### Entrega
O painel **Admin → Métricas → Indicadores de operação**, dentro do seletor
mensal/anual já existente, traz indicadores de capacidade e comparecimento
relacionados à agenda de Nail Design.

As métricas são **operacionais**, não são receitas confirmadas em caixa.

### Definições transparentes
1. **Taxa de ocupação da agenda:** minutos de reservas `pending`,
   `confirmed` ou `completed` + intervalo de 15 min, limitados ao
   expediente, divididos pelos minutos de expediente habilitado depois de
   descontar os blocos administrativos. Cancelamentos não ocupam agenda.
   Os dias e horários são lidos de `business_hours` no fuso
   `America/Sao_Paulo`. Apura o período selecionado, inclusive datas
   futuras, e reflete a configuração de expediente e bloqueios **atual**,
   não necessariamente a que existia historicamente.
2. **Cancelamentos:** apenas reservas `cancelled` que não são a origem
   de um reagendamento. O denominador também elimina essas origens.
   Uma mudança de horário não distorce a taxa de cancelamento.
3. **Faltas registradas:** só registros explícitos da Admin na tabela
   `appointment_no_shows`, para atendimento **confirmado e já encerrado**.
   A taxa de faltas usa, no denominador, serviços concluídos + faltas
   registradas. Serviços não concluídos por si só **não** são faltas.
4. **Pendentes de verificação:** serviços `confirmed` já encerrados sem
   `completed` ou lançamento de falta. Pedidos antigos ainda `pending`
   aparecem separados e não entram como ausências confirmadas.

### Registro e correção de falta
A Admin pode marcar **Registrar falta → Confirmar falta** ao verificar uma
ausência. O registro não cancela a reserva, não emite nova notificação,
não estorna TR Points nem cria recebimentos.

Uma falta incorreta pode ser anulada com motivo de 5 a 300 caracteres,
sem apagar o registro. Uma mesma reserva pode receber um novo registro
depois de anulada, com vínculo histórico. A tabela tem índice parcial
que impede duas faltas ativas para a mesma reserva.

Enquanto há uma falta ativa, o servidor não permite alterar a reserva
original de confirmada para concluída ou cancelada: primeiro é preciso
reverter a falta. Essa regra impede contradições entre histórico e
relatórios, inclusive fora da interface.

### Segurança
- `p4_operational_metrics(year,month)` é `SECURITY INVOKER`,
  valida `private.is_admin()` e consulta somente registros permitidos por
  RLS. O retorno traz métricas e no máximo 40 atendimentos antigos para
  análise da administração.
- `appointment_no_shows`: RLS somente Admin para SELECT, INSERT e
  UPDATE restrito às três colunas de anulação. Sem DELETE, sem atualização
  do atendimento/autor e sem acesso por contas Cliente.
- Triggers validam autorização, horário encerrado e preservação dos
  lançamentos. O trigger de integridade de status é `SECURITY DEFINER`
  por precisar enxergar todos os registros de falta, inclusive quando uma
  atualização de reserva é tentada por outra conta; o EXECUTE público
  foi revogado e a função recebe apenas OLD/NEW do trigger.
- No frontend não existem chaves de serviço ou funções administrativas de
  exclusão/alteração de histórico.
- As auditorias de TR Points, pagamentos e reagendamentos permanecem intactas.

### Testes
O SQL é testado em Postgres 17 **descartável** com duas políticas de presença
(sem inferência), cálculo de minutos, blocos, exclusão das origens de
reagendamento, autorização RLS, bloqueio de status contraditório,
anulação justificativa e preservação da linha anulada.
O Playwright Chromium testa, em 390 px, a navegação até Métricas,
visualização da ocupação e o fluxo de confirmação de falta com Supabase
**fictício**, sem acessar clientes reais.

### Publicação controlada
1. Aprovar CI e prévia Vercel.
2. Revisar o SQL: `supabase/migrations/20261113123447_phase4_operational_kpis.sql`.
3. Antes de expor a UI, aplicar a migração com o histórico real do Supabase,
   conferir privilégios, RLS e a **quantidade de linhas**.
4. Só após isso publicar o frontend e validar Safari/iPhone em conta Admin.
5. Não criar ausências ou agendamentos fictícios na produção.
6. Reverter deploy web não reverte faltas efetivamente registradas. Para
   alterações posteriores, criar uma nova migração incremental; não excluir
   histórico já auditado.

### Limites
A taxa de ocupação mede a agenda, não ociosidade de cada profissional nem
pagamento; há apenas uma capacidade de agenda. O expediente e bloqueios
atuais podem modificar retrospectivamente o cálculo. A taxa de
cancelamentos é baseada na **data agendada**, não na data de solicitação
do cancelamento. As listas mostram até 40 casos recentes por período,
mas os totais são calculados sobre todos os registros.

Próximas etapas: sugestões de manutenção recorrente e campanhas
com consentimento explícito.
