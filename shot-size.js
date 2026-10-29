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
async function evl(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (!r.result || r.result.exceptionDetails) return { value: undefined }; return { value: r.result.result ? r.result.result.value : undefined }; }
await send('Runtime.enable'); await send('Page.enable').catch(() => {});
await send('Page.reload', { ignoreCache: true }).catch(() => {});
await sleep(3500);
const partsR = await evl('JSON.stringify(Object.values(DD.dummy && DD.dummy.parts ? DD.dummy.parts : {}).map(p=>({x:p.position.x,y:p.position.y})))');
let span = 'unknown';
try { const pts = JSON.parse(partsR.value || '[]'); if (pts.length) { const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y); span = 'parts=' + pts.length + ' spanX=' + (Math.max(...xs)-Math.min(...xs)).toFixed(0) + ' spanY=' + (Math.max(...ys)-Math.min(...ys)).toFixed(0); } } catch (e) {}
console.log('dummy', span);
const stR = await evl('JSON.stringify(DD.state())');
console.log('state', (stR.value || '').slice(0, 300));
const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78 });
if (r.result && r.result.data) { writeFileSync('C:/Users/ajest/Desktop/Dummy Drop/shot-size.jpg', Buffer.from(r.result.data, 'base64')); console.log('saved shot-size.jpg'); }
process.exit(0);
