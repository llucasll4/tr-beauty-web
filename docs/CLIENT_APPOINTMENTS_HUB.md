# Meus Agendamentos — painel da cliente

## Objetivo
Transformar a aba **Agendar** em um painel de gestão da própria cliente, preservando o fluxo existente de criação.

## Entrega
- Usuárias autenticadas: aba **Reservas** abre **Meus agendamentos**, com **Próximos** e **Histórico**.
- Próximos: agendamentos com início futuro e status `pending` ou `confirmed`, em ordem crescente.
- Histórico: agendamentos iniciados no passado, cancelados ou concluídos, em ordem decrescente.
- Cada cartão exibe serviço, data, hora (America/Sao_Paulo), valor da reserva e status traduzido.
- Indicadores de pedido aguardando confirmação e reserva cancelada.
- Botão **Novo agendamento** abre o formulário já existente. Voltar retorna ao painel.
- Após a reserva, a cliente volta ao painel com mensagem de sucesso e recarregamento dos agendamentos.
- Estados vazios, carregamento, erros, atualização manual e paginação de 50 registros por vez.
- Visitantes continuam vendo a interface pública com convite ao login antes de agendar.
- Não há cancelamento ou reagendamento pela cliente nesta entrega, porque não foram solicitados.

## Segurança
- A consulta usa `appointments.eq('client_id', userId)` e a política RLS existente `Read own appointments or admin`.
- A política restringe o SELECT a `client_id=auth.uid()` ou administradora e aplica-se a `authenticated`.
- Visitantes sem sessão não executam a consulta.
- Nenhuma migração ou nova dependência.

## Teste manual recomendado
- [ ] Conta cliente com reserva futura: visualizar status, data, preço e nome do serviço em **Próximos**.
- [ ] Conta cliente com atendimentos anteriores: visualizar em **Histórico**.
- [ ] Reserva cancelada: aparece no histórico e não entre próximos, mesmo com data futura.
- [ ] Conta sem agendamentos: estados vazios corretos.
- [ ] Clicar em **Novo agendamento**, usar botão voltar e conferir retorno ao painel.
- [ ] Criar uma reserva e confirmar que ela aparece na lista como aguardando confirmação.
- [ ] Cliente não vê agendamentos de outras contas.
- [ ] Visitante anônimo permanece no fluxo público, sem acessar o painel privado.
- [ ] Testar em celular, especialmente o botão **Reservas**, scroll e troca de abas.

## Limitações
A lista carrega 50 agendamentos por página e permite solicitar mais.
O status de cada item é atualizado ao reabrir o painel ou tocar no botão de atualizar.
