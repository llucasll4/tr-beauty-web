# Novo agendamento — quatro telas de referência (serviços de unhas)

## Objetivo
Refatorar apenas a experiência de agendamento **da cliente** da TR Beauty Concept, mantendo o fluxo do estúdio, sem introduzir serviços fora do segmento de unhas. O layout usa a referência fornecida pela proprietária e as cores existentes da marca: creme `#FDFBF7`, nude `#EBE5DF`, café `#7A655B` e texto `#2C2C2C`.

## Navegação (quatro telas)

1. **Serviços**: lista dos serviços ativos cadastrados no Supabase, busca textual e filtros gerados dinamicamente a partir das categorias/nomes reais. Cards arredondados com imagem do Portfólio vinculada ao serviço (quando houver), nome, preço e duração. Sem categorias de cabelo, rosto ou massagem. Visitante pode navegar por serviços sem entrar; precisa autenticar-se para avançar ao horário.
2. **Agendamento**: resumo do serviço selecionado com foto, calendário mensal, dias elegíveis dentro da janela existente de 30 dias, e horários disponíveis retornados por `available_slots`. Seleção do horário obrigatória para avançar. Trocar serviço/data limpa imediatamente o horário anterior.
3. **Confirmar agendamento**: resumo completo de serviço, data, hora de Brasília e nome do estúdio; forma de pagamento **No atendimento** ou **TR Points**; exibição de pontos/saldo, indisponibilidade e explicação de que se trata de um pedido sujeito à aprovação. Ao confirmar, usa as RPCs existentes `book_appointment` ou `book_appointment_with_points` e só mostra sucesso após retornar o UUID da reserva.
4. **Pedido enviado com sucesso**: estado de sucesso em uma tela inteira (em vez do antigo modal), resumo do serviço, data, hora, pagamento e status **Aguardando confirmação**; botões **Ver meus agendamentos** (Reservas) e **Ir para o início**.

## Integrações preservadas
- RPCs de agenda e o bloqueio de horários concorrentes.
- TR Points: resgates em pontos com verificação no servidor e estorno quando aplicável.
- Administração: agendamento manual e central de notificações não são alterados.
- Notificações de reserva criada/confirmada/cancelada e avisos internos da cliente continuam usando as triggers existentes.
- Perfil, login e retorno de visitante para o serviço previamente selecionado.
- Histórico de Reservas e os botões de navegação inferior.
- Produtos e preços são obtidos do banco, sem dados fictícios.

## Fotos
A tela reaproveita arquivos existentes do bucket público `portfolio`, quando alguma foto tiver `service_id` correspondente ao serviço. Nos demais serviços, utiliza uma ilustração de unhas/beleza discreta, sem mostrar fotos de serviços não cadastrados. Uma foto já está vinculada a Esmaltação em gel; a administradora pode associar outras pelo Portfólio.

## Backend
Nenhuma migração nova: todos os campos de `services`, `appointments` e `portfolio_photos` já existem e as RPCs seguem intactas. Isso limita o risco para os dados e os agendamentos em produção.

## Validação técnica
- [x] Serviços atuais do banco: Esmaltação em gel e Banho de gel, ambos do segmento de unhas.
- [x] RPCs `available_slots`, `book_appointment`, `book_appointment_with_points` acessíveis e com resultado esperado.
- [x] Novo componente compilou no build de prévia Vercel.
- [ ] Aceite visual da experiência em celular (navegador iOS e Android) e desktop.
- [ ] Teste real de pedido no site com cliente, confirmando a chegada na tela 4 e a notificação.
- [ ] Teste de resgate TR Points no novo formulário (saldo suficiente/insuficiente).
- [ ] Voltar de cada etapa, busca e filtros e retorno do visitante após autenticação.
- [ ] Confirmar que o painel de gestão da Admin continua funcionando.

## Cuidados de UX
- Não confundir o pedido enviado com horário definitivamente confirmado; aguarda aprovação do estúdio.
- A etapa de confirmação exibe um aviso real sobre aprovação, mas não inventa termos legais ou políticas que ainda não foram cadastradas.
- O nome de profissional não é inventado; exibe **TR Beauty Concept**.
- Não criar novas categorias ou serviços inexistentes.
