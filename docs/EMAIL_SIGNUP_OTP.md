# Confirmação de cadastro por código — TR Beauty Concept

## Status
- Interface da cliente: integrada ao site (cadastro → inserir código → confirmar → entrar).
- Envio automático do código por e-mail: depende de modificar o modelo **Confirm sign up** no painel de Auth do Supabase.
- Sem essa modificação, o e-mail antigo continuará contendo um link de confirmação; o código não aparecerá.

## ÚNICO passo obrigatório no Supabase

1. Acesse [Supabase Auth Templates](https://supabase.com/dashboard/project/gotdntnqiwhdkopaxrbb/auth/templates).
2. Abra **Confirm sign up** (não *Magic Link* nem *Reset Password*).
3. Defina o assunto para **Seu código de confirmação — TR Beauty Concept**.
4. Substitua o corpo HTML pelo conteúdo de `docs/EMAIL_SIGNUP_OTP_TEMPLATE.html`.
5. Salve. Preserve a configuração que exige confirmação de e-mail; não desligue **Confirm email**.

O campo `{{ .Token }}` é obrigatório: o Supabase substitui automaticamente pelo código de uso único enviado na confirmação do cadastro. Não use `{{ .ConfirmationURL }}` no novo modelo.

## Fluxo da cliente

- Informa nome, e-mail, senha e toca **Cadastrar**.
- Supabase `signUp` cria a conta ainda não confirmada e manda o e-mail.
- O site abre **Confirme sua conta com o código recebido**, com campo numérico de 6 a 8 dígitos.
- `supabase.auth.verifyOtp({email,token,type:'email'})` valida o código no próprio Supabase e inicia a sessão.
- Após a validação, a cliente entra no site normalmente.
- **Não recebi o código — reenviar** usa `supabase.auth.resend({type:'signup',email})`. O cliente aplica limite inicial de 60 segundos entre reenvios, além dos limites do servidor.
- **Já tenho um código de confirmação** na tela de login permite retornar ao fluxo para completar a ativação.
- Recuperação de senha e mudança de e-mail continuam com os modelos/fluxos originais e não foram alteradas.
- Pessoas que já confirmaram a conta continuam entrando por senha, sem precisar de um novo código.

## Verificação

- [ ] Novo cadastro recebe e-mail contendo o código, não o link.
- [ ] Código correto confirma conta e entra automaticamente.
- [ ] Código inválido/expirado apresenta erro.
- [ ] Reenviar entrega novo código, respeitando o limite de envio.
- [ ] Fechar e retornar ao site e usar **Já tenho um código** funciona.
- [ ] Contas já confirmadas continuam acessíveis.
- [ ] Recuperação de senha permanece funcional.

**Não criamos OTP próprio nem armazenamos códigos no banco da aplicação.** A geração, validade, rate limit e verificação continuam totalmente no Supabase Auth.

Referência oficial: https://supabase.com/docs/guides/auth/auth-email-templates
