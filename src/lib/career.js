// Career simulator. The whole league (every 2K27 player) is simulated each season so the
// merged player's role, minutes, stats, awards and contracts come from where he actually
// ranks — a 75 overall fights for a roster spot, a 97 overall wins MVPs.
import PLAYERS from '../data/players.json';
import { TEAMS, TEAM_IDS, team } from '../data/teams.js';
import { ovrAt, rawOvrAt, PARTS, clamp, POSITIONS } from './ratings.js';
import MODEL from '../data/model.json';

const BASE = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));
const START_YEAR = 2026;
const BASE_CAP = 165; // $M, 2026-27 projection
const ATHLETIC = ['speed', 'agility', 'vertical', 'stamina', 'speedWithBall', 'drivingDunk', 'hustle', 'perimeterD'];
const SKILL = ['threePoint', 'midRange', 'freeThrow', 'shotIQ', 'passIQ', 'passVision', 'helpDefIQ', 'offConsistency', 'postFade', 'postHook', 'intangibles', 'defConsistency'];
const POT_BONUS = { 'A+': 2.2, A: 1.6, 'A-': 1.1, 'B+': 0.6, B: 0.2, 'B-': -0.3, 'C+': -0.7, C: -1 };

// ---------- random helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const chance = (p) => Math.random() < p;
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function poisson(l) { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
function weighted(items, w) { const t = w.reduce((a, b) => a + b, 0); let r = Math.random() * t; for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }
const lerp = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0); } return pts[pts.length - 1][1]; };
const r1 = (x) => Math.round(x * 10) / 10;

export const seasonLabel = (y) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
export const capFor = (year) => BASE_CAP * Math.pow(1.05, year - START_YEAR);
export const money = (m) => (m >= 1 ? `$${m.toFixed(1)}M` : `$${Math.round(m * 1000)}K`);

// ---------- league player helpers ----------
function attrOf(L, lp, k) {
  if (lp.user) return L.user.attrs[k];
  return clamp(BASE[lp.base].attrs[k] + lp.off, 25, 99);
}
const heightOf = (L, lp) => (lp.user ? L.user.height : BASE[lp.base].height);
const avgAttrs = (L, lp, ks) => ks.reduce((s, k) => s + attrOf(L, lp, k), 0) / ks.length;
const roster = (L, tid) => Object.values(L.players).filter((p) => p.team === tid && !p.retired);

export function marketSalary(ovr, age, year, yearsInLeague) {
  const cap = capFor(year);
  const min = 2.3 * Math.pow(1.05, year - START_YEAR) * (yearsInLeague >= 6 ? 1.3 : 1);
  const maxPct = yearsInLeague >= 10 ? 0.35 : yearsInLeague >= 7 ? 0.3 : 0.25;
  let s;
  if (ovr >= 93) s = cap * maxPct;
  else if (ovr >= 88) s = cap * maxPct * lerp([[88, 0.72], [93, 1]], ovr);
  else if (ovr >= 84) s = cap * lerp([[84, 0.14], [88, 0.22]], ovr);
  else if (ovr >= 80) s = cap * lerp([[80, 0.07], [84, 0.14]], ovr);
  else if (ovr >= 77) s = cap * lerp([[77, 0.03], [80, 0.07]], ovr);
  else s = min;
  if (age >= 33 && ovr < 93) s *= 0.7;
  return Math.max(min, s);
}

function contractYearsFor(age, ovr) {
  if (ovr < 77) return age < 30 ? randi(1, 2) : 1;
  if (age <= 27) return randi(3, 5);
  if (age <= 30) return randi(2, 4);
  if (age <= 33) return randi(1, 3);
  return 1;
}

// Ceiling implied by a 2K potential grade.
const CEIL = { 'A+': [94, 99], A: [89, 94], 'A-': [85, 90], 'B+': [81, 86], B: [77, 82], 'B-': [73, 78], 'C+': [70, 75], C: [67, 72] };
function ceilingFor(pot, ovr, age) {
  if (age >= 27) return ovr + 1;
  const [a, b] = CEIL[pot] || CEIL.B;
  return Math.max(ovr + 1, randi(a, b));
}

// Age curve: expected overall change over one offseason.
function progressionDelta(age, pot, ovr, ceil = 99) {
  let d;
  if (age <= 20) d = rand(2, 6);
  else if (age <= 22) d = rand(1, 5);
  else if (age <= 24) d = rand(0, 3.5);
  else if (age <= 27) d = rand(-1, 2.2);
  else if (age <= 29) d = rand(-1.8, 1);
  else if (age <= 31) d = rand(-3, 0.5);
  else if (age <= 33) d = rand(-4, -0.5);
  else if (age <= 35) d = rand(-5.5, -1.5);
  else d = rand(-7, -2.5);
  if (age <= 25) d += POT_BONUS[pot] ?? 0;
  if (ovr >= 95 && d > 0) d *= 0.4;
  else if (ovr >= 90 && d > 0) d *= 0.7;
  if (d > 0) d = ovr >= ceil ? d * 0.15 : Math.min(d, ceil - ovr + 0.5);
  if (ovr >= 99 && d > 0) d = 0;
  return d;
}

// ---------- setup ----------
export function newCareer(merged, teamId) {
  const players = {};
  for (const p of PLAYERS) {
    players[p.id] = { id: p.id, name: p.name, team: p.team, ovr: p.ovr, age: p.age, pot: p.potential, ceil: ceilingFor(p.potential, p.ovr, p.age), pos: p.positions[0], base: p.id, off: 0, yrs: p.team === 'FA' ? 0 : randi(1, 4), exp: p.years, prevOvr: p.ovr };
  }
  const user = JSON.parse(JSON.stringify(merged));
  user.attrs = { ...user.attrs };
  user.durab = { ...user.durab };
  const yrsLeft = randi(1, 4);
  players[user.id] = { id: user.id, name: user.name, team: teamId, ovr: user.ovr, age: user.age, pot: user.potential, ceil: ceilingFor(user.potential, user.ovr, user.age), pos: user.positions[0], user: true, yrs: yrsLeft, exp: user.years, prevOvr: user.ovr };
  const L = { year: START_YEAR, players, user, champions: [], draftNo: 0 };
  trimRoster(L, teamId, user.id);
  const sal = marketSalary(user.ovr, user.age, START_YEAR, user.years);
  return {
    id: user.id,
    started: Date.now(),
    league: L,
    phase: 'preseason',
    contract: { team: teamId, years: yrsLeft, salary: sal },
    seasons: [],
    log: [`${seasonLabel(START_YEAR)}: ${user.name} begins his career with the ${team(teamId).name} (${yrsLeft} yr${yrsLeft > 1 ? 's' : ''}, ${money(sal)}/yr).`],
    retired: false,
    pending: null,
    earnings: 0,
    rings: 0,
  };
}

