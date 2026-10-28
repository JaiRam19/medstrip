/* Shared UI pieces: icons, pills, strip art, cards. */
import React, { useEffect, useReducer } from "react";
import { DRUGS, stamp } from "./engine.js";

/* Re-render every `ms` while `active` is true (progress bars, countdowns). */
export function useTick(ms, active = true) {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(force, ms);
    return () => clearInterval(t);
  }, [ms, active]);
}

const PATHS = {
  home: <path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" />,
  pill: <><rect x="3.2" y="8.6" width="17.6" height="6.8" rx="3.4" transform="rotate(-45 12 12)" /><path d="m9.6 9.6 4.8 4.8" /></>,
  camera: <><path d="M4 8h3.2l1.6-2.5h6.4L16.8 8H20v11H4z" /><circle cx="12" cy="13.2" r="3.4" /></>,
  layers: <><path d="m12 4 8.5 4.6L12 13.2 3.5 8.6z" /><path d="m3.5 12.6 8.5 4.6 8.5-4.6" /><path d="m3.5 16.4 8.5 4.6 8.5-4.6" opacity=".5" /></>,
  chat: <path d="M4.5 5.5h15v10.5H10l-5.5 4z" />,
  inbox: <><path d="M3.5 13.5 6.5 5h11l3 8.5V19h-17z" /><path d="M3.5 13.5H8l1.2 2.5h5.6l1.2-2.5h4.5" /></>,
  pulse: <path d="M3 12.5h4l2.5-6.5 5 13 2.5-6.5H21" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  alert: <><path d="M12 4 21 19.5H3z" /><path d="M12 10v4.5M12 17v.4" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  arrow: <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />,
  upload: <><path d="M12 15.5V5M7.5 9.5 12 5l4.5 4.5" /><path d="M4.5 15v4.5h15V15" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  bolt: <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z" />,
  db: <><ellipse cx="12" cy="6.5" rx="7" ry="2.8" /><path d="M5 6.5v11c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-11" /><path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" /></>,
  send: <path d="m4.5 12 15-7-4.5 14-3-5.5z" />,
  replay: <><path d="M5.5 9A7 7 0 1 1 5 14" /><path d="M5 4.5V9h4.5" /></>,
};

export function Icon({ name, size = 18, className }) {
  return (
    <svg className={"ico " + (className || "")} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" className="logo-bg" />
      <circle cx="11" cy="12" r="3.3" className="logo-dot" />
      <circle cx="21" cy="12" r="3.3" className="logo-dot" />
      <circle cx="11" cy="21" r="3.3" className="logo-dot" />
      <circle cx="21" cy="21" r="3.3" className="logo-dot faded" />
    </svg>
  );
}

/* A blister strip drawn in the medicine's tint, with the foil stamp. */
export function StripArt({ drug, width = 120, expiry, blurred }) {
  const d = DRUGS[drug];
  const hue = d ? d.hue : 220;
  const label = d ? (d.name + " " + d.strength).toUpperCase() : "MEDICINE";
  return (
    <svg className={"strip" + (blurred ? " blurred" : "")} viewBox="0 0 120 66" width={width} role="img" aria-label={(d ? d.name : "Medicine") + " strip"}>
      <rect x="1" y="1" width="118" height="64" rx="7" className="foil" />
      <text x="8" y="13" className="strip-name">{label}</text>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={7 + i * 22} y="20" width="18" height="28" rx="9" className="blister" />
          <rect x={10.5 + i * 22} y="24" width="11" height="20" rx="5.5" style={{ fill: "hsl(" + hue + " 62% 56%)" }} />
        </g>
      ))}
      <text x="8" y="60" className="strip-exp">{d ? stamp(expiry || d.expiry) : ""}</text>
    </svg>
  );
}

const RISK_TONE = { LOW: "ok", MEDIUM: "warn", HIGH: "crit", UNKNOWN: "unk" };
const RISK_TEXT = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", UNKNOWN: "Unknown" };
export function Risk({ r, small }) {
  if (!r) return null;
  return <span className={"pill dot t-" + RISK_TONE[r] + (small ? " sm" : "")} title={"Risk " + r}>{RISK_TEXT[r]} risk</span>;
}

export const STATUS = {
  UPLOADED: ["Uploaded", "acc"], READING: ["Reading photo", "acc"], LOOKING_UP: ["Looking up label", "acc"], CHECKING: ["Checking interactions", "acc"],
  REVIEWING: ["Safety review", "acc"], AWAITING_CONFIRMATION: ["Needs your confirmation", "warn"], AWAITING_ACK: ["Needs your acknowledgement", "warn"],
  DONE: ["Done", "ok"], NEEDS_RETAKE: ["Retake photo", "warn"], CANCELLED: ["Cancelled", "unk"], FAILED: ["Failed", "crit"],
  PLANNING: ["Planning", "acc"], RUNNING: ["Auditing", "acc"], DRAFTING: ["Drafting", "acc"], CRITIQUE: ["Critic reviewing", "acc"],
  AWAITING_APPROVAL: ["Needs your approval", "warn"], SENDING: ["Sending", "acc"], SENT: ["Sent", "ok"], DISCARDED: ["Discarded", "unk"], EXPIRED: ["Expired", "unk"],
};
export function Status({ s }) {
  const [label, tone] = STATUS[s] || [s, "unk"];
  const live = tone === "acc";
  return <span className={"pill t-" + tone + (live ? " live" : "")} title={s}>{label}</span>;
}

export function Card({ title, sub, action, children, className, id }) {
  return (
    <section className={"card " + (className || "")} id={id}>
      {(title || action) && (
        <header className="card-head">
          <div className="card-titles">
            {title && <h3>{title}</h3>}
            {sub && <p className="sub">{sub}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ icon, title, children }) {
  return (
    <div className="empty">
      {icon && <span className="empty-ico"><Icon name={icon} size={20} /></span>}
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Seg({ options, value, onChange, label, id }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label} id={id}>
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={value === o.key} className={value === o.key ? "on" : ""} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Disclaimer() {
  return <p className="disclaimer">Sample data. Not medical advice. Ask a pharmacist.</p>;
}
