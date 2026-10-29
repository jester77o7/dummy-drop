// Dummy Drop stage 4: PHYSICS HARDENING quality bar battery (bot measured).
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('page never appeared');}
const page=await getPage();
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();const exceptions=[];
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails;exceptions.push((d.exception&&d.exception.description)||d.text||'unknown');}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});if(!r.result)return{error:'no result'};if(r.result.exceptionDetails){const d=r.result.exceptionDetails;return{error:(d.exception&&d.exception.description)||d.text};}return{value:r.result.result?r.result.result.value:undefined};}
let pass=0,fail=0;
function report(name,ok,detail){console.log((ok?'PASS':'FAIL')+' | '+name+(detail?' | '+detail:''));ok?pass++:fail++;}
async function getState(){const r=await evl('JSON.stringify(DD.state())');try{return JSON.parse(r.value||'{}');}catch(e){return{};}}
async function getHealth(id){const r=await evl('JSON.stringify(DD.bodyHealth('+id+'))');try{return JSON.parse(r.value||'{}');}catch(e){return{};}}
async function reload(){await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(3000);return getState();}
async function pollHealth(id,ms,pred){let h={};const t0=Date.now();while(Date.now()-t0<ms){h=await getHealth(id);if(pred(h))return h;await sleep(100);}return h;}
async function waitRest(ms){let st={};const t0=Date.now();let sawMoving=false;while(Date.now()-t0<ms){st=await getState();if(st.maxBodySpeed>1)sawMoving=true;if(st.allRest)return{st,sawMoving};await sleep(250);}return{st,sawMoving};}
await send('Runtime.enable');await send('Page.enable').catch(()=>{});

// A. 30s no-touch stability
let st=await reload();
report('loads with hardening api',typeof st.stepAvgMs==='number'&&typeof st.allRest==='boolean','stepAvgMs='+st.stepAvgMs+' bodies='+st.bodyCount);
const baseChange=st.towerMaxChange;
console.log('INFO | stability waiting 30s, baseline towerMaxChange='+baseChange);
await sleep(30000);
st=await getState();
report('tower stands 30s no drift/lean/collapse',st.towerMaxChange<5,'towerMaxChange='+Math.round(st.towerMaxChange*100)/100+' errors='+(st.errors||[]).length);
report('no errors after 30s soak',Array.isArray(st.errors)&&st.errors.length===0,JSON.stringify(st.errors||[]));

// B+C+E. Identical repeat launches at full power + joint stretch + rest detection
const finals=[];
let peakStretch=0;
for(let run=0;run<2;run++){
  st=await reload();
  let r=await evl('DD.botLaunch(50,540)');
  report('repeat run'+(run+1)+' launch accepted',r.value===true,'ret='+r.value);
  let sawMoving=false;
  const t0=Date.now();
  while(Date.now()-t0<20000){
    st=await getState();
    if(st.maxBodySpeed>1)sawMoving=true;
    if(typeof st.maxJointStretchPx==='number')peakStretch=Math.max(peakStretch,st.maxJointStretchPx);
    if(st.allRest)break;
    await sleep(250);
  }
  report('repeat run'+(run+1)+' rest detection: moving seen then allRest after >=1s still',sawMoving&&st.allRest===true,'restSteps='+st.restSteps+' maxBodySpeed='+st.maxBodySpeed);
  finals.push({chestX:st.chest.x,chestY:st.chest.y,tower:st.towerMaxChange,score:st.score});
  console.log('INFO | repeat run'+(run+1)+' final='+JSON.stringify(finals[run]));
}
if(finals.length===2){
  const dx=Math.abs(finals[0].chestX-finals[1].chestX),dy=Math.abs(finals[0].chestY-finals[1].chestY);
  report('identical repeat launches (fixed timestep)',dx<30&&dy<30,'chestDiff dx='+Math.round(dx*10)/10+' dy='+Math.round(dy*10)/10);
}
report('joint stretch at full power within limit (<60px)',peakStretch>0&&peakStretch<60,'peakStretchPx='+Math.round(peakStretch*10)/10);

// D. Breakage calibration (scripted impacts, as stage 3)
st=await reload();
let r=await evl('JSON.stringify(DD.testImpact("glass",5))');let ids=JSON.parse(r.value||'{}');
let h=await pollHealth(ids.targetId,1500,x=>!x.exists);
report('calibration: glass breaks at speed 5',h.exists===false,'');
st=await reload();
r=await evl('JSON.stringify(DD.testImpact("wood",5))');ids=JSON.parse(r.value||'{}');
h=await pollHealth(ids.targetId,1500,x=>x.exists&&x.health!==null&&x.health<=13.5);
report('calibration: wood survives speed 5 (health ~13 of 18, item-3 pools)',h.exists===true&&h.health>9&&h.health<=13.5,'health='+h.health);
st=await reload();
r=await evl('JSON.stringify(DD.testImpact("wood",11))');ids=JSON.parse(r.value||'{}');
h=await pollHealth(ids.targetId,1500,x=>x.exists&&x.health!==null&&x.health<=9);
report('calibration: wood survives full-speed chest hit cracked (speed 11)',h.exists===true&&h.health>0&&h.health<=9,'health='+h.health);
st=await reload();
r=await evl('JSON.stringify(DD.testImpact("wood",19))');ids=JSON.parse(r.value||'{}');
h=await pollHealth(ids.targetId,1500,x=>!x.exists);
report('calibration: wood breaks at speed 19',h.exists===false,'');
st=await reload();
r=await evl('JSON.stringify(DD.testImpact("stone",12))');ids=JSON.parse(r.value||'{}');
h=await pollHealth(ids.targetId,1200,x=>x.exists&&x.health!==null&&x.health<60);
await sleep(2000);h=await getHealth(ids.targetId);
report('calibration: stone never breaks at speed 12 + ground fall',h.exists===true,'health='+h.health);

// F. Step time on largest structure (existing tower + 60-block grid)
st=await reload();
r=await evl('DD.spawnGrid(10,6)');
await sleep(5000);
st=await getState();
report('step time comfortable on largest structure',st.stepAvgMs<8&&st.stepMaxMs<33,'spawned='+r.value+' bodies='+st.bodyCount+' stepAvgMs='+st.stepAvgMs+' stepMaxMs='+st.stepMaxMs+' steps='+st.stepCount);
report('no errors across stage 4',Array.isArray(st.errors)&&st.errors.length===0,JSON.stringify(st.errors||[]));
report('no CDP exceptions across stage 4',exceptions.length===0,'exceptions='+exceptions.length+(exceptions[0]?' first='+exceptions[0]:''));
console.log('SUMMARY '+pass+'/'+(pass+fail)+' passed');
ws.close();process.exit(0);
