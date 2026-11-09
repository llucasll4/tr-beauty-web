# TR Beauty Concept — WhatsApp Inteligente, Meu Nail Book e Clube TR Points VIP

## Escopo (sem lista de espera)
Três diferenciais implementados no projeto e protegidos por Supabase:
1. WhatsApp Inteligente;
2. Meu Nail Book;
3. TR Points 2.0 — Clube VIP.

## 1. WhatsApp Inteligente

A infraestrutura P4 **já enviava e-mails e continha um worker preparado para a API oficial da Meta**.
Evolução:
- **Admin → WhatsApp**: painel de visão operacional com totais reais de clientes opt-in, mensagens em fila/enviadas/falhadas e presenças confirmadas.
- **Perfil → Notificações**: ao ativar WhatsApp e salvar, o opt-in registra `whatsapp_consented_at`; desligar apaga o consentimento. O worker agora verifica simultaneamente `whatsapp_enabled` e o timestamp antes de enviar.
- Templates existentes preservados para pedido, confirmação, cancelamento e lembrete; nenhum modelo promocional é criado.
- Mensagens `booking_confirmed` e `reminder_24h` podem ganhar botão **Confirmar presença**, mas SOMENTE se `WA_REPLY_BUTTONS_ENABLED=true` e os modelos aprovados na Meta incluírem quick reply index 0. Padrão: desativado.
- Novo webhook `supabase/functions/whatsapp-webhook/index.ts` implantado no Supabase; exige validação `WA_META_VERIFY_TOKEN` no desafio GET e assinatura HMAC SHA-256 com `WA_APP_SECRET` em POST. Sem esses segredos, rejeita a solicitação.
- Somente processa o payload `TR_CONFIRM_<uuid-da-reserva>`, com `from` igual ao telefone do perfil, preferência opt-in válida, reserva confirmada e horário futuro. Atualiza `appointments.attendance_confirmed_at` com filtro de idempotência.
- Em **Admin → Agenda**, a confirmação de presença é mostrada como marcador verde sem interferir na aprovação da reserva. Resposta de agradecimento via WhatsApp dentro da janela de atendimento, quando houver credenciais.

### Passos EXTERNOS para ativar o WhatsApp (não podem ser feitos só com GitHub/Supabase)
É preciso uma conta **Meta Business**, WhatsApp Business Account, número verificado e templates utility aprovados. A integração automática NÃO está confirmada como ativa até esse processo ser concluído.

Em Supabase → Edge Functions → Secrets, configurar:
- `WA_ACCESS_TOKEN`: token de sistema de longa duração, nunca enviado ao frontend.
- `WA_PHONE_NUMBER_ID`: ID do número oficial.
- `WA_GRAPH_VERSION`: versão suportada da Graph API, como `v23.0` (ajustar conforme a conta e versão atual).
- `WA_TEMPLATE_REQUESTED`, `WA_TEMPLATE_CONFIRMED`, `WA_TEMPLATE_CANCELLED`, `WA_TEMPLATE_REMINDER`: nomes exatos dos modelos utility aprovados.
- `WA_TEMPLATE_LANGUAGE=pt_BR`.
- `WA_APP_SECRET`: app secret Meta para verificar o HMAC do webhook.
- `WA_META_VERIFY_TOKEN`: valor aleatório longo definido no setup do webhook; não é token de cliente.
- `WA_REPLY_BUTTONS_ENABLED=true` **somente após** os modelos de confirmação e lembrete incluírem botão de quick reply no índice 0.
- O worker P4 usa também `P4_SENDING_ENABLED`, `P4_CRON_SECRET` e as chaves existentes do Resend, que não devem ser alteradas desnecessariamente.

Em Meta App → WhatsApp → Configuration, usar a URL da função `whatsapp-webhook` que aparece no painel Supabase e configurar o mesmo `WA_META_VERIFY_TOKEN`, assinando os eventos de mensagens.

**Sem autenticação e modelos aprovados, não afirmar que o WhatsApp está enviando.** O email, notificações internas e reservas permanecem funcionando normalmente.

## 2. Meu Nail Book

- **Home de cliente → Meu Nail Book**: uma galeria privada onde a cliente salva inspirações com título, notas, imagem JPG/PNG/WEBP de até 5 MB e serviço de unhas opcional.
- **Admin → Nail Book**: pesquisa cliente, vê o álbum e pode registrar fotos do trabalho realizado vinculadas a um atendimento com status `completed`.
- Visualização do trabalho com data, serviço e observações. Em registros com serviço vinculado, a cliente usa **Repetir este estilo** para abrir o agendamento já com esse serviço selecionado.
- Fotos armazenadas em bucket **privado** `nail-book`, com URL assinada válida por 1 hora (renovável ao atualizar).
- A cliente só lê seu próprio álbum e insere/remove suas inspirações. A Admin pode consultar/registrar trabalhos das clientes. O sistema **não publica fotos pessoais no Portfólio público**.

