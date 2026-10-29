// G2/F3: screenshots of all 3 enlarged levels at rest, for Muse visual inspection.
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
async function evl(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.result && r.result.exceptionDetails) console.log('EVAL EXC', JSON.stringify(r.result.exceptionDetails).slice(0,300)); return { value: r.result && r.result.result ? r.result.result.value : undefined }; }
async function snap(name) {
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
  if (r.result && r.result.data) { writeFileSync('C:/Users/ajest/Desktop/Dummy Drop/' + name, Buffer.from(r.result.data, 'base64')); console.log('saved', name); }
  else console.log('FAILED', name);
}
await send('Runtime.enable'); await send('Page.enable').catch(() => {});
await send('Page.reload', { ignoreCache: true }).catch(() => {});
await sleep(3000);
const im = await evl('JSON.stringify(DD.imagesInfo())');
console.log('IMAGES', im.value || 'n/a');
for (const lvl of [1,2,3]) {
  const r = await evl(`DD.startLevel(${lvl}); 'ok'`);
  await sleep(1800);
  const st = await evl('JSON.stringify(DD.state())');
  console.log('L'+lvl, (st.value||'').slice(0,220));
  await snap('shot-L'+lvl+'.jpg');
}
console.log('done');
process.exit(0);
