// G1 probe part 2 (critique #2 fix list): can ANY single drag reach L1's
// shelter posts (thin glass 16x80 at x968/1112, y 601-681) on the CURRENT
// pre-settle build? probe-g1 showed the test sequence sails OVER the shelter
// and never touches the posts (health 3/3, bit-identical). This probe tries
// low / downward trajectories one fresh shot at a time: pulls ABOVE the
// anchor (180,540) launch the dummy DOWNWARD toward the shelter line.
// Per candidate: fresh L1, one botLaunch, wait for settle, dump the shelter
// posts, the heavy beam (wood 264x26), the pumpkin, score and chest end.
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
const FOCUS="JSON.stringify((function(){var all=Matter.Composite.allBodies(DD.world).filter(function(b){return b.plugin&&b.plugin.material;});function pick(f){var a=all.filter(f);return a.map(function(b){return {mat:b.plugin.material,x:Math.round(b.position.x),y:Math.round(b.position.y),hp:Math.round((b.plugin.health||0)*10)/10,crush:b.plugin.crush||0,w:b.plugin.w||0,h:b.plugin.h||0};});}return {posts:pick(function(b){return b.plugin.w===16;}),beam:pick(function(b){return b.plugin.w===264;}),pumpkin:pick(function(b){return b.plugin.material==='pumpkin';}),nBreak:all.length};})())";
await send('Runtime.enable');
await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(2500);
const CANDS=[[50,540],[60,470],[80,470],[50,480],[100,480],[90,440],[110,500],[40,500]];
for(let i=0;i<CANDS.length;i++){
  const c=CANDS[i];
  await evl('DD.startLevel(1)');await sleep(1000);
  const before=await evl(FOCUS);
  const ok=await evl('DD.botLaunch('+c[0]+','+c[1]+')');
  // sample the flight: track lowest chest y and max chest x while flying
  let maxX=-1,minY=9999;const t0=Date.now();
  let st={};
  while(Date.now()-t0<8000){
    st=await getState();
    if(st.chest){maxX=Math.max(maxX,st.chest.x);minY=Math.min(minY,st.chest.y);}
    if(st.phase!=='flying'&&st.launched===false)break;
    await sleep(200);
    if(st.phase==='flying')break;
  }
  const fin=await settled(45000);
  // resample chest extremes from final state only as endpoint
  console.log('CAND drag='+c.join(',')+' accepted='+ok+' phase='+fin.phase+' score='+fin.score+' alive='+fin.pumpkinsAlive+' broken='+fin.blocksBroken+' chestEnd='+Math.round(fin.chest?fin.chest.x:-1)+','+Math.round(fin.chest?fin.chest.y:-1));
  console.log('  before: '+before);
  console.log('  after : '+(await evl(FOCUS)));
}
ws.close();process.exit(0);
