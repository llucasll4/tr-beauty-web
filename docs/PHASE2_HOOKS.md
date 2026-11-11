# Fase 2 — Extração de hooks de notificações e serviços

Entrega do PR #41. Esta etapa reorganiza consultas e ciclo de vida, **sem alterar as regras de negócio do banco de dados**.

## Hooks criados

- `hooks/useClientNotifications.js`: contador, lista (não lidas primeiro), atualização de leitura, consentimento de alertas in-app, canal Realtime e sincronização periódica de 60 segundos. A consulta do feed de clientes agora não é iniciada em sessões administrativas.
- `hooks/useAdminNotifications.js`: contador, alertas operacionais, marcação de leitura, aceite/cancelamento de pedidos de atendimento e atualização da agenda após uma decisão. Canal Realtime e atualização a cada 30 segundos mantidos.
- `hooks/useStudioServices.js`: carregamento público do catálogo, seleção de serviços ativos, edição, criação e ativação/desativação pelo Admin, com validações existentes.
- `hooks/useAdminTodayStats.js`: contadores rápidos do Admin, mesmos filtros e atualização em 60 segundos enquanto o painel estiver aberto. O indicador de 'Faturamento' continua somando **serviços concluídos**, não comprovantes de caixa.
- `hooks/useHomeInspirations.js`: carrossel de portfólio público, com limpeza de consulta ao sair da Home.

## Benefícios

A separação facilita localizar o responsável por um erro e testar cada unidade sem arriscar reservas e pontuação. O componente principal só integra estado e ações, em vez de manter as consultas e o ciclo de vida de cada módulo.

## Controles preservados

- Toda alteração em agendamentos ainda passa pelo Supabase, com os gatilhos de segurança da Fase 1.
- As notificações continuam sujeitas à RLS por destinatário; nenhuma chave de serviço é usada no cliente.
- O processo de decisão de pedido pendente continua condicionado a `status='pending'`, bloqueando respostas em duplicidade.
- A separação dos hooks não altera prazos de envio de WhatsApp/e-mail nem ativa push.
- A rotina de atualização das preferências do app ainda consulta o Supabase e permite atualização imediata pelo Perfil.

## Validação de entrega

1. `app-tests-and-build`: testes de JS + exportação Expo Web.
2. `booking-points-db-regression`: integração real de calendário e pontos em PostgreSQL descartável.
3. Vercel Preview `READY` no commit efetivamente mesclado.
4. Recomenda-se validação manual em uma sessão autenticada: troca de tela Home/Notificações, alerta em tempo real, aceite de um pedido pendente, criação/edição de serviço e mudança de preferências de avisos. Build automático não substitui esta conferência.

## Próxima etapa

Concentrar lógica de reservas, agenda e navegação em módulos menores, após testes adicionais de componentes; em branch exclusiva, planejar atualização do Expo SDK 51 com progressão entre SDKs e verificações visuais em cada salto. Nenhuma atualização do SDK foi realizada nesta entrega.
