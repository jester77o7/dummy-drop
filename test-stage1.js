// Dummy Drop stage 1 checks: load, tower stands, bot launch topples tower, soak.
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
let seq = 0; const pending = new Map(); const exceptions = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; exceptions.push((d.exception && d.exception.description) || d.text || 'unknown'); }
});
function send(method, params = {}) { return new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); }); }
async function evl(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (!r.result) return { error: 'no result' };
  if (r.result.exceptionDetails) { const d = r.result.exceptionDetails; return { error: (d.exception && d.exception.description) || d.text }; }
  return { value: r.result.result ? r.result.result.value : undefined };
}
let pass = 0, fail = 0;
function report(name, ok, detail) { console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : '')); ok ? pass++ : fail++; }

await send('Runtime.enable');
await send('Page.enable').catch(() => {});
await send('Page.reload', { ignoreCache: true }).catch(() => {});
await sleep(2500);

let r = await evl('typeof window.DD');
report('game loads, DD api present', r.value === 'object', 'typeof DD=' + r.value);
r = await evl('JSON.stringify(DD.state())');
let st = {}; try { st = JSON.parse(r.value || '{}'); } catch (e) {}
report('no page errors on load', Array.isArray(st.errors) && st.errors.length === 0, JSON.stringify(st.errors || r.error || ''));

// Tower stands untouched for the settle window (already ~2.5s since reload)
await sleep(2000);
r = await evl('JSON.stringify(DD.state())');
st = {}; try { st = JSON.parse(r.value || '{}'); } catch (e) {}
report('tower stable before launch', typeof st.towerMaxChange === 'number' && st.towerMaxChange < 8, 'maxChange=' + st.towerMaxChange);

// Bot drag flat left and release: pull to (50,540). Probe 2026-10-28: this pull
// hit the tower base (maxChange 180); angled pulls arced over the tower.
r = await evl('DD.botLaunch(50,540)');
report('botLaunch accepted', r.value === true, 'ret=' + r.value);
await sleep(1200);
r = await evl('JSON.stringify(DD.state())');
st = {}; try { st = JSON.parse(r.value || '{}'); } catch (e) {}
report('ball launched and flying', st.launched === true && st.ball && st.ball.x > 260, JSON.stringify(st.ball || {}));
const ballPeakX = st.ball ? st.ball.x : 0;

// Wait for impact / topple
let toppled = false, lastSt = st;
for (let i = 0; i < 16; i++) {
  await sleep(500);
  r = await evl('JSON.stringify(DD.state())');
  try { lastSt = JSON.parse(r.value || '{}'); } catch (e) {}
  if (lastSt.towerMaxChange > 25) { toppled = true; break; }
}
report('tower topples after hit', toppled, 'maxChange=' + lastSt.towerMaxChange + ' top=' + JSON.stringify(lastSt.top || {}));

// 30 second soak from reload: we have used ~15s; wait the rest plus margin
await sleep(18000);
r = await evl('JSON.stringify(DD.state())');
st = {}; try { st = JSON.parse(r.value || '{}'); } catch (e) {}
report('no page errors after soak', Array.isArray(st.errors) && st.errors.length === 0 && exceptions.length === 0, 'pageErrors=' + JSON.stringify(st.errors || []) + ' exceptions=' + exceptions.length);
console.log('SUMMARY ' + pass + '/' + (pass + fail) + ' passed');
ws.close();
process.exit(0);
