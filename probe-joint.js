// Probe raw constraint points vs Matter.Vector.rotate world anchors (page already at rest).
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
await send('Runtime.enable');
const EXPR = `JSON.stringify([0,10,14].map(function(i){
  var c=DD.dummy.joints[i];
  var ra=Matter.Vector.rotate(c.pointA,c.bodyA.angle), rb=Matter.Vector.rotate(c.pointB,c.bodyB.angle);
  var A={x:c.bodyA.position.x+ra.x, y:c.bodyA.position.y+ra.y};
  var B={x:c.bodyB.position.x+rb.x, y:c.bodyB.position.y+rb.y};
  return {i:i, partA:c.bodyA.plugin.part, partB:c.bodyB.plugin.part,
    pointA:c.pointA, pointB:c.pointB, angleA:c.bodyA.angle, angleB:c.bodyB.angle,
    posA:c.bodyA.position, posB:c.bodyB.position,
    worldA:A, worldB:B, distViaRotate:Math.hypot(B.x-A.x,B.y-A.y), rest:DD.dummy.rest[i], len:c.length};
}))`;
let r = await evl(EXPR);
console.log(r.value || JSON.stringify(r));
ws.close(); process.exit(0);
