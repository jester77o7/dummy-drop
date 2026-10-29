// Dummy Drop stage 6: THREE LEVELS.
// PASS from plan: every level cleared by the bot at least once within 5 dummies;
// every level stable for 30 seconds untouched (no self-collapse).
// Winning drags are filled in from probe-stage6.js results (WIN_DRAGS below).
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('page never appeared');}
const page=await getPage();
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();const exceptions=[];
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails;exceptions.push((d.exception&&d.exception.description)||d.text||'unknown');}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});if(r.result&&r.result.exceptionDetails){const d=r.result.exceptionDetails;return{error:(d.exception&&d.exception.description)||d.text};}return{value:r.result&&r.result.result?r.result.result.value:undefined};}
let pass=0,fail=0;
function report(name,ok,detail){console.log((ok?'PASS':'FAIL')+' | '+name+(detail?' | '+detail:''));ok?pass++:fail++;}
async function getState(){const r=await evl('JSON.stringify(DD.state())');try{return JSON.parse(r.value||'{}');}catch(e){return{};}}
async function waitPhase(want,ms){let st={};const t0=Date.now();while(Date.now()-t0<ms){st=await getState();if(st.phase===want)return st;await sleep(300);}return st;}
async function settled(ms){let st=await waitPhase('flying',6000);const t0=Date.now();while(Date.now()-t0<ms){st=await getState();if(st.phase!=='flying')return st;await sleep(300);}return st;}
await send('Runtime.enable');await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(3000);
const EXPECT_PUMPKINS={1:1,2:2,3:3};
// Plan stage 6: "beatable by bot launches at several angles and powers within
// 5 dummies". A varied sequence per level (a player adjusting aim), not one
// identical shot repeated: probe-l1wreck showed a repeated flat-max can take
// the tower's head off (glass+stone, score 30) while the base shelter and its
// pumpkin sit untouched, five times in a row. G1 probe (2026-10-29 00:20):
// probe-g1low proved a full-power DOWNWARD drag (60,470) - pull above the
// anchor - smashes through L1's ground glass shelter and wins in 1 shot,
// 4/4 candidates in that family; the old sequences never aimed low at all.
// WIN_DRAGS now LEAD with that low shot on every level, then fall back to
// the varied flat/arc sequence.
const WIN_DRAGS={1:[[60,470],[50,540],[60,560],[80,620],[110,555]],
                 2:[[60,470],[50,540],[80,620],[60,560],[110,555]],
                 3:[[60,470],[50,560],[50,540],[80,620],[110,555]]};
// L3 shot 2 updated 2026-10-29 (K1): probe-l3top + probe-l3confirm proved
// (50,560) a reliable direct TOP-pumpkin kill, 8/8 across fresh and
// as-shot-2 contexts, while the old shot 2 (50,540) never reached the top
// shelter. (60,560) in the old sequence only killed the top after shots
// 2-3 had weakened the upper structure (context effect, probe-l3survive).
for(let lv=1;lv<=3;lv++){
  // 30 s untouched stability
  await evl('DD.startLevel('+lv+')');
  let st0=await getState();
  report('L'+lv+' starts ready with expected pumpkins',st0.phase==='ready'&&st0.pumpkinsAlive===EXPECT_PUMPKINS[lv]&&st0.dummiesLeft===5,JSON.stringify({phase:st0.phase,alive:st0.pumpkinsAlive}));
  // Stability criterion (probe-l3stab 2026-10-28): a tall stack makes one
  // initial settle of a few px in the first seconds (L3: 5.37 px, then the
  // value is bit-identical at 5/10/20/30/45 s). The quality bar bans drift,
  // lean and self-collapse over 30 s, so judge: no movement between the 10 s
  // and 30 s samples, pumpkins intact, still ready, settle bounded (<8 px).
  await sleep(10000);
  let st10=await getState();
  await sleep(20000);
  let st=await getState();
  report('L'+lv+' stable 30s untouched (no drift/collapse, pumpkins intact)',Math.abs(st.towerMaxChange-st10.towerMaxChange)<0.5&&st.towerMaxChange<8&&st.pumpkinsAlive===EXPECT_PUMPKINS[lv]&&st.phase==='ready','maxChange10s='+st10.towerMaxChange+' maxChange30s='+st.towerMaxChange+' alive='+st.pumpkinsAlive+' phase='+st.phase);
  // Beatable: repeat the proven drag until won or dummies out (max 5)
  const seq=WIN_DRAGS[lv];let used=0;let final=st;
  await evl('DD.startLevel('+lv+')');await sleep(800);
  while(used<5){
    const c=seq[used];
    let r=await evl('DD.botLaunch('+c[0]+','+c[1]+')');
    if(r.value!==true){report('L'+lv+' launch '+(used+1)+' accepted',false,'ret='+r.value);break;}
    used++;final=await settled(45000);
    if(final.phase==='won'||final.phase==='lost')break;
    if(final.phase!=='ready'){report('L'+lv+' settles to ready/won/lost',false,'phase='+final.phase);break;}
  }
  report('L'+lv+' cleared by bot within 5 dummies',final.phase==='won','phase='+final.phase+' used='+used+' alive='+final.pumpkinsAlive+' score='+final.score);
  report('L'+lv+' no page errors',Array.isArray(final.errors)&&final.errors.length===0,JSON.stringify(final.errors||[]));
}
report('no CDP exceptions across stage 6',exceptions.length===0,'exceptions='+exceptions.length+(exceptions[0]?' first='+exceptions[0]:''));
console.log('SUMMARY '+pass+'/'+(pass+fail)+' passed');
ws.close();process.exit(0);
