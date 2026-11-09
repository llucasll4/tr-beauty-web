# TR Points — painel completo da cliente

## Acesso
No site `https://trbeautyconcept.com.br`, clientes logadas acessam **Início → Ver meu extrato e serviços** no cartão TR Points. A tela dedicada oferece botão para voltar ao Início.

## Entrega
- Cabeçalho com saldo atual, progresso até a meta e estado do programa.
- Total acumulado de pontos **ganhos** e **descontados** com sinais separados.
- Aba **Extrato** com todos os lançamentos de pontos: valor positivo/negativo, data, tipo, descrição e vínculo com atendimento/serviço.
- Aba **Serviços realizados** lista todos os agendamentos cujo status é `completed`, incluindo serviço, data, preço no momento da reserva, pontos positivos e descontos vinculados; indica quando não existe lançamento de pontos.
- Paginação de 30 registros por vez em cada aba, com botão **Carregar mais registros**; evita limitar a cinco movimentos.
- Bloco **Sobre o TR Points** com taxa e meta atuais, aviso de regras variáveis e espaço para informações futuras.
- Botão para atualizar informações sem sair do painel.
- Sem função de editar, resgatar ou atribuir pontos pelo cliente; permanece somente leitura.

## Regras
O total de pontos ganhos é a soma dos movimentos positivos do ledger; o total de pontos descontados é a soma do valor absoluto de movimentos negativos, independentemente do tipo de evento. O saldo disponível usa a RPC `get_my_loyalty` já existente (com seu tratamento histórico de saldo). Histórico de serviços inclui apenas `appointments.status='completed'`, inclusive aqueles que não geraram pontos.

O vínculo a cada serviço é recuperado de `points_ledger.appointment_id`; movimentos de bônus, ajustes e resgates sem vínculo permanecem no extrato geral.
A data de atendimento é exibida em `America/Sao_Paulo`; nome do serviço usa nome atual do cadastro (não há snapshot histórico do nome).

## Segurança
- A RPC `get_my_points_totals()` usa `SECURITY INVOKER`, restringe ao `auth.uid()` e só permite EXECUTE a `authenticated`.
- O SELECT em `points_ledger` e `appointments` é limitado pela RLS a registros da própria cliente ou admin; o frontend também filtra por `client_id=userId`.
- A policy `Customer historical completed services` permite a clientes autenticadas ler serviços inativos somente quando têm um atendimento concluído com o serviço. `anon` continua vendo somente os serviços ativos.
- Não há acesso público ao extrato, nem inserções/edições de pontos pelo cliente.
- Migrações já aplicadas ao Supabase: `20261109_tr_points_totals.sql` e `20261109_tr_points_historical_services.sql`. Não reexecutar em produção.

## Verificações técnicas feitas
- Consulta de totais sobre cliente real no banco: 115 ganhos, zero descontos, uma movimentação.
- Consulta sobre usuário sem lançamentos: totais zerados.
- `anon` sem EXECUTE da nova RPC; `authenticated` com permissão.
- `SECURITY INVOKER` confirmado.
- RLS dos serviços anteriores permanece limitada ao proprietário do atendimento concluído; visitantes seguem com serviços ativos.
- Build de prévia da Vercel READY.

## Checklist de aceite no navegador
- [ ] Início mostra cartão TR Points com botão **Ver meu extrato e serviços**.
- [ ] Clicar abre tela com saldo, progresso e totais ganhos/descontados.
- [ ] Extrato mostra serviço e evento para cada lançamento e pontos com sinal correto.
- [ ] Serviços realizados mostra atendimento e pontos associados; sem lançamento, deve mostrar zero.
- [ ] Testar conta sem pontuação: estados vazios e totais zero.
- [ ] Atualizar dados e voltar ao Início.
- [ ] Se houver mais de 30 registros, testar **Carregar mais registros** em ambas as abas.
- [ ] Confirmar que clientes não veem dados de outras contas.
