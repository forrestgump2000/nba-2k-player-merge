import React from 'react';
import { TEAMS, TEAM_IDS, team } from '../data/teams.js';
import { tier, ratingClass, fmtHeight } from '../lib/ratings.js';
import {
  startSeason, acceptOffer, sitOut, retire, autoOffseason, careerTotals, legacy, seasonLabel, money,
  freeAgentPool, signFreeAgent, tradeTargets, evaluateTrade, executeTrade, requestTrade, teamRoster, currentPlayer,
} from '../lib/career.js';
import { Ovr, PlayerImg, TeamLogo } from './common.jsx';

function statusText(ovr, age) {
  if (ovr >= 97) return 'Generational. The league runs through him — MVP favorite every healthy season.';
  if (ovr >= 93) return 'Superstar. Perennial All-NBA and on every MVP ballot.';
  if (ovr >= 88) return "All-Star caliber. A team's No. 1 option or an elite No. 2.";
  if (ovr >= 84) return 'Quality starter. A strong No. 2 or No. 3 on a good team.';
  if (ovr >= 80) return 'Starter on most teams, sixth man on contenders.';
  if (ovr >= 76) return 'Rotation player. Minutes depend on the depth chart.';
  if (ovr >= 73) return `Fringe NBA player — one bad camp from being waived. In real danger of falling out of the league${age >= 30 ? ', and the clock is ticking' : ''}.`;
  return 'Below NBA level. G League or overseas unless he develops fast.';
}

const AWARD_ORDER = ['MVP', 'Finals MVP', 'NBA Champion', 'Defensive Player of the Year', 'All-NBA 1st Team', 'All-NBA 2nd Team', 'All-NBA 3rd Team', 'All-Star', 'All-Defensive 1st Team', 'All-Defensive 2nd Team', 'Sixth Man of the Year', 'Most Improved Player', 'Scoring Title', 'Rebounding Title', 'Assists Title'];

function Awards({ list }) {
  if (!list.length) return null;
  return <div style={{ marginTop: 8 }}>{list.map((a) => <span key={a} className={`award ${a === 'NBA Champion' ? 'ring' : ''}`}>{a === 'NBA Champion' ? '💍 ' : '🏆 '}{a}</span>)}</div>;
}

function SeasonCard({ s }) {
  return (
    <div className="panel season-card">
      <div className="row">
        <TeamLogo id={s.team === 'FA' ? s.startTeam : s.team} />
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 22, textTransform: 'uppercase' }}>{s.label} season</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {team(s.team).name} · Age {s.age} · {s.ovr} OVR · {s.role}{s.wins != null ? ` · ${s.wins}-${s.losses}` : ''}
          </div>
        </div>
      </div>
      {s.gp > 0 ? (
        <>
          <div className="statline">
            <div><b>{s.ppg}</b><span>PPG</span></div>
            <div><b>{s.rpg}</b><span>RPG</span></div>
            <div><b>{s.apg}</b><span>APG</span></div>
            <div><b>{s.spg}</b><span>SPG</span></div>
            <div><b>{s.bpg}</b><span>BPG</span></div>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {s.gp} games · {s.mpg} MPG · {s.fg} FG% · {s.tp} 3P% · {s.ft} FT%{s.mvpRank ? ` · MVP voting: ${s.mvpRank}${['st', 'nd', 'rd'][s.mvpRank - 1] || 'th'}` : ''}
          </div>
        </>
      ) : <div className="muted" style={{ margin: '10px 0' }}>Did not play an NBA game this season.</div>}
      <div style={{ marginTop: 8, fontWeight: 600 }}>{s.playoff}</div>
      <Awards list={s.awards} />
      {s.events.length > 0 && <ul className="events">{s.events.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      <div className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
        League: 🏆 {team(s.champion).name} def. {team(s.runnerUp).nick} {s.champScore} · MVP {s.mvp} · DPOY {s.dpoy}
        {s.leaders?.pts && <> · Scoring leader {s.leaders.pts[0]} ({s.leaders.pts[1]})</>}
      </div>
    </div>
  );
}

