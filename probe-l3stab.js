const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('no page');}
const page=await getPage();const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});return r.result&&r.result.result?r.result.result.value:undefined;}
async function getState(){const v=await evl('JSON.stringify(DD.state())');try{return JSON.parse(v||'{}');}catch(e){return{};}}
await send('Runtime.enable');
await evl('DD.startLevel(3)');
for(const t of [5,10,20,30,45]){await sleep(t===5?5000: (t===10?5000:(t===20?10000:(t===30?10000:15000))));const st=await getState();console.log('t='+t+'s maxChange='+st.towerMaxChange+' alive='+st.pumpkinsAlive+' phase='+st.phase+' top='+JSON.stringify(st.top));}
ws.close();process.exit(0);
