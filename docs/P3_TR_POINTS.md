# TR Beauty Concept — P3 TR Points (proposta para revisão)

Esta implementação está em uma branch separada, sem modificar a versão publicada.

## Regra inicial (editável)

- **1 ponto por R$ 1 inteiro** do valor do serviço concluído, por exemplo R$ 120,50 gera 120 pontos.
- **Meta visual: 300 pontos.** A meta não concede automaticamente nenhuma recompensa, desconto nem resgate.
- Pontos são creditados na transição do atendimento para `completed` no Supabase.
- Cada atendimento credita no máximo uma vez, graças a um índice único e inserção idempotente.
- Cancelamentos e atendimentos pendentes/confirmados não geram crédito.
- Atendimentos concluídos anteriormente à migração **não** recebem crédito retroativo.
- Reversões e resgates ficam para uma próxima etapa após a definição da regra comercial.

## Como ativar

1. Revise a taxa e a meta na migração `supabase/migrations/20261108_p3_tr_points.sql`.
2. Execute a migração no **SQL Editor do Supabase**, após revisar.
3. Faça merge deste pull request. A Vercel deverá publicar o novo código.
4. Faça login como cliente. Veja o cartão TR Points na Home.
5. Faça um agendamento de teste; marque-o como confirmado e depois concluído no painel Admin.
6. Confira se a cliente recebe os pontos e se a administradora vê o mesmo saldo em **Admin > Clientes**.
7. Atualize o cartão e a página: a pontuação não deve duplicar.

## Configuração posterior

No SQL Editor, o proprietário do banco pode ajustar a regra:

```sql
update public.loyalty_settings
set points_per_real = 1, goal_points = 300, enabled = true
where id = 1;
```

Não defina benefícios ou prêmios antes de aprovar a política de resgates.

## Segurança

O navegador não recebe permissão de gravação em `points_ledger`; o crédito é feito pelo trigger do banco. A consulta da própria cliente é restrita por RLS. A função administrativa confere o papel `admin` no banco.

**Limite dos testes:** os arquivos JavaScript foram validados sintaticamente, mas a migração ainda precisa ser executada e testada no Supabase real.