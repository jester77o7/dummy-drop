// Priority agenda item 2 probe (2026-10-29): dummy slide distance, measured
// PROPERLY (the 05:10-05:22 probe-wreck Part C used chest y>630 as touchdown,
// which is late - limbs are already dragging by then - and read the final
// chest AFTER the game respawned the dummy, so 19-20 px understates the glide).
// Method: fresh L1, remove all breakables in-page so the launch lands on OPEN
// GROUND (no tower contact contaminates the slide), flat-max (50,540) x3.
// An in-page sampler (10 ms) records: firstContact = first tick any dummy part
// bottom reaches GROUND_Y-1 (680) after launch, with chest x at that tick;
// then tracks chest x every tick until the dummy object is replaced (respawn
// at rest judgment) or speed stays <0.35 for 1 s. slide = lastChestX -
// firstContactChestX, like for like before/after any friction/density change.
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

const INSTALL = `(function(){
  // clear breakables so the flight lands on open ground
  var bs=Matter.Composite.allBodies(DD.world).filter(function(b){return b.plugin&&b.plugin.material;});
  for(var i=0;i<bs.length;i++)Matter.Composite.remove(DD.world,bs[i]);
  var orig=DD.dummy;
  window.__slide={orig:orig,contactX:null,contactPart:null,lastX:null,lastSpeed:null,done:false,reason:'',ticks:0,stillTicks:0,contactCentroid:null,lastCentroid:null,maxX:null};
  if(window.__slideTimer)clearInterval(window.__slideTimer);
  window.__slideTimer=setInterval(function(){
    var s=window.__slide; if(!s||s.done)return;
    if(DD.dummy!==s.orig){s.done=true;s.reason='respawned';clearInterval(window.__slideTimer);return;}
    var parts=DD.dummy.parts, chest=DD.dummy.chest;
    var maxBottom=-1e9, who='';
    for(var i=0;i<parts.length;i++){if(parts[i].bounds.max.y>maxBottom){maxBottom=parts[i].bounds.max.y;who=parts[i].plugin.part;}}
    var launched = chest.position.x>200 || Math.abs(chest.velocity.x)>0.5 || Math.abs(chest.velocity.y)>0.5;
    s.ticks++;
    var cen=0; for(var j=0;j<parts.length;j++)cen+=parts[j].position.x; cen/=parts.length;
    if(s.contactX===null){
      if(launched && maxBottom>=679){s.contactX=chest.position.x;s.contactPart=who;s.contactCentroid=cen;s.maxX=chest.position.x;}
    } else {
      s.lastX=chest.position.x; s.lastCentroid=cen; if(chest.position.x>s.maxX)s.maxX=chest.position.x;
      var sp=Math.hypot(chest.velocity.x,chest.velocity.y); s.lastSpeed=sp;
      if(sp<0.35){s.stillTicks++;}else{s.stillTicks=0;}
      if(s.stillTicks>=100){s.done=true;s.reason='rest';clearInterval(window.__slideTimer);}
    }
    if(s.ticks>3000){s.done=true;s.reason='timeout';clearInterval(window.__slideTimer);}
  },10);
  return 'sampler installed, cleared '+bs.length+' breakables';
})()`;

for(let run=1;run<=3;run++){
  await evl('DD.startLevel(1)');await sleep(1000);
  console.log('run '+run+' setup: '+(await evl(INSTALL)));
  const ok=await evl('DD.botLaunch(50,540)');
  let out=null;
  const t0=Date.now();
  while(Date.now()-t0<40000){
    const v=await evl(`(function(){var s=window.__slide;if(!s)return null;return JSON.stringify({done:s.done,reason:s.reason,contactX:s.contactX,contactPart:s.contactPart,lastX:s.lastX,slide:(s.contactX!==null&&s.lastX!==null)?Math.round(s.lastX-s.contactX):null,centroidSlide:(s.contactCentroid!==null&&s.lastCentroid!==null)?Math.round(s.lastCentroid-s.contactCentroid):null,maxSlide:(s.contactX!==null&&s.maxX!==null)?Math.round(s.maxX-s.contactX):null,ticks:s.ticks});})()`);
    try{out=JSON.parse(v||'null');}catch(e){out=null;}
    if(out&&out.done)break;
    await sleep(400);
  }
  console.log('SLIDE run '+run+': launchOk='+ok+' '+JSON.stringify(out));
}
ws.close();process.exit(0);
