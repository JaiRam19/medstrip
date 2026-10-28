/* MedStrip web app. React 18. All data comes from the mock backend in engine.js. */
import React, { useState, useEffect, useReducer, useRef } from "react";
import {
  store, go, toast, startJob, decideJob, removeMedicine, startReview, decideReview, sendChat, replayDlt,
  pendingTasks, busyAgents, daysLeft, stamp, ago, clock, timeLeft, secs, RANK,
  DRUGS, AGENTS, SCENARIOS, REVIEW_DRILLS, ROUTES,
} from "./engine.js";
import { Icon, Logo, StripArt, Risk, Status, Card, Empty, Seg, Disclaimer, useTick } from "./ui.jsx";


function useStore() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => store.sub(force), []);
  return store.get();
}

const NAV = [
  { key: "overview", label: "Overview", icon: "home" },
  { key: "cabinet", label: "Cabinet", icon: "pill" },
  { key: "add", label: "Add medicine", icon: "camera" },
  { key: "review", label: "Cabinet review", icon: "layers" },
  { key: "ask", label: "Ask", icon: "chat" },
  { key: "approvals", label: "Approvals", icon: "inbox" },
  { key: "activity", label: "Activity", icon: "pulse" },
];
const TITLES = {
  overview: ["Overview", "What needs you, and what the agents are doing."],
  cabinet: ["Cabinet", "Every medicine you added, with expiry and interaction risk."],
  add: ["Add medicine", "Photo in, cabinet entry out. Six agents work one after another."],
  review: ["Cabinet review", "A supervisor plans, four auditors work in parallel, a critic checks the report, and you approve it."],
  ask: ["Ask", "A router sends each question to the right specialist."],
  approvals: ["Approvals", "Workflows paused until a person decides."],
  activity: ["Activity", "Agent runs, Kafka events and dead letters."],
};

/* ======================= Shell ======================= */
export default function App() {
  const s = useStore();
  const tasks = pendingTasks(s);
  const openDlt = s.dlt.filter((d) => !d.replayed).length;
  const [title, sub] = TITLES[s.view];
  const mainRef = useRef(null);
  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; window.scrollTo(0, 0); }, [s.view]);

  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><Logo /><span>MedStrip</span></div>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => {
            const badge = n.key === "approvals" ? tasks.length : n.key === "activity" ? openDlt : 0;
            return (
              <button key={n.key} type="button" className={"nav-item" + (s.view === n.key ? " on" : "")} aria-current={s.view === n.key ? "page" : undefined} onClick={() => go(n.key)}>
                <Icon name={n.icon} />
                <span>{n.label}</span>
                {badge > 0 && <span className={"badge" + (n.key === "activity" ? " crit" : "")}>{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="side-foot">
          <div className="mock-note">
            <span className="pill t-acc sm">Mock mode</span>
            <p>Everything runs in your browser. Swap <code>engine.js</code> for calls to your Spring Boot API when it is ready.</p>
          </div>
        </div>
      </aside>

      <main className="main" ref={mainRef}>
        <div className="page">
          <header className="top">
            <div className="top-titles">
              <h1>{title}</h1>
              <p>{sub}</p>
            </div>
            <div className="top-actions">
              <span className="user-chip" title="Synthetic user id sent as X-User-Id"><span className="avatar">U1</span>Demo user</span>
              {s.view !== "add" && <button type="button" className="btn primary" onClick={() => go("add")}><Icon name="plus" size={16} />Add medicine</button>}
            </div>
          </header>
          {s.view === "overview" && <Overview s={s} tasks={tasks} />}
          {s.view === "cabinet" && <Cabinet s={s} />}
          {s.view === "add" && <AddMedicine s={s} />}
          {s.view === "review" && <Review s={s} />}
          {s.view === "ask" && <Ask s={s} />}
          {s.view === "approvals" && <Approvals s={s} tasks={tasks} />}
          {s.view === "activity" && <Activity s={s} />}
        </div>
      </main>
      <Toasts list={s.toasts} />
    </div>
  );
}

function Toasts({ list }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => <div key={t.id} className={"toast t-" + t.tone}>{t.text}</div>)}
    </div>
  );
}

