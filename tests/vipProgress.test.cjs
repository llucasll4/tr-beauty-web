const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../vipProgress.js'),'utf8');
// Import the real ESM module used by Expo without changing the app's module type.
const loaded=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const thresholds={silver_points:1000,gold_points:2000};

test('Bronze: goal advances to Prata',async()=>{
 const {getVipProgress}=await loaded;
 assert.deepEqual(getVipProgress({lifetime_points:350},thresholds),{
  tier:'Bronze',nextTier:'Prata',lifetime:350,goal:1000,remaining:650,progress:35,
 });
});
test('Prata: advancing changes next goal automatically to Ouro',async()=>{
 const {getVipProgress}=await loaded;
 assert.deepEqual(getVipProgress({lifetime_points:1000},thresholds),{
  tier:'Prata',nextTier:'Ouro',lifetime:1000,goal:2000,remaining:1000,progress:0,
 });
});
test('Prata: half-way through the tier',async()=>{
 const {getVipProgress}=await loaded;
 assert.equal(getVipProgress({lifetime_points:1500},thresholds).progress,50);
});
test('Ouro: final tier, no fictitious extra level',async()=>{
 const {getVipProgress}=await loaded;
 const p=getVipProgress({lifetime_points:3000},thresholds);
 assert.deepEqual([p.tier,p.nextTier,p.remaining,p.progress],['Ouro',null,0,100]);
});
test('Backend threshold changes are respected (no fixed 300)',async()=>{
 const {getVipProgress}=await loaded;
 const p=getVipProgress({lifetime_points:800},{silver_points:750,gold_points:1250});
 assert.equal(p.tier,'Prata');
 assert.equal(p.goal,1250);
 assert.equal(p.remaining,450);
});
test('Redeemed balance does not lower tier or VIP progress',async()=>{
 const {getVipProgress}=await loaded;
 const p=getVipProgress({lifetime_points:1800,balance:0},thresholds);
 assert.equal(p.tier,'Prata');
 assert.equal(p.remaining,200);
});
test('Malformed and missing settings are rejected',async()=>{
 const {getVipProgress}=await loaded;
 assert.equal(getVipProgress(null,thresholds),null);
 assert.equal(getVipProgress({lifetime_points:10},null),null);
 assert.equal(getVipProgress({lifetime_points:10},{silver_points:1000,gold_points:500}),null);
 assert.equal(getVipProgress({lifetime_points:10},{silver_points:0,gold_points:2000}),null);
});
test('Negative lifetime input never produces negative progression',async()=>{
 const {getVipProgress}=await loaded;
 const p=getVipProgress({lifetime_points:-50},thresholds);
 assert.equal(p.progress,0);
 assert.equal(p.remaining,1000);
});
