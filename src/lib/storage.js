const LOCKER = 'p2k-locker-v1';
const CAREER = (id) => `p2k-career-v1-${id}`;

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const loadLocker = () => read(LOCKER, []);
export const saveLocker = (list) => write(LOCKER, list);

// transient per-season fields on league players are dropped to keep saves small
export function saveCareer(c) {
  const players = {};
  for (const [k, p] of Object.entries(c.league.players)) {
    const { stats, _mvp, mpg, rank, gp, ...rest } = p; // eslint-disable-line no-unused-vars
    players[k] = rest;
  }
  return write(CAREER(c.id), { ...c, league: { ...c.league, players } });
}
export const loadCareer = (id) => read(CAREER(id), null);
export function deleteCareer(id) { try { localStorage.removeItem(CAREER(id)); } catch { /* storage unavailable */ } }
