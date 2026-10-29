// J1/H4: downward-pull drag screenshot - judge aim guide readability for the low kill shot.
// Holds a real mouse drag (CDP Input) at the probe-proven low pull (60,470) and screenshots mid-drag.
import { writeFileSync } from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage() {
  for (let i = 0; i < 30; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
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
async function evl(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.result && r.result.exceptionDetails) console.log('EVAL EXC', JSON.stringify(r.result.exceptionDetails).slice(0,300)); return r.result && r.result.result ? r.result.result.value : undefined; }
async function snap(name) {
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  if (r.result && r.result.data) { writeFileSync('C:/Users/ajest/Desktop/Dummy Drop/' + name, Buffer.from(r.result.data, 'base64')); console.log('saved', name); }
  else console.log('FAILED', name);
}
await send('Runtime.enable'); await send('Page.enable'); await send('Input.enable').catch(()=>{});
await send('Page.reload', { ignoreCache: true }).catch(() => {});
await sleep(3000);
const rectJson = await evl("JSON.stringify(document.getElementById('game').getBoundingClientRect())");
const rect = JSON.parse(rectJson);
console.log('rect', rectJson);
const toClient = (gx, gy) => ({ x: rect.left + gx * rect.width / 1280, y: rect.top + gy * rect.height / 720 });
// press on the chest at the anchor (180,540 game)
let p = toClient(180, 540);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 1 });
await sleep(200);
// move in steps to the low downward-launch pull (60,470 game) - pull ABOVE anchor
for (const [gx, gy] of [[150,520],[120,500],[90,485],[60,470]]) {
  p = toClient(gx, gy);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1 });
  await sleep(120);
}
await sleep(400);
const st = await evl('JSON.stringify(DD.state())');
console.log('state during drag', (st||'').slice(0,300));
await snap('shot-drag-down.jpg');
// also a normal flat pull for comparison
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', buttons: 0, clickCount: 1 });
await sleep(500);
await evl("DD.startLevel(1); 'ok'");
await sleep(1500);
p = toClient(180, 540);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 1 });
await sleep(200);
for (const [gx, gy] of [[140,540],[100,540],[50,540]]) {
  p = toClient(gx, gy);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1 });
  await sleep(120);
}
await sleep(400);
await snap('shot-drag-flat.jpg');
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', buttons: 0, clickCount: 1 });
console.log('done');
process.exit(0);
