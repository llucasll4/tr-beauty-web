# Fase 3 — Etapa 2: análise de pedidos de exclusão de contas

## Problema
A área **Admin → Configurações → Exclusão de contas** já permite receber,
analisar e responder a pedidos de privacidade, mas uma resposta administrativa
**não significa que o usuário foi excluído**.

A exclusão imediata de `auth.users` é perigosa: há relacionamentos com
`profiles`, `appointments`, `points_ledger`, `appointment_payments`,
notificações e outros dados. Alguns FKs são `RESTRICT`/`NO ACTION`,
enquanto outros têm `ON DELETE CASCADE`, que pode apagar históricos
necessários para auditoria ou obrigações de retenção.

## Alteração entregue neste PR
- Uma seção **Verificar vínculos antes de excluir** para cada pedido.
- Leitura sob demanda, apenas para a Admin autenticada, usando o RLS
  existente e quatro contagens PostgREST `HEAD`:
  - reservas com status `pending` ou `confirmed`;
  - atendimentos `completed`;
  - movimentações `points_ledger`;
  - lançamentos da `appointment_payments`, incluindo anulados, vinculados
    ao usuário por `appointments!inner`.
- Se uma consulta falhar, a tela exibe **verificação incompleta** e não apresenta
  contagens fictícias iguais a zero.
- Mensagens para analisar reservas e registros financeiros; a inexistência de
  vínculos nessas quatro categorias **não comprova** que a conta possa ser apagada.
- Teste de navegação Chromium em celular com conta/admin/solicitação fictícias.
- Nenhuma alteração no schema ou em clientes, perfis ou pagamentos.

## Regras de segurança
- **Sem exclusão automática ou botão "Excluir permanentemente" nesta etapa.**
- `account_deletion_requests.status='responded'` é uma resposta registrada.
  Não marca a conta como excluída, nem encerra o ciclo de retenção.
- Status `processed` não será liberado até existir um procedimento administrativo
  autorizado, verificável, auditado e que trate as FKs, dados financeiros,
  reversibilidade e revogação de sessões.
- `supabase.auth.admin.deleteUser` exige chave de privilégios elevados e não
  pode ser chamada no browser. Nunca introduzir `service_role` no cliente.
- É necessário mapear backup, exportação, retenção por categoria, evidência da
  confirmação de identidade, tratamento de solicitações pendentes e comunicação
  à titular. Dados protegidos por obrigações legais podem exigir conservação
  ou anonimização em vez de exclusão irrestrita.
- A interface existente continua responsável por anotar a resposta à cliente.
  O texto visível à titular não é lugar para notas operacionais confidenciais.

## Próximo passo para completar a exclusão efetiva
Definir uma política formal de conservação, com suporte jurídico do estúdio;
projetar rotina protegida em backend, testada em uma cópia isolada, que trate
cada relação sem apagar históricos necessários. A ação real deve exigir
aprovação explícita por solicitação de cliente, conferência de identidade,
trilha de auditoria fora de dados sujeitos a `CASCADE` e confirmação de
resultado (inclusive eventual falha parcial).

## Validação
1. `npm test`, `npm run build` e testes Chromium no PR.
2. Abrir Admin → Configurações → Exclusão de contas em tela pequena.
3. Em uma solicitação legítima, acionar "Verificar vínculos".
4. Conferir a interpretação dos quatro indicadores sem expor dados a cliente.
5. Verificar que nenhum controle permite apagar uma conta.
6. Não inserir solicitações fictícias na produção para validar a tela.

Referência de segurança: https://supabase.com/docs/guides/auth/managing-user-data
