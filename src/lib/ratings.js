import MODEL from '../data/model.json';

export const PARTS = MODEL.parts;

// 2K attribute groups, in the order the game shows them.
export const CATEGORIES = [
  { key: 'outside', label: 'Outside Scoring', attrs: [['closeShot', 'Close Shot'], ['midRange', 'Mid-Range Shot'], ['threePoint', 'Three-Point Shot'], ['freeThrow', 'Free Throw'], ['shotIQ', 'Shot IQ'], ['offConsistency', 'Offensive Consistency']] },
  { key: 'athleticism', label: 'Athleticism', attrs: [['speed', 'Speed'], ['agility', 'Agility'], ['strength', 'Strength'], ['vertical', 'Vertical'], ['stamina', 'Stamina'], ['hustle', 'Hustle'], ['durability', 'Overall Durability']] },
  { key: 'inside', label: 'Inside Scoring', attrs: [['layup', 'Layup'], ['standingDunk', 'Standing Dunk'], ['drivingDunk', 'Driving Dunk'], ['postHook', 'Post Hook'], ['postFade', 'Post Fade'], ['postControl', 'Post Control'], ['drawFoul', 'Draw Foul'], ['hands', 'Hands']] },
  { key: 'playmaking', label: 'Playmaking', attrs: [['passAccuracy', 'Pass Accuracy'], ['ballHandle', 'Ball Handle'], ['speedWithBall', 'Speed with Ball'], ['passIQ', 'Pass IQ'], ['passVision', 'Pass Vision']] },
  { key: 'defense', label: 'Defense', attrs: [['interiorD', 'Interior Defense'], ['perimeterD', 'Perimeter Defense'], ['steal', 'Steal'], ['block', 'Block'], ['helpDefIQ', 'Help Defense IQ'], ['passPerception', 'Pass Perception'], ['defConsistency', 'Defensive Consistency']] },
  { key: 'rebounding', label: 'Rebounding', attrs: [['offRebound', 'Offensive Rebound'], ['defRebound', 'Defensive Rebound']] },
];
export const ATTR_KEYS = CATEGORIES.flatMap((c) => c.attrs.map((a) => a[0])).concat('intangibles');
export const ATTR_LABEL = Object.fromEntries(CATEGORIES.flatMap((c) => c.attrs).concat([['intangibles', 'Intangibles']]));

