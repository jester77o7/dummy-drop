// Probe Stage 6 levels: stability snapshot + candidate launches per level.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('page never appeared');}
const page=await getPage();
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();const exceptions=[];
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails;exceptions.push((d.exception&&d.exception.description)||d.text||'unknown');}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});if(r.result&&r.result.exceptionDetails){const d=r.result.exceptionDetails;return{error:(d.exception&&d.exception.description)||d.text};}return{value:r.result&&r.result.result?r.result.result.value:undefined};}
async function getState(){const r=await evl('JSON.stringify(DD.state())');try{return JSON.parse(r.value||'{}');}catch(e){return{};}}
async function waitPhase(want,ms){let st={};const t0=Date.now();while(Date.now()-t0<ms){st=await getState();if(st.phase===want)return st;await sleep(300);}return st;}
async function settled(ms){let st=await waitPhase('flying',6000);const t0=Date.now();while(Date.now()-t0<ms){st=await getState();if(st.phase!=='flying')return st;await sleep(300);}return st;}
await send('Runtime.enable');await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(3000);
const candidates=[[50,540],[110,555],[80,620],[60,470]];
for(let lv=1;lv<=3;lv++){
  await evl('DD.startLevel('+lv+')');await sleep(6000);
  let st=await getState();
  console.log('L'+lv+' STABILITY6s phase='+st.phase+' pumpkins='+st.pumpkinsAlive+' towerMaxChange='+st.towerMaxChange+' errors='+(st.errors||[]).length);
  for(const c of candidates){
    await evl('DD.startLevel('+lv+')');await sleep(800);
    let r=await evl('DD.botLaunch('+c[0]+','+c[1]+')');
    if(r.value!==true){console.log('L'+lv+' drag '+c+' launch rejected');continue;}
    // up to 5 dummies with same drag until won/lost
    let final=await settled(40000);let used=1;
    while(final.phase==='ready'&&used<5){await evl('DD.botLaunch('+c[0]+','+c[1]+')');final=await settled(40000);used++;}
    console.log('L'+lv+' drag '+c+' -> phase='+final.phase+' used='+used+' pumpkinsAlive='+final.pumpkinsAlive+' squashed='+final.pumpkinsSquashed+' score='+final.score+' blocksBroken='+final.blocksBroken);
    if(final.phase==='won')break;
  }
}
console.log('exceptions='+exceptions.length);
ws.close();process.exit(0);
