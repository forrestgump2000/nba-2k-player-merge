import React from 'react';
import { ratingClass, headshot } from '../lib/ratings.js';
import { team } from '../data/teams.js';
import PLAYERS from '../data/players.json';

const HAS_IMG = new Set(PLAYERS.map((p) => p.id));

function Silhouette() {
  return (
    <div className="sil">
      <svg viewBox="0 0 100 80" width="70%" fill="currentColor" aria-hidden="true">
        <circle cx="50" cy="28" r="16" />
        <path d="M18 80c0-20 14-32 32-32s32 12 32 32z" />
      </svg>
    </div>
  );
}

function Shot({ id, alt }) {
  if (!HAS_IMG.has(id)) return <Silhouette />;
  return <img src={headshot({ id })} alt={alt} loading="lazy" />;
}

// Headshot; merged players get both parents' faces split down a seam.
export function PlayerImg({ player, className = '', style }) {
  if (player?.merged) {
    return (
      <div className={`pimg ${className}`} style={style}>
        <div className="half a"><Shot id={player.parents[0]} alt={player.parentNames[0]} /></div>
        <div className="half b"><Shot id={player.parents[1]} alt={player.parentNames[1]} /></div>
        <div className="seam" />
      </div>
    );
  }
  return (
    <div className={`pimg ${className}`} style={style}>
      {player ? <Shot id={player.id} alt={player.name} /> : <Silhouette />}
    </div>
  );
}

export function Ovr({ value, size = '', label = 'OVR' }) {
  return (
    <span className={`ovr-badge ${size} ${ratingClass(value)}`}>
      <b>{value}</b>
      <small>{label}</small>
    </span>
  );
}

export function TeamLogo({ id, size = 44 }) {
  const t = team(id);
  return (
    <span className="tlogo" style={{ background: t.color, width: size, height: size, fontSize: size * 0.32 }}>
      {t.abbr}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }) {
  React.useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 1100 } : undefined} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
