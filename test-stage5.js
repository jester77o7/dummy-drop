// Dummy Drop stage 5: GAME FLOW.
// PASS from plan: scripted play clears level 1 both ways (win + lose), UI states correct.
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
async function reload(){await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(3000);return getState();}
async function waitPhase(want,ms){let st={};const t0=Date.now();while(Date.now()-t0<ms){st=await getState();if(st.phase===want)return st;await sleep(300);}return st;}
async function waitSettled(want,ms){ // wait until the launch is judged: flying first, then the target phase
  let st=await waitPhase('flying',6000);
  return waitPhase(want,ms);
}
async function hudText(){const r=await evl("document.getElementById('hud-info').textContent");return r.value||'';}
async function overlayShown(){const r=await evl("document.getElementById('overlay').style.display");return r.value;}
await send('Runtime.enable');await send('Page.enable').catch(()=>{});

// Start state
let st=await reload();
report('starts ready with 5 dummies on level 1',st.phase==='ready'&&st.dummiesLeft===5&&st.level===1,JSON.stringify({phase:st.phase,dummiesLeft:st.dummiesLeft,level:st.level}));
let hud=await hudText();
report('HUD shows dummy counter',/Dummies: 5/.test(hud),hud);
report('overlay hidden at start',(await overlayShown())==='none','');

// WIN path: squash the pumpkin via the game's own damage rules, launch, rest -> won
let r=await evl('DD.testSquashPumpkins()');
report('scripted squash hits the level pumpkin',r.value===1,'n='+r.value);
await sleep(600);
st=await getState();
report('pumpkin gone after squash',st.pumpkinsAlive===0&&st.pumpkinsSquashed>=1,'alive='+st.pumpkinsAlive+' squashed='+st.pumpkinsSquashed);
r=await evl('DD.botLaunch(175,552)');
report('win-path launch accepted',r.value===true,'ret='+r.value);
st=await waitSettled('won',40000);
report('win judged at rest when all pumpkins destroyed',st.phase==='won','phase='+st.phase+' allRest='+st.allRest);
report('stars awarded on win (1-3)',st.stars>=1&&st.stars<=3,'stars='+st.stars);
report('win overlay shown',(await overlayShown())==='block','');
let nextVisible=await evl("document.getElementById('btn-next').style.display");
report('next level button visible on win',nextVisible.value==='inline-block','display='+nextVisible.value);

// Next level button: resets to a fresh ready level
await evl("document.getElementById('btn-next').click()");
await sleep(1200);
st=await getState();
report('next level button starts a fresh level',st.phase==='ready'&&st.dummiesLeft===5&&st.pumpkinsAlive===2&&st.level===2,JSON.stringify({phase:st.phase,dummiesLeft:st.dummiesLeft,alive:st.pumpkinsAlive,level:st.level})); // Stage 6: level 2 has 2 pumpkins (was 1 in the single-tower build)

// LOSE path: 5 weak launches, pumpkin survives, dummies run out -> lost
st=await reload();
for(let i=1;i<=5;i++){
  r=await evl('DD.botLaunch(175,552)');
  if(r.value!==true){report('lose-path launch '+i+' accepted',false,'ret='+r.value);break;}
  const want=(i<5)?'ready':'lost';
  st=await waitSettled(want,40000);
  report('lose-path after launch '+i+' phase='+want,st.phase===want,'phase='+st.phase+' dummiesLeft='+st.dummiesLeft);
  if(st.phase!==want)break;
}
report('lose overlay shown',(await overlayShown())==='block','');
hud=await hudText();
report('HUD counter at zero on lose',/Dummies: 0/.test(hud),hud);

// Retry button: back to ready with 5 dummies and the pumpkin back
await evl("document.getElementById('btn-retry').click()");
await sleep(1200);
st=await getState();
report('retry restores ready level (5 dummies, pumpkin back, score 0)',st.phase==='ready'&&st.dummiesLeft===5&&st.pumpkinsAlive===1&&st.score===0,JSON.stringify({phase:st.phase,dummiesLeft:st.dummiesLeft,alive:st.pumpkinsAlive,score:st.score}));
report('no errors across stage 5',Array.isArray(st.errors)&&st.errors.length===0,JSON.stringify(st.errors||[]));
report('no CDP exceptions across stage 5',exceptions.length===0,'exceptions='+exceptions.length+(exceptions[0]?' first='+exceptions[0]:''));
console.log('SUMMARY '+pass+'/'+(pass+fail)+' passed');
ws.close();process.exit(0);
