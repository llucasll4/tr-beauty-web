// TR Beauty Concept — Meta WhatsApp Cloud API webhook.
// PUBLIC endpoint with Meta challenge + SHA-256 signature verification.
// Requires WA_META_VERIFY_TOKEN + WA_APP_SECRET before enabling Meta callbacks.
// No authentication token or provider secret is exposed to the browser.
import {createClient} from 'npm:@supabase/supabase-js@2';

const env=(k:string)=>Deno.env.get(k)?.trim()||'';
function serviceKey():string {
  const bundle=env('SUPABASE_SECRET_KEYS');
  if(bundle)try{
    const parsed=JSON.parse(bundle);
    if(typeof parsed.default==='string'&&parsed.default)return parsed.default;
  }catch{}
  return env('SUPABASE_SERVICE_ROLE_KEY');
}
function normalized(raw:string|null|undefined):string {
  let digits=String(raw||'').replace(/\D/g,'');
  if(digits.length===10||digits.length===11)digits='55'+digits;
  return digits;
}
function json(body:unknown,status=200):Response {
  return new Response(JSON.stringify(body),{
    status,headers:{'content-type':'application/json'}
  });
}
async function signed(raw:Uint8Array,header:string,secret:string){
  if(!secret||!/^sha256=[0-9a-f]{64}$/i.test(header))return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['verify']);
  const signature=new Uint8Array(header.slice(7).match(/.{2}/g)!.map(v=>parseInt(v,16)));
  return crypto.subtle.verify('HMAC',key,signature,raw);
}
async function acknowledge(number:string){
  const token=env('WA_ACCESS_TOKEN'),phoneId=env('WA_PHONE_NUMBER_ID'),version=env('WA_GRAPH_VERSION');
  if(!token||!phoneId||!/^v\d+\.\d+$/.test(version))return;
  try{
    // Resposta dentro da janela de atendimento aberta pelo clique da cliente.
    await fetch('https://graph.facebook.com/'+version+'/'+phoneId+'/messages',{
      method:'POST',
      headers:{Authorization:'Bearer '+token,'content-type':'application/json'},
      body:JSON.stringify({
        messaging_product:'whatsapp',to:number,type:'text',
        text:{body:'💅 TR Beauty Concept: presença confirmada! Esperamos você no seu horário. 🌟'}
      })
    });
  }catch(err){console.error('Falha na resposta do WhatsApp',String(err));}
}

Deno.serve(async(req:Request)=>{
  const url=new URL(req.url);
  if(req.method==='GET'){
    const token=env('WA_META_VERIFY_TOKEN');
    if(token&&url.searchParams.get('hub.mode')==='subscribe'&&
      url.searchParams.get('hub.verify_token')===token){
      return new Response(url.searchParams.get('hub.challenge')||'',{status:200});
    }
    return new Response('Forbidden',{status:403});
  }
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const secret=env('WA_APP_SECRET');
  const raw=new Uint8Array(await req.arrayBuffer());
  if(!(await signed(raw,req.headers.get('x-hub-signature-256')||'',secret))){
    return json({error:'Signature verification failed'},401);
  }
  let payload:any;
  try{payload=JSON.parse(new TextDecoder().decode(raw));}
  catch{return json({error:'Malformed payload'},400);}
  const dbKey=serviceKey();
  if(!dbKey)return json({error:'Integration not configured'},503);
  const db=createClient(env('SUPABASE_URL'),dbKey,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const messages=(payload?.entry||[]).flatMap((entry:any)=>
    (entry?.changes||[]).flatMap((change:any)=>change?.value?.messages||[]));
  let confirmations=0;
  for(const msg of messages){
    const sender=normalized(msg?.from);
    const action=String(msg?.button?.payload||msg?.interactive?.button_reply?.id||'');
    const match=/^TR_CONFIRM_([0-9a-f-]{36})$/.exec(action);
    if(!match||sender.length<10)continue;
    // Only actions tied to a specific confirmed appointment can change attendance.
    const {data:appointment,error:readError}=await db.from('appointments')
      .select('id,client_id,starts_at,status,attendance_confirmed_at')
      .eq('id',match[1]).maybeSingle();
    if(readError||!appointment||appointment.status!=='confirmed'||
      appointment.attendance_confirmed_at||
      new Date(appointment.starts_at).getTime()<=Date.now())continue;
    const [{data:profile},{data:preference}]=await Promise.all([
      db.from('profiles').select('phone').eq('id',appointment.client_id).maybeSingle(),
      db.from('notification_preferences').select('whatsapp_enabled,whatsapp_consented_at')
        .eq('user_id',appointment.client_id).maybeSingle()
    ]);
    if(!preference?.whatsapp_enabled||!preference.whatsapp_consented_at||
      normalized(profile?.phone)!==sender)continue;
    const {data:updated,error:updateError}=await db.from('appointments')
      .update({attendance_confirmed_at:new Date().toISOString()})
      .eq('id',appointment.id).eq('status','confirmed')
      .is('attendance_confirmed_at',null)
      .select('id').maybeSingle();
    if(updateError){console.error('Presence update failed',String(updateError.code));continue;}
    if(updated){
      confirmations++;
      await acknowledge(sender);
    }
  }
  return json({ok:true,confirmed:confirmations});
});
