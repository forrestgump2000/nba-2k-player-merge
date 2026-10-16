// Builds src/data/players.json and src/data/model.json from data/raw.json
// (scraped NBA 2K27 ratings). Fits per-position ridge regressions so that
// overalls for merged players can be estimated from their attributes.
import fs from 'node:fs';

const KEYS = ["ovr","threePoint","midRange","closeShot","freeThrow","offConsistency","shotIQ","layup","drivingDunk","standingDunk","postHook","postFade","postControl","drawFoul","hands","speed","strength","agility","vertical","hustle","stamina","durability","ballHandle","speedWithBall","passAccuracy","passVision","passIQ","block","steal","passPerception","interiorD","perimeterD","defConsistency","helpDefIQ","defRebound","offRebound","intangibles"];
const ATTRS = KEYS.slice(1);
const POS = ['PG', 'SG', 'SF', 'PF', 'C'];

const raw = JSON.parse(fs.readFileSync('data/raw.json', 'utf8'));

const inches = (s) => { const m = /(\d+)'(\d+)"/.exec(s || ''); return m ? +m[1] * 12 + +m[2] : null; };
const lbs = (s) => { const m = /(\d+)lbs/.exec(s || ''); return m ? +m[1] : null; };
const ageOn = (s) => {
  const d = new Date(s); if (isNaN(d)) return null;
  const ref = new Date('2026-10-20');
  let a = ref.getFullYear() - d.getFullYear();
  if (ref < new Date(ref.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
};
const titleCase = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

const players = raw.map((r) => {
  const [rawName, slug, team, , nat, jersey, pos, arch, h, w, ws, yrs, birth, vals, pot, badges] = r;
  const name = rawName.replace(/&#8217;|&#039;/g, "'").replace(/&amp;/g, '&');
  const attrs = {};
  KEYS.forEach((k, i) => (attrs[k] = vals[i]));
  const ovr = attrs.ovr; delete attrs.ovr;
  const parts = name.trim().split(/\s+/);
  const positions = (pos || '').split('/').map((s) => s.trim()).filter(Boolean);
  const height = inches(h);
  return {
    id: slug,
    name,
    first: parts[0],
    last: parts.slice(1).join(' ') || parts[0],
    team: team === 'free-agency' ? 'FA' : team,
    jersey: (jersey || '').replace('#', ''),
    positions: positions.length ? positions : [height >= 82 ? 'C' : height >= 80 ? 'PF' : height >= 78 ? 'SF' : height >= 76 ? 'SG' : 'PG'],
    archetype: arch || 'Role Player',
    height,
    weight: lbs(w),
    wingspan: inches(ws) || height,
    years: +yrs || 0,
    age: ageOn(birth) ?? 26,
    nationality: nat || '',
    ovr,
    potential: pot || 'B',
    attrs,
    badges: (badges || '').split(';').filter(Boolean).map((b) => { const [n, l] = b.split('|'); return [n, l || 'bronze']; }),
  };
});

// Fill attributes the source left blank with averages from same-position peers near the same overall.
for (const p of players) {
  for (const k of ATTRS) {
    if (p.attrs[k] != null) continue;
    const peers = players.filter((q) => q !== p && q.attrs[k] != null && q.positions[0] === p.positions[0] && Math.abs(q.ovr - p.ovr) <= 3);
    p.attrs[k] = Math.round(peers.reduce((s, q) => s + q.attrs[k], 0) / peers.length);
    p.filled = true;
  }
}

// Body-part durability. 2K tracks these individually; the source only publishes the
// overall durability, so the parts are spread deterministically around it.
const PARTS = ['Head', 'Neck', 'Back', 'Left Shoulder', 'Right Shoulder', 'Left Elbow', 'Right Elbow', 'Left Hand', 'Right Hand', 'Left Hip', 'Right Hip', 'Left Knee', 'Right Knee', 'Left Ankle', 'Right Ankle', 'Left Foot', 'Right Foot', 'Miscellaneous'];
function rng(seed) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
for (const p of players) {
  const r = rng(p.id); const base = p.attrs.durability; const ageHit = Math.max(0, p.age - 30) * 1.2;
  const raw = PARTS.map((part) => { const leg = /Knee|Ankle|Foot|Hip|Back/.test(part) ? ageHit : ageHit * 0.4; return base + (r() - 0.5) * 22 - leg + ageHit * 0.6; });
  const shift = base - raw.reduce((a, b) => a + b, 0) / raw.length;
  p.durab = Object.fromEntries(PARTS.map((part, i) => [part, Math.max(25, Math.min(99, Math.round(raw[i] + shift)))]));
}

// ---- ridge regression per position ----
function solve(A, b) {
  const n = A.length; const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}
// Durability is kept out of the overall formula (weight fixed at 0): it's availability,
// not on-court skill. It still drives injuries in the career sim.
const NO_WEIGHT = new Set(['durability']);
const feats = (p) => [1, ...ATTRS.map((k) => p.attrs[k]), p.height];
// Non-negative ridge regression (coordinate descent on centered data): every attribute
// weight is >= 0, so raising a rating can never lower the overall. Height is unconstrained.
function fit(rows, lambda) {
  const X = rows.map((p) => feats(p).slice(1)); const y = rows.map((p) => p.ovr);
  const n = X.length, d = X[0].length;
  const mx = Array.from({ length: d }, (_, j) => X.reduce((s, x) => s + x[j], 0) / n);
  const my = y.reduce((a, b) => a + b, 0) / n;
  const Xc = X.map((x) => x.map((v, j) => v - mx[j])); const yc = y.map((v) => v - my);
  const w = Array(d).fill(0); const pred = Array(n).fill(0);
  const sq = Array.from({ length: d }, (_, j) => Xc.reduce((s, x) => s + x[j] * x[j], 0));
  for (let it = 0; it < 4000; it++) {
    for (let j = 0; j < d; j++) {
      let r = 0;
      for (let i = 0; i < n; i++) r += Xc[i][j] * (yc[i] - pred[i] + Xc[i][j] * w[j]);
      if (j < d - 1 && NO_WEIGHT.has(ATTRS[j])) continue;
      let nw = r / (sq[j] + (j < d - 1 ? lambda : 0));
      if (j < d - 1) nw = Math.max(0, nw);
      const dw = nw - w[j];
      if (dw) { for (let i = 0; i < n; i++) pred[i] += Xc[i][j] * dw; w[j] = nw; }
    }
  }
  return [my - w.reduce((s, wj, j) => s + wj * mx[j], 0), ...w];
}
const predict = (w, p) => feats(p).reduce((s, x, i) => s + x * w[i], 0);

const model = {};
for (const pos of POS) {
  // weight primary-position players, but include secondary-position players for stability
  const rows = players.filter((p) => !p.filled && (p.positions[0] === pos || p.positions.includes(pos)) && Math.abs(p.ovr - 72) < 30 && p.id !== 'russell-westbrook');
  model[pos] = fit(rows, 40);
  const prim = players.filter((p) => p.positions[0] === pos);
  const err = prim.map((p) => Math.abs(predict(model[pos], p) - p.ovr));
  console.log(pos, 'n=', rows.length, 'MAE', (err.reduce((a, b) => a + b, 0) / err.length).toFixed(2), 'max', Math.max(...err).toFixed(1));
}

// Correct placeholder overalls (e.g. unsigned vets listed far below what their attributes say).
for (const p of players) {
  const est = Math.round(predict(model[p.positions[0]], p));
  if (Math.abs(est - p.ovr) > 15) { console.log('fix ovr', p.name, p.ovr, '->', est); p.ovr = est; }
}

fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/players.json', JSON.stringify(players));
fs.writeFileSync('src/data/model.json', JSON.stringify({ features: ['bias', ...ATTRS, 'height'], weights: model, parts: PARTS }));
console.log('players', players.length, 'unique names', new Set(players.map((p) => p.name)).size);
