// K1 probe part 2 (critique #5): which single trajectories reach L3's TOP
// pumpkin shelter (pumpkin centre ~1040,438, between glass posts 970/1110
// spanning y 392-462, sitting on the stone beam top y=462)?
// probe-l3survive found: low shot (60,470) kills ground+mid in 1, then
// (50,540) and (80,620) never touch the top pumpkin (bit-identical, hp 4/4);
// only (60,560) as shot 4 killed it, by direct flight into its shelter.
// This probe tries candidates ONE fresh L3 at a time, and also in the real
// play pattern: low shot first (clears ground+mid), then ONE candidate as
// shot 2 aimed at the top. Reports top pumpkin hp/position/gone per shot.
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
const TOP="JSON.stringify((function(){var ps=Matter.Composite.allBodies(DD.world).filter(function(b){return b.plugin&&b.plugin.material==='pumpkin';}).map(function(b){return {x:Math.round(b.position.x),y:Math.round(b.position.y),hp:Math.round((b.plugin.health||0)*10)/10,crush:b.plugin.crush||0};});ps.sort(function(a,b){return a.y-b.y;});return ps;})())";
await send('Runtime.enable');
await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(2500);
// Part A: single fresh shots aimed at the top shelter
const CANDS=[[60,560],[60,560],[50,560],[70,570],[60,580],[50,580],[80,600],[40,540],[90,580]];
console.log('PART A single fresh-L3 shots (pumpkins listed top-first by y):');
for(let i=0;i<CANDS.length;i++){
  const c=CANDS[i];
  await evl('DD.startLevel(3)');await sleep(1100);
  const before=await evl(TOP);
  const ok=await evl('DD.botLaunch('+c[0]+','+c[1]+')');
  const fin=await settled(45000);
  const after=await evl(TOP);
  console.log('A drag='+c.join(',')+' ok='+ok+' phase='+fin.phase+' score='+fin.score+' alive='+fin.pumpkinsAlive+' broken='+fin.blocksBroken);
  console.log('  before(top-first): '+before);
  console.log('  after (top-first): '+after);
}
// Part B: real pattern - low shot (60,470) clears ground+mid, then candidate as shot 2
const CANDS2=[[60,560],[60,580],[50,560]];
console.log('PART B low-shot first, then candidate as shot 2:');
for(let i=0;i<CANDS2.length;i++){
  const c=CANDS2[i];
  await evl('DD.startLevel(3)');await sleep(1100);
  await evl('DD.botLaunch(60,470)');
  const mid=await settled(45000);
  console.log('B pre drag=60,470 phase='+mid.phase+' score='+mid.score+' alive='+mid.pumpkinsAlive+' top-list: '+(await evl(TOP)));
  if(mid.phase==='won'||mid.phase==='lost'){console.log('  B cand='+c.join(',')+' SKIPPED (already '+mid.phase+')');continue;}
  const ok=await evl('DD.botLaunch('+c[0]+','+c[1]+')');
  const fin=await settled(45000);
  console.log('  B cand='+c.join(',')+' ok='+ok+' phase='+fin.phase+' score='+fin.score+' alive='+fin.pumpkinsAlive+' broken='+fin.blocksBroken+' top-list: '+(await evl(TOP)));
}
ws.close();process.exit(0);