function trimRoster(L, tid, keepId) {
  const r = roster(L, tid).sort((a, b) => a.ovr - b.ovr);
  while (r.length > 15) {
    const cut = r.find((p) => p.id !== keepId);
    cut.team = 'FA'; cut.yrs = 0;
    r.splice(r.indexOf(cut), 1);
  }
}

// ---------- injuries ----------
const INJURIES = {
  Head: [['concussion', 'minor'], ['facial fracture', 'moderate']],
  Neck: [['neck strain', 'minor'], ['neck spasms', 'minor']],
  Back: [['back spasms', 'minor'], ['lower back strain', 'moderate'], ['herniated disc', 'major']],
  'Left Shoulder': [['left shoulder strain', 'minor'], ['left shoulder sprain', 'moderate'], ['torn left labrum', 'major']],
  'Right Shoulder': [['right shoulder strain', 'minor'], ['right shoulder sprain', 'moderate'], ['torn right labrum', 'major']],
  'Left Elbow': [['left elbow contusion', 'minor'], ['left elbow sprain', 'moderate']],
  'Right Elbow': [['right elbow contusion', 'minor'], ['right elbow sprain', 'moderate']],
  'Left Hand': [['jammed left finger', 'minor'], ['fractured left hand', 'moderate']],
  'Right Hand': [['sprained right wrist', 'minor'], ['fractured right hand', 'moderate']],
  'Left Hip': [['left hip contusion', 'minor'], ['left hip flexor strain', 'moderate']],
  'Right Hip': [['right hip contusion', 'minor'], ['right hip flexor strain', 'moderate']],
  'Left Knee': [['left knee soreness', 'minor'], ['left MCL sprain', 'moderate'], ['torn left meniscus', 'major'], ['torn left ACL', 'season']],
  'Right Knee': [['right knee soreness', 'minor'], ['right MCL sprain', 'moderate'], ['torn right meniscus', 'major'], ['torn right ACL', 'season']],
  'Left Ankle': [['left ankle sprain', 'minor'], ['high left ankle sprain', 'moderate'], ['ruptured left Achilles', 'season']],
  'Right Ankle': [['right ankle sprain', 'minor'], ['high right ankle sprain', 'moderate'], ['ruptured right Achilles', 'season']],
  'Left Foot': [['left foot soreness', 'minor'], ['left plantar fasciitis', 'moderate'], ['fractured left foot', 'major']],
  'Right Foot': [['right foot soreness', 'minor'], ['right plantar fasciitis', 'moderate'], ['fractured right foot', 'major']],
  Miscellaneous: [['illness', 'minor'], ['hamstring strain', 'minor'], ['calf strain', 'moderate'], ['groin strain', 'moderate']],
};

function rollUserInjuries(L) {
  const u = L.user; const age = L.players[u.id].age;
  const parts = PARTS.map((p) => u.durab[p]);
  const avgD = parts.reduce((a, b) => a + b, 0) / parts.length;
  const lambda = clamp(0.55 + (85 - avgD) * 0.035 + Math.max(0, age - 30) * 0.08, 0.2, 3);
  const n = poisson(lambda);
  const out = [];
  let missed = 0;
  for (let i = 0; i < n; i++) {
    const part = weighted(PARTS, PARTS.map((p) => Math.pow(101 - u.durab[p], 1.6)));
    const d = u.durab[part];
    const opts = INJURIES[part];
    const severe = 0.04 + Math.max(0, 80 - d) * 0.006 + Math.max(0, age - 30) * 0.01;
    const roll = Math.random();
    let [name, sev] = opts[0];
    const bySev = (s) => opts.find((o) => o[1] === s);
    if (roll < severe * 0.35 && bySev('season')) [name, sev] = bySev('season');
    else if (roll < severe && bySev('major')) [name, sev] = bySev('major');
    else if (roll < 0.35 + severe && bySev('moderate')) [name, sev] = bySev('moderate');
    const games = sev === 'minor' ? randi(1, 6) : sev === 'moderate' ? randi(7, 22) : sev === 'major' ? randi(25, 55) : 82;
    out.push({ part, name, sev, games });
    missed += games;
    if (sev === 'major' || sev === 'season') {
      u.durab[part] = clamp(u.durab[part] - randi(5, 10), 25, 99);
      for (const k of ['speed', 'agility', 'vertical', 'drivingDunk', 'speedWithBall']) u.attrs[k] = clamp(u.attrs[k] - randi(sev === 'season' ? 2 : 1, sev === 'season' ? 6 : 3));
    }
  }
  let rest = age >= 33 ? randi(3, 12) : age >= 30 ? randi(0, 4) : 0;
  return { injuries: out, missed: Math.min(82, missed + rest), rest, seasonEnding: out.some((x) => x.sev === 'season') };
}

function rollOtherGames(lp) {
  let missed = chance(0.5) ? Math.round(Math.abs(gauss()) * 9) : randi(0, 3);
  if (chance(0.07)) missed += randi(25, 70);
  if (lp.age >= 33) missed += randi(2, 10);
  return clamp(82 - missed, 0, 82);
}

// ---------- season ----------
const MPG_CURVE = [[55, 0], [65, 3], [70, 7], [73, 11], [75, 15], [78, 21], [80, 24], [84, 29], [88, 32.5], [92, 34.5], [96, 35.5], [99, 36.5]];
const STRENGTH_W = [0.22, 0.18, 0.15, 0.12, 0.1, 0.08, 0.06, 0.04, 0.03, 0.02];

function teamStrength(list) {
  const eff = list.map((p) => p.ovr * (p.gp / 82) + 70 * (1 - p.gp / 82)).sort((a, b) => b - a);
  while (eff.length < 10) eff.push(65);
  return STRENGTH_W.reduce((s, w, i) => s + w * eff[i], 0);
}

