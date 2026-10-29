// Priority agenda item 1 probe (2026-10-29 05:00): why do tower pieces FLOAT
// after supports are destroyed? Plus item 2 baseline: dummy slide distance.
// Part A (synthetic, decisive): stack 3 wood blocks, let them sleep, remove
// the BOTTOM block exactly as the game's breakage does (Composite.remove),
// then watch whether the upper blocks fall or stay suspended, and whether
// they are sleeping.
// Part B (natural wreck): play L1 with the proven drag sequence; after each
// settled shot, list every breakable with EMPTY SPACE beneath it (bottom
// above ground, no other body top within 8 px under overlapping x, speed
// low) and its sleeping flag.
// Part C (slide baseline): flat-max launch on fresh L1 x3; touchdown = first
// sample chest y>630; slide = final rest chest x - touchdown x.
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
await send('Runtime.enable');
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(2500);

// ---------- Part A: synthetic sleeping-stack removal ----------
await evl('DD.startLevel(1)');await sleep(800);
const stackSetup = await evl(`(function(){
  var ids=[];
  ids.push(DD.spawnBlockAt('wood',600,660,40,40));
  ids.push(DD.spawnBlockAt('wood',600,620,40,40));
  ids.push(DD.spawnBlockAt('wood',600,580,40,40));
  return JSON.stringify(ids);
})()`);
console.log('A setup block ids: '+stackSetup);
await sleep(4000); // let them sleep (sleepThreshold 60 steps ~1s of stillness)
const aBefore = await evl(`(function(){
  var bs=Matter.Composite.allBodies(DD.world).filter(b=>b.position.x>560&&b.position.x<640&&b.plugin&&b.plugin.material==='wood');
  return JSON.stringify(bs.map(b=>({id:b.id,y:Math.round(b.position.y),sleeping:b.isSleeping,sleepCounter:b.sleepCounter,speed:Math.round(b.speed*100)/100})));
})()`);
console.log('A before removal (bottom y=660 first): '+aBefore);
const aRemoved = await evl(`(function(){
  var bs=Matter.Composite.allBodies(DD.world).filter(b=>b.position.x>560&&b.position.x<640&&b.plugin&&b.plugin.material==='wood');
  bs.sort((a,b)=>b.position.y-a.position.y);
  var bottom=bs[0];
  Matter.Composite.remove(DD.world,bottom);
  return 'removed bottom id '+bottom.id+' y='+Math.round(bottom.position.y);
})()`);
console.log('A '+aRemoved);
for(const wait of [500,1500,3000]){
  await sleep(wait===500?500:(wait===1500?1000:1500));
  const aNow = await evl(`(function(){
    var bs=Matter.Composite.allBodies(DD.world).filter(b=>b.position.x>560&&b.position.x<640&&b.plugin&&b.plugin.material==='wood');
    return JSON.stringify(bs.map(b=>({id:b.id,y:Math.round(b.position.y),sleeping:b.isSleeping,speed:Math.round(b.speed*100)/100})));
  })()`);
  console.log('A after +'+wait+'ms: '+aNow);
}

// ---------- Part B: natural L1 wreck, float scan after each shot ----------
const FLOATSCAN = `(function(){
  var all=Matter.Composite.allBodies(DD.world).filter(b=>!b.isStatic);
  var out=[];
  for(var i=0;i<all.length;i++){
    var b=all[i];
    if(!(b.plugin&&b.plugin.material))continue;
    var bottom=b.bounds.max.y;
    if(bottom>672)continue; // resting on/near ground (GROUND_Y=680)
    var supported=false;
    for(var j=0;j<all.length;j++){
      if(all[j]===b)continue;
      var o=all[j];
      var gap=bottom-o.bounds.min.y; // wait: support top is ABOVE? support top = o.bounds.min.y, gap = o.top - b.bottom... computed below properly
    }
    // proper: support if o.bounds.min.y is just below b.bounds.max.y (within -4..10) and x ranges overlap
    for(var k=0;k<all.length;k++){
      if(all[k]===b)continue;
      var s=all[k];
      var g=s.bounds.min.y-b.bounds.max.y;
      var xover=Math.min(b.bounds.max.x,s.bounds.max.x)-Math.max(b.bounds.min.x,s.bounds.min.x);
      if(g>=-6&&g<=10&&xover>4){supported=true;break;}
    }
    if(!supported)out.push({mat:b.plugin.material,x:Math.round(b.position.x),y:Math.round(b.position.y),bottom:Math.round(bottom),sleeping:b.isSleeping,speed:Math.round(b.speed*100)/100,angle:Math.round(b.angle*100)/100});
  }
  return JSON.stringify(out);
})()`;
await evl('DD.startLevel(1)');await sleep(1200);
console.log('B start floaters: '+(await evl(FLOATSCAN)));
const DRAGS=[[60,470],[50,540],[60,560],[80,620],[110,555]];
for(let i=0;i<DRAGS.length;i++){
  const c=DRAGS[i];
  const ok=await evl('DD.botLaunch('+c[0]+','+c[1]+')');
  const st=await settled(45000);
  await sleep(1500); // extra settle so sleeping state is final
  console.log('B SHOT '+(i+1)+' drag='+c.join(',')+' ok='+ok+' phase='+st.phase+' score='+st.score+' alive='+st.pumpkinsAlive);
  console.log('B floaters after shot '+(i+1)+': '+(await evl(FLOATSCAN)));
  if(st.phase==='won'||st.phase==='lost')break;
}

// ---------- Part C: slide baseline, flat-max (50,540) x3 ----------
for(let run=1;run<=3;run++){
  await evl('DD.startLevel(1)');await sleep(1000);
  await evl('DD.botLaunch(50,540)');
  let touchdown=null,last=null;const t0=Date.now();
  while(Date.now()-t0<30000){
    const st=await getState();
    last=st;
    if(touchdown===null&&st.launched&&st.chest.y>630)touchdown=st.chest.x;
    if(st.phase!=='flying'&&st.launched)break;
    await sleep(100);
  }
  await sleep(500);
  const fin=await getState();
  console.log('C run '+run+': touchdownX='+(touchdown===null?'none':Math.round(touchdown))+' finalChestX='+Math.round(fin.chest.x)+' slidePx='+(touchdown===null?'n/a':Math.round(fin.chest.x-touchdown))+' phase='+fin.phase);
}
ws.close();process.exit(0);
