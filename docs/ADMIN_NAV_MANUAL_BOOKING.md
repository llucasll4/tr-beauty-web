# Admin — navegação exclusiva, agendamento manual e perfil administrativo

## Alteração de navegação

A administradora tem uma navegação simplificada, distinta da experiência de cliente:

- **Início**: acesso à vitrine e atalhos para o painel administrativo e agendamento de cliente.
- **Galeria**: visualização da galeria.
- **Admin**: central de trabalho, aberta como página inicial após login da administradora.

As abas de cliente **Reservas/Agendar** e **Perfil** deixam de aparecer para administradoras; a tela de TR Points pessoal da cliente também não é mostrada na Home da Admin.

## Novas seções de Admin

- **Agendar cliente**: escolher uma cliente já cadastrada, serviço ativo, data e horário, e informar observações opcionais.
- **Meu perfil**: o formulário existente de foto, nome, telefone e e-mail da própria administradora, agora acessado por **Admin → Meu perfil**. Atualizações de e-mail continuam com verificação por e-mail. O perfil da cliente não é editado aqui: dados e histórico continuam na seção **Clientes**.
- Permanecem as abas **Agenda, Clientes, Serviços, Portfólio, Financeiro e TR Points**.

## Agendamento manual — regras

A seção **Agendar cliente** lista até 75 clientes e permite pesquisar pelo nome. É necessário que a cliente tenha uma conta cadastrada no site.

O processo usa a RPC `public.admin_book_client_appointment(p_client_id,p_service_id,p_starts_at,p_notes)`:
- Exige sessão de administradora por `private.is_admin()`.
- Checa que o cliente informado existe e tem `role='client'`.
- Usa serviço ativo e valida o horário pela RPC já existente `available_slots`, incluindo expediente, bloqueio de conflitos e limite de 90 dias.
- Cria a reserva com preço normal registrado no momento da marcação, **sem descontar TR Points**, e observação de origem administrativa.
- Cria inicialmente como `pending` e atualiza para `confirmed` na mesma transação, para acionar o fluxo já existente de e-mails de confirmação e lembretes quando a cliente habilitou notificações.
- Não gera novo atendimento caso a validação falhe, preservando as restrições de sobreposição do banco.
- Exibe confirmação na tela e permite abrir a Agenda, onde a nova marcação deve aparecer.

## Segurança

A RPC é `SECURITY INVOKER` e executável somente por `authenticated` (não por `anon`); a autorização de administradora é validada dentro da função. RLS existente de `appointments` continua exigindo `private.is_admin()` para inserir e alterar registros; clientes comuns não podem marcar para outras pessoas.

Migrações **já aplicadas** ao Supabase:
- `supabase/migrations/20261109_admin_manual_appointment.sql`
- `supabase/migrations/20261109_admin_manual_booking_confirm_notice.sql`

Não reexecutar no ambiente de produção.

## Testes técnicos

- [x] Criação de agendamento confirmado pela conta administradora com serviço, cliente, data, observação e preço corretos.
- [x] Tentativa da mesma RPC por cliente comum foi negada.
- [x] Teste transacional com `ROLLBACK`; nenhuma marcação fictícia persistiu.
- [x] RPC sem permissão `anon`; segurança invoker e policy existente verificadas.
- [x] Build da branch na Vercel READY.

## Checklist visual para validação da administradora

- [ ] Entrar como Admin: navegação inferior mostra Início, Galeria e Admin, sem abas de cliente Agendar e Perfil.
- [ ] Abrir **Admin → Agendar cliente**, selecionar cliente existente, serviço e data.
- [ ] Escolher horário disponível e confirmar; verificar confirmação na tela.
- [ ] Abrir Agenda e encontrar o atendimento como **Confirmado**.
- [ ] Confirmar envio de e-mail à cliente, se habilitado nas preferências.
- [ ] Abrir **Admin → Meu perfil**, alterar nome/telefone ou foto e salvar; voltar ao Admin.
- [ ] Entrar como cliente: navegação anterior e agendamento da própria cliente continuam funcionando.
- [ ] Entrar como visitante: Home e Galeria públicas permanecem.
- [ ] Confirmar que cliente comum não consegue acessar a função de agendamento manual.

## Fora do escopo

Cadastro de novas contas de clientes diretamente pelo Admin e edição de dados pessoais de terceiros pelo Admin não foram adicionados. Esses fluxos exigem validações adicionais de identidade e proteção de dados.
