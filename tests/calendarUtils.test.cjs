const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function loadSource(relativePath){
  const source=fs.readFileSync(path.join(__dirname,'..',relativePath),'utf8');
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const calendar=loadSource('utils/calendar.js');
const service=loadSource('utils/services.js');
const tokens=loadSource('theme/tokens.js');

test('São Paulo: UTC to local calendar day crosses midnight correctly',async()=>{
  const {localDateKey}=await calendar;
  assert.equal(localDateKey(new Date('2026-11-11T02:30:00.000Z')),'2026-11-10');
  assert.equal(localDateKey(new Date('2026-11-11T03:30:00.000Z')),'2026-11-11');
});

test('Month navigation crosses year boundaries with stable ISO month keys',async()=>{
  const {offsetMonth,monthLabel}=await calendar;
  assert.equal(offsetMonth('2026-12',1),'2027-01');
  assert.equal(offsetMonth('2027-01',-1),'2026-12');
  assert.match(monthLabel('2026-11'),/Novembro de 2026/);
});

test('Calendar grid begins Monday, includes blank cells and disables closed days',async()=>{
  const {buildCalendar}=await calendar;
  const cells=buildCalendar('2026-11',new Set(['2026-11-01','2026-11-03','2026-11-04']),
    new Set([2,3,4,5,6]));
  assert.equal(cells.length%7,0);
  assert.equal(cells[0],null); // 1 Nov 2026 is Sunday, week starts Monday.
  assert.equal(cells[6].key,'2026-11-01');
  assert.equal(cells[6].enabled,false); // Sunday is closed.
  assert.equal(cells.find(x=>x?.key==='2026-11-03').enabled,true);
  assert.equal(cells.find(x=>x?.key==='2026-11-02').enabled,false);
});

test('Calendar disables dates outside known bookable set',async()=>{
  const {buildCalendar}=await calendar;
  const cells=buildCalendar('2026-11',new Set(['2026-11-10']));
  assert.equal(cells.filter(x=>x?.enabled).length,1);
});

test('Home service icon mapping stays nail-specific, not water drops',async()=>{
  const {emojiForHomeService}=await service;
  for(const name of ['Banho de gel','Manutenção','Alongamento','Esmaltação']){
    assert.equal(emojiForHomeService(name),'💅');
  }
  assert.equal(emojiForHomeService('Nail Art'),'🎨');
  assert.equal(emojiForHomeService('Serviço especial'),'✨');
});

test('Original TR Beauty Concept palette remains pixel-exact',async()=>{
  const {brandColors,homeColors,palette}=await tokens;
  assert.equal(brandColors.background,'#FDFBF7');
  assert.equal(brandColors.nude,'#EBE5DF');
  assert.equal(brandColors.mocha,'#7A655B');
  assert.equal(homeColors.background,'#FAF9F5');
  assert.equal(homeColors.brown,'#402816');
  assert.equal(palette.warmNude,'#EBE3D9');
});
