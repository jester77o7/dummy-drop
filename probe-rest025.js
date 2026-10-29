// Probe: after a flat-max launch, which bodies keep rest detection from firing?
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('page never appeared');}
const page=await getPage();
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});if(!r.result)return{error:'no result'};if(r.result.exceptionDetails){const d=r.result.exceptionDetails;return{error:(d.exception&&d.exception.description)||d.text};}return{value:r.result.result?r.result.result.value:undefined};}
await send('Runtime.enable');await send('Page.enable').catch(()=>{});
await send('Page.reload',{ignoreCache:true}).catch(()=>{});
await sleep(3000);
let r=await evl('DD.botLaunch(50,540)');
console.log('botLaunch ret='+r.value);
await sleep(10000);
const expr=`JSON.stringify((function(){var bs=Matter.Composite.allBodies(DD.world);var out=[];for(var i=0;i<bs.length;i++){var b=bs[i];if(b.isStatic)continue;var sp=Math.hypot(b.velocity.x,b.velocity.y);if(sp>=0.1||Math.abs(b.angularVelocity)>=0.02||!b.isSleeping){out.push({label:b.label,part:(b.plugin&&b.plugin.part)||(b.plugin&&b.plugin.material)||'',id:b.id,x:Math.round(b.position.x),y:Math.round(b.position.y),speed:Math.round(sp*1000)/1000,angVel:Math.round(b.angularVelocity*1000)/1000,sleeping:b.isSleeping});}}return {rest:DD.restInfo(),movers:out};})())`;
r=await evl(expr);
console.log(r.error||r.value);
ws.close();process.exit(0);
