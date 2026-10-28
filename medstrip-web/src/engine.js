/*
 * MedStrip mock backend.
 * Everything here runs in the browser and pretends to be the two Spring Boot apps,
 * Kafka, Redis, S3, openFDA and the agents. When you build the real backend,
 * replace these functions with fetch() calls to medstrip-api.
 */

export const DAY = 86400000;

/* ---------- time helpers ---------- */
export function ym(offsetMonths) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
function expiryEnd(e) {
  const [y, m] = e.split("-").map(Number);
  return new Date(y, m, 0, 23, 59, 59).getTime();
}
export function daysLeft(e) {
  return Math.ceil((expiryEnd(e) - Date.now()) / DAY);
}
export function stamp(e) {
  const [y, m] = e.split("-");
  return "EXP " + m + "/" + y;
}
export function clock(t) {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
export function ago(t) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return s + "s ago";
  const m = Math.round(s / 60);
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  if (h < 48) return h + " h ago";
  return Math.round(h / 24) + " days ago";
}
export function timeLeft(ms) {
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return Math.floor(h / 24) + " d " + (h % 24) + " h";
  return h + " h " + m + " min";
}
export function secs(ms) {
  return ms >= 1000 ? (ms / 1000).toFixed(1) + " s" : ms + " ms";
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- reference data (sample, not medical advice) ---------- */
export const DRUGS = {
  paracetamol: { name: "Paracetamol", strength: "500 mg", hue: 205, expiry: ym(13),
    warnings: ["Contains paracetamol (acetaminophen). The label warns against using other products that contain it.", "Liver warning on the label for heavy alcohol use."] },
  warfarin: { name: "Warfarin", strength: "5 mg", hue: 330, expiry: ym(9),
    warnings: ["The label carries a bleeding risk warning.", "The label asks you to tell your doctor about every other medicine you take."] },
  metformin: { name: "Metformin", strength: "500 mg", hue: 170, expiry: ym(18),
    warnings: ["The label includes a lactic acidosis warning.", "The label advises caution with heavy alcohol use."] },
  amoxicillin: { name: "Amoxicillin", strength: "500 mg", hue: 45, expiry: ym(6),
    warnings: ["The label lists serious allergic reactions as a warning.", "The label asks about penicillin allergy before use."] },
  ibuprofen: { name: "Ibuprofen", strength: "400 mg", hue: 18, expiry: ym(8),
    warnings: ["NSAID label warning about stomach bleeding.", "The label advises asking a doctor before use with other NSAIDs such as aspirin."] },
  aspirin: { name: "Aspirin", strength: "75 mg", hue: 0, expiry: ym(1),
    warnings: ["Stomach bleeding warning on the label.", "The label advises asking a doctor before use with blood thinners."] },
  cetirizine: { name: "Cetirizine", strength: "10 mg", hue: 265, expiry: ym(17),
    warnings: ["May cause drowsiness.", "The label advises care with alcohol and sedatives."] },
  pantoprazole: { name: "Pantoprazole", strength: "40 mg", hue: 120, expiry: ym(0),
    warnings: ["The label advises long-term use only under a doctor's care."] },
};

const RULES = [
  { a: "warfarin", b: "aspirin", risk: "HIGH", why: "Both affect bleeding. The warfarin label warns against combining it with aspirin unless a doctor says so." },
  { a: "warfarin", b: "ibuprofen", risk: "HIGH", why: "The warfarin label warns that NSAIDs such as ibuprofen raise bleeding risk." },
  { a: "ibuprofen", b: "aspirin", risk: "MEDIUM", why: "Both are NSAIDs. The ibuprofen label advises caution when used with aspirin." },
];
export const RANK = { LOW: 0, UNKNOWN: 1, MEDIUM: 2, HIGH: 3 };

function pairRule(a, b) {
  return RULES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}
export function checkAgainst(key, others) {
  let risk = "LOW";
  const conflicts = [];
  let reasons = [];
  others.forEach((o) => {
    if (o.key === key) return;
    const r = pairRule(key, o.key);
    if (r) {
      conflicts.push(o.name);
      reasons.push(r.why);
      if (RANK[r.risk] > RANK[risk]) risk = r.risk;
    }
  });
  if (!reasons.length) reasons = ["No interaction with your cabinet found in the label text. This is not a guarantee."];
  return { risk, conflicts, reasons };
}
function recompute(cab) {
  return cab.map((it) =>
    it.source === "unavailable"
      ? { ...it, risk: "UNKNOWN", conflicts: [], reasons: ["No label text was available, so this could not be checked. Ask a pharmacist."] }
      : { ...it, ...checkAgainst(it.key, cab) }
  );
}

/* ---------- agents (for the Overview list) ---------- */
export const AGENTS = [
  { name: "Vision Reader", tech: "Spring AI", flow: "Add medicine" },
  { name: "OCR Reader", tech: "AWS Textract", flow: "Add medicine" },
  { name: "Drug Facts", tech: "Spring AI · openFDA", flow: "Add medicine" },
  { name: "Interaction Checker", tech: "Spring AI", flow: "Add medicine" },
  { name: "Safety Reviewer", tech: "Spring AI", flow: "Add medicine · Review" },
  { name: "Cabinet Writer", tech: "Redis · DynamoDB", flow: "Add medicine" },
  { name: "Review Supervisor", tech: "LangChain4j", flow: "Review" },
  { name: "Auditors (4)", tech: "LangChain4j parallel", flow: "Review" },
  { name: "Report Writer", tech: "Spring AI", flow: "Review" },
  { name: "Chat Router", tech: "LangChain4j", flow: "Ask" },
];

/* ---------- pipeline steps for Add medicine ---------- */
export const STEP_DEFS = [
  { key: "api", agent: "Upload API", tech: "Spring Boot · S3 · Kafka", out: "medicine-photo-uploaded" },
  { key: "vision", agent: "Vision Reader", tech: "Spring AI", group: "read" },
  { key: "ocr", agent: "OCR Reader", tech: "AWS Textract", group: "read", out: "medicine-extracted" },
  { key: "facts", agent: "Drug Facts", tech: "Spring AI · openFDA · Redis", out: "medicine-enriched" },
  { key: "interact", agent: "Interaction Checker", tech: "Spring AI", out: "interaction-checked" },
  { key: "safety", agent: "Safety Reviewer", tech: "Spring AI", out: "medicine-approved" },
  { key: "writer", agent: "Cabinet Writer", tech: "Redis · DynamoDB" },
];
function newSteps() {
  return STEP_DEFS.map((d) => ({ ...d, state: "pending", note: "", ms: null }));
}

export const SCENARIOS = [
  { key: "normal", label: "Normal", help: "Clear photo. The chain runs start to finish." },
  { key: "unsure", label: "Unsure read", help: "Vision and OCR disagree. Gate A asks you to confirm the details." },
  { key: "blurry", label: "Blurry photo", help: "Low confidence. The job ends as Retake photo. Nothing goes to the dead letter topic." },
  { key: "fdadown", label: "openFDA down", help: "Timeouts and backoff. Uses the cache if it can, otherwise the risk is Unknown and Gate B asks you." },
  { key: "badjson", label: "Bad model output", help: "The model reply never parses. 3 attempts, then the dead letter topic." },
  { key: "duplicate", label: "Duplicate photo", help: "Same photo hash as an earlier upload. You get the earlier job back." },
];

export const REVIEW_DRILLS = [
  { key: "normal", label: "Normal", help: "Critic approves the first draft." },
  { key: "mistake", label: "Writer makes a mistake", help: "Critic rejects draft 1. The writer fixes it in round 2." },
  { key: "stubborn", label: "Critic never satisfied", help: "3 rejected rounds. The loop stops and a person decides." },
  { key: "lanefail", label: "An auditor times out", help: "One parallel lane fails. The report is marked partial." },
];

export const AUDITORS = [
  { key: "interactions", agent: "Interaction Auditor", heading: "Interactions", dur: 1700 },
  { key: "expiry", agent: "Expiry Auditor", heading: "Expiry", dur: 900 },
  { key: "duplicates", agent: "Duplicate Auditor", heading: "Duplicates", dur: 1200 },
  { key: "labels", agent: "Label Auditor", heading: "Label warnings", dur: 1400 },
];

/* ---------- store ---------- */
function createStore(init) {
  let state = init;
  const subs = new Set();
  return {
    get: () => state,
    set: (fn) => {
      state = fn(state);
      subs.forEach((f) => f());
    },
    sub: (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}

function seed() {
  const now = Date.now();
  const H = 3600000;
  const mk = (key, extra) => {
    const d = DRUGS[key];
    return { id: "M-" + key, key, name: d.name, strength: d.strength, expiry: extra.expiry || d.expiry,
      source: "openFDA", warnings: d.warnings, addedAt: now - extra.days * DAY, jobId: extra.jobId };
  };
  const cabinet = recompute([
    mk("aspirin", { days: 20, jobId: "J-1001" }),
    mk("ibuprofen", { days: 12, jobId: "J-1002" }),
    mk("cetirizine", { days: 40, jobId: "J-0990" }),
    mk("pantoprazole", { days: 90, jobId: "J-0950" }),
  ]);

  const doneSteps = (key, risk, conflicts) => newSteps().map((s) => {
    const n = {
      api: "Saved to s3://medstrip-photos/U1/J-1002.jpg and returned 202 Accepted.",
      vision: 'Read "' + DRUGS[key].name + " " + DRUGS[key].strength + '", confidence 0.95. Matches Textract.',
      ocr: 'Text found: "' + DRUGS[key].name.toUpperCase() + " " + DRUGS[key].strength.toUpperCase() + '"',
      facts: "openFDA answered in 398 ms. Cached for 24 h.",
      interact: "Risk " + risk + (conflicts ? " with " + conflicts + "." : "."),
      safety: 'Added "check with a pharmacist". No dosage advice.',
      writer: "Saved to cabinet:U1 in Redis and the run record to DynamoDB.",
    }[s.key];
    const ms = { api: 41, vision: 1080, ocr: 655, facts: 398, interact: 702, safety: 515, writer: 8 }[s.key];
    return { ...s, state: "done", note: n, ms };
  });

  const j1003Steps = newSteps().map((s) => {
    if (s.key === "api") return { ...s, state: "done", ms: 36, note: "Saved to s3://medstrip-photos/U1/J-1003.jpg and returned 202 Accepted." };
    if (s.key === "ocr") return { ...s, state: "done", ms: 690, note: 'Text found: "METFORMIN 500 MG ' + stamp(DRUGS.metformin.expiry) + '"' };
    if (s.key === "vision") return { ...s, state: "waiting", ms: 1120, note: 'Read "Metformn" (0.62). Textract read "Metformin". They disagree.' };
    return s;
  });

  const jobs = {
    "J-1002": { id: "J-1002", sample: "ibuprofen", scenario: "normal", status: "DONE", createdAt: now - 12 * DAY,
      steps: doneSteps("ibuprofen", "MEDIUM", "Aspirin"),
      extracted: { name: "Ibuprofen", strength: "400 mg", expiry: DRUGS.ibuprofen.expiry, confidence: 0.95 },
      result: { risk: "MEDIUM", conflicts: ["Aspirin"], reasons: [RULES[2].why], source: "openFDA" },
      gate: null, message: "Ibuprofen 400 mg is in your cabinet.", source: "openFDA" },
    "J-1003": { id: "J-1003", sample: "metformin", scenario: "unsure", status: "AWAITING_CONFIRMATION", createdAt: now - 2 * H,
      steps: j1003Steps, extracted: { name: "Metformn", strength: "500 mg", expiry: DRUGS.metformin.expiry, confidence: 0.62 },
      result: null, gate: "CONFIRM", gateAt: now - 2 * H + 3000, message: null },
  };

  const ev = (topic, offset, t, payload, partition) => ({ id: topic + ":" + offset, t, topic, key: "U1", partition: partition == null ? 1 : partition, offset, payload });
  const events = [
    ev("medicine-photo-uploaded", 1041, now - 2 * H, { jobId: "J-1003", s3Key: "U1/J-1003.jpg" }),
    ev("medstrip.DLT", 6, now - 26 * H, { jobId: "J-0998", reason: "Image file is corrupt (not a JPEG)" }, 0),
    ev("medicine-photo-uploaded", 1040, now - 26 * H, { jobId: "J-0998", s3Key: "U1/J-0998.jpg" }),
    ev("medicine-approved", 702, now - 12 * DAY, { jobId: "J-1002", risk: "MEDIUM" }),
    ev("interaction-checked", 715, now - 12 * DAY, { jobId: "J-1002", risk: "MEDIUM", conflictsWith: ["Aspirin"] }),
    ev("medicine-enriched", 731, now - 12 * DAY, { jobId: "J-1002", name: "Ibuprofen", source: "openFDA" }),
    ev("medicine-extracted", 744, now - 12 * DAY, { jobId: "J-1002", name: "Ibuprofen", strength: "400 mg", confidence: 0.95 }),
  ];
  const run = (t, agent, workflow, ref, ms, status, summary, tokens) => ({ id: "seed-" + agent + t, t, agent, workflow, ref, ms, status, summary, tokens: tokens || 0 });
  const runs = [
    run(now - 2 * H + 1200, "Vision Reader", "Add medicine", "J-1003", 1120, "waiting", "confidence 0.62, sent to Gate A", 1250),
    run(now - 2 * H + 700, "OCR Reader", "Add medicine", "J-1003", 690, "ok", "text extracted"),
    run(now - 2 * H, "Upload API", "Add medicine", "J-1003", 36, "ok", "202 Accepted"),
    run(now - 26 * H, "Vision Reader", "Add medicine", "J-0998", 0, "error", "image file is corrupt"),
    run(now - 12 * DAY + 4000, "Cabinet Writer", "Add medicine", "J-1002", 8, "ok", "saved"),
    run(now - 12 * DAY + 3400, "Safety Reviewer", "Add medicine", "J-1002", 515, "ok", "approved", 405),
    run(now - 12 * DAY + 2700, "Interaction Checker", "Add medicine", "J-1002", 702, "ok", "risk MEDIUM", 630),
    run(now - 12 * DAY + 2000, "Drug Facts", "Add medicine", "J-1002", 398, "ok", "openFDA lookup", 850),
    run(now - 12 * DAY + 1100, "Vision Reader", "Add medicine", "J-1002", 1080, "ok", "confidence 0.95", 1230),
  ];
  const dlt = [{ id: "dl-seed", t: now - 26 * H, source: "medicine-photo-uploaded", reason: "Image file is corrupt (not a JPEG)", payload: { jobId: "J-0998", userId: "U1" }, ref: "J-0998", replayed: false }];

  return {
    user: "U1",
    view: "overview",
    sel: { job: "J-1003", review: null, med: null },
    cabinet,
    fdaCache: { aspirin: true, ibuprofen: true, cetirizine: true, pantoprazole: true },
    jobs,
    jobOrder: ["J-1003", "J-1002"],
    reviews: {},
    reviewOrder: [],
    events,
    offsets: { "medicine-photo-uploaded": 1042, "medicine-extracted": 745, "medicine-enriched": 732, "interaction-checked": 716, "medicine-approved": 703, "review-approved": 12, "medstrip.DLT": 7 },
    runs,
    dlt,
    chat: [{ id: "c0", me: false, route: null, text: "Hi. I can check interactions with your cabinet, show label warnings, and list what expires soon. I don't answer dosage questions." }],
    chatBusy: false,
    toasts: [],
    seq: 1003,
  };
}

export const store = createStore(seed());
const get = store.get;
const set = store.set;

/* ---------- small helpers ---------- */
function nextId(prefix) {
  let id;
  set((s) => {
    id = prefix + "-" + (s.seq + 1);
    return { ...s, seq: s.seq + 1 };
  });
  return id;
}
function emit(topic, payload) {
  set((s) => {
    const off = s.offsets[topic] || 0;
    const e = { id: topic + ":" + off + ":" + Date.now(), t: Date.now(), topic, key: s.user, partition: topic.endsWith(".DLT") ? 0 : 1, offset: off, payload };
    return { ...s, offsets: { ...s.offsets, [topic]: off + 1 }, events: [e, ...s.events].slice(0, 300) };
  });
}
function logRun(agent, workflow, ref, ms, status, summary, tokens) {
  set((s) => ({ ...s, runs: [{ id: "r" + Math.random().toString(36).slice(2), t: Date.now(), agent, workflow, ref, ms, status, summary, tokens: tokens || 0 }, ...s.runs].slice(0, 300) }));
}
function deadLetter(source, reason, payload, ref) {
  emit("medstrip.DLT", { ...payload, reason });
  set((s) => ({ ...s, dlt: [{ id: "dl" + Date.now(), t: Date.now(), source, reason, payload: { ...payload, userId: s.user }, ref, replayed: false }, ...s.dlt] }));
}
export function toast(text, tone) {
  const id = Math.random();
  set((s) => ({ ...s, toasts: [...s.toasts, { id, text, tone: tone || "info" }] }));
  setTimeout(() => set((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) })), 3800);
}
export function go(view, sel) {
  set((s) => ({ ...s, view, sel: { ...s.sel, ...(sel || {}) } }));
}
const job = (id) => get().jobs[id];
function patchJob(id, fn) {
  set((s) => ({ ...s, jobs: { ...s.jobs, [id]: { ...s.jobs[id], ...fn(s.jobs[id]) } } }));
}
function step(id, key, patch) {
  patchJob(id, (j) => ({ steps: j.steps.map((x) => (x.key === key ? { ...x, ...patch } : x)) }));
}
function misspell(n) {
  return n.length > 5 ? n.slice(0, -2) + n.slice(-1) : n + "e";
}

/* ---------- Flow A: add a medicine (sequential + parallel read + gates A and B) ---------- */
export function startJob(sample, scenario, thumb) {
  if (scenario === "duplicate") {
    const prev = get().jobOrder.map(job).find((x) => x.sample === sample && x.status !== "FAILED");
    if (prev) {
      logRun("Upload API", "Add medicine", prev.id, 4, "ok", "same photo hash, returned existing job");
      toast("Same photo was uploaded " + ago(prev.createdAt) + ". Showing that job instead of starting a new one.");
      return prev.id;
    }
  }
  const id = nextId("J");
  set((s) => ({
    ...s,
    jobs: { ...s.jobs, [id]: { id, sample, scenario, status: "UPLOADED", createdAt: Date.now(), steps: newSteps(), extracted: null, gate: null, result: null, message: null, thumb: thumb || null } },
    jobOrder: [id, ...s.jobOrder],
  }));
  processJob(id);
  return id;
}

async function processJob(id) {
  const j0 = job(id);
  const d = DRUGS[j0.sample];
  const sc = j0.scenario;
  step(id, "api", { state: "running", note: "Saving the photo" });
  await wait(500);
  step(id, "api", { state: "done", ms: 38, note: "Saved to s3://medstrip-photos/U1/" + id + ".jpg and returned 202 Accepted." });
  emit("medicine-photo-uploaded", { jobId: id, s3Key: "U1/" + id + ".jpg" });
  logRun("Upload API", "Add medicine", id, 38, "ok", "202 Accepted");

  patchJob(id, () => ({ status: "READING" }));
  step(id, "vision", { state: "running", note: "Reading the photo" });
  step(id, "ocr", { state: "running", note: "Extracting text" });
  await wait(700);
  step(id, "ocr", { state: "done", ms: 690, note: 'Text found: "' + d.name.toUpperCase() + " " + d.strength.toUpperCase() + " " + stamp(d.expiry) + '"' });
  logRun("OCR Reader", "Add medicine", id, 690, "ok", "text extracted");

  if (sc === "badjson") {
    for (let a = 1; a <= 3; a++) {
      step(id, "vision", { note: "Model reply did not parse into MedicineReading. Attempt " + a + " of 3." });
      await wait(650);
    }
    step(id, "vision", { state: "error", ms: 2100, note: "Gave up after 3 attempts. Sent to medstrip.DLT." });
    deadLetter("medicine-photo-uploaded", "Model output did not parse after 3 attempts", { jobId: id }, id);
    logRun("Vision Reader", "Add medicine", id, 2100, "error", "parse failed 3 times", 3720);
    patchJob(id, () => ({ status: "FAILED", message: "The model kept returning text in the wrong shape. The event is in the dead letter topic, and other jobs keep flowing." }));
    toast("Job " + id + " sent to the dead letter topic", "crit");
    return;
  }

  await wait(400);
  const conf = sc === "unsure" ? 0.62 : sc === "blurry" ? 0.31 : 0.94;
  const vname = sc === "unsure" ? misspell(d.name) : d.name;
  patchJob(id, () => ({ extracted: { name: vname, strength: d.strength, expiry: d.expiry, confidence: conf } }));
  logRun("Vision Reader", "Add medicine", id, 1100, sc === "blurry" ? "retake" : sc === "unsure" ? "waiting" : "ok", "confidence " + conf.toFixed(2), 1240);

  if (sc === "blurry") {
    step(id, "vision", { state: "error", ms: 1100, note: "Confidence 0.31. Too blurry to trust." });
    patchJob(id, () => ({ status: "NEEDS_RETAKE", message: "The photo is too blurry to read. Retake it in good light with the name and expiry in view. Retrying would not help, so nothing went to the dead letter topic." }));
    return;
  }
  if (sc === "unsure") {
    step(id, "vision", { state: "waiting", ms: 1100, note: 'Read "' + vname + '" (0.62). Textract read "' + d.name + '". They disagree.' });
    patchJob(id, () => ({ status: "AWAITING_CONFIRMATION", gate: "CONFIRM", gateAt: Date.now() }));
    toast("Gate A: confirm what the photo says", "warn");
    return;
  }
  step(id, "vision", { state: "done", ms: 1100, note: 'Read "' + d.name + " " + d.strength + '", confidence 0.94. Matches Textract.' });
  emit("medicine-extracted", { jobId: id, name: d.name, strength: d.strength, expiry: d.expiry, confidence: conf });
  await enrichAndCheck(id);
}

async function enrichAndCheck(id) {
  const j0 = job(id);
  const key = j0.sample;
  const sc = j0.scenario;
  patchJob(id, () => ({ status: "LOOKING_UP" }));
  step(id, "facts", { state: "running", note: "Looking up the label" });
  let source = "openFDA";
  const cached = get().fdaCache[key];
  if (sc === "fdadown") {
    for (let a = 1; a <= 3; a++) {
      step(id, "facts", { note: "openFDA timed out after 3 s. Attempt " + a + " of 3, backing off." });
      await wait(600);
    }
    source = cached ? "cache" : "unavailable";
    step(id, "facts", { state: "done", ms: 9000, note: cached ? "openFDA is down. Served the label from the Redis cache (fda:" + key + ")." : "openFDA is down and nothing is cached. Passing source=unavailable instead of guessing." });
    logRun("Drug Facts", "Add medicine", id, 9000, cached ? "ok" : "degraded", "openFDA down, used " + source);
  } else if (cached) {
    await wait(300);
    source = "cache";
    step(id, "facts", { state: "done", ms: 14, note: "Cache hit in Redis (fda:" + key + "). openFDA was not called." });
    logRun("Drug Facts", "Add medicine", id, 14, "ok", "cache hit");
  } else {
    await wait(800);
    step(id, "facts", { state: "done", ms: 412, note: "openFDA answered in 412 ms. Summarized " + DRUGS[key].warnings.length + " warnings and cached them for 24 h." });
    set((s) => ({ ...s, fdaCache: { ...s.fdaCache, [key]: true } }));
    logRun("Drug Facts", "Add medicine", id, 412, "ok", "openFDA lookup", 860);
  }
  emit("medicine-enriched", { jobId: id, name: DRUGS[key].name, source });

  patchJob(id, () => ({ status: "CHECKING", source }));
  step(id, "interact", { state: "running", note: "Comparing with your cabinet" });
  await wait(800);
  const res = source === "unavailable"
    ? { risk: "UNKNOWN", conflicts: [], reasons: ["No label text was available, so the check could not run. Unknown is never shown as safe."] }
    : checkAgainst(key, get().cabinet);
  step(id, "interact", { state: "done", ms: 720, note: "Risk " + res.risk + (res.conflicts.length ? " with " + res.conflicts.join(", ") : "") + "." });
  emit("interaction-checked", { jobId: id, risk: res.risk, conflictsWith: res.conflicts });
  logRun("Interaction Checker", "Add medicine", id, 720, "ok", "risk " + res.risk, 640);

  patchJob(id, () => ({ status: "REVIEWING", result: { ...res, source } }));
  step(id, "safety", { state: "running", note: "Checking the wording" });
  await wait(600);
  const needsAck = res.risk === "HIGH" || res.risk === "UNKNOWN";
  step(id, "safety", { state: needsAck ? "waiting" : "done", ms: 540, note: needsAck ? 'Added "ask a pharmacist". A person must acknowledge this before it is saved.' : "Wording is fine. No dosage advice and no safety promises." });
  emit("medicine-approved", { jobId: id, risk: res.risk });
  logRun("Safety Reviewer", "Add medicine", id, 540, needsAck ? "waiting" : "ok", needsAck ? "sent to Gate B" : "approved", 410);
  if (needsAck) {
    patchJob(id, () => ({ status: "AWAITING_ACK", gate: "ACK", gateAt: Date.now() }));
    toast("Gate B: a warning needs your acknowledgement", "warn");
    return;
  }
  await writeCabinet(id);
}

async function writeCabinet(id) {
  const j = job(id);
  const d = DRUGS[j.sample];
  const ex = j.extracted;
  step(id, "writer", { state: "running", note: "Saving" });
  await wait(450);
  const exists = get().cabinet.find((c) => c.name.toLowerCase() === ex.name.toLowerCase() && c.strength === ex.strength && c.expiry === ex.expiry);
  if (exists) {
    step(id, "writer", { state: "done", ms: 6, note: "Already in the cabinet with the same name, strength and expiry. Skipped (idempotent write)." });
    patchJob(id, () => ({ status: "DONE", message: ex.name + " " + ex.strength + " was already in your cabinet, so nothing changed." }));
    logRun("Cabinet Writer", "Add medicine", id, 6, "ok", "duplicate skipped");
    return;
  }
  set((s) => ({
    ...s,
    cabinet: recompute([...s.cabinet, { id: "M-" + id, key: j.sample, name: ex.name, strength: ex.strength, expiry: ex.expiry, source: j.source || "openFDA", warnings: j.source === "unavailable" ? [] : d.warnings, addedAt: Date.now(), jobId: id }]),
  }));
  step(id, "writer", { state: "done", ms: 9, note: "Saved to cabinet:U1 in Redis and the run record to DynamoDB." });
  patchJob(id, () => ({ status: "DONE", message: ex.name + " " + ex.strength + " is in your cabinet." }));
  logRun("Cabinet Writer", "Add medicine", id, 9, "ok", "saved");
  toast(ex.name + " added to your cabinet", "ok");
}

export async function decideJob(id, action, values) {
  const j = job(id);
  if (!j || !j.gate) return;
  const waited = Date.now() - (j.gateAt || Date.now());
  if (j.gate === "CONFIRM") {
    if (action === "approve") {
      patchJob(id, () => ({ gate: null, extracted: { ...j.extracted, ...values, confidence: 1 } }));
      step(id, "vision", { state: "done", note: 'Confirmed by you: "' + values.name + " " + values.strength + '".' });
      logRun("You (Gate A)", "Add medicine", id, waited, "ok", "confirmed details");
      emit("medicine-extracted", { jobId: id, ...values, confirmedBy: "user" });
      await enrichAndCheck(id);
    } else {
      const timeout = action === "timeout";
      step(id, "vision", { state: "error", note: timeout ? "Timed out waiting for you." : "Rejected by you." });
      patchJob(id, () => ({ gate: null, status: "CANCELLED", message: timeout ? "No answer within 24 hours, so the job was cancelled. Nothing was saved." : "You rejected the reading. Nothing was saved." }));
      logRun("You (Gate A)", "Add medicine", id, waited, "cancelled", timeout ? "no answer in 24 h" : "rejected");
    }
  } else if (j.gate === "ACK") {
    if (action === "approve") {
      patchJob(id, () => ({ gate: null }));
      step(id, "safety", { state: "done", note: "Warning acknowledged by you." });
      logRun("You (Gate B)", "Add medicine", id, waited, "ok", "acknowledged warning");
      await writeCabinet(id);
    } else {
      const timeout = action === "timeout";
      step(id, "safety", { state: "error", note: timeout ? "Timed out waiting for you." : "Discarded by you." });
      patchJob(id, () => ({ gate: null, status: "CANCELLED", message: timeout ? "No answer within 24 hours, so the job was cancelled. Nothing was saved." : "Discarded. Nothing was saved." }));
      logRun("You (Gate B)", "Add medicine", id, waited, "cancelled", timeout ? "no answer in 24 h" : "discarded");
    }
  }
}

export function removeMedicine(mid) {
  const it = get().cabinet.find((c) => c.id === mid);
  set((s) => ({ ...s, cabinet: recompute(s.cabinet.filter((c) => c.id !== mid)), sel: { ...s.sel, med: null } }));
  logRun("Cabinet Writer", "Cabinet", mid, 5, "ok", "removed " + (it ? it.name : mid));
  toast((it ? it.name : "Medicine") + " removed from your cabinet");
}

/* ---------- Flow B: cabinet review (supervisor + parallel + critic loop + gate C) ---------- */
const rev = (id) => get().reviews[id];
function patchReview(id, patch) {
  set((s) => ({ ...s, reviews: { ...s.reviews, [id]: { ...s.reviews[id], ...(typeof patch === "function" ? patch(s.reviews[id]) : patch) } } }));
}
function patchLane(id, key, patch) {
  patchReview(id, (r) => ({ lanes: r.lanes.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
}

function auditFindings(key, cab) {
  if (key === "interactions") {
    const out = [];
    for (let i = 0; i < cab.length; i++)
      for (let k = i + 1; k < cab.length; k++) {
        const r = pairRule(cab[i].key, cab[k].key);
        if (r) out.push({ risk: r.risk, text: cab[i].name + " with " + cab[k].name + ". " + r.why + (r.risk === "HIGH" ? " Ask a pharmacist before taking both." : "") });
      }
    cab.filter((c) => c.source === "unavailable").forEach((c) => out.push({ risk: "UNKNOWN", text: c.name + " could not be checked because no label text was found. Ask a pharmacist." }));
    return out.sort((a, b) => RANK[b.risk] - RANK[a.risk]);
  }
  if (key === "expiry") {
    return cab.map((c) => ({ c, d: daysLeft(c.expiry) })).filter((x) => x.d <= 60).sort((a, b) => a.d - b.d).map((x) => ({
      risk: x.d < 0 ? "HIGH" : x.d <= 30 ? "MEDIUM" : "LOW",
      text: x.d < 0 ? x.c.name + " expired " + -x.d + " days ago. Set it aside and ask a pharmacist how to dispose of it." : x.c.name + " " + x.c.strength + " expires " + stamp(x.c.expiry).slice(4) + ", in " + x.d + " days.",
    }));
  }
  if (key === "duplicates") {
    const by = {};
    cab.forEach((c) => (by[c.name.toLowerCase()] = by[c.name.toLowerCase()] || []).push(c));
    return Object.values(by).filter((a) => a.length > 1).map((a) => ({ risk: "MEDIUM", text: a[0].name + " appears " + a.length + " times. Check whether you need both strips." }));
  }
  const n = cab.reduce((t, c) => t + (c.warnings || []).length, 0);
  return [{ risk: "LOW", text: n + " label warnings across " + cab.length + " medicines. Open a medicine in the cabinet to read them." }];
}

function critic(drill, n, comment) {
  if (comment) return { ok: true, notes: ['Applied your comment: "' + comment + '".', "No dosage advice. HIGH items say ask a pharmacist."] };
  if (drill === "mistake" && n === 1) return { ok: false, notes: ['Draft says "Ibuprofen and Aspirin are fine together". Remove safety promises.', 'A HIGH item is missing "ask a pharmacist".'] };
  if (drill === "stubborn") {
    const notes = [["Tone is too alarming for LOW items.", "Expiry dates use two formats."], ["Summary repeats the findings word for word.", 'Missing the "not medical advice" line.'], ["Still too long. Keep it to one screen."]];
    return { ok: false, notes: notes[n - 1] || ["Not approved."] };
  }
  return { ok: true, notes: ["No dosage advice.", "Every HIGH item says ask a pharmacist.", "Partial results are labelled."] };
}

function buildReport(id, n) {
  const r = rev(id);
  const sections = r.lanes.filter((l) => l.state === "done" && l.findings.length).map((l) => ({ heading: AUDITORS.find((a) => a.key === l.key).heading, items: l.findings }));
  const missing = r.lanes.filter((l) => l.state === "error").map((l) => l.agent);
  const all = sections.flatMap((s) => s.items);
  const count = (k) => all.filter((x) => x.risk === k).length;
  const parts = [["HIGH", count("HIGH")], ["MEDIUM", count("MEDIUM")], ["UNKNOWN", count("UNKNOWN")]].filter((p) => p[1]).map((p) => p[1] + " " + p[0]);
  return {
    title: "Cabinet review for " + get().user,
    draft: n,
    summary: (parts.length ? parts.join(", ") + " finding" + (all.length > 1 ? "s" : "") : "No serious findings") + " across " + r.plan.size + " medicines." + (missing.length ? " Partial report: " + missing.join(", ") + " did not finish." : ""),
    sections,
    missing,
  };
}

async function draftRound(id, n, comment) {
  patchReview(id, { status: "DRAFTING" });
  await wait(900);
  patchReview(id, { report: buildReport(id, n), status: "CRITIQUE" });
  logRun("Report Writer", "Cabinet review", id, 880, "ok", "draft " + n, 1450);
  await wait(800);
  const v = critic(rev(id).drill, n, comment);
  patchReview(id, (r) => ({ rounds: [...r.rounds, { n, verdict: v.ok ? "APPROVED" : "CHANGES", notes: v.notes, byYou: !!comment }] }));
  logRun("Safety Reviewer", "Cabinet review", id, 760, v.ok ? "ok" : "rejected", (v.ok ? "approved" : "rejected") + " draft " + n, 690);
  return v.ok;
}
function toGate(id, approved) {
  patchReview(id, { status: "AWAITING_APPROVAL", approved, gateAt: Date.now() });
  toast("Gate C: a report is waiting for your approval", "warn");
}

export async function startReview(drill) {
  const id = nextId("R");
  const cab = get().cabinet;
  const skip = cab.length < 2 ? ["interactions", "duplicates"] : [];
  const lanes = AUDITORS.filter((a) => !skip.includes(a.key)).map((a) => ({ ...a, state: "pending", ms: null, summary: "", findings: [] }));
  set((s) => ({
    ...s,
    reviews: { ...s.reviews, [id]: { id, drill, status: "PLANNING", createdAt: Date.now(), plan: null, lanes: [], rounds: [], report: null, approved: false, s3Key: null, message: null } },
    reviewOrder: [id, ...s.reviewOrder],
    sel: { ...s.sel, review: id },
  }));
  await wait(800);
  const started = Date.now();
  patchReview(id, {
    status: "RUNNING",
    plan: {
      size: cab.length,
      picked: lanes.map((l) => l.agent),
      skipped: skip.map((k) => AUDITORS.find((a) => a.key === k).agent),
      note: skip.length ? "Fewer than 2 medicines, so the interaction and duplicate checks are skipped." : "All four auditors are needed for " + cab.length + " medicines. Each gets its own copy of the cabinet.",
    },
    lanes: lanes.map((l) => ({ ...l, state: "running", startedAt: started, dur: drill === "lanefail" && l.key === "duplicates" ? 3000 : l.dur })),
  });
  logRun("Review Supervisor", "Cabinet review", id, 780, "ok", "planned " + lanes.length + " auditors", 520);

  const durs = [];
  await Promise.all(lanes.map(async (l) => {
    const fail = drill === "lanefail" && l.key === "duplicates";
    const dur = fail ? 3000 : l.dur;
    durs.push(dur);
    await wait(dur);
    const findings = fail ? [] : auditFindings(l.key, cab);
    patchLane(id, l.key, {
      state: fail ? "error" : "done",
      ms: dur,
      findings,
      summary: fail ? "Timed out after 3 s. The report goes on without it and says so." : findings.length ? findings.length + " finding" + (findings.length > 1 ? "s" : "") : "Nothing found",
    });
    logRun(l.agent, "Cabinet review", id, dur, fail ? "timeout" : "ok", fail ? "timed out" : findings.length + " findings", fail ? 0 : 380);
  }));
  patchReview(id, { parallelMs: Math.max(...durs), sequentialMs: durs.reduce((a, b) => a + b, 0) });

  for (let n = 1; n <= 3; n++) {
    const ok = await draftRound(id, n);
    if (ok) {
      toGate(id, true);
      return;
    }
  }
  patchReview(id, { message: "Round limit reached (3). The critic never approved, so you decide what happens next." });
  toGate(id, false);
}

export async function decideReview(id, action, comment) {
  const r = rev(id);
  if (!r || r.status !== "AWAITING_APPROVAL") return;
  const waited = Date.now() - r.gateAt;
  if (action === "approve") {
    patchReview(id, { status: "SENDING" });
    logRun("You (Gate C)", "Cabinet review", id, waited, "ok", "approved report");
    await wait(700);
    const key = "s3://medstrip-reports/U1/" + id + ".json";
    patchReview(id, { status: "SENT", s3Key: key, message: "Saved to S3 and published to the SNS topic medstrip-alerts. You get an email." });
    emit("review-approved", { reviewId: id, s3Key: key });
    logRun("Notifier", "Cabinet review", id, 120, "ok", "SNS publish");
    toast("Report sent", "ok");
  } else if (action === "changes") {
    patchReview(id, { message: null });
    logRun("You (Gate C)", "Cabinet review", id, waited, "ok", "requested changes");
    const ok = await draftRound(id, rev(id).rounds.length + 1, comment);
    toGate(id, ok);
  } else if (action === "discard") {
    patchReview(id, { status: "DISCARDED", message: "Discarded. Nothing was sent." });
    logRun("You (Gate C)", "Cabinet review", id, waited, "cancelled", "discarded");
  } else {
    patchReview(id, { status: "EXPIRED", message: "No answer in 7 days, so the review expired. Nothing was sent." });
    logRun("You (Gate C)", "Cabinet review", id, waited, "cancelled", "no answer in 7 days");
  }
}

/* ---------- Flow C: chat (routing + guardrail + memory) ---------- */
export const ROUTES = {
  interaction: { label: "Interactions", agent: "Interaction specialist" },
  facts: { label: "Label facts", agent: "Drug facts specialist" },
  expiry: { label: "Expiry", agent: "Expiry specialist" },
  cabinet: { label: "Cabinet", agent: "Cabinet specialist" },
  guardrail: { label: "Guardrail", agent: "Rule check (no model call)" },
  fallback: { label: "Fallback", agent: "Router" },
};
function findDrugs(t) {
  return Object.keys(DRUGS).filter((k) => t.includes(k) || t.includes(DRUGS[k].name.toLowerCase()));
}

export async function sendChat(text) {
  const s0 = get();
  if (s0.chatBusy) return;
  const memoryBefore = s0.chat.filter((m) => m.id !== "c0").length;
  set((s) => ({ ...s, chatBusy: true, chat: [...s.chat, { id: "u" + Date.now(), me: true, text }] }));
  await wait(650);
  const s = get();
  const t = text.toLowerCase();
  const drugs = findDrugs(t);
  const lastRouted = [...s.chat].reverse().find((m) => !m.me && m.route && ["interaction", "facts"].includes(m.route));
  let route;
  let usedMemory = false;
  if (/\b(dose|dosage|how many|how much|how often|overdose|tablets should|mg should)\b/.test(t)) route = "guardrail";
  else if (/expir|out of date/.test(t)) route = "expiry";
  else if (/warning|label|side effect/.test(t)) route = "facts";
  else if (/\b(take|together|combine|interact|interaction|safe|mix)\b/.test(t)) route = "interaction";
  else if (/cabinet|what do i have|list|my medicines/.test(t)) route = "cabinet";
  else if (drugs.length && lastRouted) {
    route = lastRouted.route;
    usedMemory = true;
  } else route = "fallback";

  let reply = "";
  let items = null;
  let tools = [];
  const cab = s.cabinet;
  if (route === "guardrail") {
    reply = "I can't help with dosage. Follow the label or what your doctor told you, and ask a pharmacist if you're unsure.";
  } else if (route === "expiry") {
    tools = ["listCabinet()"];
    const soon = cab.map((c) => ({ c, d: daysLeft(c.expiry) })).filter((x) => x.d <= 90).sort((a, b) => a.d - b.d);
    reply = soon.length ? "These expire within 90 days:" : "Nothing in your cabinet expires within 90 days.";
    items = soon.map((x) => ({ risk: x.d <= 30 ? "MEDIUM" : "LOW", text: x.c.name + " " + x.c.strength + ", " + stamp(x.c.expiry) + " (" + x.d + " days)" }));
  } else if (route === "facts") {
    const k = drugs[0];
    if (!k) reply = "Which medicine? For example: What are the warnings for aspirin?";
    else {
      tools = ['getDrugWarnings("' + k + '")'];
      reply = "Label warnings for " + DRUGS[k].name + (s.fdaCache[k] ? " (from the Redis cache):" : " (from openFDA):");
      items = DRUGS[k].warnings.map((w) => ({ risk: null, text: w }));
    }
  } else if (route === "interaction") {
    if (!drugs.length) reply = "Which medicine? For example: Can I take ibuprofen with my cabinet?";
    else if (drugs.length >= 2) {
      tools = ['getInteractionResult("' + drugs[0] + '", "' + drugs[1] + '")'];
      const r = pairRule(drugs[0], drugs[1]);
      reply = r ? r.why + (r.risk === "HIGH" ? " Ask a pharmacist before taking both." : " Check with a pharmacist.") : "The labels I have show no interaction between " + DRUGS[drugs[0]].name + " and " + DRUGS[drugs[1]].name + ". This is not a guarantee.";
      items = r ? [{ risk: r.risk, text: DRUGS[drugs[0]].name + " with " + DRUGS[drugs[1]].name }] : null;
    } else {
      const k = drugs[0];
      tools = ["listCabinet()", 'getInteractionResult("' + k + '")'];
      const res = checkAgainst(k, cab);
      reply = res.conflicts.length ? DRUGS[k].name + " has a " + res.risk + " flag with " + res.conflicts.join(", ") + " in your cabinet. " + res.reasons.join(" ") + (res.risk === "HIGH" ? " Ask a pharmacist before taking them together." : " Check with a pharmacist.") : "I found no interaction between " + DRUGS[k].name + " and your cabinet in the label text. This is not a guarantee.";
      items = [{ risk: res.risk, text: DRUGS[k].name + " against " + cab.length + " medicines" }];
    }
  } else if (route === "cabinet") {
    tools = ["listCabinet()"];
    reply = "You have " + cab.length + " medicines:";
    items = cab.map((c) => ({ risk: c.risk, text: c.name + " " + c.strength + ", " + stamp(c.expiry) }));
  } else {
    reply = "I can check interactions, show label warnings, and list what expires soon. Try one of the suggestions below.";
  }

  logRun("Chat Router", "Ask", "chat", 180, "ok", "route " + route, route === "guardrail" ? 0 : 220);
  if (route !== "guardrail" && route !== "fallback") logRun(ROUTES[route].agent, "Ask", "chat", 640, "ok", tools.join(", ") || "answered", 540);
  set((st) => ({
    ...st,
    chatBusy: false,
    chat: [...st.chat, { id: "a" + Date.now(), me: false, route, agent: ROUTES[route].agent, tools, text: reply, items, usedMemory, memory: Math.min(10, memoryBefore + 2) }],
  }));
}

/* ---------- Activity ---------- */
export function replayDlt(did) {
  const d = get().dlt.find((x) => x.id === did);
  if (!d || d.replayed) return;
  set((s) => ({ ...s, dlt: s.dlt.map((x) => (x.id === did ? { ...x, replayed: true, replayedAt: Date.now() } : x)) }));
  emit(d.source, { ...d.payload, replayOf: d.id });
  logRun("You", "Dead letters", d.ref, 0, "ok", "replayed to " + d.source);
  toast("Replayed to " + d.source + ". If the cause is not fixed, it will land here again.");
}

/* ---------- derived ---------- */
export function pendingTasks(s) {
  const out = [];
  s.jobOrder.forEach((id) => {
    const j = s.jobs[id];
    if (j.gate === "CONFIRM") out.push({ id, gate: "A", kind: "job", title: "Confirm what the photo says", detail: 'Vision read "' + j.extracted.name + '" with confidence ' + j.extracted.confidence.toFixed(2) + ". Textract read something else.", createdAt: j.gateAt, deadline: j.gateAt + DAY });
    if (j.gate === "ACK") out.push({ id, gate: "B", kind: "job", title: "Acknowledge a " + j.result.risk.toLowerCase() + " risk warning", detail: j.extracted.name + ": " + j.result.reasons[0], createdAt: j.gateAt, deadline: j.gateAt + DAY });
  });
  s.reviewOrder.forEach((id) => {
    const r = s.reviews[id];
    if (r.status === "AWAITING_APPROVAL") out.push({ id, gate: "C", kind: "review", title: "Approve the cabinet review report", detail: r.approved ? "The Safety Reviewer approved draft " + r.report.draft + ". Nothing is sent until you approve." : "The critic did not approve after " + r.rounds.length + " rounds. You decide.", createdAt: r.gateAt, deadline: r.gateAt + 7 * DAY });
  });
  return out.sort((a, b) => a.deadline - b.deadline);
}

export function busyAgents(s) {
  const busy = new Set();
  Object.values(s.jobs).forEach((j) => j.steps.forEach((st) => st.state === "running" && busy.add(st.agent)));
  Object.values(s.reviews).forEach((r) => {
    if (r.status === "PLANNING") busy.add("Review Supervisor");
    if (r.lanes.some((l) => l.state === "running")) busy.add("Auditors (4)");
    if (r.status === "DRAFTING") busy.add("Report Writer");
    if (r.status === "CRITIQUE") busy.add("Safety Reviewer");
  });
  if (s.chatBusy) busy.add("Chat Router");
  return busy;
}
