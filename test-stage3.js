// Dummy Drop stage 3 checks: materials, pumpkins, breakage, score.
// PASS from plan: scripted impacts break glass at low force, wood at mid, never
// stone; a falling/resting block squashes a pumpkin; score counters move.
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
async function getHealth(id) {
  const r = await evl('JSON.stringify(DD.bodyHealth(' + id + '))');
  try { return JSON.parse(r.value || '{}'); } catch (e) { return {}; }
}
async function reload() {
  await send('Page.reload', { ignoreCache: true }).catch(() => {});
  await sleep(3000);
  return getState();
}
// Poll a body's health for up to ms; returns the first snapshot matching pred, else the last.
async function pollHealth(id, ms, pred) {
  let h = {};
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    h = await getHealth(id);
    if (pred(h)) return h;
    await sleep(100);
  }
  return h;
}

await send('Runtime.enable');
await send('Page.enable').catch(() => {});

// Scene sanity: tower stands, tower pumpkin alive, no errors
let st = await reload();
report('scene loads with DD api', !!(st && typeof st.score === 'number'), 'score=' + (st && st.score));
report('tower pumpkin alive at start', st.pumpkinsAlive >= 1, 'pumpkinsAlive=' + st.pumpkinsAlive);
report('no errors on load', Array.isArray(st.errors) && st.errors.length === 0, JSON.stringify(st.errors || []));

// 1. Glass breaks at low force (speed 5 vs threshold 2.5, health 3)
st = await reload();
let r = await evl('JSON.stringify(DD.testImpact("glass",5))');
let ids = JSON.parse(r.value || '{}');
let h = await pollHealth(ids.targetId, 1500, x => !x.exists);
report('glass breaks at low impact (speed 5)', h.exists === false, 'health=' + JSON.stringify(h));
st = await getState();
report('score counter moves on glass break', st.blocksBroken >= 1 && st.score >= 10, 'blocksBroken=' + st.blocksBroken + ' score=' + st.score);

// 2. Wood pools after the item-3 retune (health 18, 2026-10-29): speed 5
// leaves ~13 (alive, above the crack line); a full-speed chest hit (probe-
// measured relative speed ~10.3, scripted here at 11) leaves ~7 of 18 -
// CRACKED, alive, per Alexander's acceptance; wood breaks at speed 19.
st = await reload();
r = await evl('JSON.stringify(DD.testImpact("wood",5))');
ids = JSON.parse(r.value || '{}');
h = await pollHealth(ids.targetId, 1500, x => x.exists && x.health !== null && x.health <= 13.5);
report('wood survives speed 5 (health ~13 of 18)', h.exists === true && h.health > 9 && h.health <= 13.5, 'health=' + (h && h.health));
st = await reload();
r = await evl('JSON.stringify(DD.testImpact("wood",11))');
ids = JSON.parse(r.value || '{}');
h = await pollHealth(ids.targetId, 1500, x => x.exists && x.health !== null && x.health <= 9);
report('wood survives full-speed chest hit cracked (speed 11, health ~7 of 18)', h.exists === true && h.health > 0 && h.health <= 9, 'health=' + (h && h.health));
st = await reload();
r = await evl('JSON.stringify(DD.testImpact("wood",19))');
ids = JSON.parse(r.value || '{}');
h = await pollHealth(ids.targetId, 1500, x => !x.exists);
report('wood breaks at speed 19', h.exists === false, 'health=' + JSON.stringify(h));

// 3. Stone never breaks: speed 12 impact, then it falls to the ground too
st = await reload();
r = await evl('JSON.stringify(DD.testImpact("stone",12))');
ids = JSON.parse(r.value || '{}');
h = await pollHealth(ids.targetId, 1200, x => x.exists && x.health !== null && x.health < 60);
report('stone damaged but standing after speed 12 (health ~48 of 60)', h.exists === true && h.health >= 36 && h.health <= 54, 'health=' + (h && h.health));
await sleep(2500);
h = await getHealth(ids.targetId);
report('stone still exists after falling to ground', h.exists === true, 'health=' + (h && h.health));

// 4. Pumpkin squashes on a direct impact (speed 6 vs threshold 4, health 4)
st = await reload();
r = await evl('JSON.stringify(DD.testImpact("pumpkin",6))');
ids = JSON.parse(r.value || '{}');
h = await pollHealth(ids.targetId, 1500, x => !x.exists);
report('pumpkin squashes at impact speed 6', h.exists === false, 'health=' + JSON.stringify(h));
st = await getState();
report('pumpkin score counter moves', st.pumpkinsSquashed >= 1 && st.score >= 100, 'pumpkinsSquashed=' + st.pumpkinsSquashed + ' score=' + st.score);

// 5. Pumpkin crushes under a heavy resting block (no impact speed)
st = await reload();
r = await evl('DD.spawnPumpkinAt(620,656)');
const pid = r.value;
r = await evl('DD.spawnBlockAt("wood",620,614,80,40)');
await sleep(2500);
h = await getHealth(pid);
st = await getState();
report('pumpkin crushes under resting wood block (mass 3.2)', h.exists === false && st.pumpkinsSquashed >= 1, 'health=' + JSON.stringify(h) + ' squashed=' + st.pumpkinsSquashed);
report('no errors across stage 3 runs', Array.isArray(st.errors) && st.errors.length === 0, JSON.stringify(st.errors || []));

report('no CDP exceptions across all runs', exceptions.length === 0, 'exceptions=' + exceptions.length + (exceptions[0] ? ' first=' + exceptions[0] : ''));
console.log('SUMMARY ' + pass + '/' + (pass + fail) + ' passed');
ws.close();
process.exit(0);
