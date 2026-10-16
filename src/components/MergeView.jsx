import React from 'react';
import PLAYERS from '../data/players.json';
import { TEAMS, team } from '../data/teams.js';
import { CATEGORIES, PARTS, categoryOvrs, explainMerge, fmtHeight, mergePlayers, ratingClass, tier } from '../lib/ratings.js';
import { Modal, Ovr, PlayerImg } from './common.jsx';

const SORTED = PLAYERS.slice().sort((a, b) => b.ovr - a.ovr);

function PlayerPicker({ onPick, onClose, label }) {
  const [q, setQ] = React.useState('');
  const list = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = s ? SORTED.filter((p) => p.name.toLowerCase().includes(s) || team(p.team).name.toLowerCase().includes(s) || team(p.team).abbr.toLowerCase() === s) : SORTED;
    return r.slice(0, 120);
  }, [q]);
  return (
    <Modal title={`Choose ${label}`} onClose={onClose}>
      <input className="search" autoFocus placeholder="Search 653 players or a team…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pick-list">
        {list.map((p) => (
          <button key={p.id} className="pick-item" onClick={() => onPick(p)}>
            <PlayerImg player={p} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="n">{p.name}</div>
              <div className="s">{team(p.team).abbr} · {p.positions.join('/')} · {fmtHeight(p.height)}</div>
            </div>
            <Ovr value={p.ovr} size="sm" />
          </button>
        ))}
        {!list.length && <div className="muted">No players match “{q}”.</div>}
      </div>
    </Modal>
  );
}

function Slot({ n, player, locked, onLock, onRandom, onChoose, onSheet }) {
  return (
    <div className={`panel slot p${n}`}>
      <div className="slot-label">
        <span>Player {n === 1 ? 'One' : 'Two'}</span>
        <span className="muted" style={{ fontSize: 11, letterSpacing: 1 }}>{n === 1 ? 'gives first name' : 'gives last name'}</span>
      </div>
      <div className="pcard">
        <PlayerImg player={player} />
        <div className="meta">
          <div className="first">{player.first}</div>
          <div className="last">{player.last}</div>
          <div className="sub">
            {team(player.team).name} · {player.positions.join(' / ')}<br />
            {fmtHeight(player.height)} · {player.weight} lbs · Age {player.age}
          </div>
        </div>
        <button className="ovr-wrap" onClick={onSheet} style={{ background: 'none', border: 0, padding: 0 }} title="Full overall sheet">
          <Ovr value={player.ovr} />
        </button>
      </div>
      <div className="slot-actions">
        <button className="btn" onClick={onRandom} disabled={locked}>🎲 Randomize</button>
        <button className="btn" onClick={onChoose}>🔎 Choose</button>
        <button className={`btn ${locked ? 'gold' : ''}`} onClick={onLock} title="Lock this player while randomizing">{locked ? '🔒' : '🔓'}</button>
      </div>
    </div>
  );
}

function AttrCompare({ a, b, m }) {
  const ca = categoryOvrs(a.attrs), cb = categoryOvrs(b.attrs), cm = categoryOvrs(m.attrs);
  const cell = (v, side, src) => <span className={src === 0 ? '' : src === side ? `win${side}` : 'lose'}>{v}</span>;
  const groups = [...CATEGORIES, { key: 'intangibles', label: 'Intangibles', attrs: [['intangibles', 'Intangibles']] }];
  return (
    <div className="attr-wrap">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 className="h2" style={{ margin: 0 }}>Every 2K rating</h3>
        <div className="legend">
          <span><i style={{ background: 'var(--p1)' }} />{a.name}</span>
          <span><i style={{ background: 'var(--p2)' }} />{b.name}</span>
          <span>Merged keeps the higher rating</span>
        </div>
      </div>
      <div className="attr-grid" style={{ marginTop: 12 }}>
        {groups.map((g, gi) => (
          <div className="attr-group" key={g.key}>
            <h4>{g.label}<span className="c1">P1</span><span className="c2">P2</span><span>MRG</span></h4>
            {g.attrs.map(([k, label]) => (
              <div className="attr-row" key={k}>
                <div>{label}</div>
                {cell(a.attrs[k], 1, m.source[k])}
                {cell(b.attrs[k], 2, m.source[k])}
                <span className={`mv ${ratingClass(m.attrs[k])}`}>{m.attrs[k]}</span>
              </div>
            ))}
            {gi < CATEGORIES.length && (
              <div className="attr-row avg">
                <div>Category Overall</div>
                <span>{ca[gi].value}</span><span>{cb[gi].value}</span>
                <span className={`mv ${ratingClass(cm[gi].value)}`}>{cm[gi].value}</span>
              </div>
            )}
          </div>
        ))}
        <div className="attr-group">
          <h4>Durability<span className="c1">P1</span><span className="c2">P2</span><span>MRG</span></h4>
          {PARTS.map((k) => {
            const src = a.durab[k] === b.durab[k] ? 0 : a.durab[k] > b.durab[k] ? 1 : 2;
            return (
              <div className="attr-row" key={k}>
                <div>{k}</div>
                {cell(a.durab[k], 1, src)}
                {cell(b.durab[k], 2, src)}
                <span className={`mv ${ratingClass(m.durab[k])}`}>{m.durab[k]}</span>
              </div>
            );
          })}
        </div>
      </div>
      <h3 className="h3" style={{ marginTop: 20 }}>Merged badges · {m.badges.length}</h3>
      <div className="badges">{m.badges.map(([n, l]) => <span key={n} className={`badge ${l}`}>{n}</span>)}</div>
    </div>
  );
}