export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const POS_HEIGHT = { PG: 75, SG: 77, SF: 79, PF: 81, C: 83 };
const POT_ORDER = ['C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];

export const clamp = (v, lo = 25, hi = 99) => Math.max(lo, Math.min(hi, v));
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function rawOvrAt(pos, attrs, height) {
  const w = MODEL.weights[pos];
  let s = w[0];
  MODEL.features.slice(1, -1).forEach((k, i) => (s += w[i + 1] * attrs[k]));
  return s + w[w.length - 1] * height;
}
export const ovrAt = (pos, attrs, height) => Math.round(clamp(rawOvrAt(pos, attrs, height), 40, 99));

export function categoryOvrs(attrs) {
  return CATEGORIES.map((c) => ({ ...c, value: Math.round(avg(c.attrs.map(([k]) => attrs[k]))) }));
}
export const positionOvrs = (attrs, height) => POSITIONS.map((p) => ({ pos: p, value: ovrAt(p, attrs, height) }));

export function fmtHeight(inches) {
  const i = Math.round(inches);
  return `${Math.floor(i / 12)}'${i % 12}"`;
}

export function tier(ovr) {
  if (ovr >= 97) return { label: 'Generational Superstar', short: 'GOAT Tier', color: 'var(--r-pink)' };
  if (ovr >= 93) return { label: 'Superstar / MVP Candidate', short: 'Superstar', color: 'var(--r-purple)' };
  if (ovr >= 88) return { label: 'All-Star', short: 'All-Star', color: 'var(--r-blue)' };
  if (ovr >= 84) return { label: 'Quality Starter', short: 'Starter', color: 'var(--r-green)' };
  if (ovr >= 80) return { label: 'Starter / Sixth Man', short: 'Rotation+', color: 'var(--r-green)' };
  if (ovr >= 76) return { label: 'Rotation Player', short: 'Rotation', color: 'var(--r-yellow)' };
  if (ovr >= 73) return { label: 'End of Bench — Fringe NBA', short: 'Fringe', color: 'var(--r-orange)' };
  return { label: 'G League / Out of the NBA', short: 'G League', color: 'var(--r-red)' };
}

export function ratingClass(v) {
  if (v >= 95) return 'r-pink';
  if (v >= 90) return 'r-purple';
  if (v >= 85) return 'r-blue';
  if (v >= 80) return 'r-green';
  if (v >= 70) return 'r-yellow';
  if (v >= 60) return 'r-orange';
  return 'r-red';
}

const BADGE_RANK = { bronze: 1, silver: 2, gold: 3, hof: 4, legend: 5 };
export const BADGE_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', hof: 'Hall of Fame', legend: 'Legend' };

// Choose a position for the merged body: any position his height can realistically play
// (within 4" of that position's typical height), taking the one he rates best at.
function pickPosition(attrs, height) {
  const fits = POSITIONS.filter((p) => Math.abs(POS_HEIGHT[p] - height) <= 4);
  const pool = fits.length ? fits : [POSITIONS.slice().sort((x, y) => Math.abs(POS_HEIGHT[x] - height) - Math.abs(POS_HEIGHT[y] - height))[0]];
  return pool.slice().sort((x, y) => rawOvrAt(y, attrs, height) - rawOvrAt(x, attrs, height))[0];
}

export function mergePlayers(a, b) {
  const attrs = {};
  const source = {};
  for (const k of ATTR_KEYS) {
    attrs[k] = Math.max(a.attrs[k], b.attrs[k]);
    source[k] = a.attrs[k] === b.attrs[k] ? 0 : a.attrs[k] > b.attrs[k] ? 1 : 2;
  }
  const durab = {};
  for (const p of PARTS) durab[p] = Math.max(a.durab[p], b.durab[p]);
  const height = (a.height + b.height) / 2;
  const weight = Math.round((a.weight + b.weight) / 2);
  const wingspan = (a.wingspan + b.wingspan) / 2;
  const badges = {};
  for (const [n, l] of [...a.badges, ...b.badges]) if (!badges[n] || BADGE_RANK[l] > BADGE_RANK[badges[n]]) badges[n] = l;
  const pos = pickPosition(attrs, height);
  const second = POSITIONS[POSITIONS.indexOf(pos) + (POSITIONS.indexOf(pos) === 4 ? -1 : 1)];
  const potential = POT_ORDER.indexOf(a.potential) >= POT_ORDER.indexOf(b.potential) ? a.potential : b.potential;
  const m = {
    id: `merge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    merged: true,
    first: a.first,
    last: b.last,
    name: `${a.first} ${b.last}`,
    parents: [a.id, b.id],
    parentNames: [a.name, b.name],
    team: a.team !== 'FA' ? a.team : b.team,
    positions: [pos, second],
    archetype: `${a.archetype.split(' ')[0]} ${b.archetype.split(' ').slice(1).join(' ') || b.archetype}`.trim(),
    height,
    weight,
    wingspan,
    age: Math.round((a.age + b.age) / 2),
    years: Math.round((a.years + b.years) / 2),
    nationality: a.nationality,
    potential,
    attrs,
    source,
    durab,
    badges: Object.entries(badges).sort((x, y) => BADGE_RANK[y[1]] - BADGE_RANK[x[1]]),
    created: Date.now(),
  };
  m.ovr = ovrAt(pos, attrs, height);
  return m;
}

export const headshot = (p) => `/headshots/${p.id}.webp`;
