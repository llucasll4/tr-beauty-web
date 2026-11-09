# Notificações — separação de lidas e não lidas

## Objetivo
Reduzir a poluição visual nas caixas de notificações da cliente e da Admin sem alterar a lógica de agendamentos, eventos, permissões ou marcação de leitura.

## Cliente
- **Não lidas** aparecem primeiro, abertas, com contador e ação de marcar como lida.
- **Lidas** ficam em seção recolhida por padrão; botão **Mostrar/Ocultar**, contador e cards compactos com título e data.
- Ao abrir um card lido, a mensagem completa aparece em sua própria seção.
- **Marcar todas como lidas** continua disponível; avisos marcados migram para o histórico recolhido.
- O botão para consultar reservas e as notificações em tempo real permanecem.
- Lista carrega até 150 avisos não lidos e as 60 mensagens lidas mais recentes separadamente, evitando que histórico antigo desloque avisos novos. Contagem de não lidos é exata e independente desses limites.

## Admin
- **Não lidas** em destaque na parte superior, respeitando a ordem anterior: cancelamentos, alertas de sistema e novos pedidos.
- **Lidas** recolhidas por padrão, com itens compactos; tocar expande o card e preserva detalhes e ações rápidas para pedidos que ainda estejam pendentes.
- Filtros **Todos, Aguardando decisão e Críticos** continuam funcionando nos dois grupos.
- A ação **Visualizar** em um alerta não lido deixa a notificação na área de trabalho até a Admin marcar explicitamente como lida; assim o card não desaparece durante a análise.
- **Aprovar/Recusar** continuam atualizando a agenda e os eventos existentes.
- Busca até 150 não lidas e 60 lidas mais recentes separadamente, com contador exato de não lidas.

## Segurança e compatibilidade
- Não altera Supabase, RLS, triggers, tabelas ou notificações externas.
- Mantém a autorização atual: cliente só consulta sua própria caixa, Admin só recebe os avisos operacionais atribuídos à sua conta.
- Mecanismos de realtime/polling e contagem no sino permanecem.

## Testes
- [x] Build de prévia Vercel READY após implementação dos componentes.
- [ ] Teste visual em celular/desktop de seção recolhida e expansão de mensagem lida.
- [ ] Teste com cliente: marcar uma/todas como lidas; verificar contador e deslocamento.
- [ ] Teste com Admin: prioridade de alertas, filtros, ações Aprovar/Recusar e detalhes de pedido lido.
- [ ] Confirmar realtime ao chegar novo pedido.
