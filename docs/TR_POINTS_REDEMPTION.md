# TR Points — Resgate de serviços com pontos

## Fluxo da cliente
1. Entrar na conta e abrir **TR Points → Usar meus pontos para agendar** ou **Reservas → Novo agendamento**.
2. Escolher serviço (mostra valor em reais e custo em TR Points).
3. Em **Forma de pagamento**, escolher **No atendimento** ou **TR Points**.
4. Com TR Points, visualizar saldo disponível e custo exato do serviço. Se insuficiente ou programa pausado, o envio fica desabilitado.
5. Escolher data/horário como antes e tocar **Resgatar e confirmar pedido**.
6. Ao confirmar o pedido no backend, os pontos são debitados e a reserva é registrada como **pendente**, com valor monetário zero.
7. O redirecionamento anterior para **Início** e o pop-up continuam funcionando, agora com mensagem específica sobre pontos usados.
8. A aba **Reservas** e a agenda Admin exibem a forma de pagamento e quantidade de pontos.

## Tabela inicial de resgates
Serviços existentes, ordenados do menor preço ao maior:
- Esmaltação em gel (R$ 65): **300 pontos**.
- Banho de gel (R$ 115): **400 pontos**.

A regra inicial é 300 + 100 × posição na tabela por preço. A administradora pode definir QUALQUER inteiro positivo por serviço, sem exigir múltiplos de 100. Para novos serviços, o formulário sugere o próximo valor e permite editar antes de salvar. A personalização administrativa substitui a referência inicial.

## Admin
- Nova aba **Admin → TR Points**, com tabela de todos os serviços, preço, status e campo editável de custo em pontos.
- **Admin → Serviços** também possui campo **Pontos necessários para resgatar o serviço** em Novo/Editar.
- Atualizações são validadas pelo backend e protegidas por RLS, somente admin pode gravar em `services`.

## Integridade do saldo e regras de resgate
- A RPC `book_appointment_with_points(service,starts_at)` exige usuário autenticado, programa habilitado e serviço ativo.
- O preço em pontos é lido do banco, não do cliente.
- O backend bloqueia a linha do perfil da cliente ao calcular o saldo; dois resgates simultâneos do mesmo perfil não conseguem debitar o mesmo saldo.
- Reaproveita a RPC existente `book_appointment` para validar horário, expediente e sobreposições.
- Em **uma única transação** cria a reserva, registra `points_redeemed`, muda `price_at_booking` para 0 e grava `points_ledger` negativo com evento `redeemed`.
- Falhas de qualquer etapa fazem rollback automático, impedindo desconto de pontos sem reserva.
- Um atendimento resgatado em pontos **não ganha pontos novamente** ao ser concluído.
- Se o estúdio cancelar o agendamento ainda pendente ou confirmado, o valor exato de pontos retorna automaticamente como movimento `reversal`, uma única vez.
- Uma reserva resgatada e cancelada não pode ser reaberta; é necessário criar um novo pedido.
- Atendimento já realizado e marcado concluído não é estornado automaticamente (exige tratamento administrativo específico).
- Resgate não equivale a pagamento recebido: `price_at_booking=0` impede aumento indevido do faturamento financeiro em reais.

## SQL e segurança
Migrações já aplicadas no Supabase:
- `supabase/migrations/20261109_tr_points_service_redemption.sql`
- `supabase/migrations/20261109_tr_points_any_positive_cost.sql`

**Não executar novamente** em produção.

`book_appointment_with_points` é `SECURITY DEFINER` por precisar criar reserva e lançar pontos, mas checa `auth.uid()`, usa `search_path=''` e foi explicitamente revogada de `anon`/PUBLIC, ficando executável apenas por `authenticated`.

As tabelas `appointments` e `points_ledger` continuam sob RLS; clientes não conseguem lançar pontos diretamente nem alterar preços de serviços.

## Teste de aceite
- [ ] Na conta cliente com saldo insuficiente, opção TR Points mostra custo/saldo e bloqueia envio.
- [ ] Na conta com saldo suficiente, selecionar serviço e data, resgatar e receber pop-up na Home.
- [ ] Na tela Reservas, exibir o custo em pontos, não valor em reais.
- [ ] No painel TR Points, extrato exibe o débito e saldo reduzido.
- [ ] Admin Agenda exibe reserva com indicação de TR Points.
- [ ] Admin → TR Points altera preço, salva e cliente vê custo atualizado.
- [ ] Cancelar reserva pendente de pontos no Admin, verificar estorno e saldo original.
- [ ] Concluir reserva de pontos e verificar que não gera nova pontuação.
- [ ] Cliente não consegue editar o custo ou lançar pontos.
- [ ] Reservar sem pontos segue funcionando como antes.

## Validação técnica
- [x] Migrações aplicadas.
- [x] Valores iniciais 300 e 400 verificados.
- [x] Em transação com rollback: reserva, débito e estorno testados; nenhuma linha fictícia persistiu.
- [ ] Testes visuais no site com cliente/admin.
