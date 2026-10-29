// K1 confirm: is (50,560) a reliable direct kill on L3's TOP pumpkin?
// 3 fresh single shots + 3 runs as shot 2 after the low shot (60,470).
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
const TOP="JSON.stringify((function(){var ps=Matter.Composite.allBodies(DD.world).filter(function(b){return b.plugin&&b.plugin.material==='pumpkin';}).map(function(b){return {x:Math.round(b.position.x),y:Math.round(b.position.y),hp:Math.round((b.plugin.health||0)*10)/10};});ps.sort(function(a,b){return a.y-b.y;});return ps;})())";
await send('Runtime.enable');
await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(2500);
let freshTopKills=0, shot2TopKills=0;
console.log('PART A: 3x fresh (50,560)');
for(let i=0;i<3;i++){
  await evl('DD.startLevel(3)');await sleep(1100);
  const before=JSON.parse(await evl(TOP)); const topY=before[0].y;
  await evl('DD.botLaunch(50,560)');
  const fin=await settled(45000);
  const after=JSON.parse(await evl(TOP));
  const topGone=!after.some(p=>Math.abs(p.y-topY)<15);
  if(topGone)freshTopKills++;
  console.log('A'+(i+1)+' phase='+fin.phase+' score='+fin.score+' alive='+fin.pumpkinsAlive+' topGone='+topGone+' after='+JSON.stringify(after));
}
console.log('PART B: 3x low (60,470) then (50,560) as shot 2');
for(let i=0;i<3;i++){
  await evl('DD.startLevel(3)');await sleep(1100);
  await evl('DD.botLaunch(60,470)');
  const mid=await settled(45000);
  const midList=JSON.parse(await evl(TOP)); const topY=midList[0]?midList[0].y:null;
  if(mid.phase==='won'){console.log('B'+(i+1)+' already won after low shot; counts as top resolved');shot2TopKills++;continue;}
  await evl('DD.botLaunch(50,560)');
  const fin=await settled(45000);
  const after=JSON.parse(await evl(TOP));
  const topGone=topY!==null&&!after.some(p=>Math.abs(p.y-topY)<15);
  if(topGone)shot2TopKills++;
  console.log('B'+(i+1)+' midAlive='+mid.pumpkinsAlive+' phase='+fin.phase+' score='+fin.score+' alive='+fin.pumpkinsAlive+' topGone='+topGone+' after='+JSON.stringify(after));
}
console.log('RESULT freshTopKills='+freshTopKills+'/3 shot2TopKills='+shot2TopKills+'/3');
ws.close();process.exit(0);
