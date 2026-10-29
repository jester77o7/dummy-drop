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
await send('Runtime.enable');
await evl('DD.startLevel(1)');await sleep(3000);
await evl('DD.botLaunch(50,540)');
let st=await waitPhase('ready',45000);
console.log('after launch1 phase='+st.phase+' score='+st.score+' alive='+st.pumpkinsAlive);
let dump=await evl("JSON.stringify(Matter.Composite.allBodies(DD.world).filter(b=>b.plugin&&b.plugin.material).map(b=>({mat:b.plugin.material,x:Math.round(b.position.x),y:Math.round(b.position.y),a:Math.round(b.angle*100)/100,hp:Math.round(b.plugin.health*10)/10,w:b.plugin.w,h:b.plugin.h})))");
console.log('wreck: '+dump);
let chest=await evl("JSON.stringify({x:Math.round(DD.chest.position.x),y:Math.round(DD.chest.position.y)})");
console.log('chest rest: '+chest);
ws.close();process.exit(0);
