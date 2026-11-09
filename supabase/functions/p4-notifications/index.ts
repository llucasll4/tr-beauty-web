// TR Beauty Concept — P4 Notification worker (Supabase Edge Function)
// Protected by X-TR-Cron-Secret; never invoke from client/browser.
// Required: P4_CRON_SECRET, P4_SENDING_ENABLED=true, RESEND_API_KEY,
// RESEND_FROM_EMAIL, WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID,
// WA_GRAPH_VERSION, WA_TEMPLATE_* (only for enabled channels).
import { createClient } from 'npm:@supabase/supabase-js@2';

type Channel = 'email' | 'whatsapp';
type EventType =
  | 'booking_requested'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'reminder_24h';

type Job = {
  id: string;
  appointment_id: string;
  client_id: string;
  event_type: EventType;
  channel: Channel;
  scheduled_for: string;
};

const env = (key: string) => Deno.env.get(key)?.trim() || '';
function equalToken(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
function normalizePhone(raw: string | null | undefined) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}
function getServiceKey() {
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY');
  const bundle = env('SUPABASE_SECRET_KEYS');
  if (bundle) {
    try {
      const keys = JSON.parse(bundle);
      if (typeof keys.default === 'string' && keys.default) return keys.default;
    } catch { /* use legacy fallback */ }
  }
  return legacy;
}
const labels: Record<EventType, { subject: string; sentence: string; template: string }> = {
  booking_requested: {
    subject: 'Recebemos seu pedido de agendamento',
    sentence: 'Recebemos seu pedido e retornaremos quando o estúdio confirmar o horário.',
    template: 'WA_TEMPLATE_REQUESTED',
  },
  booking_confirmed: {
    subject: 'Seu agendamento foi confirmado',
    sentence: 'Seu horário está confirmado. Esperamos você!',
    template: 'WA_TEMPLATE_CONFIRMED',
  },
  booking_cancelled: {
    subject: 'Seu agendamento foi cancelado',
    sentence: 'Seu agendamento foi cancelado. Acesse a TR Beauty Concept para marcar outro horário.',
    template: 'WA_TEMPLATE_CANCELLED',
  },
  reminder_24h: {
    subject: 'Lembrete do seu atendimento',
    sentence: 'Este é um lembrete do seu próximo atendimento na TR Beauty Concept.',
    template: 'WA_TEMPLATE_REMINDER',
  },
};
function appointmentDisplay(appointment: any) {
  const when = new Date(appointment.starts_at);
  return {
    name: String(appointment.profiles?.full_name || 'Cliente').trim().slice(0, 100),
    service: String(appointment.services?.name || 'Atendimento').trim().slice(0, 100),
    date: when.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    }),
    hour: when.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
    }),
  };
}
async function sendEmail(job: Job, appointment: any, email: string) {
  const apiKey = env('RESEND_API_KEY');
  const from = env('RESEND_FROM_EMAIL');
  if (!apiKey || !from) throw new Error('Provedor de e-mail não configurado');
  const item = labels[job.event_type];
  const { name, service, date, hour } = appointmentDisplay(appointment);
  const plain = [
    'Olá, ' + name + '!',
    item.sentence,
    'Serviço: ' + service,
    'Data: ' + date,
    'Horário: ' + hour + ' (Brasília)',
    'TR Beauty Concept',
  ].join('\n\n');
  const safe = [name, item.sentence, service, date, hour].map(escapeHtml);
  const html = [
    '<div style="font-family:Arial,sans-serif;color:#2C2C2C;max-width:520px;margin:auto">',
    '<h2>TR Beauty Concept</h2>',
    '<p>Olá, ' + safe[0] + '!</p>',
    '<p>' + safe[1] + '</p>',
    '<p><b>Serviço:</b> ' + safe[2] + '<br/>',
    '<b>Data:</b> ' + safe[3] + '<br/>',
    '<b>Horário:</b> ' + safe[4] + ' (Brasília)</p>',
    '<p>TR Beauty Concept</p></div>',
  ].join('');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'tr-p4-' + job.id,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'TR Beauty Concept — ' + item.subject,
      html,
      text: plain,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Resend HTTP ' + response.status + ': ' +
    String(payload?.message || payload?.name || 'erro').slice(0, 160));
  return String(payload?.id || '');
}
async function sendWhatsapp(job: Job, appointment: any, number: string) {
  const token = env('WA_ACCESS_TOKEN');
  const phoneId = env('WA_PHONE_NUMBER_ID');
  const version = env('WA_GRAPH_VERSION');
  const template = env(labels[job.event_type].template);
  const locale = env('WA_TEMPLATE_LANGUAGE') || 'pt_BR';
  if (!token || !phoneId || !version || !template) {
    throw new Error('WhatsApp Cloud API ou modelos aprovados não configurados');
  }
  if (!/^v\d+\.\d+$/.test(version) || !/^\d+$/.test(phoneId) ||
      !/^[a-z0-9_]+$/.test(template)) {
    throw new Error('Configuração de WhatsApp inválida');
  }
  const { name, service, date, hour } = appointmentDisplay(appointment);
  const response = await fetch(
    'https://graph.facebook.com/' + version + '/' + phoneId + '/messages',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: number,
        type: 'template',
        template: {
          name: template,
          language: { code: locale },
          components: [
            {
              type: 'body',
              parameters: [name, service, date, hour].map(text => ({ type: 'text', text })),
            },
            // Only enable when the matching Meta-approved templates include
            // a quick-reply button at index 0 labelled "Confirmar presença".
            ...(env('WA_REPLY_BUTTONS_ENABLED') === 'true' &&
              (job.event_type === 'booking_confirmed' || job.event_type === 'reminder_24h')
              ? [{
                type: 'button', sub_type: 'quick_reply', index: '0',
                parameters: [{
                  type: 'payload', payload: 'TR_CONFIRM_' + job.appointment_id,
                }],
              }] : []),
          ],
        },
      }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error('WhatsApp HTTP ' + response.status + ': ' +
      String(payload?.error?.code || 'falha do provedor').slice(0, 80));
  }
  return String(payload?.messages?.[0]?.id || '');
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = env('P4_CRON_SECRET');
  if (!equalToken(request.headers.get('x-tr-cron-secret') || '', secret)) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (env('P4_SENDING_ENABLED') !== 'true') {
    return Response.json({ enabled: false, processed: 0 });
  }
  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = getServiceKey();
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'Configuração de banco ausente' }, { status: 500 });
  }
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: pending, error: listError } = await db
    .from('notification_outbox')
    .select('id,appointment_id,client_id,event_type,channel,scheduled_for')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(15);

  if (listError) return Response.json({ error: 'Erro ao consultar fila' }, { status: 500 });
  const counts = { processed: 0, sent: 0, skipped: 0, failed: 0 };
  for (const job of (pending || []) as Job[]) {
    // Claim atômico por status: execuções simultâneas não enviam o mesmo job.
    const { data: claimed, error: claimError } = await db
      .from('notification_outbox')
      .update({ status: 'processing', attempts: 1 })
      .eq('id', job.id).eq('status', 'pending')
      .select('id').maybeSingle();
    if (claimError || !claimed) continue;
    counts.processed++;
    let status: 'sent' | 'skipped' | 'failed' = 'failed';
    let lastError: string | null = null;
    let providerId: string | null = null;
    try {
      const [{ data: appointment, error: appointmentError },
        { data: preference, error: preferenceError }] = await Promise.all([
        db.from('appointments')
          .select('id,starts_at,status,services(name),profiles(full_name,phone)')
          .eq('id', job.appointment_id).single(),
        db.from('notification_preferences')
          .select('email_enabled,whatsapp_enabled')
          .eq('user_id', job.client_id).maybeSingle(),
      ]);
      if (appointmentError || preferenceError || !appointment) {
        throw new Error('Dados do atendimento ou consentimento indisponíveis');
      }
      const current = appointment.status;
      const validStatus: Record<EventType, boolean> = {
        booking_requested: current === 'pending',
        booking_confirmed: current === 'confirmed',
        booking_cancelled: current === 'cancelled',
        reminder_24h: current === 'confirmed' &&
          new Date(appointment.starts_at).getTime() > Date.now() + 60 * 60 * 1000,
      };
      const channelEnabled = job.channel === 'email'
        ? preference?.email_enabled
        : preference?.whatsapp_enabled;
      if (!validStatus[job.event_type] || !channelEnabled) {
        status = 'skipped';
        lastError = 'Status mudou ou consentimento desativado';
      } else if (job.channel === 'email') {
        const { data: authUser, error: authError } = await db.auth.admin.getUserById(job.client_id);
        if (authError) throw new Error('Falha ao consultar destino de e-mail');
        const email = authUser?.user?.email;
        if (!email) {
          status = 'skipped'; lastError = 'Cliente sem e-mail';
        } else {
          providerId = await sendEmail(job, appointment, email);
          status = 'sent';
        }
      } else {
        const phone = normalizePhone(appointment.profiles?.phone);
        if (!phone) {
          status = 'skipped'; lastError = 'Telefone ausente ou inválido';
        } else {
          providerId = await sendWhatsapp(job, appointment, phone);
          status = 'sent';
        }
      }
    } catch (err) {
      // Para WhatsApp não há idempotência garantida no endpoint:
      // falhas são retidas para revisão, não reenviadas automaticamente.
      status = 'failed';
      lastError = err instanceof Error ? err.message.slice(0, 220) : 'Erro desconhecido';
    }
    const { error: saveError } = await db.from('notification_outbox').update({
      status, provider_message_id: providerId, last_error: lastError,
      processed_at: new Date().toISOString(),
    }).eq('id', job.id).eq('status', 'processing');
    if (saveError) console.error('Falha ao registrar resultado do job', job.id);
    counts[status]++;
  }
  return Response.json({ enabled: true, ...counts });
});
