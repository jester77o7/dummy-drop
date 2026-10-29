const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('no page');}
const page=await getPage();const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});return r.result&&r.result.result?r.result.result.value:undefined;}
async function getState(){const v=await evl('JSON.stringify(DD.state())');try{return JSON.parse(v||'{}');}catch(e){return{};}}
async function waitPhase(want,ms){let st={};const t0=Date.now();while(Date.now()-t0<ms){st=await getState();if(st.phase===want)return st;await sleep(300);}return st;}
async function settled(ms){await waitPhase('flying',6000);const t0=Date.now();let st={};while(Date.now()-t0<ms){st=await getState();if(st.phase!=='flying')return st;await sleep(300);}return st;}
await send('Runtime.enable');
for(let attempt=1;attempt<=3;attempt++){
  await evl('DD.startLevel(1)');await sleep(3000);
  let st=await getState();let used=0;let log=[];
  while(used<5){
    await evl('DD.botLaunch(50,540)');used++;
    st=await settled(45000);
    log.push('L'+used+':'+st.phase+'/alive'+st.pumpkinsAlive+'/score'+st.score);
    if(st.phase==='won'||st.phase==='lost')break;
    await sleep(1500);
  }
  console.log('attempt '+attempt+' -> '+st.phase+' used='+used+' | '+log.join(' '));
}
ws.close();process.exit(0);
