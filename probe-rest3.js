
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('no page');}
const page=await getPage();const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});return r.result&&r.result.result?r.result.result.value:undefined;}
await send('Runtime.enable');
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(3000);
console.log('launch '+(await evl('DD.botLaunch(60,440)')));
for(let t=0;t<10;t++){
  await sleep(3000);
  const v=await evl(`JSON.stringify(DD.dummy.parts.map(function(b){return {part:b.plugin.part,x:Math.round(b.position.x),y:Math.round(b.position.y),sp:Math.round(Math.hypot(b.velocity.x,b.velocity.y)*100)/100,av:Math.round(b.angularVelocity*100)/100,sl:b.isSleeping};}))`);
  const s=await evl('JSON.stringify(DD.state())');
  let st={}; try{st=JSON.parse(s);}catch(e){}
  console.log('t+'+((t+1)*3)+'s maxSpeed='+st.maxSpeed+' allRest='+st.allRest+' parts='+v);
}
ws.close();process.exit(0);
