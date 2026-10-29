// Dummy Drop improvement M2: LEVEL 4 (Bridge) proof.
// PASS: L4 starts ready with 2 pumpkins, stable 30 s untouched (no drift
// between the 10 s and 30 s samples, settle <8 px, pumpkins intact), and is
// cleared by the bot within 5 dummies; zero page errors / CDP exceptions.
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
async function settled(ms){await waitPhase('flying',6000);const t0=Date.now();let st={};while(Date.now()-t0<ms){st=await getState();if(st.phase!=='flying')return st;await sleep(300);}return st;}
await send('Runtime.enable');await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(3000);
await evl('DD.startLevel(4)');
let st0=await getState();
report('L4 starts ready with 2 pumpkins',st0.phase==='ready'&&st0.pumpkinsAlive===2&&st0.dummiesLeft===5&&st0.level===4,JSON.stringify({phase:st0.phase,alive:st0.pumpkinsAlive,level:st0.level}));
let btn=await evl("document.getElementById('btn-lvl-4') ? document.getElementById('btn-lvl-4').className : 'missing'");
report('L4 level button present and active',/active/.test(btn.value||''),'class='+btn.value);
await sleep(10000);
let st10=await getState();
await sleep(20000);
let st=await getState();
report('L4 stable 30s untouched',Math.abs(st.towerMaxChange-st10.towerMaxChange)<0.5&&st.towerMaxChange<8&&st.pumpkinsAlive===2&&st.phase==='ready','maxChange10s='+st10.towerMaxChange+' maxChange30s='+st.towerMaxChange+' alive='+st.pumpkinsAlive+' phase='+st.phase);
const SEQ=[[60,470],[50,540],[80,620],[60,560],[110,555]];
await evl('DD.startLevel(4)');await sleep(800);
let used=0,final=st;
while(used<5){
  const c=SEQ[used];
  let r=await evl('DD.botLaunch('+c[0]+','+c[1]+')');
  if(r.value!==true){report('L4 launch '+(used+1)+' accepted',false,'ret='+r.value);break;}
  used++;final=await settled(45000);
  if(final.phase==='won'||final.phase==='lost')break;
  if(final.phase!=='ready'){report('L4 settles to ready/won/lost',false,'phase='+final.phase);break;}
}
report('L4 cleared by bot within 5 dummies',final.phase==='won','phase='+final.phase+' used='+used+' alive='+final.pumpkinsAlive+' score='+final.score);
report('L4 no page errors',Array.isArray(final.errors)&&final.errors.length===0,JSON.stringify(final.errors||[]));
report('no CDP exceptions',exceptions.length===0,'exceptions='+exceptions.length+(exceptions[0]?' first='+exceptions[0]:''));
console.log('SUMMARY '+pass+'/'+(pass+fail)+' passed');
ws.close();process.exit(0);