const sign = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`;

function WhyOvr({ a, b, m }) {
  const e = explainMerge(m, a, b);
  const top = e.rows.slice(0, 8);
  const rest = e.attrGain - top.reduce((s, r) => s + r.pts, 0);
  return (
    <details className="why">
      <summary>Why {m.ovr} OVR?</summary>
      <p className="muted" style={{ maxWidth: 720, lineHeight: 1.6 }}>
        He starts from {e.base.name}'s {e.base.ovr}, then picks up every rating where {e.other.name} was better.
        Two players with different strengths fill each other's holes, so the merged player is better than both at almost everything.
        That's why two similar overalls usually land a few points higher. Bigger jumps happen when the two are very different (a shooter plus a rim protector, say).
      </p>
      <table>
        <tbody>
          <tr><td>{e.base.name}</td><td /><td style={{ color: 'var(--text)' }}>{e.base.ovr}</td></tr>
          {top.map((r) => <tr key={r.k}><td>{r.label}</td><td className="muted">{r.from} → {r.to}</td><td>{sign(r.pts)}</td></tr>)}
          {rest >= 0.05 && <tr><td>{e.rows.length - top.length} smaller upgrades</td><td /><td>{sign(rest)}</td></tr>}
          {Math.abs(e.shift) >= 0.05 && <tr><td>Height {fmtHeight(m.height)} at {m.positions[0]}</td><td /><td style={{ color: e.shift < 0 ? 'var(--r-red)' : undefined }}>{sign(e.shift)}</td></tr>}
          {Math.abs(e.fit) >= 0.3 && <tr><td>Formula estimate vs. {e.base.last}'s real 2K overall, rounding</td><td /><td style={{ color: e.fit < 0 ? 'var(--r-red)' : undefined }}>{sign(e.fit)}</td></tr>}
          <tr className="tot"><td>Merged overall (rounded, max 99)</td><td /><td>{m.ovr}</td></tr>
        </tbody>
      </table>
    </details>
  );
}

function CountUp({ to }) {
  const [v, setV] = React.useState(40);
  React.useEffect(() => {
    let raf; const start = performance.now();
    const step = (t) => { const k = Math.min(1, (t - start) / 900); setV(Math.round(40 + (to - 40) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <Ovr value={v} size="xl" />;
}

export default function MergeView({ state, setState, onSave, onCareer, savedIds, openSheet }) {
  const { p1, p2, merged, lock, pool, minOvr } = state;
  const [picker, setPicker] = React.useState(null);
  const [flash, setFlash] = React.useState(0);
  const candidates = React.useMemo(() => PLAYERS.filter((p) => (pool === 'all' || p.team !== 'FA') && p.ovr >= minOvr), [pool, minOvr]);
  const rnd = (not) => { let p; do { p = candidates[Math.floor(Math.random() * candidates.length)]; } while (candidates.length > 1 && p.id === not); return p; };

  const randomize = (which) => {
    const next = { ...state, merged: null };
    if ((which === 1 || which === 0) && !lock[1]) next.p1 = rnd(next.p2.id);
    if ((which === 2 || which === 0) && !lock[2]) next.p2 = rnd(next.p1.id);
    setState(next);
  };
  const doMerge = () => { setState({ ...state, merged: mergePlayers(p1, p2) }); setFlash((f) => f + 1); };
  const randomMerge = () => {
    const a = lock[1] ? p1 : rnd(p2.id); const b = lock[2] ? p2 : rnd(a.id);
    setState({ ...state, p1: a, p2: b, merged: mergePlayers(a, b) }); setFlash((f) => f + 1);
  };
  const saved = merged && savedIds.has(merged.id);
  const t = merged && tier(merged.ovr);
  const cm = merged && categoryOvrs(merged.attrs);

  return (
    <div>
      <div className="merge-top">
        <Slot n={1} player={p1} locked={lock[1]} onLock={() => setState({ ...state, lock: { ...lock, 1: !lock[1] } })} onRandom={() => randomize(1)} onChoose={() => setPicker(1)} onSheet={() => openSheet(p1)} />
        <div className="vs">
          <div className="x">+</div>
          <button className="btn primary big" onClick={doMerge}>Merge</button>
          <button className="btn" onClick={randomMerge}>🎲 Random Merge</button>
          <button className="btn ghost sm" onClick={() => randomize(0)}>Shuffle both</button>
        </div>
        <Slot n={2} player={p2} locked={lock[2]} onLock={() => setState({ ...state, lock: { ...lock, 2: !lock[2] } })} onRandom={() => randomize(2)} onChoose={() => setPicker(2)} onSheet={() => openSheet(p2)} />
      </div>
      <div className="filters">
        <label>
          Pool
          <select value={pool} onChange={(e) => setState({ ...state, pool: e.target.value })}>
            <option value="all">All 653 players (incl. free agents)</option>
            <option value="nba">On NBA rosters only</option>
          </select>
        </label>
        <label>
          Min OVR
          <select value={minOvr} onChange={(e) => setState({ ...state, minOvr: +e.target.value })}>
            {[0, 70, 75, 80, 85, 90].map((v) => <option key={v} value={v}>{v ? `${v}+` : 'Any'}</option>)}
          </select>
        </label>
        <span>{candidates.length} players in the pool</span>
      </div>

      {flash > 0 && <div className="flash" key={flash} />}

      {merged ? (
        <div className="panel result merge-anim" key={merged.id}>
          <div className="result-hero">
            <PlayerImg player={merged} />
            <div className="result-info">
              <div className="row" style={{ alignItems: 'flex-start', gap: 18 }}>
                <CountUp to={merged.ovr} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="result-name">
                    <div className="first">{merged.first}</div>
                    <div className="last"><em>{merged.last}</em></div>
                  </div>
                  <div className="tier" style={{ color: t.color, marginTop: 6 }}>{t.label}</div>
                </div>
              </div>
              <div className="vitals">
                <div className="vital"><b>{fmtHeight(merged.height)}</b><span>Height (avg)</span></div>
                <div className="vital"><b>{merged.weight}</b><span>Weight (avg)</span></div>
                <div className="vital"><b>{merged.positions.join('/')}</b><span>Position</span></div>
                <div className="vital"><b>{merged.age}</b><span>Age</span></div>
                <div className="vital"><b>{merged.potential}</b><span>Potential</span></div>
              </div>
              <div className="cats">
                {cm.map((c) => (
                  <div className={`cat ${ratingClass(c.value)}`} key={c.key}><b className="rv">{c.value}</b><span>{c.label}</span></div>
                ))}
              </div>
              <div className="row" style={{ marginTop: 4 }}>
                <button className="btn gold" onClick={() => openSheet(merged)}>📋 Full Overall Sheet</button>
                <button className="btn" onClick={() => onSave(merged)} disabled={saved}>{saved ? '✓ In Locker Room' : '💾 Save to Locker Room'}</button>
                <button className="btn primary" onClick={() => onCareer(merged)}>🏀 Simulate Career</button>
              </div>
            </div>
          </div>
          <WhyOvr a={p1} b={p2} m={merged} />
          <AttrCompare a={p1} b={p2} m={merged} />
        </div>
      ) : (
        <div className="panel empty" style={{ marginTop: 22 }}>
          <h3>Ready to merge</h3>
          <div>{p1.first} gets the first name, {p2.last} the last. Height and weight are averaged; every rating takes whoever is better.</div>
        </div>
      )}

      {picker && (
        <PlayerPicker
          label={`Player ${picker === 1 ? 'One' : 'Two'}`}
          onClose={() => setPicker(null)}
          onPick={(p) => { setState({ ...state, [picker === 1 ? 'p1' : 'p2']: p, merged: null }); setPicker(null); }}
        />
      )}
    </div>
  );
}

export const randomPair = () => {
  const nba = PLAYERS.filter((p) => p.team !== 'FA');
  const a = nba[Math.floor(Math.random() * nba.length)];
  let b; do { b = nba[Math.floor(Math.random() * nba.length)]; } while (b.id === a.id);
  return [a, b];
};
export { TEAMS };
