# Cadastro obrigatório e informações do estúdio na Home

## Cadastro (cliente)
A tela **Criar minha conta** exige os quatro campos: **Nome completo**, **Celular com DDD**, **E-mail**, **Senha**. Todos exibem `*` e mensagem explícita de obrigatoriedade.

- Nome completo: não aceita texto vazio ou só espaços; comprimento mínimo de 2 caracteres após limpeza.
- Celular: formato brasileiro com DDD e nono dígito, normalizado no Supabase (regra anterior preservada).
- E-mail: validação básica de formato no aplicativo, além da validação nativa do Supabase Auth.
- Senha: obrigatória e com pelo menos 8 caracteres (regra anterior preservada).
- Código enviado por e-mail após cadastro permanece obrigatório para confirmação.
- Servidor: `public.handle_new_user()` também impede cadastro por e-mail sem nome, mantendo validação de telefone. Dados de contas existentes não são modificados; Google OAuth e Admin permanecem sem alterações.
- WhatsApp **não é ativado** pela coleta do telefone.

## Rodapé da Home
No final da tela inicial, após os serviços e o botão Sair (quando houver), o cartão de informações da TR Beauty Concept mostra:
- **WhatsApp do Studio:** (11) 94690-1167 — toque para abrir diretamente a conversa em `https://wa.me/5511946901167`.
- **Instagram:** `@__thalitanaildesign` — toque para abrir `https://www.instagram.com/__thalitanaildesign?cplk=c3A4emlocGRxOXEx`.
- **Endereço:** Rua Santa Cruz, 537, Diadema – SP — toque para abrir a busca do endereço no Google Maps.

O CNPJ foi retirado da exibição no site, conforme solicitado. Nenhuma informação cadastral foi removida do banco.

Paleta do aplicativo: creme `#FDFBF7`, nude `#EBE5DF`, café `#7A655B`. Rodapé disponível para visitante, cliente ou Admin sem autenticação adicional.

## Banco de dados
Migração aplicada: `supabase/migrations/20261109_required_signup_name.sql`.
Ela atualiza o trigger existente sem criar tabela nova nem alterar contas atuais.
Não reaplicar a migração em produção.

## Verificações
- [x] Cadastro direto pelo banco com nome vazio foi rejeitado.
- [x] Cadastro com nome e telefone válidos criou perfil normalizado em teste.
- [x] Testes executados sob transação `ROLLBACK`, sem inserir contas permanentes.
- [x] Compilação de prévia Vercel dos componentes.
- [ ] Teste visual no celular e navegador do cadastro e rodapé.
- [ ] Teste real de cadastro e confirmação por código de e-mail.

## Observação
A obrigação de preencher telefone não equivale à verificação de propriedade do número, que precisaria de confirmação via SMS ou outro serviço.

## Ícones dos serviços na Home
Os cartões de serviços exibem emojis ligados a Nail Design: 💅 para manicure/esmaltação/gel/alongamento/manutenção, 🎨 para Nail Art/decorações e ✨ para demais serviços. A antiga gota dos serviços em gel não é mais exibida. As cores, os preços e as durações permanecem como antes.