function computeStats(L, tid, list, teamS, meanS) {
  // minutes by overall and depth chart rank
  const sorted = list.slice().sort((a, b) => b.ovr - a.ovr);
  sorted.forEach((p, i) => {
    let m = lerp(MPG_CURVE, p.ovr);
    if (i < 5) m = Math.max(m, 24);
    else if (i < 8) m = m;
    else if (i < 10) m *= 0.75;
    else if (i < 13) m *= 0.35;
    else m *= 0.1;
    p.rank = i + 1;
    p.mpg = m;
  });
  const total = sorted.slice(0, 13).reduce((s, p) => s + p.mpg, 0);
  const k = 240 / Math.max(total, 1);
  sorted.forEach((p) => (p.mpg = Math.min(38.5, p.mpg * k)));

  const teamPts = 113 + (teamS - meanS) * 1.4 + gauss() * 1.5;
  const parts = sorted.map((p) => {
    const a = (ks) => avgAttrs(L, p, ks);
    const h = heightOf(L, p);
    const scoreR = a(['threePoint', 'midRange', 'closeShot', 'layup', 'drivingDunk', 'drawFoul', 'offConsistency']) * 0.6 + Math.max(attrOf(L, p, 'threePoint'), attrOf(L, p, 'layup'), attrOf(L, p, 'closeShot')) * 0.4;
    const passR = a(['passAccuracy', 'passVision', 'passIQ', 'ballHandle']);
    const rebR = a(['defRebound', 'offRebound']);
    const defR = a(['interiorD', 'perimeterD', 'steal', 'block', 'helpDefIQ', 'defConsistency']);
    return {
      p, h, scoreR, passR, rebR, defR,
      u: Math.exp((scoreR + p.ovr - 155) / 30) * p.mpg,
      r: Math.exp((rebR + (h - 78) * 2.5 - 60) / 45) * p.mpg,
      as: Math.exp((passR - 62) / 19) * p.mpg,
      st: Math.exp((attrOf(L, p, 'steal') - 60) / 38) * p.mpg,
      bk: Math.exp((attrOf(L, p, 'block') - 55) / 26) * p.mpg,
    };
  });
  const sum = (k2) => parts.reduce((s, x) => s + x[k2], 0) || 1;
  const U = sum('u'), R = sum('r'), A = sum('as'), S = sum('st'), B = sum('bk');
  for (const x of parts) {
    const p = x.p; const v = () => 1 + gauss() * 0.06;
    const tp = attrOf(L, p, 'threePoint'), ft = attrOf(L, p, 'freeThrow');
    const inside = avgAttrs(L, p, ['closeShot', 'layup', 'drivingDunk', 'standingDunk']);
    const threeRate = clamp((tp - 55) / 70, 0.02, 0.6);
    p.stats = {
      mpg: r1(p.mpg),
      ppg: r1(soft((teamPts * x.u) / U * v())),
      rpg: r1((44 * x.r) / R * v()),
      apg: r1((26.5 * x.as) / A * v()),
      spg: r1((8 * x.st) / S * v()),
      bpg: r1((5 * x.bk) / B * v()),
      fg: r1(clamp(46 + (inside - 70) * 0.18 - threeRate * 6 + (x.h - 78) * 0.5 + gauss() * 1.5, 34, 70)),
      tp: r1(clamp(25 + (tp - 50) * 0.36 + gauss() * 1.8, 0, 46)),
      ft: r1(clamp(45 + ft * 0.48 + gauss() * 2, 40, 95)),
      def: x.defR,
    };
    if (p.mpg < 1 || p.gp === 0) Object.assign(p.stats, { ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0 });
  }
}

// real scoring leaders top out in the mid-30s; compress the extreme tail
const soft = (x) => (x > 28 ? 28 + (x - 28) * 0.55 : x);

function playSeries(a, b, sA, sB, best = 7) {
  const need = Math.ceil(best / 2); let wa = 0, wb = 0, g = 0;
  const homePattern = best === 7 ? [1, 1, 0, 0, 1, 0, 1] : [1];
  while (wa < need && wb < need) {
    const home = homePattern[g++] ? 0.35 : -0.35;
    const p = 1 / (1 + Math.exp(-((sA - sB) * 0.42 + home)));
    if (Math.random() < p) wa++; else wb++;
  }
  return wa > wb ? { winner: a, loser: b, score: `${wa}-${wb}` } : { winner: b, loser: a, score: `${wb}-${wa}` };
}

function playoffStrength(L, tid, gpMap) {
  const list = roster(L, tid).filter((p) => !(p.user && L.userOutForPlayoffs)).map((p) => ({ ovr: p.ovr, gp: 82 }));
  // stars matter more in the playoffs
  const eff = list.map((p) => p.ovr).sort((a, b) => b - a);
  while (eff.length < 8) eff.push(65);
  return [0.28, 0.22, 0.17, 0.12, 0.09, 0.06, 0.04, 0.02].reduce((s, w, i) => s + w * eff[i], 0);
}

// Moves that can happen to non-star users during the season: deadline trades and waivers.
function midseasonMoves(C, events) {
  const L = C.league; const me = L.players[L.user.id];
  if (me.team === 'FA') return { partial: 1 };
  const r = roster(L, me.team).sort((a, b) => b.ovr - a.ovr);
  const rank = r.indexOf(me) + 1;
  if (me.ovr <= 76 && rank >= 12 && chance(me.ovr <= 73 ? 0.55 : 0.3)) {
    const from = me.team;
    events.push(`Waived by the ${team(from).name} in January — fell out of the rotation.`);
    const pickup = me.ovr >= 75 ? 0.6 : me.ovr >= 73 ? 0.35 : 0.12;
    if (chance(pickup)) {
      const to = pick(TEAM_IDS.filter((t) => t !== from && roster(L, t).length < 15)) || pick(TEAM_IDS.filter((t) => t !== from));
      me.team = to; me.yrs = 0; C.contract = { team: to, years: 0, salary: marketSalary(me.ovr, me.age, L.year, me.exp) };
      trimRoster(L, to, me.id);
      events.push(`Signed a pair of 10-day contracts with the ${team(to).name}, then a rest-of-season minimum deal.`);
      return { partial: 0.55 };
    }
    me.team = 'FA'; me.yrs = 0; C.contract = { team: 'FA', years: 0, salary: 0 };
    events.push('No team claimed him. Finished the season out of the league.');
    return { partial: 0.5, cut: true };
  }
  const tradeP = me.ovr >= 93 ? 0 : me.ovr >= 88 ? 0.04 : me.ovr >= 80 ? 0.1 : 0.07;
  if (chance(tradeP)) {
    const from = me.team;
    const to = pick(TEAM_IDS.filter((t) => t !== from));
    const back = roster(L, to).filter((p) => !p.user && Math.abs(p.ovr - me.ovr) <= 4).sort(() => Math.random() - 0.5)[0];
    me.team = to; C.contract.team = to;
    let line = `Traded from the ${team(from).name} to the ${team(to).name} at the deadline`;
    if (back) { back.team = from; line += ` in a deal for ${back.name}`; }
    events.push(line + '.');
    trimRoster(L, to, me.id);
  }
  return { partial: 1 };
}

