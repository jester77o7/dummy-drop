// Probe: per-joint anchor distances at hang (no launch) and after one flat launch.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage() {
  for (let i = 0; i < 30; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
      const page = list.find(t => t.type === 'page' && t.url.includes('Dummy'));
      if (page) return page;
    } catch (e) {}
    await sleep(500);
  }
  throw new Error('page never appeared');
}
const page = await getPage();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
let seq = 0; const pending = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
function send(method, params = {}) { return new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); }); }
async function evl(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.result && r.result.exceptionDetails) { const d = r.result.exceptionDetails; return { error: (d.exception && d.exception.description) || d.text }; }
  return { value: r.result && r.result.result ? r.result.result.value : undefined };
}
const EXPR = `JSON.stringify(DD.dummy.joints.map(function(c,i){
  function wp(b,p){var ca=Math.cos(b.angle),sa=Math.sin(b.angle);return {x:b.position.x+p.x*ca-p.y*sa, y:b.position.y+p.x*sa+p.y*ca};}
  var A=wp(c.bodyA,c.pointA), B=wp(c.bodyB,c.pointB);
  return {i:i, a:c.bodyA.plugin.part, b:c.bodyB.plugin.part, stiff:c.stiffness, len:c.length,
    dist:Math.round(Math.hypot(B.x-A.x,B.y-A.y)*10)/10, rest:Math.round(DD.dummy.rest[i]*10)/10,
    aPos:[Math.round(c.bodyA.position.x),Math.round(c.bodyA.position.y),Math.round(c.bodyA.angle*100)/100],
    bPos:[Math.round(c.bodyB.position.x),Math.round(c.bodyB.position.y),Math.round(c.bodyB.angle*100)/100]};
}))`;
await send('Runtime.enable');
await send('Page.enable').catch(() => {});
await send('Page.reload', { ignoreCache: true }).catch(() => {});
await sleep(3500);
let r = await evl(EXPR);
console.log('AT HANG (no launch):');
console.log(r.value || JSON.stringify(r));
r = await evl('DD.botLaunch(50,540)');
console.log('botLaunch ret=' + r.value);
await sleep(700);
r = await evl(EXPR);
console.log('MID-FLIGHT ~0.7s:'); console.log(r.value || JSON.stringify(r));
await sleep(5000);
r = await evl(EXPR);
console.log('AT REST after launch:'); console.log(r.value || JSON.stringify(r));
r = await evl('JSON.stringify(DD.state())');
console.log('STATE: ' + (r.value || JSON.stringify(r)));
ws.close(); process.exit(0);
