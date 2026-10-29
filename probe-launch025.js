// Probe: reload, botLaunch(50,540), sample state each 250ms for 8s.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('page never appeared');}
const page=await getPage();
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});if(!r.result)return{error:'no result'};if(r.result.exceptionDetails){const d=r.result.exceptionDetails;return{error:(d.exception&&d.exception.description)||d.text};}return{value:r.result.result?r.result.result.value:undefined};}
async function getState(){const r=await evl('JSON.stringify(DD.state())');try{return JSON.parse(r.value||'{}');}catch(e){return{};}}
await send('Runtime.enable');await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});
await sleep(3000);
let st=await getState();
console.log('pre  chest='+JSON.stringify(st.chest)+' phase='+st.phase+' launched='+st.launched);
let r=await evl('DD.botLaunch(50,540)');
console.log('botLaunch ret='+r.value+' err='+r.error);
for(let i=0;i<32;i++){
  await sleep(250);
  st=await getState();
  console.log('t+'+((i+1)*250)+'ms chest=('+(st.chest?Math.round(st.chest.x):'?')+','+(st.chest?Math.round(st.chest.y):'?')+') maxSpeed='+(st.maxSpeed!=null?Math.round(st.maxSpeed*100)/100:'?')+' launched='+st.launched+' phase='+st.phase+' towerChange='+(st.towerMaxChange!=null?Math.round(st.towerMaxChange*10)/10:'?')+' errors='+JSON.stringify(st.errors||[]));
}
ws.close();process.exit(0);
