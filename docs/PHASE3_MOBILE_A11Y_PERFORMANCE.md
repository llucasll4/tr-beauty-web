# Fase 3 — Etapa 4: acessibilidade e desempenho mobile

## Escopo da primeira entrega
Melhorias incrementais no Expo Web do TR Beauty para telas pequenas e
navegação por toque, sem alterar fluxo de agendamento, banco Supabase, valores,
TR Points, autenticação, regras de horários nem design nude/creme.

## Melhorias
- Navegação inferior com nomes, estado selecionado no sistema nativo e
  `aria-current="page"` no navegador para
  tecnologias assistivas, mantendo o comportamento anterior.
- Áreas de toque da navegação inferior, cabeçalho administrativo e botões
  de calendário/retorno ampliadas para **pelo menos 44 x 44 pontos CSS**
  nos controles principais. Rótulos inferiores aumentados de 10 a 12 pontos.
- Abas inferiores adaptam-se à largura disponível (sem larguras mínimas fixas),
  inclusive em telas de 320 px.
- A Home carrega até **6 inspirações**, em vez de 12, reduzindo o número
  potencial de imagens pesadas requisitadas no carrossel; a tela Galeria
  preserva acesso ao portfólio completo.
- Teste Playwright com emulação móvel 320 x 640, validação de controles
  acessíveis, estado da aba ativa, transição para Reservas, calendário e
  ausência de rolagem horizontal do documento na Home e no agendamento.
  O log informa tempo DOMContentLoaded e total de recursos carregados
  **apenas como diagnóstico**, sem apresentar a emulação como medição real
  de rede/celular ou criar metas arbitrárias de velocidade.

## Limitações honestas
- A validação Chromium usa dispositivos **emulados**. Ela não substitui
  medições de VoiceOver no iOS, TalkBack no Android ou Safari físico.
- Esta etapa não é auditoria WCAG completa; ainda é necessário avaliar
  zoom 200%, contraste, foco de teclado, mensagens de erro, formulários,
  leitores de tela, rotação, rede móvel e latência de dispositivos reais.
- Imagens do portfólio continuam em resolução original; futura otimização
  via imagens dimensionadas/caching deve ocorrer apenas após confirmar
  suporte do Supabase e fallback para evitar fotos quebradas.
- A prévia Vercel pode não ser gerada se o limite de builds do plano for
  atingido. CI verde não é prova de que a prévia está READY.
- Sem novas dependências; sem alterações a SQL, políticas ou segredos.

## Checklist de validação real no iPhone
1. Abrir prévia pelo Safari em iPhone.
2. Navegar entre Início, Reservas, Galeria e Perfil tocando nas abas inferiores.
3. Selecionar serviços, avançar calendário e voltar, conferindo a área de toque.
4. Ativar o VoiceOver e conferir que as abas têm nome e estado ativo.
5. Ajustar texto do iPhone para tamanho maior e verificar se botões/labels
   continuam legíveis.
6. Alternar retrato/paisagem e conferir se aparece rolagem horizontal.
7. Acessar via rede móvel e comparar primeira abertura/aberturas seguintes.
8. Validar conta Admin em Configurações, alertas e painel financeiro.
9. Não confirmar agendamentos fictícios na produção.

## Dependências do roadmap
O PR #51 de monitoramento de entregas permaneceu separado desta etapa.
No início desta tarefa, o GitHub estava aprovado mas a Vercel não produziu
deploy do commit final devido a limite de builds. Não confundir aprovação
do PR de acessibilidade com publicação do PR de notificações.
