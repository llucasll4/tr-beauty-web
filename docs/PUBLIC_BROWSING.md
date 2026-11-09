# Melhoria — navegação pública e agendamento com login

## Requisito entregue

- Acessar \`https://trbeautyconcept.com.br\` **sem login**: tela inicial aberta diretamente.
- Visitante: ver serviços ativos, duração, preço, descrição e fotos públicas da Galeria.
- Visitante: abrir a aba Agendar, escolher um serviço e ver o convite para entrar ou criar uma conta.
- A disponibilidade de horários e o envio da reserva **não são consultados/liberados** enquanto não houver autenticação.
- A tela de login/cadastro agora oferece **Continuar navegando sem conta**.
- Depois de entrar/cadastrar com sessão ativa, o usuário retorna ao serviço escolhido e à etapa de agendamento.
- A aba do visitante mostra **Entrar**; usuários autenticados continuam vendo **Perfil** e **TR Points**.
- Administração, dados do perfil, agenda e financeiro permanecem exclusivos de usuários autorizados.

## Implementação

- \`App.js\`: renderização do site com ou sem sessão, componentes do visitante, proteção contra a RPC \`available_slots\` no modo anônimo e proteção na ação \`confirmBooking\`.
- \`AuthScreen.js\`: adiciona callback \`onBack\` na autenticação comum; recuperação de senha continua seu fluxo separado.
- Usa \`key={user?.id || 'guest'}\` para zerar o estado de navegação ao entrar/sair, evitando apresentar uma tela administrativa antiga ao visitante.
- Nenhuma migração nem nova dependência.

## Segurança de banco verificada antes da mudança

- \`public.services\`: política \`Public active services\` permite SELECT a \`anon\` apenas com \`active=true\`.
- \`public.portfolio_photos\` e bucket \`portfolio\`: políticas de SELECT público para a galeria, escrita restrita a admin.
- \`public.appointments\`: somente \`authenticated\` recebeu permissões de tabela, com RLS para cliente dono ou admin.
- RPCs \`available_slots\` e \`book_appointment\`: \`anon\` não possui EXECUTE; \`authenticated\` possui.
- RPC do financeiro \`p6_financial_dashboard\`: só \`authenticated\` e validação adicional de admin.

## Checklist de aceite no site

- [ ] Janela anônima: página inicial carrega sem exigir cadastro.
- [ ] Serviços ativos exibem preço e duração; serviços inativos não aparecem.
- [ ] Galeria mostra as fotos publicadas.
- [ ] Agendar permite escolher serviço mas **não mostra horários** sem login; CTA Entrar/Criar conta.
- [ ] Tela de login: voltar a navegar sem cadastro, sem perder serviço selecionado.
- [ ] Conta existente: login retorna à reserva, horários aparecem e agendamento continua possível.
- [ ] Cadastro novo: confirmação de e-mail, quando necessária, continua funcionando.
- [ ] Perfil e TR Points não exibem informações privadas sem sessão.
- [ ] Logout retorna à experiência pública sem telas privadas remanescentes.
- [ ] Admin com sessão ativa: abas Agenda, Clientes, Serviços, Portfólio, Financeiro continuam disponíveis.

## Observação

As imagens de portfólio são públicas por design. Não publique fotos sem autorização das pessoas envolvidas. Essa melhoria não altera notificações por e-mail ou outras funcionalidades anteriores.