function FreeAgency({ C, onDone }) {
  const offers = C.pending.offers;
  const me = currentPlayer(C);
  const superstar = me.ovr >= 95;
  return (
    <div className="panel season-card">
      <h3 className="h2">{seasonLabel(C.league.year)} Free Agency</h3>
      {superstar && <div className="status r-pink" style={{ marginBottom: 12 }}><b>95+ OVR:</b> every team has max space ready. Pick any destination.</div>}
      {!offers.length ? (
        <>
          <div className="status r-red" style={{ marginBottom: 12 }}>
            <b>No NBA offers.</b> At {me.ovr} OVR and age {me.age}, no team wants to guarantee a roster spot.
          </div>
          <div className="row">
            <button className="btn" onClick={() => { sitOut(C); onDone(); }}>Go to the G League / overseas</button>
            <button className="btn primary" onClick={() => { retire(C, 'no NBA offers came.'); onDone(); }}>Retire</button>
          </div>
        </>
      ) : (
        <div className="offers">
          {offers.map((o) => (
            <div className="offer" key={o.team}>
              <TeamLogo id={o.team} />
              <div>
                <div style={{ fontWeight: 700 }}>{TEAMS[o.team].name}{o.resign && <span className="pill" style={{ marginLeft: 6 }}>Re-sign</span>}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {o.years} yr{o.years > 1 ? 's' : ''} · {money(o.salary)}/yr{o.kind ? ` · ${o.kind}` : ''} · Projected role: {o.role}{o.lastWins != null ? ` · Last season ${o.lastWins}-${82 - o.lastWins}` : ''}
                </div>
              </div>
              <button className="btn primary sm" onClick={() => { acceptOffer(C, o); onDone(); }}>Sign</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FrontOffice({ C, onDone, toast }) {
  const [tab, setTab] = React.useState('fa');
  const [target, setTarget] = React.useState(null);
  const [out, setOut] = React.useState([]);
  const [q, setQ] = React.useState('');
  const me = currentPlayer(C);
  const fo = C.frontOffice;
  const myRoster = teamRoster(C, me.team).filter((p) => !p.user);
  const pool = freeAgentPool(C);
  const targets = tradeTargets(C).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || team(p.team).name.toLowerCase().includes(q.toLowerCase()));
  const ev = target ? evaluateTrade(C, target.id, out) : null;
  return (
    <div className="panel season-card">
      <h3 className="h2">⭐ Front Office Power</h3>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        At {me.ovr} OVR the {team(me.team).nick} do what you say. Up to 2 signings (one star) and 2 trades this offseason.
        Used: {fo.signings} signing{fo.signings === 1 ? '' : 's'}, {fo.trades} trade{fo.trades === 1 ? '' : 's'}.
      </div>
      <div className="subtabs">
        <button className={tab === 'fa' ? 'on' : ''} onClick={() => setTab('fa')}>Sign free agents</button>
        <button className={tab === 'trade' ? 'on' : ''} onClick={() => setTab('trade')}>Trade for a player</button>
        <button className={tab === 'move' ? 'on' : ''} onClick={() => setTab('move')}>Request a trade</button>
      </div>
      {tab === 'fa' && (
        <div className="offers">
          {pool.length === 0 && <div className="muted">The free-agent pool is empty.</div>}
          {pool.slice(0, 40).map((p) => (
            <div className="offer" key={p.id} style={{ gridTemplateColumns: '44px 1fr auto' }}>
              <Ovr value={p.ovr} size="sm" />
              <div><div style={{ fontWeight: 700 }}>{p.name}</div><div className="muted" style={{ fontSize: 12 }}>{p.pos} · Age {p.age} · Potential {p.pot}</div></div>
              <button className="btn sm primary" disabled={fo.signings >= 2 || (p.ovr >= 85 && fo.starSigned)} onClick={() => { const err = signFreeAgent(C, p.id); if (err) toast(err); else { toast(`${p.name} signed!`); onDone(); } }}>Sign</button>
            </div>
          ))}
        </div>
      )}
      {tab === 'trade' && (
        <div className="grid2">
          <div>
            <input className="search" placeholder="Search players or teams…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="offers" style={{ marginTop: 8, maxHeight: 380 }}>
              {targets.slice(0, 60).map((p) => (
                <button key={p.id} className={`check-row ${target?.id === p.id ? 'on' : ''}`} onClick={() => { setTarget(p); setOut([]); }} style={{ color: 'inherit', textAlign: 'left' }}>
                  <Ovr value={p.ovr} size="sm" />
                  <div style={{ flex: 1 }}><b>{p.name}</b><div className="muted" style={{ fontSize: 11 }}>{team(p.team).abbr} · {p.pos} · Age {p.age}</div></div>
                </button>
              ))}
            </div>
          </div>
          <div>
            {!target ? <div className="muted">Pick a target on the left, then choose who to send.</div> : (
              <>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Send to the {team(target.team).nick} for {target.name}:</div>
                <div style={{ display: 'grid', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                  {myRoster.map((p) => (
                    <label key={p.id} className={`check-row ${out.includes(p.id) ? 'on' : ''}`}>
                      <input type="checkbox" checked={out.includes(p.id)} onChange={() => setOut(out.includes(p.id) ? out.filter((x) => x !== p.id) : [...out, p.id])} />
                      <Ovr value={p.ovr} size="sm" /><span style={{ flex: 1 }}>{p.name}</span><span className="muted">{p.age}y</span>
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 13 }}>Trade acceptance</div>
                <div className="meter"><i style={{ width: `${Math.round(ev.pct * 100)}%`, background: ev.ok ? 'var(--r-green)' : ev.pct > 0.7 ? 'var(--r-yellow)' : 'var(--r-red)' }} /></div>
                <button className="btn primary" style={{ marginTop: 10, width: '100%' }} disabled={!ev.ok || fo.trades >= 2} onClick={() => { const err = executeTrade(C, target.id, out); if (err) toast(err); else { toast(`Trade done: ${target.name} is yours.`); setTarget(null); setOut([]); onDone(); } }}>
                  {ev.ok ? 'Make the trade' : 'Not enough value yet'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {tab === 'move' && (
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Demand a trade to any team. Your new team sends back its two best players.</div>
          <div className="row" style={{ gap: 6 }}>
            {TEAM_IDS.filter((t) => t !== me.team).map((t) => (
              <button key={t} className="btn sm" onClick={() => { if (confirm(`Force a trade to the ${TEAMS[t].name}?`)) { requestTrade(C, t); toast(`Welcome to ${TEAMS[t].city}.`); onDone(); } }}>
                {TEAMS[t].abbr}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Legacy({ C }) {
  const t = careerTotals(C);
  const lg = C.legacy || legacy(C);
  const awards = AWARD_ORDER.filter((a) => t.awards[a]);
  return (
    <div className="panel legacy">
      <div className="h3">Career over</div>
      <div className="big">{lg.verdict}</div>
      <div className="row" style={{ justifyContent: 'center', gap: 30, marginTop: 14 }}>
        <div><div className="hof">{lg.hof}%</div><div className="muted">Hall of Fame odds</div></div>
        <div><div className="hof" style={{ color: 'var(--r-pink)' }}>{t.awards['NBA Champion'] || 0}</div><div className="muted">Rings</div></div>
        <div><div className="hof" style={{ color: 'var(--r-blue)' }}>{t.peak}</div><div className="muted">Peak OVR</div></div>
      </div>
      <div className="statline" style={{ maxWidth: 620, margin: '18px auto' }}>
        <div><b>{t.pts.toLocaleString()}</b><span>PTS</span></div>
        <div><b>{t.reb.toLocaleString()}</b><span>REB</span></div>
        <div><b>{t.ast.toLocaleString()}</b><span>AST</span></div>
        <div><b>{t.seasons}</b><span>SEASONS</span></div>
        <div><b>{money(t.earnings)}</b><span>EARNED</span></div>
      </div>
      <div className="muted">{t.ppg} PPG · {t.rpg} RPG · {t.apg} APG · {t.spg} SPG · {t.bpg} BPG over {t.gp} games</div>
      <div style={{ marginTop: 12 }}>{awards.map((a) => <span key={a} className={`award ${a === 'NBA Champion' ? 'ring' : ''}`}>{t.awards[a]}× {a}</span>)}</div>
    </div>
  );
}

export default function CareerView({ C, base, onChange, onExit, toast, openSheet }) {
  const [sub, setSub] = React.useState('season');
  const me = currentPlayer(C);
  const u = C.league.user;
  const last = C.seasons[C.seasons.length - 1];
  const t = tier(me.ovr);
  const pending = C.pending;
  const commit = () => onChange(C);

  const simOne = () => { startSeason(C); commit(); };
  const simAll = () => {
    for (let i = 0; i < 30 && !C.retired; i++) {
      if (C.phase === 'offseason') { autoOffseason(C); if (C.retired) break; }
      startSeason(C);
    }
    commit();
  };
  const blocked = pending?.type === 'freeAgency' || pending?.type === 'forcedRetire';

  const sheetPlayer = { ...base, ...u, attrs: u.attrs, durab: u.durab, ovr: me.ovr, age: me.age, team: me.team === 'RET' ? (last?.team || base.team) : me.team };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel career-head">
        <PlayerImg player={base} />
        <div className="career-info">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Ovr value={me.ovr} size="xl" />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: 'var(--display)', fontSize: 34, textTransform: 'uppercase', lineHeight: 1 }}>{u.name}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {C.retired ? 'Retired' : team(me.team).name} · Age {me.age} · {u.positions.join('/')} · {fmtHeight(u.height)} · {u.weight} lbs
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {C.retired ? `${C.seasons.length} seasons` : me.team === 'FA' ? 'Unsigned' : `Contract: ${C.contract.years > 0 ? `${C.contract.years} yr${C.contract.years > 1 ? 's' : ''} left` : 'expiring'} · ${money(C.contract.salary)}/yr`}
                {C.rings > 0 && ` · ${'💍'.repeat(Math.min(C.rings, 10))}`}
              </div>
            </div>
          </div>
          {!C.retired && <div className={`status ${ratingClass(me.ovr)}`}><b>{t.label}</b> — {statusText(me.ovr, me.age)}</div>}
          <div className="row">
            {!C.retired && (
              <>
                <button className="btn primary" onClick={simOne} disabled={blocked}>
                  ▶ Sim {C.seasons.length ? seasonLabel(C.league.year) : `${seasonLabel(C.league.year)} season`}
                </button>
                <button className="btn" onClick={simAll}>⏩ Sim to retirement</button>
                {C.seasons.length > 0 && <button className="btn ghost" onClick={() => { if (confirm('Retire now?')) { retire(C, 'chose to walk away.'); commit(); } }}>Retire</button>}
              </>
            )}
            <button className="btn ghost" onClick={() => openSheet(sheetPlayer, me.ovr)}>📋 Current ratings</button>
            <span className="spacer" />
            <button className="btn ghost sm" onClick={onExit}>← Locker room</button>
          </div>
        </div>
      </div>

      {pending?.type === 'forcedRetire' && (
        <div className="panel season-card">
          <div className="status r-red"><b>End of the road.</b> {pending.reason}</div>
          <button className="btn primary" style={{ marginTop: 10 }} onClick={() => { retire(C, pending.reason); commit(); }}>Retire</button>
        </div>
      )}
      {pending?.type === 'freeAgency' && <FreeAgency C={C} onDone={commit} />}
      {!C.retired && C.frontOffice && me.team !== 'FA' && !blocked && <FrontOffice C={C} onDone={commit} toast={toast} />}
      {C.offseasonNotes?.length > 0 && !C.retired && <div className="muted" style={{ fontSize: 13 }}>{C.offseasonNotes.join(' ')}</div>}
      {C.retired && <Legacy C={C} />}

      {C.seasons.length === 0 && !C.retired && (
        <div className="panel empty">
          <h3>Day one</h3>
          <div>{C.log[0]}</div>
          <div style={{ marginTop: 6 }}>Every 2K27 player is in the league with him. His minutes, stats, awards and contracts come from where he actually ranks.</div>
        </div>
      )}

      {C.seasons.length > 0 && (
        <div>
          <div className="subtabs">
            {[['season', 'Latest season'], ['history', 'Career stats'], ['roster', 'Team roster'], ['standings', 'Standings'], ['log', 'Timeline']].map(([k, l]) => (
              <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>
            ))}
          </div>
          {sub === 'season' && <SeasonCard s={last} />}
          {sub === 'history' && (
            <div className="panel tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Season</th><th>Team</th><th>Age</th><th>OVR</th><th>GP</th><th>MPG</th><th>PPG</th><th>RPG</th><th>APG</th><th>SPG</th><th>BPG</th><th>FG%</th><th>3P%</th><th>Record</th><th>Salary</th><th>Awards</th></tr></thead>
                <tbody>
                  {C.seasons.map((s) => (
                    <tr key={s.year}>
                      <td>{s.label}</td><td>{team(s.team).abbr}</td><td>{s.age}</td><td className={`rv ${ratingClass(s.ovr)}`}>{s.ovr}</td>
                      <td>{s.gp}</td><td>{s.mpg}</td><td>{s.ppg}</td><td>{s.rpg}</td><td>{s.apg}</td><td>{s.spg}</td><td>{s.bpg}</td><td>{s.fg}</td><td>{s.tp}</td>
                      <td>{s.wins != null ? `${s.wins}-${s.losses}` : '—'}</td><td>{s.salary ? money(s.salary) : '—'}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 200 }}>{s.awards.join(', ')}</td>
                    </tr>
                  ))}
                  {(() => { const tt = careerTotals(C); return (
                    <tr style={{ fontWeight: 700 }}><td>Career</td><td /><td /><td>{tt.peak}</td><td>{tt.gp}</td><td /><td>{tt.ppg}</td><td>{tt.rpg}</td><td>{tt.apg}</td><td>{tt.spg}</td><td>{tt.bpg}</td><td /><td /><td /><td>{money(tt.earnings)}</td><td /></tr>
                  ); })()}
                </tbody>
              </table>
            </div>
          )}
          {sub === 'roster' && (
            <div className="panel tbl-wrap">
              {me.team === 'FA' || me.team === 'RET' ? <div className="empty">Not on an NBA roster.</div> : (
                <table className="tbl">
                  <thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>Pot</th></tr></thead>
                  <tbody>
                    {teamRoster(C, me.team).map((p, i) => (
                      <tr key={p.id} className={p.user ? 'me' : ''}><td>{i + 1}</td><td>{p.name}{p.rookie ? ' (R)' : ''}</td><td>{p.pos}</td><td>{p.age}</td><td className={`rv ${ratingClass(p.ovr)}`}>{p.ovr}</td><td>{p.pot}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {sub === 'standings' && (
            <div className="grid2">
              {['East', 'West'].map((conf) => (
                <div className="panel tbl-wrap" key={conf}>
                  <table className="tbl">
                    <thead><tr><th>{conf} · {last.label}</th><th>W</th><th>L</th></tr></thead>
                    <tbody>
                      {last.standings[conf].map(([tid, w], i) => (
                        <tr key={tid} className={tid === last.team ? 'me' : ''}><td>{i + 1}. {TEAMS[tid].name}</td><td>{w}</td><td>{82 - w}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
          {sub === 'log' && (
            <div className="panel season-card">
              <ul className="events">{C.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
