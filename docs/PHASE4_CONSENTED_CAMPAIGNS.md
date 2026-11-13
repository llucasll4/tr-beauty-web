# Fase 4 — Etapa 4: campanhas com consentimento explícito

## Finalidade e limites
O TR Beauty Concept oferece **campanhas informativas exibidas somente dentro do aplicativo**.
Não é sistema de disparo de e-mail, WhatsApp, push, SMS ou criação de
reservas. Marketing por canais externos permanece **desativado**.
A cliente nunca é incluída automaticamente por ter conta, telefone ou reserva.

## Experiência da cliente
- **Perfil → Ajustes → Novidades e promoções no aplicativo**: desativado
  por padrão. A cliente autoriza expressamente a leitura de novidades na Home,
  podendo revogar a autorização pela mesma opção a qualquer momento.
- O servidor registra a data do consentimento, ignora carimbos de data
  fornecidos pelo navegador e grava eventos imutáveis de adesão/retirada.
- Apenas clientes com `marketing_opt_in=true` E
  `marketing_consented_at IS NOT NULL` conseguem ler uma campanha publicada,
  ainda válida e não arquivada. A verificação é feita no RLS PostgreSQL.
- A Home consulta primeiro a preferência atual da própria cliente.
  Se faltar consentimento, tiver erro, ou não existir campanha ativa,
  nenhum cartão é exibido.
- **Ver serviços e horários** abre o fluxo normal de agendamento:
  sem bloqueios, reservas, pagamentos, pontos ou mensagens automáticas.
- Desativar em Ajustes e voltar para a Home remove as novidades. Dados
  armazenados em outras guias/sessões são reavaliados em nova consulta.

## Experiência da Admin
- **Admin → Configurações → Campanhas**
- Exibe somente indicadores agregados de consentimento, campanhas publicadas
  e rascunhos. Não apresenta uma lista nominativa de destinatárias.
- Criar um rascunho: título de 5 a 90 caracteres; texto de 15 a 550;
  duração de 7/14/30/60 dias e ação opcional “Ver serviços”.
- Publicação manual com segunda confirmação; a data de publicação e expiração
  são calculadas pelo **servidor**.
- Conteúdo de campanha publicada é imutável. Para corrigir, arquivar e
  criar outro rascunho. Campanhas arquivadas não podem ser reabertas;
  a trilha da campanha é preservada (sem DELETE via app).
- Uma publicação torna o cartão elegível à Home **somente** durante sua
  validade e para clientes que consentiram naquele momento.

## Banco e segurança
Migration: `supabase/migrations/20261113134533_phase4_consent_campaigns.sql`

- `public.marketing_campaigns`: RLS; somente Admin pode criar/editar;
  SELECT da cliente exige consentimento atual e campanha publicada válida.
  Não há tabela de envios, destinatárias, campanhas por e-mail ou WhatsApp.
- `public.marketing_consent_events`: auditoria opt-in/opt-out, RLS para
  leitura da própria titular/Admin; sem INSERT/UPDATE/DELETE pelo navegador.
  A remoção de conta futura pode lidar com essa tabela por FK CASCADE.
- `private.p4_marketing_consent_stamp` e
  `private.p4_marketing_consent_audit`: gatilhos protegidos que registram
  escolhas, não permitidos como RPC pública. Timestamp do opt-in é do servidor.
- `private.p4_campaign_guard`: valida Admin e transições rascunho →
  publicado → arquivado. Também garante campos de autoria imutáveis.
- `public.p4_marketing_summary()`: agrega apenas contagem, valida Admin,
  SECURITY INVOKER e revoga execução anônima.
- Uma falha de leitura da cliente nunca habilita promoção por padrão.

## Testes
- PostgreSQL 17 descartável com usuários fictícios: opt-in inicial, data
  forjada, auditoria, rascunho invisível, publicação, visibilidade somente
  mediante consentimento, opt-out imediato, recusa de edição e reabertura,
  permissão de leitura de auditoria e negação de acesso não autorizado.
- Chromium mobile: campanha para cliente autorizada, navegação sem criar
  reservas e retirada de consentimento; nenhuma campanha para cliente não
  autorizada; criação do rascunho e confirmação dupla pela Admin.
- Permanecem obrigatórias as regressões anteriores de agendamento,
  cancelamento, TR Points, monitoramento de notificações e financeiras.
- Testes são executados com URLs Supabase fictícias e não tocam dados reais.

## Publicação controlada
1. CI e prévia Vercel aprovados no último SHA.
2. Revisão da migration, das permissões e dos relatórios de segurança.
3. **Concluído em 13/11/2026:** migration aplicada no Supabase como
   versão `20261113134533`. Verificado: zero campanhas publicadas,
   zero eventos fictícios de consentimento e nenhum opt-in pré-ativado.
4. Só depois fazer merge e publicar frontend na Vercel.
5. Conferir no Safari/iPhone a visualização com conta Admin e a preferência
   Cliente, sem ativar uma campanha de teste em produção.
6. Reverter apenas o deploy web não revoga campanhas já publicadas; arquivar
   manualmente qualquer publicação indesejada.

## Privacidade
Este trabalho não substitui revisão dos textos legais, consentimento
para marketing via WhatsApp ou e-mail, nem tratamento de dados sob LGPD.
Campanhas de marketing externas exigem integração e controles adicionais
(idempotência, cancelamento, registro de entrega, finalidade de uso,
provedor, templates e verificação do consentimento **na hora de enviar**).