## 3. Clube TR Points VIP

- Dentro de **Meu TR Points**, nova aba **Clube VIP**.
- Níveis **Bronze (0)**, **Prata (500 pontos históricos)** e **Ouro (1500 pontos históricos)** por padrão; a meta é baseada no **total de pontos ganhos** no histórico, não no saldo disponível, para que resgates não diminuam o nível. **Estornos de pontos por cancelamento não contam como novos ganhos**, evitando subir de nível apenas resgatando e cancelando.
- A cliente visualiza progresso, código pessoal de indicação, local para inserir código recebido, data de aniversário (somente dia e mês) e regras de vantagens.
- Regras iniciais de campanhas, configuráveis na Admin:
  - **Indicações**: +100 pontos para quem indicou após o primeiro atendimento pago concluído da indicada; códigos únicos, sem autoindicação, telefones distintos e registro único por cliente.
  - **Aniversário**: +50 pontos em atendimento pago realizado no mês do aniversário, com data cadastrada há 30 dias ou mais; no máximo uma vez por ano.
  - **Frequência**: +80 pontos após cada conjunto de 5 atendimentos pagos concluídos.
- **IMPORTANTE: todos os bônus automáticos começam DESATIVADOS.** Só serão concedidos após a Admin revisar valores e ativar as campanhas em **Admin → TR Points → Clube VIP**. Isso evita criar custo sem autorização explícita sobre os valores.
- Os bônus só valem para eventos futuros e são lançados no extrato via `points_ledger`, com registro imutável `vip_awards` e chave de idempotência.
- A data de aniversário é cadastrada uma única vez pela cliente; correções exigem Admin. Indicações podem ser vinculadas antes do primeiro atendimento. Não prometer prevenção absoluta de contas falsas sem validação externa de telefone.

## Migrações já aplicadas (não reaplicar)
- `supabase/migrations/20261109_nailbook_vip.sql`
- `supabase/migrations/20261109_vip_summary_whatsapp_attendance.sql`
- `supabase/migrations/20261109_admin_whatsapp_summary.sql`
- `supabase/migrations/20261109_fix_vip_award_conflict.sql`
- `supabase/migrations/20261109_fix_vip_lifetime_credits.sql`

## Backend publicado
- `supabase/functions/p4-notifications/index.ts`: worker existente evoluído para quick reply opcional + consentimento expresso.
- `supabase/functions/whatsapp-webhook/index.ts`: endpoint HMAC para resposta da Meta.
Nenhum segredo foi adicionado ao repositório ou exibido ao usuário.

## Testes realizados
- [x] Bucket privado, RLS do Nail Book, cliente sem acesso ao álbum de outra cliente, Admin com acesso conforme role. Todos os registros de teste revertidos.
- [x] Birthday e frequência: quando ativados em TRANSAÇÃO DE TESTE, lançam pontos uma única vez; bug da cláusula ON CONFLICT corrigido.
- [x] Indicação: cliente nova vinculou código de outra cliente e bônus foi creditado somente após o primeiro atendimento pago em TRANSAÇÃO DE TESTE; tudo revertido.
- [x] RPC VIP da própria cliente, RPC operacional WhatsApp restrita à Admin.
- [x] Endpoint Meta e worker P4 implantados com controle de credenciais; botões de envio permanecem desativados sem permissão.
- [ ] Aceite visual no site pelo navegador para Nail Book, Clube VIP e painel WhatsApp.
- [ ] Teste real de fotos com contas cliente/admin.
- [ ] Testar Meta end-to-end **após credenciais, configuração de webhook e aprovação de templates**.

## Validação visual recomendada
1. Cliente → Início → Meu Nail Book: salvar inspiração e conferir privacidade; testar Repetir este estilo.
2. Admin → Nail Book: escolher cliente, vincular foto ao atendimento concluído e conferir a imagem na conta da cliente.
3. Cliente → TR Points → Clube VIP: conferir nível, código e aniversário.
4. Admin → TR Points → Clube VIP: conferir os valores; manter campanhas desligadas até definir a política comercial.
5. Admin → WhatsApp: verificar totais reais; aguardar autorização Meta para testes de envio e confirmação de presença.
