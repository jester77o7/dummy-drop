// Stage 7 H3 juice test: hit-stop + floating score popups.
// Polls juiceInfo quickly because popups live ~950 ms and hit-stop ~60 ms.
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
async function juice(){const r=await evl('JSON.stringify(DD.juiceInfo())');try{return JSON.parse(r.value||'{}');}catch(e){return{};}}
async function state(){const r=await evl('JSON.stringify(DD.state())');try{return JSON.parse(r.value||'{}');}catch(e){return{};}}
// Poll for up to ms, returning the best juice snapshot seen (max hitStops, any popups).
async function watch(ms){
  // allPopups accumulates EVERY popup text seen in any snapshot (item-3 fix,
  // 2026-10-29): since the item-1 wake-on-break fix, one break can cascade
  // the standing tower and flood the 950 ms popup list with +10s, so keeping
  // only the longest single snapshot can miss a +100 that did appear.
  let best={hitStops:0,popups:[],bursts:0,maxParticles:0,allPopups:[]},sawStop=false;const seen=new Set();const t0=Date.now();
  while(Date.now()-t0<ms){const j=await juice();if((j.hitStops||0)>best.hitStops)best.hitStops=j.hitStops;if((j.popups||[]).length>best.popups.length)best.popups=j.popups;(j.popups||[]).forEach(x=>seen.add(x));if((j.bursts||0)>best.bursts)best.bursts=j.bursts;if((j.activeParticles||0)>best.maxParticles)best.maxParticles=j.activeParticles;if(j.hitStopActive)sawStop=true;await sleep(40);}
  best.sawStop=sawStop;best.allPopups=[...seen];return best;
}
await send('Runtime.enable');await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(3000);
let j0=await juice();
report('juice starts clean',j0.hitStops===0&&(j0.popups||[]).length===0&&(j0.bursts||0)===0&&(j0.activeParticles||0)===0,JSON.stringify(j0));
// 1) Crack hit-stop: wood at speed 12 cracks (health 18 -> ~6, alive, item-3
// pools) with no break.
// Judge the popup state AT the crack moment: the test target keeps falling
// afterwards and may legitimately break on the ground ~1 s later, which is a
// break popup, not a crack popup (first run of this test proved exactly that).
await evl("DD.testImpact('wood',12)");
let w={hitStops:0,popups:null,bursts:0};{const t0=Date.now();while(Date.now()-t0<2500){const j=await juice();if((j.hitStops||0)>=1){w.hitStops=j.hitStops;w.popups=j.popups||[];w.bursts=j.bursts||0;break;}await sleep(30);}if(w.popups===null){const j=await juice();w.hitStops=j.hitStops||0;w.popups=j.popups||[];w.bursts=j.bursts||0;}}
let st=await state();
report('wood crack triggers hit-stop',w.hitStops>=1,'hitStops='+w.hitStops);
report('crack alone gives no score popup',w.popups.length===0,'popups='+JSON.stringify(w.popups));
report('crack alone spawns no debris burst',w.bursts===0,'bursts='+w.bursts);
// 2) Pumpkin break: popup +100 and another hit-stop.
const before=w.hitStops;
await evl("DD.testImpact('pumpkin',6)");
let p=await watch(2500);
report('pumpkin break triggers hit-stop',p.hitStops>before,'hitStops '+before+' -> '+p.hitStops);
report('pumpkin break shows +100 popup',p.allPopups.includes('+100'),'allPopups='+JSON.stringify(p.allPopups));
report('pumpkin break spawns debris burst',p.bursts>=1&&p.maxParticles>0,'bursts='+p.bursts+' maxParticles='+p.maxParticles);
// 3) Block break: popup +10.
const pb=p.bursts;
await evl("DD.testImpact('glass',5)");
let g=await watch(2500);
report('glass break shows +10 popup',g.allPopups.includes('+10'),'allPopups='+JSON.stringify(g.allPopups));
report('glass break spawns another debris burst',g.bursts>pb,'bursts '+pb+' -> '+g.bursts+' maxParticles='+g.maxParticles);
st=await state();
report('game still ready/playing, zero errors',Array.isArray(st.errors)&&st.errors.length===0,JSON.stringify(st.errors||[]));
report('no CDP exceptions',exceptions.length===0,'n='+exceptions.length);
console.log('SUMMARY '+pass+'/'+(pass+fail)+' passed');
ws.close();process.exit(0);
