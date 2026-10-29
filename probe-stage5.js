// Probe stage5 settle: squash pumpkin, weak launch, sample state 30s.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('no page');}
const page=await getPage();
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});return{value:r.result&&r.result.result?r.result.result.value:undefined};}
await send('Runtime.enable');await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true});await sleep(3000);
console.log('squash=',(await evl('DD.testSquashPumpkins()')).value);
await sleep(600);
console.log('launch=',(await evl('DD.botLaunch(175,552)')).value);
for(let i=0;i<15;i++){
  await sleep(2000);
  const r=await evl('JSON.stringify(DD.state())');
  const st=JSON.parse(r.value||'{}');
  const speeds=await evl("JSON.stringify(Matter.Composite.allBodies(DD.world).filter(b=>!b.isStatic&&!b.isSleeping).map(b=>({l:b.label,s:Math.round(Math.hypot(b.velocity.x,b.velocity.y)*100)/100,a:Math.round(Math.abs(b.angularVelocity)*1000)/1000})))");
  console.log('t+'+((i+1)*2)+'s phase='+st.phase+' allRest='+st.allRest+' restSteps='+st.restSteps+' maxBodySpeed='+st.maxBodySpeed+' dummiesLeft='+st.dummiesLeft+' awake='+speeds.value);
  if(st.phase==='won')break;
}
ws.close();process.exit(0);
