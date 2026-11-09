# Cadastro obrigatório com celular válido — TR Beauty Concept

## Objetivo
Exigir celular brasileiro com DDD ao criar nova conta de cliente. Não exige, não ativa e não envia mensagens por WhatsApp: autorização para WhatsApp permanece opcional e independente.

## Experiência
- Na tela **Criar minha conta**, o campo **Celular com DDD *** aparece junto de nome, e-mail e senha.
- Máscara `(11) 91234-5678`; teclado de telefone e exemplo visível.
- O cadastro não é enviado se o celular estiver vazio ou com formato inválido.
- Entrada pode ser digitada com máscara, apenas números ou no padrão internacional `+55`; o banco armazena a forma **E.164**, por exemplo `+5511912345678`.
- Validação de **11 dígitos brasileiros**, DDD existente e celular começando com `9`. Telefone fixo não é aceito como celular para cadastro.
- Nenhum dado pessoal é enviado para validar com sistemas externos. **Validação de formato não comprova propriedade da linha**; confirmação por SMS exigiria integração separada.

## Segurança no Supabase
- O trigger existente `auth.users → public.handle_new_user()` agora extrai e normaliza o celular de `raw_user_meta_data.phone` e grava em `public.profiles.phone`.
- Novas contas criadas com provedor **email** são rejeitadas pelo servidor sem celular válido, inclusive quando a API é chamada diretamente, sem o formulário web.
- A trigger `private.enforce_profile_mobile` também valida atualizações do número e impede que clientes com celular válido apaguem esse contato.
- Funções de trigger e normalização ficam inacessíveis como RPCs públicas.
- Não é feita imposição `NOT NULL` retroativa na tabela: isso preserva os registros existentes.

## Contas existentes, Google e Admin
- Clientes existentes sem celular **continuam com a mesma conta, histórico de reservas e pontos**.
- No próximo login, uma tela de **Completar cadastro** exige o celular antes de abrir o app.
- No primeiro login via Google, a pessoa também deve completar seu telefone antes de usar o app, porque a Meta/Google não garante telefone no cadastro OAuth.
- Contas **Admin** existentes não são obrigadas a preencher celular para acessar o painel e mantêm a edição de telefone de contato anterior.
- A tela de Perfil de cliente exige celular válido em alterações futuras, com a mesma máscara.

## Migrações
**Já aplicadas ao Supabase de produção — não reaplicar**:
- `supabase/migrations/20261109_required_signup_phone.sql`
- `supabase/migrations/20261109_restrict_handle_new_user_execute.sql`
- `supabase/migrations/20261109_admin_phone_compatibility.sql`

## Testes técnicos (revertidos com ROLLBACK)
- [x] Sem DDD, sem o nono dígito, DDD inexistente e campo vazio foram rejeitados.
- [x] Número brasileiro local, com máscara e internacional aceitos e normalizados.
- [x] Teste de criação direta de usuário de e-mail com celular inválido: cadastro rejeitado pelo trigger.
- [x] Teste de criação direta de usuário de e-mail com celular válido: `profiles.phone` preenchido corretamente.
- [x] Cliente autenticada pode atualizar seu próprio celular válido.
- [x] Número inválido ou remoção de telefone previamente válido são rejeitados no banco.
- [x] `handle_new_user()` não pode ser executado pela API anônima/autenticada.
- [x] Nenhuma conta de teste foi mantida e clientes anteriores não foram alterados.

## Aceite visual / funcional recomendado
1. Abrir **Criar minha conta** e confirmar novo campo.
2. Tentar cadastrar sem número; verificar mensagem de erro.
3. Tentar celular com DDD inválido ou número curto; verificar bloqueio.
4. Testar cadastro com celular real e verificar o código de confirmação por e-mail.
5. Entrar em conta antiga sem celular; tela de conclusão de cadastro deve abrir antes da Home.
6. Inserir um número válido nessa tela e verificar que a Home carrega normalmente.
7. Alterar telefone em **Perfil**, confirmar que a máscara e a validação funcionam.
8. Confirmar que WhatsApp permanece desativado até opt-in e configuração da Meta.
