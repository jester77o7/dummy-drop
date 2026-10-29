const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('no page');}
const page=await getPage();const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});return r.result&&r.result.result?r.result.result.value:undefined;}
await send('Runtime.enable');
const snap0=await evl('DD.startLevel(3); JSON.stringify(DD.tower.map(function(b,i){return {i:i,mat:b.plugin.material,w:b.plugin.w,h:b.plugin.h,x:b.position.x,y:b.position.y,a:b.angle};}))');
const s0=JSON.parse(snap0);
console.log('bodies='+s0.length);
for(const t of [0.5,1,2,5,10]){
  await sleep(t===0.5?500:(t===1?500:(t===2?1000:3000)));
  const snap=await evl('JSON.stringify(DD.tower.map(function(b,i){return {i:i,x:b.position.x,y:b.position.y,a:b.angle};}))');
  const s=JSON.parse(snap);
  const rows=s.map((b,i)=>({i:b.i,mat:s0[i].mat,w:s0[i].w,h:s0[i].h,dx:+(b.x-s0[i].x).toFixed(2),dy:+(b.y-s0[i].y).toFixed(2),da:+(b.a-s0[i].a).toFixed(3),d:+Math.hypot(b.x-s0[i].x,b.y-s0[i].y).toFixed(2)})).sort((a,b)=>b.d-a.d);
  console.log('t~'+t+'s top movers: '+JSON.stringify(rows.slice(0,5)));
  if(t===2)console.log('ALL: '+JSON.stringify(rows.slice().sort((a,b)=>a.i-b.i)));
}
ws.close();process.exit(0);
