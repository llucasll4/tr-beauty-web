# P6 — Painel financeiro da TR Beauty Concept

## O que foi entregue

Painel na área **Admin → Financeiro** do site \`https://trbeautyconcept.com.br\`.

- Alternância de visão **Mensal** / **Anual**, com setas para navegar pelos períodos.
- Indicadores: receita de atendimentos concluídos, quantidade de atendimentos concluídos, ticket médio e número de clientes distintos atendidos.
- Gráfico de valores concluídos por mês (visão anual) ou por blocos de sete dias dentro do mês (visão mensal).
- Receita e volume de atendimentos por serviço.
- Contagem de agendamentos pendentes, confirmados e cancelados.
- Valor de reservas confirmadas exibido **separadamente**, como previsão.
- Botão atualizar para buscar dados mais recentes.

## Regra financeira

- O painel soma \`appointments.price_at_booking\` somente quando \`appointments.status = 'completed'\`.
- O período é determinado por \`appointments.starts_at\` no fuso \`America/Sao_Paulo\`.
- Os serviços são agrupados pelo \`service_id\`; o nome exibido é o nome **atual** na tabela \`services\`.
- Reservas confirmadas são previsão, não receita realizada. Pedidos pendentes e cancelamentos não geram receita.
- Um atendimento marcado concluído não significa automaticamente que o pagamento foi recebido.
- O sistema atual não registra recebimentos, métodos de pagamento, parcelas, reembolsos, taxas, custos ou despesas. Portanto, os valores **não são faturamento fiscal, fluxo de caixa nem lucro líquido**.
- O total reflete o preço na reserva, mesmo se a tabela de serviços tiver preços posteriormente alterados.
- Não há lançamento manual de receitas. Tudo vem da Agenda.
- O painel não altera os agendamentos nem dispara notificações.

## Segurança

A consulta \`public.p6_financial_dashboard(p_year integer,p_month integer default null)\`
é uma RPC \`SECURITY INVOKER\` que exige \`private.is_admin() = true\`.
Só \`authenticated\` possui EXECUTE; \`anon\` não.
As políticas RLS já existentes em \`public.appointments\` continuam ativas.
Não são repassados nomes, telefones ou identificadores das clientes ao frontend do financeiro.
O painel só aparece no menu Admin para contas com \`profiles.role='admin'\`.

Migração: \`supabase/migrations/20261108_p6_financial_dashboard.sql\` **já aplicada** ao Supabase \`tr-beauty-web\`.
**Não executar novamente** em produção.

## Validações técnicas concluídas

- [x] Consulta mensal nov/2026: 1 concluído, R$ 115; ticket R$ 115; 1 confirmado, previsão R$ 115; 2 cancelados.
- [x] Consulta anual 2026: dados atribuídos a novembro, demais meses com zero.
- [x] RLS existente de appointments contém papel admin via função \`private.is_admin\`.
- [x] Chamada por identidade não administradora bloqueada.
- [x] \`anon\` sem permissão de EXECUTE; SECURITY INVOKER confirmado.
- [x] Vercel branch build \`READY\`.
- [ ] Teste visual no navegador autenticado como administradora (responsivo, navegação Mensal/Anual).
- [ ] Recarregar após mudar status de um atendimento de confirmado para concluído e conferir atualização.
- [ ] Teste de negativa em sessão de cliente.

## Como validar no site

1. Entrar no site com a conta de administradora.
2. Abrir **Admin → Financeiro**; a barra de abas rola horizontalmente no celular.
3. Selecionar **Mensal** e observar novembro/2026.
4. Conferir receita de R$ 115 e 1 atendimento concluído; previsão separada de R$ 115.
5. Alternar para **Anual** e verificar o pico de novembro.
6. Conferir serviço e contagens, navegar para mês sem movimento e usar **Atualizar**.
7. Confirmar com conta de cliente que Financeiro não aparece.

## Próximas melhorias possíveis (fora do escopo)

- Conciliação de pagamentos recebidos.
- Controle de despesas, taxas, comissões e lucro líquido.
- Exportação de relatórios e comprovantes.
- Comparativo entre períodos e metas.