export function simSeason(C) {
  const L = C.league; const u = L.user; const me = L.players[u.id];
  const events = [];
  const startTeam = me.team;
  const move = midseasonMoves(C, events);
  const inj = me.team === 'FA' && startTeam === 'FA' ? { injuries: [], missed: 82, rest: 0, seasonEnding: false } : rollUserInjuries(L);
  for (const i of inj.injuries) events.push(`Missed ${i.sev === 'season' ? 'the rest of the season' : `${i.games} game${i.games > 1 ? 's' : ''}`} with ${/^[aeiou]/i.test(i.name) ? 'an' : 'a'} ${i.name}.`);
  if (inj.rest >= 5) events.push(`Sat ${inj.rest} games for rest/load management.`);

  const active = Object.values(L.players).filter((p) => !p.retired && p.team !== 'FA');
  for (const p of active) p.gp = p.user ? Math.round(Math.max(0, 82 - inj.missed) * move.partial) : rollOtherGames(p);
  if (me.team === 'FA') me.gp = 0;
  L.userOutForPlayoffs = inj.seasonEnding || me.team === 'FA';

  // standings
  const strengths = {};
  for (const t of TEAM_IDS) strengths[t] = teamStrength(roster(L, t));
  const vals = Object.values(strengths);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
  const rec = {};
  for (const t of TEAM_IDS) {
    const pct = clamp(0.5 + ((strengths[t] - mean) / sd) * 0.13 + gauss() * 0.04, 0.15, 0.82);
    rec[t] = Math.round(82 * pct);
  }
  const off = (Object.values(rec).reduce((a, b) => a + b, 0) - 1230) / 30;
  for (const t of TEAM_IDS) { rec[t] = clamp(Math.round(rec[t] - off), 9, 73); }
  for (const t of TEAM_IDS) computeStats(L, t, roster(L, t), strengths[t], mean);
  if (me.team === 'FA') me.stats = null;

  // awards
  const pool = active.filter((p) => p.stats && p.team !== 'FA');
  const wins = (p) => rec[p.team] ?? 30;
  const mvpScore = (p) => p.ovr * 1.0 + p.stats.ppg * 0.28 + (p.stats.apg + p.stats.rpg) * 0.12 + (wins(p) - 41) * 0.16 + gauss() * 0.8;
  pool.forEach((p) => (p._mvp = mvpScore(p)));
  const eligible = pool.filter((p) => p.gp >= 65);
  const byMvp = eligible.slice().sort((a, b) => b._mvp - a._mvp);
  const awards = [];
  const mine = (p) => p && p.user;
  const mvpRank = byMvp.findIndex((p) => p.user) + 1;
  if (mine(byMvp[0])) awards.push('MVP');
  const allNba = byMvp.slice(0, 15);
  const ani = allNba.findIndex((p) => p.user);
  if (ani >= 0) awards.push(ani < 5 ? 'All-NBA 1st Team' : ani < 10 ? 'All-NBA 2nd Team' : 'All-NBA 3rd Team');
  for (const conf of ['East', 'West']) {
    const asg = pool.filter((p) => p.gp >= 35 && TEAMS[p.team]?.conf === conf).sort((a, b) => b._mvp - a._mvp).slice(0, 12);
    if (asg.some(mine)) awards.push('All-Star');
  }
  const defScore = (p) => p.stats.def + p.stats.bpg * 2.2 + p.stats.spg * 2.2 + (wins(p) - 41) * 0.05 + (p.ovr - 80) * 0.15 + gauss() * 0.8;
  const byDef = eligible.slice().sort((a, b) => defScore(b) - defScore(a));
  if (mine(byDef[0])) awards.push('Defensive Player of the Year');
  const adi = byDef.slice(0, 10).findIndex((p) => p.user);
  if (adi >= 0) awards.push(adi < 5 ? 'All-Defensive 1st Team' : 'All-Defensive 2nd Team');
  const sixth = eligible.filter((p) => p.rank >= 6 && p.rank <= 9).sort((a, b) => b.stats.ppg + b.ovr * 0.3 - (a.stats.ppg + a.ovr * 0.3))[0];
  if (mine(sixth)) awards.push('Sixth Man of the Year');
  const mip = eligible.filter((p) => p.age <= 28).sort((a, b) => (b.ovr - b.prevOvr) - (a.ovr - a.prevOvr))[0];
  if (mine(mip) && me.ovr - me.prevOvr >= 3) awards.push('Most Improved Player');
  const scoring = eligible.slice().sort((a, b) => b.stats.ppg - a.stats.ppg)[0];
  if (mine(scoring)) awards.push('Scoring Title');
  const rebTitle = eligible.slice().sort((a, b) => b.stats.rpg - a.stats.rpg)[0];
  if (mine(rebTitle)) awards.push('Rebounding Title');
  const astTitle = eligible.slice().sort((a, b) => b.stats.apg - a.stats.apg)[0];
  if (mine(astTitle)) awards.push('Assists Title');

  // playoffs
  const seeds = {};
  for (const conf of ['East', 'West']) {
    const ts = TEAM_IDS.filter((t) => TEAMS[t].conf === conf).sort((a, b) => rec[b] - rec[a] || strengths[b] - strengths[a]);
    const ps = Object.fromEntries(ts.map((t) => [t, playoffStrength(L, t)]));
    const g78 = playSeries(ts[6], ts[7], ps[ts[6]], ps[ts[7]], 1);
    const g910 = playSeries(ts[8], ts[9], ps[ts[8]], ps[ts[9]], 1);
    const g8 = playSeries(g78.loser, g910.winner, ps[g78.loser], ps[g910.winner], 1);
    seeds[conf] = { order: ts, ps, playIn: [g78, g910, g8], bracket: [ts[0], g8.winner, ts[3], ts[4], ts[2], ts[5], ts[1], g78.winner] };
  }
  const roundNames = ['First Round', 'Conference Semifinals', 'Conference Finals', 'NBA Finals'];
  const exits = {};
  const confChamp = {};
  const series = [];
  for (const conf of ['East', 'West']) {
    let alive = seeds[conf].bracket; const ps = seeds[conf].ps;
    for (let r = 0; r < 3; r++) {
      const next = [];
      for (let i = 0; i < alive.length; i += 2) {
        const s = playSeries(alive[i], alive[i + 1], ps[alive[i]], ps[alive[i + 1]]);
        exits[s.loser] = { round: r, by: s.winner, score: s.score };
        series.push({ round: r, ...s });
        next.push(s.winner);
      }
      alive = next;
    }
    confChamp[conf] = alive[0];
  }
  const [e, w] = [confChamp.East, confChamp.West];
  const allPs = { ...seeds.East.ps, ...seeds.West.ps };
  const finals = rec[e] >= rec[w] ? playSeries(e, w, allPs[e], allPs[w]) : playSeries(w, e, allPs[w], allPs[e]);
  exits[finals.loser] = { round: 3, by: finals.winner, score: finals.score };
  series.push({ round: 3, ...finals });
  const champ = finals.winner;
  L.champions.push({ year: L.year, team: champ, runnerUp: finals.loser, score: finals.score });
  const fmvp = roster(L, champ).filter((p) => p.stats).sort((a, b) => b._mvp - a._mvp)[0];

  // the user's postseason
  let playoff = 'Missed playoffs';
  const myT = me.team;
  if (myT !== 'FA') {
    const conf = TEAMS[myT].conf; const order = seeds[conf].order; const seed = order.indexOf(myT) + 1;
    const made = seeds[conf].bracket.includes(myT);
    if (!made) playoff = seed <= 10 ? `Lost in the play-in (${seed} seed)` : `Missed playoffs (${seed}th in the ${conf})`;
    else if (champ === myT) playoff = `Won the NBA Championship (${seed} seed)`;
    else { const x = exits[myT]; playoff = `Lost in the ${roundNames[x.round]} to the ${team(x.by).nick}, ${x.score} (${seed} seed)`; }
    if (made && L.userOutForPlayoffs && me.team !== 'FA') playoff += ' — he was out injured';
  }
  const champMine = champ === myT && me.gp > 0;
  if (champMine) { awards.push('NBA Champion'); C.rings++; if (mine(fmvp) && !L.userOutForPlayoffs) awards.push('Finals MVP'); }

  const sorted = me.team !== 'FA' ? roster(L, me.team).sort((a, b) => b.ovr - a.ovr) : [];
  const rank = sorted.indexOf(me) + 1;
  const role = me.team === 'FA' ? 'Out of the league' : me.rank <= 1 ? 'Franchise player' : me.rank <= 3 ? 'Core starter' : me.rank <= 5 ? 'Starter' : me.rank <= 8 ? 'Rotation' : me.rank <= 10 ? 'Deep bench' : 'Out of the rotation';
  const st = me.stats || { mpg: 0, ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fg: 0, tp: 0, ft: 0 };
  const season = {
    year: L.year, label: seasonLabel(L.year), team: me.team, startTeam, age: me.age, ovr: me.ovr, gp: me.gp || 0,
    ...Object.fromEntries(['mpg', 'ppg', 'rpg', 'apg', 'spg', 'bpg', 'fg', 'tp', 'ft'].map((k) => [k, st[k]])),
    wins: rec[me.team] ?? null, losses: rec[me.team] != null ? 82 - rec[me.team] : null,
    playoff, awards, injuries: inj.injuries, events, role, rank,
    mvpRank: mvpRank > 0 && mvpRank <= 10 ? mvpRank : null,
    salary: C.contract.team === 'FA' ? 0 : C.contract.salary,
    champion: champ, champScore: finals.score, runnerUp: finals.loser,
    mvp: byMvp[0] ? byMvp[0].name : '', mvpTeam: byMvp[0]?.team,
    leaders: { pts: scoring && [scoring.name, scoring.stats.ppg], reb: rebTitle && [rebTitle.name, rebTitle.stats.rpg], ast: astTitle && [astTitle.name, astTitle.stats.apg] },
    dpoy: byDef[0]?.name, fmvp: fmvp?.name,
    standings: Object.fromEntries(['East', 'West'].map((c) => [c, seeds[c].order.map((t) => [t, rec[t]])])),
  };
  C.earnings += season.salary;
  C.seasons.push(season);
  C.log.push(`${season.label}: ${summaryLine(season)}`);
  offseason(C);
  return season;
}

