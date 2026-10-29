// Screenshot run: loads Dummy Drop on port 9223 (separate profile), flings the
// dummy with a strong up-arc pull, and captures flight, impact, and rest frames.
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
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
function send(method, params = {}) { return new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); }); }
async function evl(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (!r.result || r.result.exceptionDetails) return { value: undefined };
  return { value: r.result.result ? r.result.result.value : undefined };
}
async function getState() {
  const r = await evl('JSON.stringify(DD.state())');
  try { return JSON.parse(r.value || '{}'); } catch (e) { return {}; }
}
async function snap(name) {
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78 });
  if (r.result && r.result.data) {
    writeFileSync('C:/Users/ajest/Desktop/Dummy Drop/' + name, Buffer.from(r.result.data, 'base64'));
    console.log('saved', name);
  } else console.log('FAILED', name, JSON.stringify(r).slice(0, 200));
}
await send('Runtime.enable');
await send('Page.enable').catch(() => {});
await send('Page.reload', { ignoreCache: true }).catch(() => {});
await sleep(3000);
let st = await getState();
console.log('loaded chest=', JSON.stringify(st.chest || {}), 'errors=', JSON.stringify(st.errors || []));
await snap('shot-ready.jpg');
let r = await evl('DD.botLaunch(60,470)');
console.log('launch result', JSON.stringify(r));
let flightDone = false, impactDone = false;
for (let i = 0; i < 90; i++) {
  await sleep(60);
  st = await getState();
  const c = st.chest || {};
  const spd = Math.hypot(c.vx || 0, c.vy || 0);
  if (!flightDone && st.launched && c.x > 420 && c.y < 520 && spd > 4) { await snap('shot-flight.jpg'); flightDone = true; }
  if (!impactDone && flightDone && (c.x > 900 || (st.towerMaxChange || 0) > 40)) { await snap('shot-impact.jpg'); impactDone = true; }
  if (flightDone && impactDone) break;
}
console.log('flight', flightDone, 'impact', impactDone);
for (let i = 0; i < 40; i++) { await sleep(250); st = await getState(); if (st.allRest) break; }
await snap('shot-rest.jpg');
console.log('final state', JSON.stringify({ score: st.score, pumpkinsSquashed: st.pumpkinsSquashed, towerMaxChange: st.towerMaxChange, allRest: st.allRest }));
process.exit(0);
