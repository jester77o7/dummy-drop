// Improvement #4 test: extended aim guide (drawing only).
// Runs against the SHOT chrome (port 9223, 1320x940 window): the 9222 test
// chrome has no window-size (800x600 default), so the canvas bottom falls
// outside the viewport and CDP mouse drags at game y~470-540 never land -
// the same reason shot-drag.js uses 9223. Drag-hold is proven here; the
// physics regressions still run on 9222.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9223/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('page never appeared');}
const page=await getPage();
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();const exceptions=[];
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails;exceptions.push((d.exception&&d.exception.description)||d.text||'unknown');}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});if(r.result&&r.result.exceptionDetails){const d=r.result.exceptionDetails;return{error:(d.exception&&d.exception.description)||d.text};}return{value:r.result&&r.result.result?r.result.result.value:undefined};}
let pass=0,fail=0;
function report(name,ok,detail){console.log((ok?'PASS':'FAIL')+' | '+name+(detail?' | '+detail:''));ok?pass++:fail++;}
await send('Runtime.enable');await send('Page.enable').catch(()=>{});await send('Input.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(3000);
let ai={};{const r=await evl('JSON.stringify(DD.aimInfo())');try{ai=JSON.parse(r.value||'{}');}catch(e){}}
report('aimInfo present',typeof ai.span==='number',JSON.stringify(ai));
report('aim trail spans at least 2.5 drag vectors',ai.span>=2.5,'span='+ai.span);
report('aim trail has at least 12 dots',ai.dots>=12,'dots='+ai.dots);
// Real CDP drag to the proven low pull (60,470): dummy must be held, not launched.
const rectJson=(await evl("JSON.stringify(document.getElementById('game').getBoundingClientRect())")).value;
const rect=JSON.parse(rectJson);
const toClient=(gx,gy)=>({x:rect.left+gx*rect.width/1280,y:rect.top+gy*rect.height/720});
let p=toClient(180,540);
await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});
await sleep(200);
for(const [gx,gy] of [[150,520],[120,500],[90,485],[60,470]]){p=toClient(gx,gy);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y,button:'left',buttons:1});await sleep(120);}
await sleep(300);
let st={};{const r=await evl('JSON.stringify(DD.state())');try{st=JSON.parse(r.value||'{}');}catch(e){}}
report('drag holds dummy near low pull, not launched',st.launched===false&&st.chest&&Math.abs(st.chest.x-60)<8&&Math.abs(st.chest.y-470)<8,JSON.stringify(st.chest||{})+' launched='+st.launched);
await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',buttons:0,clickCount:1});
await sleep(500);
report('zero page errors',Array.isArray(st.errors)&&st.errors.length===0,JSON.stringify(st.errors||[]));
report('no CDP exceptions',exceptions.length===0,'n='+exceptions.length);
console.log('SUMMARY '+pass+'/'+(pass+fail)+' passed');
ws.close();process.exit(0);