function summaryLine(s) {
  if (s.team === 'FA' && s.gp === 0) return 'Spent the season out of the NBA.';
  const bits = [`${s.ppg} PPG / ${s.rpg} RPG / ${s.apg} APG in ${s.gp} games (${team(s.team).abbr})`];
  if (s.awards.length) bits.push(s.awards.join(', '));
  bits.push(s.playoff);
  return bits.join(' · ');
}

// ---------- offseason ----------
const FIRST = ['Jalen', 'Cam', 'Tre', 'Malik', 'Jaylen', 'Isaiah', 'Darius', 'Marcus', 'Ty', 'Keon', 'Amari', 'Zion', 'Dylan', 'Bryce', 'Caleb', 'Elijah', 'Nikola', 'Luka', 'Matas', 'Theo', 'Andre', 'Kobe', 'Devin', 'Jordan', 'Aaron', 'Xavier', 'Omar', 'Rasheed', 'Quinn', 'Kai', 'Miles', 'Jabari', 'Trey', 'DeShawn', 'Mikal', 'Ousmane', 'Alperen', 'Tidjane', 'Noah', 'Reed', 'Collin', 'AJ', 'Cooper', 'Ace', 'Dariq', 'Kasparas', 'Hugo', 'Yanic', 'Egor', 'Khaman'];
const LAST = ['Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Hill', 'Green', 'Adams', 'Baker', 'Nelson', 'Carter', 'Mitchell', 'Roberts', 'Turner', 'Phillips', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Murphy', 'Cook', 'Rogers', 'Bell', 'Bailey', 'Petrovic', 'Diallo', 'Okafor', 'Sarr', 'Jovic', 'Fernandez', 'Kalkbrenner', 'Boozer', 'Dybantsa', 'Peterson'];

function draft(L, rec) {
  const order = TEAM_IDS.slice().sort((a, b) => (rec[a] ?? 41) - (rec[b] ?? 41));
  // light lottery shuffle among the worst 14
  const lottery = order.slice(0, 14).sort((a, b) => (rec[a] - rec[b]) + gauss() * 6);
  const full = [...lottery, ...order.slice(14)];
  const templates = PLAYERS.filter((p) => p.ovr >= 68 && p.ovr <= 82);
  const picks = [];
  for (let i = 0; i < 60; i++) {
    const tid = full[i % 30];
    const n = i + 1;
    const target = n === 1 ? randi(75, 80) : n <= 5 ? randi(71, 77) : n <= 14 ? randi(67, 73) : n <= 30 ? randi(63, 70) : randi(57, 66);
    const tpl = pick(templates);
    const id = `rk-${L.year + 1}-${n}-${Math.random().toString(36).slice(2, 6)}`;
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const pot = n <= 2 ? pick(['A+', 'A', 'A-']) : n <= 10 ? pick(['A-', 'B+', 'B+', 'B']) : n <= 30 ? pick(['B+', 'B', 'B', 'B-']) : pick(['B', 'B-', 'C+', 'C']);
    L.players[id] = { id, name, team: tid, ovr: target, prevOvr: target, age: randi(19, 22), pot, ceil: ceilingFor(pot, target, 19), pos: tpl.positions[0], base: tpl.id, off: target - tpl.ovr, yrs: n <= 30 ? 4 : 2, exp: 0, rookie: L.year + 1, pick: n };
    picks.push(L.players[id]);
  }
  return picks;
}

function progressUser(L, delta) {
  const u = L.user; const me = L.players[u.id]; const age = me.age;
  const before = me.ovr;
  for (const k of Object.keys(u.attrs)) {
    let d = delta + gauss() * 1.1;
    if (ATHLETIC.includes(k)) d += age >= 29 ? -(age - 28) * 0.45 : age <= 24 ? 0.6 : 0;
    if (SKILL.includes(k)) d += age >= 25 && age <= 33 ? 0.7 : 0;
    u.attrs[k] = clamp(Math.round(u.attrs[k] + d));
  }
  if (age >= 30) for (const p of PARTS) u.durab[p] = clamp(u.durab[p] - randi(0, 2));
  else if (age <= 24) for (const p of PARTS) u.durab[p] = clamp(u.durab[p] + randi(0, 1));
  u.attrs.durability = Math.round(PARTS.reduce((s, p) => s + u.durab[p], 0) / PARTS.length);
  // steer so the overall lands where the age curve says
  const target = clamp(before + delta, 40, 99);
  const pos = u.positions[0];
  const wsum = MODEL.weights[pos].slice(1, -1).reduce((a, b) => a + b, 0);
  for (let it = 0; it < 3; it++) {
    const diff = target - rawOvrAt(pos, u.attrs, u.height);
    if (Math.abs(diff) < 0.3) break;
    const shift = diff / wsum;
    for (const k of Object.keys(u.attrs)) if (k !== 'durability') u.attrs[k] = clamp(u.attrs[k] + shift);
  }
  for (const k of Object.keys(u.attrs)) u.attrs[k] = Math.round(u.attrs[k]);
  u.ovr = ovrAt(pos, u.attrs, u.height);
  me.ovr = u.ovr;
}

function offseason(C) {
  const L = C.league; const me = L.players[L.user.id];
  const last = C.seasons[C.seasons.length - 1];
  const rec = Object.fromEntries(Object.values(last.standings).flat());
  const notes = [];

  // aging and development
  for (const p of Object.values(L.players)) {
    if (p.retired) continue;
    p.prevOvr = p.ovr;
    const d = progressionDelta(p.age, p.pot, p.ovr, p.ceil ?? 99);
    p.age += 1; p.exp += 1;
    if (p.user) { progressUser(L, d); L.user.age = p.age; L.user.years = p.exp; continue; }
    p.ovr = clamp(Math.round(p.ovr + d), 40, 99);
    p.off = p.ovr - BASE[p.base].ovr;
  }
  // retirements
  for (const p of Object.values(L.players)) {
    if (p.retired || p.user) continue;
    let pr = 0;
    if (p.age >= 40) pr = 0.9;
    else if (p.age >= 37) pr = p.ovr < 80 ? 0.75 : 0.3;
    else if (p.age >= 34) pr = p.ovr < 76 ? 0.5 : 0.08;
    if (p.ovr < 63 && p.age > 24) pr = Math.max(pr, 0.6);
    if (p.team === 'FA' && p.age >= 31) pr = Math.max(pr, 0.5);
    if (chance(pr)) { p.retired = true; p.team = 'RET'; }
  }
  const picks = draft(L, rec);
  // contracts tick down; expiring players hit free agency (some re-sign)
  for (const p of Object.values(L.players)) {
    if (p.retired || p.user || p.team === 'FA' || p.rookie === L.year + 1) continue;
    p.yrs -= 1;
    if (p.yrs <= 0) {
      if (chance(p.ovr >= 85 ? 0.65 : 0.45)) p.yrs = contractYearsFor(p.age, p.ovr);
      else { p.team = 'FA'; p.yrs = 0; }
    }
  }
  L.year += 1;
  const myPick = picks.find((p) => p.team === me.team);
  if (myPick) notes.push(`The ${team(me.team).nick} drafted ${myPick.name} (#${myPick.pick} pick).`);

  // the user's contract
  C.pending = null;
  if (me.team !== 'FA') {
    C.contract.years -= 1; me.yrs = C.contract.years;
  }
  if (me.team === 'FA' || C.contract.years <= 0) {
    me.team = 'FA';
    C.pending = { type: 'freeAgency', offers: generateOffers(C, last.team) };
  }
  C.frontOffice = me.ovr >= 95 ? { signings: 0, starSigned: false, trades: 0 } : null;
  C.phase = 'offseason';
  C.offseasonNotes = notes;
  checkForcedRetirement(C);
}

function checkForcedRetirement(C) {
  const me = C.league.players[C.league.user.id];
  if (me.age >= 43) { C.pending = { type: 'forcedRetire', reason: `At ${me.age}, his body finally gave out.` }; }
}

// ---------- free agency ----------
export function generateOffers(C, prevTeam) {
  const L = C.league; const me = L.players[L.user.id];
  const ovr = me.ovr; const age = me.age;
  let n;
  if (ovr >= 95) n = 30;
  else if (ovr >= 90) n = randi(7, 12);
  else if (ovr >= 85) n = randi(4, 8);
  else if (ovr >= 80) n = randi(2, 6);
  else if (ovr >= 77) n = randi(1, 4);
  else if (ovr >= 75) n = chance(0.75) ? randi(1, 2) : 0;
  else if (ovr >= 73) n = chance(age <= 27 ? 0.45 : 0.25) ? 1 : 0;
  else if (ovr >= 70) n = chance(age <= 24 ? 0.3 : 0.06) ? 1 : 0;
  else n = 0;
  if (age >= 34 && ovr < 95) n = Math.floor(n * 0.6);
  if (age >= 38 && ovr < 85) n = Math.floor(n * 0.5);
  const all = TEAM_IDS.slice().sort(() => Math.random() - 0.5);
  if (prevTeam && TEAMS[prevTeam] && ovr >= 78 && n > 0) { all.splice(all.indexOf(prevTeam), 1); all.unshift(prevTeam); }
  const market = marketSalary(ovr, age, L.year, me.exp);
  const offers = all.slice(0, n).map((t) => {
    const r = roster(L, t).filter((p) => !p.user).sort((a, b) => b.ovr - a.ovr);
    const depth = r.filter((p) => p.ovr > ovr).length + 1;
    const lastRec = C.seasons.length ? C.seasons[C.seasons.length - 1].standings : null;
    const w = lastRec ? Object.fromEntries(Object.values(lastRec).flat())[t] : null;
    const contender = w != null && w >= 50;
    const years = ovr < 75 ? 1 : contractYearsFor(age, ovr);
    let salary = market * (ovr >= 93 ? 1 : rand(0.88, 1.12)) * (contender && ovr < 93 ? 0.92 : 1);
    if (t === prevTeam) salary *= 1.05;
    const kind = ovr < 75 ? pick(['Non-guaranteed training camp deal', 'Two-way contract', 'Veteran minimum']) : ovr < 77 ? 'Minimum contract' : null;
    return { team: t, years, salary: r1(salary), role: depth <= 1 ? 'Franchise player' : depth <= 3 ? 'Starter' : depth <= 5 ? 'Starter' : depth <= 8 ? 'Rotation' : 'Bench', depth, lastWins: w, kind, resign: t === prevTeam };
  });
  return offers.sort((a, b) => b.salary - a.salary);
}

export function acceptOffer(C, offer) {
  const L = C.league; const me = L.players[L.user.id];
  me.team = offer.team; me.yrs = offer.years;
  C.contract = { team: offer.team, years: offer.years, salary: offer.salary };
  trimRoster(L, offer.team, me.id);
  const verb = offer.resign ? 'Re-signed with' : 'Signed with';
  C.log.push(`${seasonLabel(L.year)} offseason: ${verb} the ${team(offer.team).name} — ${offer.years} yr${offer.years > 1 ? 's' : ''}, ${money(offer.salary)}/yr${offer.kind ? ` (${offer.kind})` : ''}.`);
  C.pending = null;
}

export function sitOut(C) {
  C.log.push(`${seasonLabel(C.league.year)} offseason: No NBA deal. Heading to the G League / overseas to try to earn another shot.`);
  C.pending = null;
}

export function retire(C, reason) {
  C.retired = true; C.phase = 'retired'; C.pending = null;
  const me = C.league.players[C.league.user.id];
  me.retired = true; me.team = 'RET';
  C.log.push(`${seasonLabel(C.league.year)}: Retired at age ${me.age}${reason ? ` — ${reason}` : ''}.`);
  C.legacy = legacy(C);
}

// ---------- front office (95+ overall) ----------
export function freeAgentPool(C) {
  const L = C.league;
  return Object.values(L.players).filter((p) => p.team === 'FA' && !p.retired && !p.user).sort((a, b) => b.ovr - a.ovr).slice(0, 60);
}

export function signFreeAgent(C, pid) {
  const L = C.league; const me = L.players[L.user.id]; const p = L.players[pid];
  const fo = C.frontOffice;
  if (!fo || me.team === 'FA') return 'You need to be on a team first.';
  if (fo.signings >= 2) return 'Two signings per offseason — the cap sheet is maxed out.';
  if (p.ovr >= 85 && fo.starSigned) return 'You already landed a star this summer. Only role players (84 or below) can still fit.';
  p.team = me.team; p.yrs = contractYearsFor(p.age, p.ovr);
  fo.signings++; if (p.ovr >= 85) fo.starSigned = true;
  trimRoster(L, me.team, me.id);
  C.log.push(`${seasonLabel(L.year)} offseason: Recruited ${p.name} (${p.ovr} OVR) to the ${team(me.team).nick}.`);
  return null;
}

export function assetValue(p) {
  const age = p.age <= 22 ? 1.4 : p.age <= 25 ? 1.2 : p.age <= 29 ? 1 : p.age <= 32 ? 0.75 : 0.5;
  return Math.pow(1.17, p.ovr - 70) * age * (1 + (POT_BONUS[p.pot] ?? 0) * 0.05);
}

export function tradeTargets(C) {
  const L = C.league; const me = L.players[L.user.id];
  return Object.values(L.players).filter((p) => !p.retired && !p.user && p.team !== 'FA' && p.team !== me.team && TEAMS[p.team]).sort((a, b) => b.ovr - a.ovr).slice(0, 150);
}

export function evaluateTrade(C, targetId, outIds) {
  const L = C.league; const t = L.players[targetId];
  const give = outIds.map((id) => L.players[id]).reduce((s, p) => s + assetValue(p), 0);
  const want = assetValue(t) * 0.95; // a 95+ star has leverage
  return { give, want, ok: outIds.length > 0 && give >= want, pct: Math.min(1, give / want) };
}

export function executeTrade(C, targetId, outIds) {
  const L = C.league; const me = L.players[L.user.id]; const t = L.players[targetId];
  const ev = evaluateTrade(C, targetId, outIds);
  if (!ev.ok) return 'The other front office hung up. Add more value.';
  if (C.frontOffice.trades >= 2) return 'Two trades per offseason max.';
  const other = t.team;
  outIds.forEach((id) => (L.players[id].team = other));
  t.team = me.team;
  C.frontOffice.trades++;
  trimRoster(L, me.team, me.id); trimRoster(L, other, null);
  C.log.push(`${seasonLabel(L.year)} offseason: Traded for ${t.name} (${t.ovr} OVR) from the ${team(other).nick}, sending ${outIds.map((id) => L.players[id].name).join(', ')}.`);
  return null;
}

export function requestTrade(C, toTeam) {
  const L = C.league; const me = L.players[L.user.id]; const from = me.team;
  const back = roster(L, toTeam).filter((p) => !p.user).sort((a, b) => b.ovr - a.ovr).slice(0, 2);
  back.forEach((p) => (p.team = from));
  me.team = toTeam; C.contract.team = toTeam;
  trimRoster(L, toTeam, me.id);
  C.log.push(`${seasonLabel(L.year)} offseason: Forced a trade from the ${team(from).nick} to the ${team(toTeam).name}${back.length ? ` (${back.map((p) => p.name).join(' & ')} went the other way)` : ''}.`);
}

// ---------- AI free agency, then next season ----------
function aiFreeAgency(L) {
  const fas = Object.values(L.players).filter((p) => p.team === 'FA' && !p.retired && !p.user).sort((a, b) => b.ovr - a.ovr);
  const size = Object.fromEntries(TEAM_IDS.map((t) => [t, roster(L, t).length]));
  for (const p of fas) {
    const open = TEAM_IDS.filter((t) => size[t] < 14);
    if (!open.length) break;
    if (p.ovr < 66 && chance(0.6)) continue;
    const t = pick(open);
    p.team = t; p.yrs = contractYearsFor(p.age, p.ovr); size[t]++;
  }
  // pad any thin roster with G League call-ups
  for (const t of TEAM_IDS) {
    while (size[t] < 13) {
      const tpl = pick(PLAYERS.filter((x) => x.ovr >= 62 && x.ovr <= 72));
      const ovr = randi(60, 68);
      const id = `gl-${L.year}-${t}-${size[t]}-${Math.random().toString(36).slice(2, 5)}`;
      L.players[id] = { id, name: `${pick(FIRST)} ${pick(LAST)}`, team: t, ovr, prevOvr: ovr, age: randi(22, 28), pot: 'B-', ceil: ovr + 3, pos: tpl.positions[0], base: tpl.id, off: ovr - tpl.ovr, yrs: 1, exp: 0 };
      size[t]++;
    }
    trimRoster(L, t, L.user.id);
  }
  // keep save size bounded: drop long-retired and unsigned scrubs
  for (const [id, p] of Object.entries(L.players)) if (!p.user && (p.retired || (p.team === 'FA' && p.ovr < 62))) delete L.players[id];
}

export function startSeason(C) {
  const L = C.league; const me = L.players[L.user.id];
  aiFreeAgency(L);
  if (me.team === 'FA' && me.ovr >= 72 && chance(me.ovr >= 75 ? 0.5 : 0.2)) {
    const t = pick(TEAM_IDS);
    me.team = t; C.contract = { team: t, years: 1, salary: marketSalary(me.ovr, me.age, L.year, me.exp) };
    trimRoster(L, t, me.id);
    C.log.push(`${seasonLabel(L.year)}: Earned a camp invite and made the ${team(t).name} roster.`);
  }
  C.phase = 'preseason';
  C.frontOffice = null;
  return simSeason(C);
}

// Auto-pilot for "sim to retirement".
export function autoOffseason(C) {
  const L = C.league; const me = L.players[L.user.id];
  if (C.pending?.type === 'forcedRetire') { retire(C, C.pending.reason); return; }
  const lastTwo = C.seasons.slice(-2);
  if (me.age >= 37 && me.ovr < 80) { retire(C, 'decided it was time to walk away.'); return; }
  if (me.ovr < 70 && me.age >= 30) { retire(C, 'no longer an NBA-level player.'); return; }
  if (lastTwo.length === 2 && lastTwo.every((s) => s.gp === 0)) { retire(C, 'two straight years out of the league.'); return; }
  if (C.pending?.type === 'freeAgency') {
    const o = C.pending.offers;
    if (!o.length) { if (me.age >= 31) { retire(C, 'no NBA offers came.'); return; } sitOut(C); }
    else acceptOffer(C, o.slice().sort((a, b) => b.salary * 0.6 + (b.lastWins ?? 41) * 0.5 - (a.salary * 0.6 + (a.lastWins ?? 41) * 0.5))[0]);
  }
  if (C.frontOffice && me.team !== 'FA') {
    const pool = freeAgentPool(C);
    const star = pool.find((p) => p.ovr >= 85);
    if (star) signFreeAgent(C, star.id);
    const role = freeAgentPool(C).find((p) => p.ovr < 85);
    if (role) signFreeAgent(C, role.id);
  }
}

// ---------- legacy ----------
export function careerTotals(C) {
  const s = C.seasons.filter((x) => x.gp > 0);
  const gp = s.reduce((a, x) => a + x.gp, 0) || 1;
  const tot = (k) => s.reduce((a, x) => a + x[k] * x.gp, 0);
  const awards = {};
  for (const x of C.seasons) for (const a of x.awards) awards[a] = (awards[a] || 0) + 1;
  return {
    seasons: s.length, gp: s.reduce((a, x) => a + x.gp, 0),
    pts: Math.round(tot('ppg')), reb: Math.round(tot('rpg')), ast: Math.round(tot('apg')), stl: Math.round(tot('spg')), blk: Math.round(tot('bpg')),
    ppg: r1(tot('ppg') / gp), rpg: r1(tot('rpg') / gp), apg: r1(tot('apg') / gp), spg: r1(tot('spg') / gp), bpg: r1(tot('bpg') / gp),
    awards, peak: Math.max(...C.seasons.map((x) => x.ovr), C.league.user.ovr), earnings: C.earnings,
  };
}

export function legacy(C) {
  const t = careerTotals(C); const a = t.awards; const g = (k) => a[k] || 0;
  const score = g('MVP') * 12 + g('Finals MVP') * 7 + g('NBA Champion') * 5 + g('All-NBA 1st Team') * 5 + (g('All-NBA 2nd Team') + g('All-NBA 3rd Team')) * 2.5 + g('All-Star') * 2.2 + g('Defensive Player of the Year') * 5 + g('Scoring Title') * 3 + t.pts / 1500;
  const hof = Math.round(100 / (1 + Math.exp(-(score - 42) / 7)));
  let verdict;
  if (score >= 140) verdict = 'Greatest of All Time conversation';
  else if (score >= 95) verdict = 'Top-10 all-time legend';
  else if (score >= 60) verdict = 'First-ballot Hall of Famer';
  else if (score >= 35) verdict = 'Hall of Fame candidate';
  else if (score >= 18) verdict = 'Very good NBA career';
  else if (t.seasons >= 8) verdict = 'Solid journeyman pro';
  else if (t.seasons >= 3) verdict = 'Brief NBA career';
  else verdict = 'Cup of coffee in the league';
  return { score: Math.round(score), hof, verdict };
}

// ---------- UI helpers ----------
export function teamRoster(C, tid) {
  const L = C.league;
  return roster(L, tid).sort((a, b) => b.ovr - a.ovr);
}
export const currentPlayer = (C) => C.league.players[C.league.user.id];
