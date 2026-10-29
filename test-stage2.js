// Dummy Drop stage 2 checks: 5 reload+launch runs at varied power.
// PASS from plan: dummy stays in one piece, ends at rest, no joint explosions, zero errors.
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
async function getState() {
  const r = await evl('JSON.stringify(DD.state())');
  try { return JSON.parse(r.value || '{}'); } catch (e) { return {}; }
}

await send('Runtime.enable');
await send('Page.enable').catch(() => {});

const pulls = [
  { name: 'flat max', x: 50, y: 540 },
  { name: 'flat mid', x: 110, y: 540 },
  { name: 'up max', x: 60, y: 440 },
  { name: 'up mid', x: 120, y: 460 },
  { name: 'down slight', x: 110, y: 555 },
];
let overallPeakStretch = 0;

for (let run = 0; run < pulls.length; run++) {
  const p = pulls[run];
  await send('Page.reload', { ignoreCache: true }).catch(() => {});
  await sleep(3000);
  let st = await getState();
  if (run === 0) {
    report('game loads, DD api present', !!(st && st.parts && st.parts.chest), 'parts=' + (st && st.parts ? Object.keys(st.parts).length : 0));
    report('no errors on load', Array.isArray(st.errors) && st.errors.length === 0, JSON.stringify(st.errors || []));
  }
  const before = st;
  let r = await evl('DD.botLaunch(' + p.x + ',' + p.y + ')');
  report('run' + (run + 1) + ' ' + p.name + ' botLaunch accepted', r.value === true, 'ret=' + r.value);
  // Sample during flight for peak joint stretch + part spread
  let peakStretch = 0, peakSpread = 0, launchedSeen = false;
  for (let i = 0; i < 24; i++) {
    await sleep(250);
    st = await getState();
    if (st.launched) launchedSeen = true;
    if (typeof st.maxJointStretchPx === 'number') peakStretch = Math.max(peakStretch, st.maxJointStretchPx);
    if (typeof st.maxPartSpread === 'number') peakSpread = Math.max(peakSpread, st.maxPartSpread);
  }
  overallPeakStretch = Math.max(overallPeakStretch, peakStretch);
  report('run' + (run + 1) + ' launched', launchedSeen === true, 'chest=' + JSON.stringify(st.chest || {}));
  report('run' + (run + 1) + ' dummy in one piece', peakSpread < 220 && st.maxPartSpread < 220, 'peakSpread=' + Math.round(peakSpread) + ' finalSpread=' + Math.round(st.maxPartSpread || 0));
  report('run' + (run + 1) + ' no joint explosion', peakStretch < 60, 'peakStretchPx=' + Math.round(peakStretch * 10) / 10 + ' worstJoint=' + st.worstJoint);
  // Wait for rest (up to extra 6s)
  for (let i = 0; i < 12 && !(st.maxSpeed < 0.35); i++) { await sleep(500); st = await getState(); }
  report('run' + (run + 1) + ' ends at rest', typeof st.maxSpeed === 'number' && st.maxSpeed < 0.35, 'maxSpeed=' + (st.maxSpeed != null ? Math.round(st.maxSpeed * 100) / 100 : 'n/a') + ' chest=' + JSON.stringify(st.chest || {}));
  report('run' + (run + 1) + ' no errors', Array.isArray(st.errors) && st.errors.length === 0, JSON.stringify(st.errors || []));
  console.log('INFO | run' + (run + 1) + ' ' + p.name + ' | towerMaxChange=' + Math.round((st.towerMaxChange || 0) * 10) / 10 + ' finalStretch=' + Math.round((st.maxJointStretchPx || 0) * 10) / 10);
}
report('no CDP exceptions across all runs', exceptions.length === 0, 'exceptions=' + exceptions.length + (exceptions[0] ? ' first=' + exceptions[0] : ''));
console.log('INFO | overall peak joint stretch px=' + Math.round(overallPeakStretch * 10) / 10);
console.log('SUMMARY ' + pass + '/' + (pass + fail) + ' passed');
ws.close();
process.exit(0);
