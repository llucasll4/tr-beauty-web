# Fase 4 — Etapa 3: sugestões de manutenção recorrente

## Objetivo
Ajudar uma cliente que já concluiu um atendimento a identificar um período
aproximado de retorno ao estúdio, sem transformar a sugestão em venda forçada,
reserva automática ou comunicação promocional.

## Administração
Em **Admin → Serviços → Editar**, o campo opcional
**"Sugerir manutenção após (dias)"** aceita um número inteiro de 14 a 90.
- Em branco: recomendações DESATIVADAS para este serviço.
- Valor configurado: a Home pode sugerir retorno a partir do histórico
  da cliente; cada serviço pode ter o seu próprio intervalo.
- Os serviços existentes permanecem SEM sugestão até a Admin preencher
  um intervalo. A migração não aplica automaticamente "21 dias" a todos.
- O intervalo é uma recomendação do estúdio, não uma orientação clínica ou
  garantia de manutenção gratuita. Não altera preço, duração ou TR Points.

## Cliente — comportamento
O cartão **"Que tal cuidar das unhas novamente?"** aparece somente para
usuárias autenticadas, não Admin, quando:
1. Há um atendimento **completed** com fim já ocorrido.
2. O serviço associado está ativo e possui intervalo configurado.
3. A recomendação é temporalmente útil: de 7 dias antes até 30 dias
   depois da data sugerida (fim do atendimento + intervalo em dias).
4. A cliente **não tem** reserva pendente ou confirmada FUTURA para
   aquele mesmo serviço.
5. Usa o último atendimento concluído de cada serviço (máximo de 35
   resultados recentes), e mostra apenas uma sugestão de cada vez.

O cartão aparece abaixo de **Seu momento de autocuidado**, antes do
TR Points, sem deslocar a prioridade do próximo agendamento. A cliente pode
tocar **Ver serviços e horários**, que abre a seleção normal de serviços,
sem reservar, cobrar, resgatar pontos ou enviar notificações.

Não há listas de espera, WhatsApp inteligente, SMS ou campanhas adicionadas
nesta etapa. Consentimento para comunicações de marketing não é alterado.
Sem conta, sem atendimento concluído elegível, sem configuração ou
com erro de consulta, o cartão fica ausente e NÃO inventa uma data.

## Privacidade e segurança
- A única mudança de esquema é `services.maintenance_interval_days`,
  com CHECK de 14 a 90 e NULL permitido. As políticas RLS já existentes
  continuam restringindo configuração de serviços à Admin.
- A sugestão consulta apenas a tabela de agendamentos do próprio cliente
  (RLS `client_id=auth.uid()`). Nenhum outro perfil é consultado.
- Nenhum dado de manutenção é persistido sobre a cliente; o cálculo
  ocorre somente no navegador autenticado.
- Nenhuma atividade em segundo plano, notificação promocional ou
  reserva é criada automaticamente.
- Não extrapola para atendimento médico nem promete resultado.

## Testes e lançamento
- PostgreSQL isolado valida NULL como opt-out, valores 14–90,
  negação de edição por cliente e permanência do RLS existente.
- Chromium em 390px simula atendimento concluído e testa a sugestão,
  a navegação para serviços e a ausência de qualquer pedido de reserva.
- Chromium também simula uma reserva futura para o mesmo serviço e
  confirma que a sugestão não aparece.
- `npm test`, build web, testes antigos de reserva, reagendamento, TR Points
  e ferramentas Admin permanecem obrigatórios.
- A migração da branch **não é aplicada automaticamente** em produção.
  Aplicar somente depois da revisão; verificar histórico Supabase, RLS e
  que os 6 serviços existentes continuam sem intervalo, então liberar
  a UI do mesmo commit testado.
- Em Safari físico, testar como Admin o cadastro de `21` dias em um
  serviço (somente se for um intervalo realmente adequado ao estúdio)
  e como Cliente um atendimento concluído verdadeiro. Não criar
  reservas fictícias de produção.

## Etapa seguinte
Fase 4 — campanhas de relacionamento com consentimento explícito e
possibilidade de desativação, sem ativar WhatsApp Business antes de
configuração autorizada.
