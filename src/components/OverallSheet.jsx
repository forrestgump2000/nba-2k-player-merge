import React from 'react';
import { CATEGORIES, PARTS, categoryOvrs, positionOvrs, ratingClass, tier, fmtHeight, BADGE_LABEL } from '../lib/ratings.js';
import { team } from '../data/teams.js';
import { Modal, Ovr, PlayerImg } from './common.jsx';

function Tile({ label, value, main }) {
  return (
    <div className={`ov-tile ${ratingClass(value)} ${main ? 'main' : ''}`}>
      <span>{label}</span>
      <b className="rv">{value}</b>
    </div>
  );
}

function AttrTile({ label, value }) {
  return (
    <div className={`attr-tile ${ratingClass(value)}`}>
      <div className="t"><span>{label}</span><b className="rv">{value}</b></div>
      <div className="bar"><i style={{ width: `${value}%` }} /></div>
    </div>
  );
}

export default function OverallSheet({ player, onClose, ovr }) {
  const p = player;
  const o = ovr ?? p.ovr;
  const cats = categoryOvrs(p.attrs);
  const pos = positionOvrs(p.attrs, p.height);
  const t = tier(o);
  const badgeCounts = p.badges.reduce((m, [, l]) => ((m[l] = (m[l] || 0) + 1), m), {});
  const total = Object.values(p.attrs).reduce((a, b) => a + b, 0);
  const durAvg = Math.round(PARTS.reduce((s, k) => s + p.durab[k], 0) / PARTS.length);

  return (
    <Modal title={`${p.name} — Full Overall Sheet`} onClose={onClose} wide>
      <div className="sheet-top">
        <PlayerImg player={p} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Ovr value={o} size="xl" />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="tier" style={{ color: t.color }}>{t.label}</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 30, textTransform: 'uppercase', lineHeight: 1.1 }}>{p.name}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {p.positions.join(' / ')} · {p.archetype} · {team(p.team).name}
              </div>
              {p.merged && (
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  <span style={{ color: 'var(--p1)' }}>{p.parentNames[0]}</span> <span className="muted">+</span>{' '}
                  <span style={{ color: 'var(--p2)' }}>{p.parentNames[1]}</span>
                </div>
              )}
            </div>
          </div>
          <div className="vitals">
            <div className="vital"><b>{fmtHeight(p.height)}</b><span>Height</span></div>
            <div className="vital"><b>{p.weight} lbs</b><span>Weight</span></div>
            <div className="vital"><b>{fmtHeight(p.wingspan)}</b><span>Wingspan</span></div>
            <div className="vital"><b>{p.age}</b><span>Age</span></div>
            <div className="vital"><b>{p.potential}</b><span>Potential</span></div>
            <div className="vital"><b>{total.toLocaleString()}</b><span>Total Attributes</span></div>
          </div>
        </div>
      </div>

      <div className="sheet-sections">
        <section>
          <h4 className="h3">Overall by position</h4>
          <div className="ov-grid">
            {pos.map((x) => <Tile key={x.pos} label={`${x.pos} Overall`} value={x.value} main={x.pos === p.positions[0]} />)}
          </div>
        </section>
        <section>
          <h4 className="h3">Category overalls</h4>
          <div className="ov-grid">
            {cats.map((c) => <Tile key={c.key} label={c.label} value={c.value} />)}
            <Tile label="Intangibles" value={p.attrs.intangibles} />
            <Tile label="Durability" value={p.attrs.durability} />
          </div>
        </section>
        {CATEGORIES.map((c) => (
          <section key={c.key}>
            <h4 className="h3">{c.label} · <span className={`rv ${ratingClass(cats.find((x) => x.key === c.key).value)}`}>{cats.find((x) => x.key === c.key).value}</span></h4>
            <div className="ov-grid">
              {c.attrs.map(([k, label]) => <AttrTile key={k} label={label} value={p.attrs[k]} />)}
            </div>
          </section>
        ))}
        <section>
          <h4 className="h3">Durability by body part · avg <span className={`rv ${ratingClass(durAvg)}`}>{durAvg}</span></h4>
          <div className="body-map">
            {PARTS.map((k) => <AttrTile key={k} label={k} value={p.durab[k]} />)}
          </div>
        </section>
        <section>
          <h4 className="h3">Badges · {p.badges.length}</h4>
          <div className="row" style={{ marginBottom: 10, gap: 6 }}>
            {['legend', 'hof', 'gold', 'silver', 'bronze'].filter((l) => badgeCounts[l]).map((l) => (
              <span key={l} className={`badge ${l}`}>{badgeCounts[l]} {BADGE_LABEL[l]}</span>
            ))}
          </div>
          <div className="badges">
            {p.badges.map(([n, l]) => <span key={n} className={`badge ${l}`}>{n}</span>)}
          </div>
        </section>
      </div>
    </Modal>
  );
}
