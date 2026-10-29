// Level select smoke test (Stage 7)
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('page never appeared');}
const page=await getPage();
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();const exceptions=[];
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails;exceptions.push((d.exception&&d.exception.description)||d.text||'unknown');}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});if(r.result&&r.result.exceptionDetails){const d=r.result.exceptionDetails;return{error:(d.exception&&d.exception.description)||d.text};}return{value:r.result&&r.result.result?r.result.result.value:undefined};}
let pass=0,fail=0;
function report(name,ok,detail){console.log((ok?'PASS':'FAIL')+' | '+name+(detail?' | '+detail:''));ok?pass++:fail++;}
async function getState(){const r=await evl('JSON.stringify(DD.state())');try{return JSON.parse(r.value||'{}');}catch(e){return{};}}
await send('Runtime.enable');await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(3000);
let st=await getState();
report('starts on level 1 ready',st.level===1&&st.phase==='ready',JSON.stringify({level:st.level,phase:st.phase}));
let active=await evl("document.getElementById('btn-lvl-1').className");
report('level 1 button active at start',/active/.test(active.value||''),'class='+active.value);
await evl("document.getElementById('btn-lvl-3').click()");await sleep(1500);
st=await getState();
report('click Level 3 loads keep with 3 pumpkins',st.level===3&&st.phase==='ready'&&st.pumpkinsAlive===3&&st.dummiesLeft===5,JSON.stringify({level:st.level,phase:st.phase,alive:st.pumpkinsAlive,dummies:st.dummiesLeft}));
active=await evl("document.getElementById('btn-lvl-3').className");
report('level 3 button active after click',/active/.test(active.value||''),'class='+active.value);
await evl("document.getElementById('btn-lvl-2').click()");await sleep(1500);
st=await getState();
report('click Level 2 loads fort with 2 pumpkins',st.level===2&&st.pumpkinsAlive===2,JSON.stringify({level:st.level,alive:st.pumpkinsAlive}));
report('no errors',Array.isArray(st.errors)&&st.errors.length===0,JSON.stringify(st.errors||[]));
report('no CDP exceptions',exceptions.length===0,'n='+exceptions.length);
console.log('SUMMARY '+pass+'/'+(pass+fail)+' passed');
ws.close();process.exit(0);
