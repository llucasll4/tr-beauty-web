const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

// Extract production function bodies instead of testing hand-written stand-ins.
const sources=[
 ['supabase/migrations/20261111_admin_calendar_blocks.sql',
  ['available_slots','calendar_blocks_reservation_guard','calendar_blocks_appointment_guard']],
 ['supabase/migrations/20261109_schedule_last_start_20h.sql',['book_appointment']],
 ['supabase/migrations/20261109_tr_points_any_positive_cost.sql',['book_appointment_with_points']],
 ['supabase/migrations/20261109_tr_points_service_redemption.sql',
  ['credit_points_after_completion','refund_cancelled_points_booking','protect_cancelled_points_booking']],
];
let sql='-- Generated from real production migration definitions; do not edit manually.\n';
for (const [file,names] of sources) {
  const content=fs.readFileSync(path.join(root,file),'utf8');
  for(const name of names){
    const re=new RegExp('create\\s+or\\s+replace\\s+function\\s+public\\.'+
      name+'\\s*\\([\\s\\S]*?\\$function\\$;','gi');
    const matches=[...content.matchAll(re)];
    if(matches.length!==1){
      throw Error('Expected exactly one '+name+' in '+file+'; found '+matches.length);
    }
    sql+='\n-- '+file+': '+name+'\n'+matches[0][0]+'\n';
  }
}
fs.writeFileSync(path.join(root,'tests/db/generated-functions.sql'),sql);
console.log('Validated and extracted '+sources.reduce((n,[,names])=>n+names.length,0)+' SQL functions.');
