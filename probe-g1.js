// G1 probe (critique #2): L1 wreck after each shot of the test-stage6 sequence
// on the CURRENT pre-settle build. Where does the beam land, where does the
// pumpkin sit, what health/crush does it actually see?
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('no page');}
const page=await getPage();const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});return r.result&&r.result.result?r.result.result.value:undefined;}
async function getState(){const v=await evl('JSON.stringify(DD.state())');try{return JSON.parse(v||'{}');}catch(e){return{};}}
async function settled(ms){let st={};const t0=Date.now();let sawFly=false;while(Date.now()-t0<ms){st=await getState();if(st.phase==='flying')sawFly=true;if(sawFly&&st.phase!=='flying')return st;await sleep(300);}return st;}
const DUMP="JSON.stringify(Matter.Composite.allBodies(DD.world).filter(b=>b.plugin&&b.plugin.material).map(b=>({mat:b.plugin.material,x:Math.round(b.position.x),y:Math.round(b.position.y),a:Math.round(b.angle*100)/100,hp:Math.round((b.plugin.health||0)*10)/10,crush:b.plugin.crush||0,w:b.plugin.w||0,h:b.plugin.h||0,m:Math.round(b.mass*100)/100})))";
await send('Runtime.enable');
await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(2500);
await evl('DD.startLevel(1)');await sleep(1200);
console.log('START wreck: '+(await evl(DUMP)));
const DRAGS=[[50,540],[60,560],[80,620],[50,540],[110,555]];
for(let i=0;i<DRAGS.length;i++){
  const c=DRAGS[i];
  const ok=await evl('DD.botLaunch('+c[0]+','+c[1]+')');
  const st=await settled(45000);
  console.log('SHOT '+(i+1)+' drag='+c.join(',')+' accepted='+ok+' phase='+st.phase+' score='+st.score+' alive='+st.pumpkinsAlive+' blocksBroken='+st.blocksBroken);
  console.log('  wreck: '+(await evl(DUMP)));
  if(st.phase==='won'||st.phase==='lost')break;
}
ws.close();process.exit(0);
