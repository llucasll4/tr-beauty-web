const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

// Extract exactly each SQL function body with its own dollar-quote delimiter.
// Some migrations use $function$, others $guard$ or $rpc$.
const sources=[
 ['supabase/migrations/20261111_admin_calendar_blocks.sql',
  ['available_slots','calendar_blocks_reservation_guard','calendar_blocks_appointment_guard']],
 ['supabase/migrations/20261109_schedule_last_start_20h.sql',['book_appointment']],
 ['supabase/migrations/20261109_tr_points_any_positive_cost.sql',['book_appointment_with_points']],
 ['supabase/migrations/20261109_tr_points_service_redemption.sql',
  ['credit_points_after_completion','refund_cancelled_points_booking','protect_cancelled_points_booking']],
];
let sql='-- Exact SQL functions extracted from the current repository migrations.\n';
for(const [file,names] of sources){
 const source=fs.readFileSync(path.join(root,file),'utf8');
 for(const name of names){
   const re=new RegExp('create\\s+or\\s+replace\\s+function\\s+public\\.'+
     name+'\\s*\\(','gi');
   const found=[...source.matchAll(re)];
   if(found.length!==1)throw Error('Expected 1 '+name+' in '+file+', found '+found.length);
   const from=source.slice(found[0].index);
   const open=from.match(/\bas\s+(\$[A-Za-z0-9_]*\$)/i);
   if(!open)throw Error('No SQL body delimiter for '+name);
   const delimiter=open[1];
   const end=from.indexOf(delimiter+';',open.index+open[0].length);
   if(end<0)throw Error('No closing SQL delimiter for '+name);
   const definition=from.slice(0,end+delimiter.length+1);
   // Never allow extraction of an unrelated function/trigger statement.
   if(definition.slice(open.index).match(/\bcreate\s+trigger\b/i)){
     throw Error('Wrong SQL body boundary for '+name);
   }
   sql+='\n-- '+file+': '+name+'\n'+definition+'\n';
 }
}
const dest=path.join(root,'tests/db/generated-functions.sql');
fs.writeFileSync(dest,sql);
console.log('Extracted '+sources.reduce((n,[,names])=>n+names.length,0)+
  ' production SQL functions in isolated test harness.');
