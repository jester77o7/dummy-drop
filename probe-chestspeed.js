// Item 3 probe (2026-10-29): what speed does the chest actually carry into
// the tower on real launches? In-page 10 ms sampler records max chest speed
// overall, max before chest x reaches 850 (tower face), and chest speed at
// the first tick any breakable loses health (first tower contact).
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage(){for(let i=0;i<30;i++){try{const list=await(await fetch('http://127.0.0.1:9222/json/list')).json();const page=list.find(t=>t.type==='page'&&t.url.includes('Dummy'));if(page)return page;}catch(e){}await sleep(500);}throw new Error('no page');}
const page=await getPage();const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let seq=0;const pending=new Map();
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
function send(method,params={}){return new Promise(res=>{const id=++seq;pending.set(id,res);ws.send(JSON.stringify({id,method,params}));});}
async function evl(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});if(r.result&&r.result.exceptionDetails)return 'ERR:'+((r.result.exceptionDetails.exception&&r.result.exceptionDetails.exception.description)||r.result.exceptionDetails.text);return r.result&&r.result.result?r.result.result.value:undefined;}
await send('Runtime.enable');
await send('Page.reload',{ignoreCache:true}).catch(()=>{});await sleep(2500);
const INSTALL=`(function(){
  if(window.__csTimer)clearInterval(window.__csTimer);
  var base={};
  Matter.Composite.allBodies(DD.world).forEach(function(b){if(b.plugin&&b.plugin.material)base[b.id]=b.plugin.health;});
  window.__cs={maxAll:0,maxPre850:0,firstHitSpeed:null,firstHitMat:null,ticks:0};
  window.__csTimer=setInterval(function(){
    var s=window.__cs;var c=DD.chest;if(!c)return;
    var sp=Math.hypot(c.velocity.x,c.velocity.y);s.ticks++;
    if(sp>s.maxAll)s.maxAll=sp;
    if(c.position.x<850&&sp>s.maxPre850)s.maxPre850=sp;
    if(s.firstHitSpeed===null){
      var bs=Matter.Composite.allBodies(DD.world);
      for(var i=0;i<bs.length;i++){var b=bs[i];if(b.plugin&&b.plugin.material&&base[b.id]!==undefined&&b.plugin.health<base[b.id]){s.firstHitSpeed=sp;s.firstHitMat=b.plugin.material;break;}}
    }
  },10);
  return 'sampler installed';
})()`;
const DRAGS=[[50,540],[60,470],[110,555],[50,560]];
for(const d of DRAGS){
  await evl('DD.startLevel(1)');await sleep(800);
  await evl(INSTALL);
  const ok=await evl('DD.botLaunch('+d[0]+','+d[1]+')');
  await sleep(6000);
  const v=await evl(`JSON.stringify({maxAll:Math.round(window.__cs.maxAll*100)/100,maxPre850:Math.round(window.__cs.maxPre850*100)/100,firstHitSpeed:window.__cs.firstHitSpeed===null?null:Math.round(window.__cs.firstHitSpeed*100)/100,firstHitMat:window.__cs.firstHitMat})`);
  const st=await evl('JSON.stringify(DD.state())');
  let s={};try{s=JSON.parse(st||'{}');}catch(e){}
  console.log('DRAG '+d.join(',')+' launchOk='+ok+' chest='+v+' score='+(s.score)+' blocksBroken='+(s.blocksBroken));
}
ws.close();process.exit(0);