/* ======================= Overview ======================= */
function Overview({ s, tasks }) {
  useTick(1000);
  const cab = s.cabinet;
  const expiring = cab.filter((c) => daysLeft(c.expiry) <= 30);
  const flagged = cab.filter((c) => RANK[c.risk] >= 1);
  const runsToday = s.runs.filter((r) => Date.now() - r.t < 86400000).length;
  const busy = busyAgents(s);
  const lastRun = (name) => {
    const n = name === "Auditors (4)" ? /Auditor$/ : null;
    const r = s.runs.find((x) => (n ? n.test(x.agent) : x.agent === name));
    return r ? ago(r.t) : "not run yet";
  };
  const openDlt = s.dlt.filter((d) => !d.replayed);
  const attention = [
    ...tasks.map((t) => ({ key: "t" + t.id, tone: "warn", icon: "inbox", title: "Gate " + t.gate + ": " + t.title, detail: t.detail, action: () => go(t.kind === "job" ? "add" : "review", t.kind === "job" ? { job: t.id } : { review: t.id }) })),
    ...flagged.map((c) => ({ key: "f" + c.id, tone: c.risk === "HIGH" ? "crit" : c.risk === "UNKNOWN" ? "unk" : "warn", icon: "alert", title: c.name + " " + c.strength + " has " + c.risk.toLowerCase() + " risk", detail: c.conflicts.length ? "With " + c.conflicts.join(", ") + "." : c.reasons[0], action: () => go("cabinet", { med: c.id }) })),
    ...expiring.map((c) => ({ key: "e" + c.id, tone: "warn", icon: "clock", title: c.name + " expires in " + daysLeft(c.expiry) + " days", detail: stamp(c.expiry), action: () => go("cabinet", { med: c.id }) })),
    ...openDlt.map((d) => ({ key: "d" + d.id, tone: "crit", icon: "bolt", title: "Dead letter from " + d.source, detail: d.reason, action: () => go("activity") })),
  ];

  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Medicines" value={cab.length} hint="in cabinet:U1" />
        <Stat label="Expiring in 30 days" value={expiring.length} tone={expiring.length ? "warn" : null} hint="checked daily" />
        <Stat label="Need a pharmacist check" value={flagged.length} tone={flagged.length ? "crit" : null} hint="medium, high or unknown" />
        <Stat label="Agent runs today" value={runsToday} hint="from DynamoDB agent_runs" />
      </div>

      <div className="quick">
        <QuickAction icon="camera" title="Add a medicine" pattern="Sequential + parallel read" onClick={() => go("add")}>Photo to cabinet. Six agents hand off through Kafka.</QuickAction>
        <QuickAction icon="layers" title="Run a cabinet review" pattern="Supervisor + parallel + loop" onClick={() => go("review")}>Four auditors at once, then a writer and a critic.</QuickAction>
        <QuickAction icon="chat" title="Ask a question" pattern="Routing + guardrail" onClick={() => go("ask")}>The router picks the right specialist for you.</QuickAction>
      </div>

      <div className="grid-2">
        <Card title="Needs your attention" sub={attention.length ? attention.length + " items" : "All clear"}>
          {attention.length ? (
            <ul className="rows">
              {attention.map((a) => (
                <li key={a.key}>
                  <button type="button" className="row-btn" onClick={a.action}>
                    <span className={"row-ico t-" + a.tone}><Icon name={a.icon} size={16} /></span>
                    <span className="row-main"><b>{a.title}</b><span className="muted">{a.detail}</span></span>
                    <Icon name="arrow" size={16} className="row-go" />
                  </button>
                </li>
              ))}
            </ul>
          ) : <Empty icon="check" title="Nothing needs you">New warnings and approvals show up here.</Empty>}
        </Card>

        <Card title="Agents" sub={busy.size ? busy.size + " working now" : "All idle"}>
          <ul className="agents">
            {AGENTS.map((a) => {
              const on = busy.has(a.name);
              return (
                <li key={a.name} className={on ? "on" : ""}>
                  <span className={"adot" + (on ? " on" : "")} aria-hidden="true" />
                  <span className="a-main"><b>{a.name}</b><span className="muted">{a.tech}</span></span>
                  <span className="a-state">{on ? "working" : lastRun(a.name)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card title="Recent uploads" action={<button type="button" className="btn sm" onClick={() => go("add")}>Open Add medicine</button>}>
        <JobList s={s} limit={5} />
      </Card>
      <Disclaimer />
    </div>
  );
}

function Stat({ label, value, hint, tone }) {
  return (
    <div className={"stat" + (tone ? " t-" + tone : "")}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-hint">{hint}</span>
    </div>
  );
}

function QuickAction({ icon, title, pattern, children, onClick }) {
  return (
    <button type="button" className="qa" onClick={onClick}>
      <span className="qa-ico"><Icon name={icon} size={20} /></span>
      <span className="qa-body">
        <b>{title}</b>
        <span className="muted">{children}</span>
        <span className="tag">{pattern}</span>
      </span>
    </button>
  );
}

function JobList({ s, limit, onPick }) {
  const ids = s.jobOrder.slice(0, limit || 50);
  if (!ids.length) return <Empty icon="camera" title="No uploads yet">Pick a sample strip to start.</Empty>;
  return (
    <ul className="joblist">
      {ids.map((id) => {
        const j = s.jobs[id];
        const ex = j.extracted;
        return (
          <li key={id}>
            <button type="button" className={"job-row" + (s.sel.job === id && s.view === "add" ? " on" : "")} onClick={() => (onPick ? onPick(id) : go("add", { job: id }))}>
              <StripArt drug={j.sample} width={54} />
              <span className="row-main"><b>{ex ? ex.name + " " + ex.strength : DRUGS[j.sample].name}</b><span className="muted mono">{id} · {ago(j.createdAt)}</span></span>
              <Status s={j.status} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ======================= Cabinet ======================= */
function Cabinet({ s }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const items = s.cabinet
    .filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((c) => filter === "all" || (filter === "expiring" ? daysLeft(c.expiry) <= 60 : RANK[c.risk] >= 1))
    .sort((a, b) => RANK[b.risk] - RANK[a.risk] || daysLeft(a.expiry) - daysLeft(b.expiry));
  const sel = s.cabinet.find((c) => c.id === s.sel.med);

  return (
    <div className="stack">
      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input id="cab-search" type="search" placeholder="Search medicines" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search medicines" />
        </label>
        <Seg id="cab-filter" label="Filter" value={filter} onChange={setFilter} options={[{ key: "all", label: "All" }, { key: "expiring", label: "Expiring soon" }, { key: "flagged", label: "Needs a check" }]} />
        <span className="muted count">{items.length} of {s.cabinet.length}</span>
      </div>
      {items.length ? (
        <div className="meds">
          {items.map((c) => <MedCard key={c.id} c={c} onOpen={() => go("cabinet", { med: c.id })} />)}
        </div>
      ) : (
        <Card><Empty icon="pill" title={s.cabinet.length ? "No medicines match" : "Your cabinet is empty"}>{s.cabinet.length ? "Clear the search or pick another filter." : "Add your first medicine from a strip photo."}</Empty></Card>
      )}
      <Disclaimer />
      {sel && <MedDrawer c={sel} s={s} onClose={() => go("cabinet", { med: null })} />}
    </div>
  );
}

function expiryTone(d) {
  return d < 0 ? "crit" : d <= 30 ? "warn" : d <= 60 ? "soon" : "ok";
}

function MedCard({ c, onOpen }) {
  const d = daysLeft(c.expiry);
  const tone = expiryTone(d);
  return (
    <button type="button" className={"med risk-" + c.risk.toLowerCase()} onClick={onOpen}>
      <div className="med-top">
        <StripArt drug={c.key} width={96} expiry={c.expiry} />
        <Risk r={c.risk} small />
      </div>
      <div className="med-name"><b>{c.name}</b><span>{c.strength}</span></div>
      <div className="exp">
        <span className="stamp">{stamp(c.expiry)}</span>
        <span className={"days t-" + tone}>{d < 0 ? "Expired" : d + " days left"}</span>
      </div>
      <div className="shelf" aria-hidden="true"><span className={"shelf-fill t-" + tone} style={{ width: Math.max(4, Math.min(100, (d / 540) * 100)) + "%" }} /></div>
      <div className="med-foot muted">{c.conflicts.length ? "With " + c.conflicts.join(", ") : c.risk === "UNKNOWN" ? "Could not be checked" : "No conflicts found"}</div>
    </button>
  );
}

function MedDrawer({ c, s, onClose }) {
  const [confirm, setConfirm] = useState(false);
  const d = daysLeft(c.expiry);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <div className="drawer-wrap" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={c.name + " details"} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <StripArt drug={c.key} width={150} expiry={c.expiry} />
          <button type="button" className="btn ghost icon" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="drawer-title">
          <h2>{c.name} <span>{c.strength}</span></h2>
          <div className="row gap"><Risk r={c.risk} /><span className="pill t-unk">{stamp(c.expiry)} · {d < 0 ? "expired" : d + " days"}</span></div>
        </div>
        <section className="dsec">
          <h4>Interaction check</h4>
          <ul className="bullets">{c.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          {RANK[c.risk] >= 1 && <p className="callout">Ask a pharmacist before taking these together.</p>}
        </section>
        <section className="dsec">
          <h4>Label warnings <span className="muted">from {c.source === "unavailable" ? "nowhere yet" : "openFDA"}</span></h4>
          {c.warnings.length ? <ul className="bullets">{c.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : <p className="muted">No label text was available when this was added.</p>}
        </section>
        <section className="dsec">
          <h4>Where it came from</h4>
          <dl className="kv">
            <dt>Added</dt><dd>{ago(c.addedAt)}</dd>
            <dt>Job</dt><dd>{s.jobs[c.jobId] ? <button type="button" className="link" onClick={() => go("add", { job: c.jobId, med: null })}>{c.jobId}</button> : <span className="mono">{c.jobId}</span>}</dd>
            <dt>Redis key</dt><dd className="mono">cabinet:U1 → {c.id}</dd>
          </dl>
        </section>
        <div className="drawer-foot">
          {confirm ? (
            <div className="confirm">
              <span>Remove {c.name} from your cabinet?</span>
              <button type="button" className="btn danger-solid" onClick={() => removeMedicine(c.id)}>Remove</button>
              <button type="button" className="btn" onClick={() => setConfirm(false)}>Keep it</button>
            </div>
          ) : <button type="button" className="btn danger" onClick={() => setConfirm(true)}>Remove from cabinet</button>}
        </div>
        <Disclaimer />
      </aside>
    </div>
  );
}

/* ======================= Add medicine (Flow A) ======================= */
const SAMPLE_KEYS = ["paracetamol", "warfarin", "metformin", "amoxicillin", "ibuprofen"];
function sampleHint(key, s) {
  if (s.cabinet.some((c) => c.key === key && c.expiry === DRUGS[key].expiry)) return "Already in cabinet";
  if (key === "warfarin") return "High risk with your cabinet";
  return s.fdaCache[key] ? "Label cached" : "First openFDA lookup";
}

function AddMedicine({ s }) {
  const [sample, setSample] = useState("paracetamol");
  const [scenario, setScenario] = useState("normal");
  const [thumb, setThumb] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const j = s.jobs[s.sel.job] || s.jobs[s.jobOrder[0]];

  function readFile(f) {
    if (!f) return;
    if (!/^image\//.test(f.type)) { toast("That file is not an image. Choose a JPG or PNG photo of the strip.", "crit"); return; }
    const r = new FileReader();
    r.onload = () => setThumb(r.result);
    r.readAsDataURL(f);
  }
  function upload() {
    const id = startJob(sample, scenario, thumb);
    go("add", { job: id });
    setThumb(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="split">
      <div className="stack">
        <Card title="New photo" sub="Upload a strip or use a sample.">
          <label
            htmlFor="file"
            className={"drop" + (drag ? " drag" : "") + (thumb ? " has" : "")}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]); }}
          >
            {thumb ? <img src={thumb} alt="Selected strip" /> : <Icon name="upload" size={22} />}
            <span><b>{thumb ? "Photo ready" : "Drop a strip photo"}</b><span className="muted">{thumb ? "Mock mode reads it as the strip selected below." : "or tap to choose a file"}</span></span>
            <input id="file" ref={fileRef} type="file" accept="image/*" onChange={(e) => readFile(e.target.files[0])} />
          </label>
          <div className="samples" role="radiogroup" aria-label="Sample strip">
            {SAMPLE_KEYS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={sample === k} className={"sample" + (sample === k ? " on" : "")} onClick={() => setSample(k)}>
                <StripArt drug={k} width={92} />
                <b>{DRUGS[k].name}</b>
                <span className="muted">{sampleHint(k, s)}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Scenario" sub="Pick what should happen, then watch the agents.">
          <div className="scenarios" role="radiogroup" aria-label="Scenario">
            {SCENARIOS.map((sc) => (
              <button key={sc.key} type="button" role="radio" aria-checked={scenario === sc.key} className={"scenario" + (scenario === sc.key ? " on" : "")} onClick={() => setScenario(sc.key)}>
                <span className="radio" aria-hidden="true" />
                <span><b>{sc.label}</b><span className="muted">{sc.help}</span></span>
              </button>
            ))}
          </div>
          <button type="button" className="btn primary wide" id="upload-btn" onClick={upload}><Icon name="upload" size={16} />Upload {DRUGS[sample].name}</button>
        </Card>

        <Card title="Recent uploads">
          <JobList s={s} limit={8} />
        </Card>
      </div>
      <div className="stack sticky-col">
        {j ? <JobView j={j} /> : <Card><Empty icon="camera" title="No job yet">Pick a sample and upload it. Each agent step appears here.</Empty></Card>}
      </div>
    </div>
  );
}

function StepIcon({ state }) {
  if (state === "done") return <Icon name="check" size={13} />;
  if (state === "error") return <Icon name="x" size={13} />;
  if (state === "waiting") return <Icon name="clock" size={13} />;
  return null;
}

function JobView({ j }) {
  useTick(1000, !!j.gate);
  const ex = j.extracted;
  const groups = [];
  j.steps.forEach((st) => {
    const last = groups[groups.length - 1];
    if (st.group && last && last.group === st.group) last.items.push(st);
    else groups.push({ group: st.group, items: [st] });
  });
  const scenario = SCENARIOS.find((x) => x.key === j.scenario);

  return (
    <Card className="jobcard">
      <div className="job-head">
        {j.thumb ? <img className="job-thumb" src={j.thumb} alt="Uploaded strip" /> : <StripArt drug={j.sample} width={120} blurred={j.scenario === "blurry"} />}
        <div className="job-titles">
          <span className="eyebrow mono">Job {j.id}</span>
          <h2>{ex ? ex.name + " " + ex.strength : "Reading the photo"}</h2>
          <div className="row gap wrap"><Status s={j.status} />{scenario && <span className="pill t-unk sm">{scenario.label}</span>}<span className="muted small">{ago(j.createdAt)}</span></div>
        </div>
      </div>

      <ol className="timeline">
        {groups.map((g, gi) => {
          if (g.group) {
            const states = g.items.map((x) => x.state);
            const gs = states.includes("error") ? "error" : states.includes("waiting") ? "waiting" : states.includes("running") ? "running" : states.every((x) => x === "done") ? "done" : "pending";
            const out = g.items[g.items.length - 1].out;
            return (
              <React.Fragment key={gi}>
                <li className={"tl " + gs}>
                  <span className="tl-dot"><StepIcon state={gs} /></span>
                  <div className="tl-body">
                    <div className="par-label"><Icon name="layers" size={13} />Parallel read. Both agents look at the same photo at once.</div>
                    <div className="par">
                      {g.items.map((st) => (
                        <div key={st.key} className={"par-item " + st.state}>
                          <div className="tl-head"><b>{st.agent}</b><span className="ms mono">{st.ms != null ? secs(st.ms) : ""}</span></div>
                          <span className="tech">{st.tech}</span>
                          <p className="tl-note">{st.note || "Waiting"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </li>
                {out && gs === "done" && <TopicHop topic={out} />}
              </React.Fragment>
            );
          }
          const st = g.items[0];
          return (
            <React.Fragment key={gi}>
              <li className={"tl " + st.state}>
                <span className="tl-dot"><StepIcon state={st.state} /></span>
                <div className="tl-body">
                  <div className="tl-head"><b>{st.agent}</b><span className="tech">{st.tech}</span><span className="ms mono">{st.ms != null ? secs(st.ms) : ""}</span></div>
                  <p className="tl-note">{st.note || (st.state === "pending" ? "Waiting for the previous step" : "")}</p>
                </div>
              </li>
              {st.out && st.state === "done" && <TopicHop topic={st.out} />}
            </React.Fragment>
          );
        })}
      </ol>

      {j.gate === "CONFIRM" && <GateA j={j} />}
      {j.gate === "ACK" && <GateB j={j} />}

      {j.result && !j.gate && (
        <div className={"result t-" + ({ LOW: "ok", MEDIUM: "warn", HIGH: "crit", UNKNOWN: "unk" }[j.result.risk])}>
          <div className="row gap wrap"><Risk r={j.result.risk} /><span className="muted small">Label source: {j.result.source}{j.result.conflicts.length ? " · with " + j.result.conflicts.join(", ") : ""}</span></div>
          <p>{j.result.reasons.join(" ")}</p>
        </div>
      )}
      {j.message && <div className={"msg t-" + (j.status === "DONE" ? "ok" : j.status === "FAILED" ? "crit" : "warn")}>{j.message}</div>}
      <Disclaimer />
    </Card>
  );
}

function TopicHop({ topic }) {
  return <li className="hop"><span className="hop-line" aria-hidden="true" /><span className="mono">Kafka</span><code>{topic}</code></li>;
}

function GateA({ j }) {
  const ex = j.extracted;
  const [name, setName] = useState(DRUGS[j.sample].name);
  const [strength, setStrength] = useState(ex.strength);
  const [expiry, setExpiry] = useState(ex.expiry);
  const [err, setErr] = useState("");
  function confirm() {
    if (!/^\d{4}-\d{2}$/.test(expiry.trim())) { setErr("Write the expiry as year and month, for example 2027-03."); return; }
    if (!name.trim()) { setErr("Add the medicine name."); return; }
    decideJob(j.id, "approve", { name: name.trim(), strength: strength.trim() || ex.strength, expiry: expiry.trim() });
  }
  return (
    <div className="gate">
      <div className="gate-head"><span className="gate-tag">Gate A</span><b>Confirm what the photo says</b><span className="muted small">Times out in {timeLeft(j.gateAt + 86400000 - Date.now())}</span></div>
      <p className="small">Vision read <b>"{ex.name}"</b> with confidence {ex.confidence.toFixed(2)}. Textract read <b>"{DRUGS[j.sample].name}"</b>. The job is paused and the Kafka consumer has moved on. Fix anything that is wrong.</p>
      <div className="form3">
        <label htmlFor="ga-name">Name<input id="ga-name" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label htmlFor="ga-strength">Strength<input id="ga-strength" value={strength} onChange={(e) => setStrength(e.target.value)} /></label>
        <label htmlFor="ga-exp">Expiry (YYYY-MM)<input id="ga-exp" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></label>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="btns">
        <button type="button" className="btn primary" onClick={confirm}>Confirm and continue</button>
        <button type="button" className="btn danger" onClick={() => decideJob(j.id, "reject")}>Reject</button>
        <button type="button" className="btn ghost" onClick={() => decideJob(j.id, "timeout")}>Simulate no answer</button>
      </div>
    </div>
  );
}

function GateB({ j }) {
  return (
    <div className="gate crit">
      <div className="gate-head"><span className="gate-tag">Gate B</span><b>Acknowledge the warning</b><span className="muted small">Times out in {timeLeft(j.gateAt + 86400000 - Date.now())}</span></div>
      <div className="row gap"><Risk r={j.result.risk} />{j.result.conflicts.length > 0 && <span className="small">with {j.result.conflicts.join(", ")}</span>}</div>
      <p className="small">{j.result.reasons.join(" ")} Ask a pharmacist before taking these together.</p>
      <div className="btns">
        <button type="button" className="btn primary" onClick={() => decideJob(j.id, "approve")}>I understand, add it</button>
        <button type="button" className="btn danger" onClick={() => decideJob(j.id, "reject")}>Discard</button>
        <button type="button" className="btn ghost" onClick={() => decideJob(j.id, "timeout")}>Simulate no answer</button>
      </div>
    </div>
  );
}

/* ======================= Cabinet review (Flow B) ======================= */
function Review({ s }) {
  const [drill, setDrill] = useState("normal");
  const r = s.reviews[s.sel.review] || s.reviews[s.reviewOrder[0]];
  const running = r && ["PLANNING", "RUNNING", "DRAFTING", "CRITIQUE", "SENDING"].includes(r.status);
  useTick(120, !!(r && r.status === "RUNNING"));

  return (
    <div className="stack">
      <Card>
        <div className="flowline" aria-label="Review workflow">
          <FlowNode label="Supervisor" sub="plans" on={r && r.status === "PLANNING"} done={r && r.plan} />
          <FlowArrow />
          <FlowNode label="4 auditors" sub="in parallel" on={r && r.status === "RUNNING"} done={r && r.parallelMs} />
          <FlowArrow />
          <FlowNode label="Writer ⇄ Critic" sub="up to 3 rounds" on={r && ["DRAFTING", "CRITIQUE"].includes(r.status)} done={r && r.rounds.length && r.status !== "DRAFTING" && r.status !== "CRITIQUE"} />
          <FlowArrow />
          <FlowNode label="You" sub="Gate C" on={r && r.status === "AWAITING_APPROVAL"} done={r && ["SENT", "DISCARDED", "EXPIRED", "SENDING"].includes(r.status)} />
          <FlowArrow />
          <FlowNode label="S3 + SNS" sub="report sent" done={r && r.status === "SENT"} on={r && r.status === "SENDING"} />
        </div>
        <div className="review-controls">
          <div className="drills" role="radiogroup" aria-label="Drill">
            {REVIEW_DRILLS.map((d) => (
              <button key={d.key} type="button" role="radio" aria-checked={drill === d.key} className={"scenario" + (drill === d.key ? " on" : "")} onClick={() => setDrill(d.key)}>
                <span className="radio" aria-hidden="true" />
                <span><b>{d.label}</b><span className="muted">{d.help}</span></span>
              </button>
            ))}
          </div>
          <button type="button" id="run-review" className="btn primary" disabled={running} onClick={() => startReview(drill)}>
            <Icon name="layers" size={16} />{running ? "Review running" : "Run cabinet review"}
          </button>
        </div>
      </Card>

      {!r && <Card><Empty icon="layers" title="No review yet">Run a review of your {s.cabinet.length} medicines. Tip: add Warfarin first to see a high risk finding.</Empty></Card>}

      {r && (
        <>
          <div className="row gap wrap review-status">
            <span className="eyebrow mono">Review {r.id}</span><Status s={r.status} />
            {r.message && <span className="small muted">{r.message}</span>}
            {s.reviewOrder.length > 1 && (
              <span className="past">
                {s.reviewOrder.slice(0, 5).map((id) => <button key={id} type="button" className={"chip" + (id === r.id ? " on" : "")} onClick={() => go("review", { review: id })}>{id}</button>)}
              </span>
            )}
          </div>
          <div className="grid-2">
            <Card title="Parallel auditors" sub={r.plan ? r.plan.note : "The supervisor is planning which auditors to call."}>
              {r.lanes.length ? (
                <div className="lanes">
                  {r.lanes.map((l) => {
                    const p = l.state === "running" ? Math.min(0.97, (Date.now() - l.startedAt) / l.dur) : l.state === "pending" ? 0 : 1;
                    return (
                      <div key={l.key} className={"lane " + l.state}>
                        <div className="lane-head"><b>{l.agent}</b><span className="mono ms">{l.ms != null ? secs(l.ms) : l.state === "running" ? "working" : ""}</span></div>
                        <div className="bar" role="progressbar" aria-label={l.agent} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(p * 100)}><span style={{ width: Math.round(p * 100) + "%" }} /></div>
                        {l.summary && <span className="small muted">{l.summary}</span>}
                      </div>
                    );
                  })}
                  {r.plan && r.plan.skipped.length > 0 && <p className="small muted">Skipped: {r.plan.skipped.join(", ")}.</p>}
                  {r.parallelMs != null && (
                    <div className="timing">
                      <div><span className="muted small">In parallel</span><b className="mono">{secs(r.parallelMs)}</b></div>
                      <div><span className="muted small">One after another</span><b className="mono">{secs(r.sequentialMs)}</b></div>
                      <p className="small muted">Parallel time is the slowest lane, not the sum.</p>
                    </div>
                  )}
                </div>
              ) : <div className="skeleton" aria-hidden="true"><span /><span /><span /></div>}
            </Card>

            <Card title="Writer and critic loop" sub="The Safety Reviewer checks every draft. The loop stops after 3 rounds.">
              {r.rounds.length || ["DRAFTING", "CRITIQUE"].includes(r.status) ? (
                <ol className="rounds">
                  {r.rounds.map((x) => (
                    <li key={x.n} className={x.verdict === "APPROVED" ? "ok" : "crit"}>
                      <div className="round-head"><b>Draft {x.n}</b>{x.byYou && <span className="pill t-acc sm">your comment</span>}<span className={"pill sm t-" + (x.verdict === "APPROVED" ? "ok" : "crit")}>{x.verdict === "APPROVED" ? "Approved" : "Changes needed"}</span></div>
                      <ul className="bullets small">{x.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                    </li>
                  ))}
                  {r.status === "DRAFTING" && <li className="live"><b>Draft {r.rounds.length + 1}</b><span className="small muted">Report Writer is drafting</span></li>}
                  {r.status === "CRITIQUE" && <li className="live"><b>Draft {r.rounds.length + 1}</b><span className="small muted">Safety Reviewer is checking</span></li>}
                </ol>
              ) : <Empty icon="clock" title="Waiting for the auditors">Drafting starts when every lane has finished or timed out.</Empty>}
            </Card>
          </div>

          {r.status === "AWAITING_APPROVAL" && <GateC r={r} />}

          {r.report && (
            <Card title={r.report.title} sub={"Draft " + r.report.draft + " · " + r.report.summary} className="report">
              {!r.approved && r.status !== "SENT" && r.rounds.length > 0 && r.rounds[r.rounds.length - 1].verdict !== "APPROVED" && <div className="msg t-crit">Not approved by the Safety Reviewer. It cannot be sent as it is.</div>}
              {r.report.missing.length > 0 && <div className="msg t-warn">Partial report. {r.report.missing.join(", ")} timed out.</div>}
              <div className="rsecs">
                {r.report.sections.map((sec) => (
                  <section key={sec.heading} className="rsec">
                    <h4>{sec.heading}</h4>
                    <ul className="findings">
                      {sec.items.map((it, i) => <li key={i}><Risk r={it.risk} small /><span>{it.text}</span></li>)}
                    </ul>
                  </section>
                ))}
              </div>
              {r.s3Key && <p className="small"><Icon name="db" size={14} /> Saved to <code>{r.s3Key}</code></p>}
              <Disclaimer />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function FlowNode({ label, sub, on, done }) {
  return <div className={"fnode" + (on ? " on" : "") + (done && !on ? " done" : "")}><b>{label}</b><span>{sub}</span></div>;
}
function FlowArrow() {
  return <span className="farrow" aria-hidden="true"><Icon name="arrow" size={14} /></span>;
}

function GateC({ r }) {
  useTick(1000);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="gate">
      <div className="gate-head"><span className="gate-tag">Gate C</span><b>Approve the report</b><span className="muted small">Expires in {timeLeft(r.gateAt + 7 * 86400000 - Date.now())}</span></div>
      <p className="small">{r.approved ? "The Safety Reviewer approved this draft. Nothing is saved or sent until you approve." : "The critic did not approve any draft, so you can't send it. Tell the writer what to change, or discard it."}</p>
      <label htmlFor="gc-comment" className="small muted">Comment for the writer (optional)</label>
      <textarea id="gc-comment" rows="2" value={comment} onChange={(e) => { setComment(e.target.value); setErr(""); }} placeholder="For example: keep it shorter and list expiry first" />
      {err && <p className="err">{err}</p>}
      <div className="btns">
        <button type="button" className="btn primary" disabled={!r.approved} onClick={() => decideReview(r.id, "approve")}>Approve and send</button>
        <button type="button" className="btn" onClick={() => { if (!comment.trim()) { setErr("Write a short comment so the writer knows what to change."); return; } decideReview(r.id, "changes", comment.trim()); setComment(""); }}>Request changes</button>
        <button type="button" className="btn danger" onClick={() => decideReview(r.id, "discard")}>Discard</button>
        <button type="button" className="btn ghost" onClick={() => decideReview(r.id, "timeout")}>Simulate no answer</button>
      </div>
    </div>
  );
}

/* ======================= Ask (Flow C) ======================= */
const SUGGESTIONS = ["Can I take ibuprofen with my cabinet?", "What about warfarin?", "What expires soon?", "What are the warnings for aspirin?", "Is aspirin safe with warfarin?", "How many tablets should I take?"];

function Ask({ s }) {
  const [text, setText] = useState("");
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [s.chat.length, s.chatBusy]);
  const counts = {};
  s.chat.forEach((m) => { if (m.route) counts[m.route] = (counts[m.route] || 0) + 1; });
  function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || s.chatBusy) return;
    setText("");
    sendChat(t);
  }
  return (
    <div className="split chat-split">
      <Card className="chatcard">
        <div className="chatlog" ref={logRef} aria-live="polite">
          {s.chat.map((m) => (
            <div key={m.id} className={"msgb" + (m.me ? " me" : "")}>
              {!m.me && m.route && (
                <div className="meta">
                  <span className={"pill sm " + (m.route === "guardrail" ? "t-warn" : "t-acc")}>{ROUTES[m.route].label}</span>
                  <span className="muted small">{m.agent}</span>
                  {m.usedMemory && <span className="pill sm t-unk">used memory</span>}
                </div>
              )}
              <p>{m.text}</p>
              {m.items && m.items.length > 0 && (
                <ul className="findings">{m.items.map((it, i) => <li key={i}>{it.risk ? <Risk r={it.risk} small /> : <span className="bullet" aria-hidden="true" />}<span>{it.text}</span></li>)}</ul>
              )}
              {!m.me && m.tools && m.tools.length > 0 && <div className="tools">{m.tools.map((t) => <code key={t}>{t}</code>)}</div>}
              {!m.me && m.route && <span className="foot">Memory {m.memory} of 10 messages · not medical advice</span>}
            </div>
          ))}
          {s.chatBusy && <div className="msgb typing"><span /><span /><span /><span className="muted small">Router is picking a specialist</span></div>}
        </div>
        <div className="chips">
          {SUGGESTIONS.map((q) => <button key={q} type="button" className="chip" disabled={s.chatBusy} onClick={() => sendChat(q)}>{q}</button>)}
        </div>
        <form className="composer" onSubmit={submit}>
          <input id="chat-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about your cabinet" aria-label="Your question" autoComplete="off" />
          <button type="submit" className="btn primary" disabled={!text.trim() || s.chatBusy} aria-label="Send"><Icon name="send" size={16} /></button>
        </form>
      </Card>
      <div className="stack">
        <Card title="How the router decides" sub="LangChain4j routes each question to one specialist.">
          <ul className="routes">
            {Object.entries(ROUTES).map(([k, v]) => (
              <li key={k}>
                <span className={"pill sm " + (k === "guardrail" ? "t-warn" : k === "fallback" ? "t-unk" : "t-acc")}>{v.label}</span>
                <span className="muted small">{v.agent}</span>
                <span className="mono small count">{counts[k] || 0}</span>
              </li>
            ))}
          </ul>
          <p className="small muted">Dosage questions hit the guardrail before any model call. A follow-up like "What about warfarin?" reuses the last route from chat memory in Redis.</p>
        </Card>
      </div>
    </div>
  );
}

/* ======================= Approvals ======================= */
function Approvals({ s, tasks }) {
  useTick(1000);
  const done = [
    ...s.jobOrder.map((id) => s.jobs[id]).filter((j) => j.scenario === "unsure" || (j.result && ["HIGH", "UNKNOWN"].includes(j.result.risk))).filter((j) => !j.gate && ["DONE", "CANCELLED"].includes(j.status)).map((j) => ({ id: j.id, kind: "job", label: (j.extracted ? j.extracted.name : j.id), status: j.status, t: j.createdAt })),
    ...s.reviewOrder.map((id) => s.reviews[id]).filter((r) => ["SENT", "DISCARDED", "EXPIRED"].includes(r.status)).map((r) => ({ id: r.id, kind: "review", label: "Cabinet review", status: r.status, t: r.createdAt })),
  ].sort((a, b) => b.t - a.t);
  return (
    <div className="stack">
      <div className="gate-legend">
        <div><span className="gate-tag">Gate A</span><span className="small">Confirm an unsure photo read. Times out in 24 h.</span></div>
        <div><span className="gate-tag">Gate B</span><span className="small">Acknowledge a high or unknown risk. Times out in 24 h.</span></div>
        <div><span className="gate-tag">Gate C</span><span className="small">Approve the review report before it is sent. Expires in 7 days.</span></div>
      </div>
      <Card title="Waiting for you" sub={tasks.length ? tasks.length + " paused workflows" : "Nothing paused"}>
        {tasks.length ? (
          <ul className="tasks">
            {tasks.map((t) => (
              <li key={t.id}>
                <span className="gate-tag">Gate {t.gate}</span>
                <span className="row-main"><b>{t.title}</b><span className="muted small">{t.detail}</span><span className="mono small muted">{t.id} · waiting {ago(t.createdAt).replace(" ago", "")} · times out in {timeLeft(t.deadline - Date.now())}</span></span>
                <button type="button" className="btn primary sm" onClick={() => go(t.kind === "job" ? "add" : "review", t.kind === "job" ? { job: t.id } : { review: t.id })}>Open</button>
              </li>
            ))}
          </ul>
        ) : <Empty icon="inbox" title="Nothing is waiting for you">Try the Unsure read scenario, upload Warfarin, or run a cabinet review.</Empty>}
      </Card>
      {done.length > 0 && (
        <Card title="Decided">
          <ul className="rows">
            {done.map((d) => (
              <li key={d.id}>
                <button type="button" className="row-btn" onClick={() => go(d.kind === "job" ? "add" : "review", d.kind === "job" ? { job: d.id } : { review: d.id })}>
                  <span className="row-main"><b>{d.label}</b><span className="muted mono small">{d.id} · {ago(d.t)}</span></span>
                  <Status s={d.status} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ======================= Activity ======================= */
function Activity({ s }) {
  const [tab, setTab] = useState("runs");
  const [topic, setTopic] = useState("all");
  const [flow, setFlow] = useState("all");
  const topics = Array.from(new Set(s.events.map((e) => e.topic))).sort();
  const flows = Array.from(new Set(s.runs.map((r) => r.workflow))).sort();
  const runs = s.runs.filter((r) => flow === "all" || r.workflow === flow);
  const events = s.events.filter((e) => topic === "all" || e.topic === topic);
  const openDlt = s.dlt.filter((d) => !d.replayed).length;

  return (
    <div className="stack">
      <div className="toolbar">
        <Seg id="act-tab" label="Activity" value={tab} onChange={setTab} options={[{ key: "runs", label: "Agent runs" }, { key: "events", label: "Kafka events" }, { key: "dlt", label: "Dead letters" + (openDlt ? " (" + openDlt + ")" : "") }]} />
        {tab === "runs" && (
          <select id="flow-filter" value={flow} onChange={(e) => setFlow(e.target.value)} aria-label="Workflow">
            <option value="all">All workflows</option>
            {flows.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        {tab === "events" && (
          <select id="topic-filter" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">
            <option value="all">All topics</option>
            {topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {tab === "runs" && (
        <Card title="Agent runs" sub="One row per agent execution. Stored in the DynamoDB table agent_runs.">
          <div className="tablewrap">
            <table>
              <thead><tr><th>Time</th><th>Agent</th><th>Workflow</th><th>Ref</th><th className="num">Duration</th><th className="num">Tokens</th><th>Status</th><th>Summary</th></tr></thead>
              <tbody>
                {runs.slice(0, 80).map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{clock(r.t)}</td>
                    <td><b>{r.agent}</b></td>
                    <td className="muted">{r.workflow}</td>
                    <td className="mono">{r.ref}</td>
                    <td className="num mono">{secs(r.ms)}</td>
                    <td className="num mono">{r.tokens ? r.tokens.toLocaleString() : "–"}</td>
                    <td><span className={"pill sm t-" + ({ ok: "ok", error: "crit", timeout: "crit", rejected: "warn", waiting: "warn", degraded: "warn", retake: "warn", cancelled: "unk" }[r.status] || "unk")}>{r.status}</span></td>
                    <td className="muted">{r.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "events" && (
        <Card title="Kafka events" sub="Newest first. Every message is keyed by userId, so one user's events stay in order on one partition.">
          <div className="tablewrap">
            <table>
              <thead><tr><th>Time</th><th>Topic</th><th className="num">Partition</th><th className="num">Offset</th><th>Key</th><th>Payload</th></tr></thead>
              <tbody>
                {events.slice(0, 80).map((e) => (
                  <tr key={e.id}>
                    <td className="mono">{clock(e.t)}</td>
                    <td><code className={e.topic.endsWith(".DLT") ? "t-crit" : ""}>{e.topic}</code></td>
                    <td className="num mono">{e.partition}</td>
                    <td className="num mono">{e.offset}</td>
                    <td className="mono">{e.key}</td>
                    <td><code className="payload">{JSON.stringify(e.payload)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "dlt" && (
        <Card title="Dead letters" sub="Messages that can never succeed, or ran out of retries. Nothing is deleted.">
          {s.dlt.length ? (
            <ul className="dlt">
              {s.dlt.map((d) => (
                <li key={d.id} className={d.replayed ? "replayed" : ""}>
                  <div className="dlt-head">
                    <span className="row-ico t-crit"><Icon name="bolt" size={15} /></span>
                    <b>{d.reason}</b>
                    <span className="muted small">{ago(d.t)}</span>
                  </div>
                  <div className="small muted">From <code>{d.source}</code> · job <span className="mono">{d.ref}</span></div>
                  <pre><code>{JSON.stringify(d.payload, null, 2)}</code></pre>
                  <div className="btns">
                    {d.replayed ? <span className="pill sm t-unk">Replayed {ago(d.replayedAt)}</span> : <button type="button" className="btn sm" onClick={() => replayDlt(d.id)}><Icon name="replay" size={14} />Replay to {d.source}</button>}
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty icon="check" title="No dead letters">Try the Bad model output scenario in Add medicine.</Empty>}
        </Card>
      )}
    </div>
  );
}
