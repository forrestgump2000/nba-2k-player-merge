import React from 'react';
import MergeView, { randomPair } from './components/MergeView.jsx';
import CareerView from './components/CareerView.jsx';
import OverallSheet from './components/OverallSheet.jsx';
import { Modal, Ovr, PlayerImg } from './components/common.jsx';
import { TEAMS, TEAM_IDS, team } from './data/teams.js';
import { tier, fmtHeight } from './lib/ratings.js';
import { newCareer, seasonLabel, careerTotals } from './lib/career.js';
import { loadLocker, saveLocker, loadCareer, saveCareer, deleteCareer } from './lib/storage.js';

function TeamChooser({ player, onPick, onClose }) {
  const [sel, setSel] = React.useState(TEAMS[player.team] ? player.team : TEAM_IDS[0]);
  return (
    <Modal title={`Start ${player.name}'s career`} onClose={onClose}>
      <div className="muted" style={{ marginBottom: 12 }}>
        Starting team — defaults to {player.parentNames[0]}'s team. He joins the real 2K27 roster and the depth chart decides his role.
      </div>
      <div className="row" style={{ gap: 6 }}>
        {TEAM_IDS.map((t) => (
          <button key={t} className={`btn sm ${sel === t ? 'primary' : ''}`} onClick={() => setSel(t)} title={TEAMS[t].name}>{TEAMS[t].abbr}</button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700 }}>{TEAMS[sel].name}</div>
        <span className="spacer" />
        <button className="btn" onClick={() => setSel(TEAM_IDS[Math.floor(Math.random() * 30)])}>🎲 Random team</button>
        <button className="btn primary" onClick={() => onPick(sel)}>Tip off →</button>
      </div>
    </Modal>
  );
}

function LockerRoom({ list, onOpen, onCareer, onDelete, careers }) {
  if (!list.length) {
    return (
      <div className="panel empty">
        <h3>Locker room is empty</h3>
        <div>Merge two players and hit “Save to Locker Room”.</div>
      </div>
    );
  }
  return (
    <div className="locker-grid">
      {list.map((p) => {
        const c = careers[p.id];
        const t = tier(p.ovr);
        return (
          <div className="panel lcard" key={p.id}>
            <div style={{ position: 'relative' }}>
              <PlayerImg player={p} />
              <Ovr value={p.ovr} />
            </div>
            <div className="body">
              <div>
                <div className="nm">{p.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {p.parentNames[0]} + {p.parentNames[1]}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{p.positions.join('/')} · {fmtHeight(p.height)} · {p.weight} lbs · Age {p.age}</div>
                <div className="tier" style={{ color: t.color, fontSize: 13, marginTop: 4 }}>{t.short}</div>
              </div>
              {c && <div className="muted" style={{ fontSize: 12 }}>{c}</div>}
              <div className="row" style={{ marginTop: 'auto' }}>
                <button className="btn sm gold" onClick={() => onOpen(p)}>Sheet</button>
                <button className="btn sm primary" onClick={() => onCareer(p)}>{c ? 'Career' : 'Start career'}</button>
                <span className="spacer" />
                <button className="btn sm ghost" onClick={() => onDelete(p)} aria-label="Release">🗑</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function careerBlurb(c) {
  if (!c) return null;
  if (!c.seasons.length) return 'Career not started';
  const t = careerTotals(c);
  const rings = t.awards['NBA Champion'] || 0;
  const status = c.retired ? `Retired · ${c.legacy?.verdict || ''}` : `${seasonLabel(c.league.year)} · ${team(c.league.players[c.id]?.team).abbr}`;
  return `${status} · ${t.seasons} seasons · ${t.ppg} PPG${rings ? ` · ${rings}× champ` : ''}`;
}

export default function App() {
  const [tab, setTab] = React.useState('merge');
  const [mergeState, setMergeState] = React.useState(() => {
    const [p1, p2] = randomPair();
    return { p1, p2, merged: null, lock: { 1: false, 2: false }, pool: 'all', minOvr: 0 };
  });
  const [locker, setLocker] = React.useState(loadLocker);
  const [sheet, setSheet] = React.useState(null);
  const [toastMsg, setToastMsg] = React.useState(null);
  const [chooser, setChooser] = React.useState(null);
  const [career, setCareer] = React.useState(null);
  const [, bump] = React.useReducer((x) => x + 1, 0);

  const toast = React.useCallback((m) => { setToastMsg(m); clearTimeout(window.__t); window.__t = setTimeout(() => setToastMsg(null), 2600); }, []);
  const savedIds = React.useMemo(() => new Set(locker.map((p) => p.id)), [locker]);
  const careers = React.useMemo(() => Object.fromEntries(locker.map((p) => [p.id, careerBlurb(loadCareer(p.id))])), [locker, career, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateLocker = (list) => { setLocker(list); if (!saveLocker(list)) toast('Could not save — browser storage is full or blocked.'); };
  const save = (p) => { if (!savedIds.has(p.id)) { updateLocker([p, ...locker]); toast(`${p.name} added to the locker room.`); } };
  const remove = (p) => {
    if (!confirm(`Release ${p.name} from the locker room? His career save goes too.`)) return;
    updateLocker(locker.filter((x) => x.id !== p.id)); deleteCareer(p.id);
    if (career?.id === p.id) setCareer(null);
  };
  const openCareer = (p) => {
    if (!savedIds.has(p.id)) updateLocker([p, ...locker]);
    const existing = loadCareer(p.id);
    if (existing) { setCareer(existing); setTab('career'); window.scrollTo(0, 0); }
    else setChooser(p);
  };
  const begin = (p, teamId) => {
    const c = newCareer(p, teamId);
    saveCareer(c); setCareer(c); setChooser(null); setTab('career'); window.scrollTo(0, 0);
  };
  const onCareerChange = (c) => { if (!saveCareer(c)) toast('Career save failed — storage full.'); bump(); };
  const careerBase = career && locker.find((p) => p.id === career.id);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/icon-192.png" alt="" />
          <div>
            <h1>NBA 2K <span>Player Merge</span></h1>
            <small>2K27 ratings · 653 players</small>
          </div>
        </div>
        <nav className="tabs">
          <button className={tab === 'merge' ? 'on' : ''} onClick={() => setTab('merge')}>Merge</button>
          <button className={tab === 'locker' ? 'on' : ''} onClick={() => setTab('locker')}>Locker Room{locker.length > 0 && <span className="count">{locker.length}</span>}</button>
          <button className={tab === 'career' ? 'on' : ''} onClick={() => setTab('career')}>Career</button>
        </nav>
      </header>

      {tab === 'merge' && (
        <MergeView state={mergeState} setState={setMergeState} onSave={save} onCareer={openCareer} savedIds={savedIds} openSheet={(p) => setSheet({ player: p })} />
      )}
      {tab === 'locker' && (
        <>
          <h2 className="h2">Locker Room</h2>
          <LockerRoom list={locker} careers={careers} onOpen={(p) => setSheet({ player: p })} onCareer={openCareer} onDelete={remove} />
        </>
      )}
      {tab === 'career' && (
        career && careerBase ? (
          <CareerView key={career.id} C={career} base={careerBase} onChange={onCareerChange} onExit={() => { setCareer(null); setTab('locker'); }} toast={toast} openSheet={(p, o) => setSheet({ player: p, ovr: o })} />
        ) : (
          <>
            <h2 className="h2">Career Simulator</h2>
            <div className="muted" style={{ marginBottom: 14 }}>Pick a player from your locker room. 95+ OVR players run their team's front office.</div>
            <LockerRoom list={locker} careers={careers} onOpen={(p) => setSheet({ player: p })} onCareer={openCareer} onDelete={remove} />
          </>
        )
      )}

      <div className="foot">
        Ratings and headshots from NBA 2K27 via 2kratings.com. Body-part durability is estimated from each player's Overall Durability.<br />
        Fan project — not affiliated with the NBA, 2K or Take-Two.
      </div>

      {sheet && <OverallSheet player={sheet.player} ovr={sheet.ovr} onClose={() => setSheet(null)} />}
      {chooser && <TeamChooser player={chooser} onPick={(t) => begin(chooser, t)} onClose={() => setChooser(null)} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}
