# TR Beauty Concept — P4: e-mail + WhatsApp (manual de ativação)

**Esta é uma proposta em branch separada; não há envios ativos.**
Arquivos: migração SQL, Edge Function de envio, tela de consentimento da cliente.

## Como funcionará

- Eventos: pedido recebido, confirmação, cancelamento e lembrete (24h antes).
- Horários sempre no fuso de São Paulo.
- E-mail (Resend) e WhatsApp (Meta Cloud API) são opções independentes no Meu Perfil.
- Ambos começam DESATIVADOS; a cliente precisa autorizar.
- Ações de criar/alterar agendamento enfileiram avisos no banco; um cron processa a fila.
- Cada tipo de evento/canal só entra uma vez na fila para cada agendamento.
- Se um evento estiver desatualizado, ou o consentimento tiver sido retirado, o worker não envia.
- O status sent significa apenas que o provedor recebeu, não que a cliente leu.

## 1. Migração do banco — executar antes do merge

Supabase > SQL Editor > New query:
copie e execute integralmente o arquivo
supabase/migrations/20261108_p4_notifications.sql.

Não altere nem execute novamente a migração da P3. Nenhuma mensagem será
enviada só com a migração.

## 2. Preparar e-mail com Resend

1. Abra https://resend.com e crie uma conta.
2. Verifique seu domínio trbeautyconcept.com.br conforme instruções de DNS.
3. Gere uma API key para envio e selecione um endereço do domínio verificado,
   como TR Beauty Concept <agenda@trbeautyconcept.com.br>.
4. No Supabase > Edge Functions > Secrets crie:
   RESEND_API_KEY = chave da Resend
   RESEND_FROM_EMAIL = remetente verificado

Nunca divulgue senhas, chaves ou tokens no chat, GitHub ou código frontend.

## 3. Preparar WhatsApp Cloud API da Meta

É necessário um WhatsApp Business Account (WABA), número habilitado, Phone
Number ID e token de acesso da Meta. Ter somente o aplicativo WhatsApp
Business instalado NÃO dá acesso a envios automáticos da Cloud API.

A Meta deve aprovar modelos Utility de mensagens transacionais para uso
proativo, especialmente fora da janela de conversa de 24h. Podem existir
custos por mensagem. NÃO remova ou migre o número atual do estúdio sem antes
avaliar se a configuração suporta manter o uso cotidiano do WhatsApp.

Crie no WhatsApp Manager os seguintes templates em pt_BR, com quatro
parâmetros de corpo NA ORDEM: nome da cliente, serviço, data e hora.

- tr_agendamento_recebido:
  "Olá, {{1}}! Recebemos seu pedido de {{2}} para {{3}} às {{4}}.
   Aguarde a confirmação da TR Beauty Concept."
- tr_agendamento_confirmado:
  "Olá, {{1}}! Seu atendimento de {{2}} está confirmado para
   {{3}} às {{4}}. Esperamos você na TR Beauty Concept!"
- tr_agendamento_cancelado:
  "Olá, {{1}}! Seu atendimento de {{2}} previsto para {{3}} às
   {{4}} foi cancelado. Entre em contato se precisar de ajuda."
- tr_lembrete_24h:
  "Olá, {{1}}! Lembrete: seu atendimento de {{2}} está marcado
   para {{3}} às {{4}}. TR Beauty Concept."

Se houver rejeição ou mudança de categoria, revise com a Meta.

No Supabase > Edge Functions > Secrets, configure:
  WA_ACCESS_TOKEN = token de produção
  WA_PHONE_NUMBER_ID = ID numérico do número
  WA_GRAPH_VERSION = versão vigente da API Graph (ex. v24.0, confirmar com a Meta)
  WA_TEMPLATE_LANGUAGE = pt_BR
  WA_TEMPLATE_REQUESTED = tr_agendamento_recebido
  WA_TEMPLATE_CONFIRMED = tr_agendamento_confirmado
  WA_TEMPLATE_CANCELLED = tr_agendamento_cancelado
  WA_TEMPLATE_REMINDER = tr_lembrete_24h

## 4. Publicar Edge Function

Supabase > Edge Functions > Deploy a new function > Via Editor.
Nome: p4-notifications.
Cole todo o arquivo supabase/functions/p4-notifications/index.ts.
Desative a opção Verify JWT NESTA função — o acesso ficará protegido
pelo header x-tr-cron-secret, validado pelo código.

Em Edge Functions > Secrets, configure:
  P4_CRON_SECRET = segredo forte e exclusivo gerado por você (32 bytes ou mais)
  P4_SENDING_ENABLED = false
  [além dos secrets dos canais acima]

Não compartilhe P4_CRON_SECRET. Ele deve ser igual ao segredo do Cron.
Deixe P4_SENDING_ENABLED=false até finalizar a configuração e os testes.

## 5. Agendar execução a cada cinco minutos

Habilite pg_cron e pg_net em Supabase > Database > Extensions.
No Supabase > SQL Editor, crie dois segredos no Vault com:
  select vault.create_secret('https://SEU-PROJETO.supabase.co/functions/v1/p4-notifications','p4_notification_function_url');
  select vault.create_secret('O_MESMO_SEGREDO_FORTE_DE_P4_CRON_SECRET','p4_notification_cron_secret');

Substitua os placeholders APENAS no Supabase, nunca no GitHub.

Depois execute:

    select cron.schedule(
      'tr-p4-send-notifications',
      '*/5 * * * *',
      $$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets
                  where name = 'p4_notification_function_url'),
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'x-tr-cron-secret',(select decrypted_secret
              from vault.decrypted_secrets
              where name = 'p4_notification_cron_secret')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 10000
        );
      $$
    );

Crie este job somente uma vez. No Supabase > Integrations > Cron,
confira o History e o HTTP 200. Diferentemente de Vercel Cron,
a frequência não depende dos limites do plano Vercel Hobby.

## 6. Publicar frontend e testar

Faça merge deste PR somente DEPOIS da migração SQL. O novo Meu Perfil
terá uma área para autorizar avisos por e-mail e WhatsApp separadamente.
Salve o telefone do perfil antes de autorizar o WhatsApp.

Para testes: use conta própria e destinos que você controla. Com os
provedores configurados e modelos aprovados, altere o secret
P4_SENDING_ENABLED para true, então faça uma nova reserva de teste,
confirme e/ou cancele. Uma reserva confirmada com ao menos duas horas
de antecedência terá o lembrete agendado 24h antes, ou no próximo
processamento se a confirmação for tardia.

Para auditar, no SQL Editor rode:

    select event_type, channel, status, scheduled_for, processed_at, last_error
    from public.notification_outbox
    order by created_at desc limit 30;

Estados: pending / processing / sent / failed / skipped.
Falhas não são reenviadas automaticamente; investigue antes de repetir,
especialmente no WhatsApp, para não gerar mensagens duplicadas.

**Nenhuma mensagem sai automaticamente até habilitar o worker e o Cron.**
O uso dessa integração pode exigir um serviço contratado da Meta/Resend.

## Documentação

Supabase Scheduling: https://supabase.com/docs/guides/functions/schedule-functions
Supabase Cron: https://supabase.com/docs/guides/cron
Edge Functions Secrets: https://supabase.com/docs/guides/functions/secrets
Resend API: https://resend.com/docs/api-reference/emails/send-email
Meta Cloud API templates: https://www.postman.com/meta/whatsapp-business-platform/request/o65u5m5/send-message-template-text
