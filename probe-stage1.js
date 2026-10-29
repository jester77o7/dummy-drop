// Probe several bot pulls, reload between each, report tower change.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPage() {
  for (let i = 0; i < 30; i++) {
    try { const list = await (await fetch('http://127.0.0.1:9222/json/list')).json(); const page = list.find(t => t.type === 'page' && t.url.includes('Dummy')); if (page) return page; } catch (e) {}
    await sleep(500);
  } throw new Error('no page');
}
const page = await getPage();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
let seq = 0; const pending = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
function send(method, params = {}) { return new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); }); }
async function evl(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; }
await send('Runtime.enable'); await send('Page.enable').catch(()=>{});
const pulls = [[50,540],[70,590],[90,610],[110,630],[40,600]];
for (const [px,py] of pulls) {
  await send('Page.reload', { ignoreCache: true }).catch(()=>{});
  await sleep(1800);
  await evl(`DD.botLaunch(${px},${py})`);
  let peak=0, st={};
  for (let i=0;i<10;i++){ await sleep(500); const s = await evl('JSON.stringify(DD.state())'); try{st=JSON.parse(s||'{}');}catch(e){} if(st.ball) peak=Math.max(peak,st.ball.x); if(st.towerMaxChange>25) break; }
  console.log(`pull ${px},${py} -> maxChange=${st.towerMaxChange} ballPeakX=${peak} ballEnd=${st.ball?Math.round(st.ball.x)+','+Math.round(st.ball.y):'?'}`);
}
ws.close(); process.exit(0);
