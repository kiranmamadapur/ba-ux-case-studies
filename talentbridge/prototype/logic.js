/* TalentBridge business rules. Pure functions, no DOM. UMD: window.TB in the browser, module.exports in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TB = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const DAY = 864e5, MIN = 6e4;
  const STAGES = ["Sourced", "Screened", "Interview", "Offer", "Closed"];
  const USER_ROLES = ["Recruiter", "Hiring manager", "HR head"];
  const RECRUITERS = ["Anita", "Meera"];
  const INTERVIEWERS = ["Vikram", "Anita", "Meera", "Sunil"];
  const ROLES = [
    { id: "ba", title: "Business Analyst", openedDaysAgo: 21 },
    { id: "ux", title: "UX Designer", openedDaysAgo: 12 },
    { id: "da", title: "Data Analyst", openedDaysAgo: 34 },
    { id: "qa", title: "QA Lead", openedDaysAgo: 5 }
  ];
  // name, job, stage, rating, recruiter, age in days
  const SEED = [
    ["Priya Sharma", "ba", "Sourced", 0, "Anita", 2], ["Rohan Mehta", "ba", "Screened", 4, "Anita", 9],
    ["Neha Kapoor", "ba", "Interview", 5, "Anita", 14], ["Imran Ali", "ux", "Screened", 3, "Meera", 6],
    ["Sara D'Souza", "ux", "Interview", 4, "Meera", 10], ["Dev Patel", "ux", "Offer", 5, "Meera", 11],
    ["Kavya Iyer", "da", "Sourced", 2, "Anita", 3], ["Arjun Nair", "da", "Screened", 4, "Meera", 20],
    ["Tanvi Joshi", "da", "Interview", 3, "Anita", 25], ["Mohit Verma", "da", "Closed", 2, "Meera", 30],
    ["Ishita Rao", "qa", "Sourced", 0, "Meera", 1], ["Farhan Khan", "qa", "Screened", 5, "Anita", 4],
    ["Lakshmi Menon", "ba", "Closed", 1, "Meera", 18], ["Vikas Gupta", "ux", "Sourced", 1, "Anita", 5]
  ];
  const FIRST = ["Aarav", "Diya", "Kabir", "Anaya", "Vihaan", "Myra", "Reyansh", "Zoya", "Ayaan", "Ira", "Dhruv", "Sana", "Krish", "Riya", "Yash", "Pooja"];
  const LAST = ["Singh", "Reddy", "Bose", "Chopra", "Pillai", "Das", "Malhotra", "Shetty", "Kulkarni", "Bhat", "Saxena", "Desai"];

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "."); }

  function rawCandidate(st, name, job, stage, rating, recruiter, ageDays, now, extra) {
    const si = STAGES.indexOf(stage), history = [{ from: null, to: STAGES[0], t: now - ageDays * DAY, by: recruiter }];
    for (let k = 1; k <= si; k++) history.push({ from: STAGES[k - 1], to: STAGES[k], t: now - Math.max(0.2, ageDays - k * 2) * DAY, by: recruiter });
    const c = Object.assign({
      id: st.nextId++, name, job, stage, rating, recruiter, notes: "", resume: "",
      contact: { email: slug(name) + "@example.com", phone: "98" + String(10000000 + st.nextId * 7919).slice(0, 8) },
      history
    }, extra || {});
    st.candidates.push(c);
    return c;
  }

  function createState(now) {
    const st = { v: 2, nextId: 1, nextIv: 1, jobs: ROLES.map(r => ({ id: r.id, title: r.title, openedAt: now - r.openedDaysAgo * DAY })), candidates: [], interviews: [] };
    SEED.forEach(s => rawCandidate(st, s[0], s[1], s[2], s[3], s[4], s[5], now));
    return st;
  }

  function validState(s) {
    return !!s && s.v === 2 && Array.isArray(s.jobs) && Array.isArray(s.candidates) && Array.isArray(s.interviews) &&
      typeof s.nextId === "number" && typeof s.nextIv === "number" &&
      s.candidates.every(c => c && STAGES.includes(c.stage) && Array.isArray(c.history) && c.contact);
  }
  function serialize(st) { return JSON.stringify(st); }
  function deserialize(raw) { try { const s = JSON.parse(raw); return validState(s) ? s : null; } catch (e) { return null; } }

  /* ---------- permissions (NFR1) ---------- */
  // user = { role: "Recruiter"|"Hiring manager"|"HR head", name }
  function isAssigned(user, c) { return user.role === "Recruiter" && user.name === c.recruiter; }
  function canViewContact(user, c) { return isAssigned(user, c); }
  function contactFor(user, c) { return canViewContact(user, c) ? c.contact : null; }
  function canEdit(user, c) { return isAssigned(user, c); }
  function canSchedule(user, c) { return isAssigned(user, c); }
  function canMove(user, c, to) {
    if (!STAGES.includes(to)) return { ok: false, reason: "Unknown stage." };
    if (to === c.stage) return { ok: false, reason: "Already in " + to + "." };
    if (user.role === "Recruiter") return isAssigned(user, c) ? { ok: true } : { ok: false, reason: "Only the assigned recruiter (" + c.recruiter + ") can move this candidate." };
    if (user.role === "Hiring manager") {
      if (c.rating < 4) return { ok: false, reason: "Hiring managers can decide only on shortlisted candidates (rating 4 or above)." };
      if (to !== "Offer" && to !== "Closed") return { ok: false, reason: "Hiring managers can move shortlisted candidates to Offer or Closed only." };
      return { ok: true };
    }
    return { ok: false, reason: "HR head has read-only access." };
  }

  /* ---------- candidates (FR1, FR2) ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validateCandidate(input, existing, jobs) {
    const errors = {}, name = String(input.name || "").trim().replace(/\s+/g, " "), email = String(input.email || "").trim().toLowerCase(), phone = String(input.phone || "").replace(/[\s-]/g, "");
    if (name.length < 2 || name.length > 60) errors.name = "Enter a name of 2 to 60 characters.";
    if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
    else { const d = existing.find(c => c.contact.email.toLowerCase() === email); if (d) errors.email = "A candidate with this email already exists (" + d.name + ")."; }
    if (phone && !/^\d{10}$/.test(phone)) errors.phone = "Phone must be 10 digits (or leave it blank).";
    if (!jobs.some(j => j.id === input.job)) errors.job = "Choose a role.";
    return { ok: Object.keys(errors).length === 0, errors, value: { name, email, phone, job: input.job } };
  }
  function addCandidate(st, user, input, now) {
    if (user.role !== "Recruiter") return { ok: false, errors: { form: "Only recruiters can add candidates." } };
    const v = validateCandidate(input, st.candidates, st.jobs);
    if (!v.ok) return { ok: false, errors: v.errors };
    const c = { id: st.nextId++, name: v.value.name, job: v.value.job, stage: STAGES[0], rating: 0, recruiter: user.name, notes: "", resume: "", contact: { email: v.value.email, phone: v.value.phone }, history: [{ from: null, to: STAGES[0], t: now, by: user.name }] };
    st.candidates.push(c);
    return { ok: true, candidate: c };
  }
  function findCandidate(st, id) { return st.candidates.find(c => c.id === id); }

  function moveCandidate(st, user, id, to, now) {
    const c = findCandidate(st, id);
    if (!c) return { ok: false, error: "Candidate not found." };
    const p = canMove(user, c, to);
    if (!p.ok) return { ok: false, error: p.reason };
    const from = c.stage;
    c.stage = to;
    c.history.push({ from, to, t: now, by: user.name });
    return { ok: true, from, to, at: now, candidate: c };
  }

  function saveProfile(st, user, id, p) {
    const c = findCandidate(st, id);
    if (!c) return { ok: false, errors: { form: "Candidate not found." } };
    if (!canEdit(user, c)) return { ok: false, errors: { form: "Only the assigned recruiter can edit this profile." } };
    const errors = {}, rating = Number(p.rating), resume = String(p.resume || "").trim(), notes = String(p.notes || "");
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) errors.rating = "Rating must be a whole number from 1 to 5 (0 = unrated).";
    if (resume && !/^[\w .\-()]+\.(pdf|docx?|txt)$/i.test(resume)) errors.resume = "Use a file name ending in .pdf, .doc, .docx or .txt.";
    if (notes.length > 1000) errors.notes = "Notes can be up to 1000 characters.";
    if (Object.keys(errors).length) return { ok: false, errors };
    c.rating = rating; c.resume = resume; c.notes = notes;
    return { ok: true, candidate: c };
  }

  /* ---------- hiring manager shortlist ---------- */
  function shortlist(st, jobId) {
    return st.candidates.filter(c => c.rating >= 4 && (!jobId || jobId === "all" || c.job === jobId))
      .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  }

  /* ---------- interviews with calendar check (FR3) ---------- */
  function parseLocal(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(v || ""));
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : NaN;
  }
  const overlaps = (a, b) => a.start < b.end && b.start < a.end;
  function scheduleInterview(st, user, req, now) {
    const c = findCandidate(st, req.candidateId);
    if (!c) return { ok: false, error: "Candidate not found." };
    if (!canSchedule(user, c)) return { ok: false, error: "Only the assigned recruiter can schedule interviews." };
    if (!INTERVIEWERS.includes(req.interviewer)) return { ok: false, error: "Choose an interviewer." };
    const start = Number(req.start), dur = Number(req.durationMin || 45);
    if (!Number.isFinite(start)) return { ok: false, error: "Pick a date and time." };
    if (start <= now) return { ok: false, error: "Pick a time in the future." };
    if (!Number.isInteger(dur) || dur < 15 || dur > 180) return { ok: false, error: "Duration must be 15 to 180 minutes." };
    const slot = { start, end: start + dur * MIN };
    const clash = st.interviews.find(i => overlaps(slot, i) && (i.interviewer === req.interviewer || i.candidateId === c.id));
    if (clash) return { ok: false, error: clash.interviewer === req.interviewer ? req.interviewer + " already has an interview at that time." : c.name + " already has an interview at that time." };
    const iv = { id: st.nextIv++, candidateId: c.id, interviewer: req.interviewer, start: slot.start, end: slot.end };
    st.interviews.push(iv);
    return { ok: true, interview: iv };
  }
  function interviewsFor(st, id) { return st.interviews.filter(i => i.candidateId === id).sort((a, b) => a.start - b.start); }

  /* ---------- report (FR4) ---------- */
  function boardCounts(st, jobId) {
    const out = {};
    st.jobs.forEach(j => { out[j.id] = {}; STAGES.forEach(s => { out[j.id][s] = 0; }); });
    st.candidates.forEach(c => { if ((!jobId || jobId === "all" || c.job === jobId) && out[c.job]) out[c.job][c.stage]++; });
    return out;
  }
  function weeklyReport(st, now) {
    const counts = boardCounts(st), cut = now - 7 * DAY;
    const rows = st.jobs.map(j => {
      const total = STAGES.reduce((n, s) => n + counts[j.id][s], 0);
      const moves = st.candidates.reduce((n, c) => n + (c.job === j.id ? c.history.filter(h => h.from !== null && h.t > cut).length : 0), 0);
      return { jobId: j.id, title: j.title, counts: counts[j.id], total, daysOpen: Math.max(0, Math.floor((now - j.openedAt) / DAY)), movesLast7: moves };
    });
    const totals = { counts: {}, total: 0, movesLast7: 0 };
    STAGES.forEach(s => { totals.counts[s] = rows.reduce((n, r) => n + r.counts[s], 0); });
    rows.forEach(r => { totals.total += r.total; totals.movesLast7 += r.movesLast7; });
    return { generatedAt: now, rows, totals };
  }
  function csvCell(v) {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function reportToCsv(rep) {
    const head = ["Role"].concat(STAGES, ["Total", "Days open", "Moves last 7 days"]);
    const lines = [head].concat(rep.rows.map(r => [r.title].concat(STAGES.map(s => r.counts[s]), [r.total, r.daysOpen, r.movesLast7])));
    lines.push(["All roles"].concat(STAGES.map(s => rep.totals.counts[s]), [rep.totals.total, "", rep.totals.movesLast7]));
    return lines.map(l => l.map(csvCell).join(",")).join("\n");
  }

  /* ---------- demo load for NFR2 ---------- */
  function generateDemo(st, n, now, seed) {
    let x = (seed || 42) >>> 0;
    const rnd = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
    const pick = a => a[Math.floor(rnd() * a.length)];
    for (let i = 0; i < n; i++) {
      const name = pick(FIRST) + " " + pick(LAST), stage = STAGES[Math.min(4, Math.floor(rnd() * rnd() * 5.5))];
      const c = rawCandidate(st, name, pick(ROLES).id, stage, Math.floor(rnd() * 6), pick(RECRUITERS), 1 + Math.floor(rnd() * 28), now, { demo: true });
      c.contact.email = "demo" + c.id + "." + slug(name) + "@example.com";
    }
    return n;
  }
  function removeDemo(st) { const n = st.candidates.length; st.candidates = st.candidates.filter(c => !c.demo); st.interviews = st.interviews.filter(i => st.candidates.some(c => c.id === i.candidateId)); return n - st.candidates.length; }

  return { STAGES, USER_ROLES, RECRUITERS, INTERVIEWERS, ROLES, DAY, createState, validState, serialize, deserialize, canViewContact, contactFor, canEdit, canSchedule, canMove, validateCandidate, addCandidate, findCandidate, moveCandidate, saveProfile, shortlist, parseLocal, scheduleInterview, interviewsFor, boardCounts, weeklyReport, reportToCsv, generateDemo, removeDemo };
});
