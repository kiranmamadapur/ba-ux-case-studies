"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("./logic.js");

const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const mk = () => T.createState(NOW);
const anita = { role: "Recruiter", name: "Anita" }, meera = { role: "Recruiter", name: "Meera" };
const hm = { role: "Hiring manager", name: "Hiring manager" }, hr = { role: "HR head", name: "HR head" };
const byName = (st, n) => st.candidates.find(c => c.name === n);
const at = (h, m) => new Date(2026, 10, 19, h, m || 0).getTime(); // tomorrow, after NOW

/* ---- AC1: dropping a card in a new stage saves the change with a timestamp (FR1) ---- */
test("AC1 move saves new stage with timestamp and history", () => {
  const st = mk(), c = byName(st, "Priya Sharma"), before = c.history.length;
  const r = T.moveCandidate(st, anita, c.id, "Screened", NOW);
  assert.equal(r.ok, true);
  assert.equal(c.stage, "Screened");
  assert.equal(c.history.length, before + 1);
  assert.deepEqual(c.history.at(-1), { from: "Sourced", to: "Screened", t: NOW, by: "Anita" });
});
test("AC1 saved change survives a reload (serialize/deserialize)", () => {
  const st = mk(), c = byName(st, "Priya Sharma");
  T.moveCandidate(st, anita, c.id, "Interview", NOW);
  const back = T.deserialize(T.serialize(st));
  assert.equal(T.findCandidate(back, c.id).stage, "Interview");
  assert.equal(T.findCandidate(back, c.id).history.at(-1).t, NOW);
});
test("move rules: same stage, unknown stage, unknown candidate", () => {
  const st = mk(), c = byName(st, "Priya Sharma");
  assert.equal(T.moveCandidate(st, anita, c.id, "Sourced", NOW).ok, false);
  assert.equal(T.moveCandidate(st, anita, c.id, "Nope", NOW).ok, false);
  assert.equal(T.moveCandidate(st, anita, 9999, "Offer", NOW).ok, false);
});
test("moves can go backwards and are all recorded", () => {
  const st = mk(), c = byName(st, "Neha Kapoor"); // Interview
  T.moveCandidate(st, anita, c.id, "Screened", NOW);
  assert.equal(c.stage, "Screened");
  assert.equal(c.history.at(-1).from, "Interview");
});

/* ---- AC2: shortlist shows only candidates rated 4 or above (FR / US2) ---- */
test("AC2 shortlist contains only rating >= 4", () => {
  const st = mk(), s = T.shortlist(st, "all");
  assert.ok(s.length > 0);
  assert.ok(s.every(c => c.rating >= 4));
  assert.equal(s.length, st.candidates.filter(c => c.rating >= 4).length);
});
test("AC2 shortlist filters by role and sorts by rating", () => {
  const st = mk(), s = T.shortlist(st, "ba");
  assert.ok(s.every(c => c.job === "ba" && c.rating >= 4));
  assert.ok(s.every((c, i) => i === 0 || s[i - 1].rating >= c.rating));
});
test("AC2 a rating change moves a candidate in or out of the shortlist", () => {
  const st = mk(), c = byName(st, "Imran Ali"); // rating 3, Meera
  assert.ok(!T.shortlist(st).includes(c));
  assert.equal(T.saveProfile(st, meera, c.id, { rating: 4, resume: "", notes: "" }).ok, true);
  assert.ok(T.shortlist(st).includes(c));
});

/* ---- AC3: weekly report lists roles, stages and days open (FR4) ---- */
test("AC3 report lists every role with stage counts and days open", () => {
  const st = mk(), rep = T.weeklyReport(st, NOW);
  assert.equal(rep.rows.length, T.ROLES.length);
  const ba = rep.rows.find(r => r.jobId === "ba");
  assert.equal(ba.title, "Business Analyst");
  assert.equal(ba.daysOpen, 21);
  assert.deepEqual(Object.keys(ba.counts), T.STAGES);
  assert.equal(rep.rows.find(r => r.jobId === "qa").daysOpen, 5);
});
test("AC3 days open grows with time", () => {
  const st = mk(), later = T.weeklyReport(st, NOW + 3 * T.DAY);
  assert.equal(later.rows.find(r => r.jobId === "ba").daysOpen, 24);
});
test("AC3 CSV export has header, one row per role and a totals row", () => {
  const csv = T.reportToCsv(T.weeklyReport(mk(), NOW)).split("\n");
  assert.equal(csv[0], "Role,Sourced,Screened,Interview,Offer,Closed,Total,Days open,Moves last 7 days");
  assert.equal(csv.length, 1 + T.ROLES.length + 1);
  assert.ok(csv.at(-1).startsWith("All roles,"));
});
test("CSV neutralises formula injection and quotes commas", () => {
  const st = mk(); st.jobs[0].title = '=HYPERLINK("x"), BA';
  const line = T.reportToCsv(T.weeklyReport(st, NOW)).split("\n")[1];
  assert.ok(line.startsWith("\"'=HYPERLINK"));
});

/* ---- UAT1: move a candidate to Interview, stage and date saved ---- */
test("UAT1 move to Interview saves stage and date", () => {
  const st = mk(), c = byName(st, "Rohan Mehta"); // Screened
  const r = T.moveCandidate(st, anita, c.id, "Interview", NOW + 1000);
  assert.equal(r.ok, true);
  assert.equal(c.stage, "Interview");
  assert.equal(c.history.at(-1).t, NOW + 1000);
});

/* ---- UAT2: manager opens shortlist, only shortlisted shown ---- */
test("UAT2 hiring manager shortlist excludes unrated and low-rated candidates", () => {
  const st = mk(), names = T.shortlist(st).map(c => c.name);
  assert.ok(!names.includes("Priya Sharma") && !names.includes("Imran Ali"));
  assert.ok(names.includes("Rohan Mehta") && names.includes("Farhan Khan"));
});
test("UAT2 hiring manager can decide on shortlisted only, to Offer or Closed", () => {
  const st = mk(), rohan = byName(st, "Rohan Mehta"), imran = byName(st, "Imran Ali");
  assert.equal(T.moveCandidate(st, hm, rohan.id, "Offer", NOW).ok, true);
  assert.equal(T.moveCandidate(st, hm, imran.id, "Offer", NOW).ok, false);
  assert.equal(T.moveCandidate(st, hm, rohan.id, "Screened", NOW).ok, false);
});

/* ---- UAT3: weekly report counts match the board ---- */
test("UAT3 report counts equal an independent count of the board", () => {
  const st = mk(), rep = T.weeklyReport(st, NOW);
  for (const r of rep.rows) for (const s of T.STAGES)
    assert.equal(r.counts[s], st.candidates.filter(c => c.job === r.jobId && c.stage === s).length);
  assert.equal(rep.totals.total, st.candidates.length);
});
test("UAT3 report stays in step after moves", () => {
  const st = mk();
  T.moveCandidate(st, anita, byName(st, "Priya Sharma").id, "Screened", NOW);
  T.moveCandidate(st, meera, byName(st, "Imran Ali").id, "Offer", NOW);
  const rep = T.weeklyReport(st, NOW), bc = T.boardCounts(st);
  for (const r of rep.rows) assert.deepEqual(r.counts, bc[r.jobId]);
  assert.equal(rep.totals.movesLast7 >= 2, true);
});
test("report counts moves in the last 7 days only", () => {
  const st = mk(), c = byName(st, "Priya Sharma");
  const base = T.weeklyReport(st, NOW).totals.movesLast7;
  T.moveCandidate(st, anita, c.id, "Screened", NOW - 8 * T.DAY);
  assert.equal(T.weeklyReport(st, NOW).totals.movesLast7, base);
  T.moveCandidate(st, anita, c.id, "Interview", NOW - 1 * T.DAY);
  assert.equal(T.weeklyReport(st, NOW).totals.movesLast7, base + 1);
});

/* ---- NFR1: only assigned recruiters see contact data ---- */
test("NFR1 contact visible only to the assigned recruiter", () => {
  const st = mk(), c = byName(st, "Priya Sharma"); // Anita
  assert.ok(T.contactFor(anita, c) && T.contactFor(anita, c).email);
  assert.equal(T.contactFor(meera, c), null);
  assert.equal(T.contactFor(hm, c), null);
  assert.equal(T.contactFor(hr, c), null);
});
test("NFR1 only the assigned recruiter can edit, move or schedule", () => {
  const st = mk(), c = byName(st, "Priya Sharma");
  assert.equal(T.saveProfile(st, meera, c.id, { rating: 3 }).ok, false);
  assert.equal(T.moveCandidate(st, meera, c.id, "Screened", NOW).ok, false);
  assert.equal(T.scheduleInterview(st, meera, { candidateId: c.id, interviewer: "Vikram", start: at(11) }, NOW).ok, false);
  assert.equal(T.moveCandidate(st, hr, c.id, "Screened", NOW).ok, false);
});

/* ---- NFR2: 500 candidates ---- */
test("NFR2 500 generated candidates: board counts and report compute well under 3 s", () => {
  const st = mk(), base = st.candidates.length;
  assert.equal(T.generateDemo(st, 500, NOW), 500);
  assert.equal(st.candidates.length, base + 500);
  const t0 = process.hrtime.bigint();
  const bc = T.boardCounts(st), rep = T.weeklyReport(st, NOW), sl = T.shortlist(st), csv = T.reportToCsv(rep);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 3000, "took " + ms + " ms");
  assert.equal(rep.totals.total, st.candidates.length);
  assert.ok(sl.length > 0 && csv.length > 0 && bc.ba);
});
test("NFR2 demo data is deterministic, unique by email, and removable", () => {
  const a = mk(), b = mk();
  T.generateDemo(a, 500, NOW, 7); T.generateDemo(b, 500, NOW, 7);
  assert.deepEqual(a.candidates.map(c => c.name), b.candidates.map(c => c.name));
  assert.equal(new Set(a.candidates.map(c => c.contact.email)).size, a.candidates.length);
  assert.equal(T.removeDemo(a), 500);
  assert.equal(a.candidates.length, mk().candidates.length);
});

/* ---- FR1/FR2: add candidate, validation, duplicates ---- */
test("add candidate: valid input lands in Sourced, assigned to the adding recruiter", () => {
  const st = mk(), r = T.addCandidate(st, anita, { name: "  Zed   Khan ", email: "Zed@Example.com", phone: "98765 43210", job: "ux" }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.candidate.name, "Zed Khan");
  assert.equal(r.candidate.stage, "Sourced");
  assert.equal(r.candidate.recruiter, "Anita");
  assert.equal(r.candidate.contact.email, "zed@example.com");
  assert.equal(r.candidate.history[0].t, NOW);
});
test("add candidate: validation errors per field", () => {
  const st = mk(), r = T.addCandidate(st, anita, { name: "A", email: "nope", phone: "123", job: "zz" }, NOW);
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ["email", "job", "name", "phone"]);
  assert.equal(st.candidates.length, mk().candidates.length);
});
test("add candidate: duplicate email detected case-insensitively", () => {
  const st = mk(), r = T.addCandidate(st, anita, { name: "Another Priya", email: "PRIYA.SHARMA@example.com", job: "ba" }, NOW);
  assert.equal(r.ok, false);
  assert.match(r.errors.email, /already exists/);
});
test("add candidate: only recruiters", () => {
  assert.equal(T.addCandidate(mk(), hm, { name: "Zed Khan", email: "z@e.com", job: "ba" }, NOW).ok, false);
});
test("profile: notes, resume file name and rating are validated and saved", () => {
  const st = mk(), c = byName(st, "Priya Sharma");
  assert.equal(T.saveProfile(st, anita, c.id, { rating: 6, resume: "", notes: "" }).ok, false);
  assert.equal(T.saveProfile(st, anita, c.id, { rating: 3, resume: "cv.exe", notes: "" }).ok, false);
  assert.equal(T.saveProfile(st, anita, c.id, { rating: 3.5, resume: "", notes: "" }).ok, false);
  const ok = T.saveProfile(st, anita, c.id, { rating: 5, resume: "priya-resume.pdf", notes: "Strong on BPMN." });
  assert.equal(ok.ok, true);
  assert.deepEqual([c.rating, c.resume, c.notes], [5, "priya-resume.pdf", "Strong on BPMN."]);
});

/* ---- FR3: interview scheduling with calendar check ---- */
test("FR3 schedules an interview and lists it for the candidate", () => {
  const st = mk(), c = byName(st, "Priya Sharma");
  const r = T.scheduleInterview(st, anita, { candidateId: c.id, interviewer: "Vikram", start: at(11), durationMin: 45 }, NOW);
  assert.equal(r.ok, true);
  assert.equal(T.interviewsFor(st, c.id).length, 1);
  assert.equal(r.interview.end - r.interview.start, 45 * 60000);
});
test("FR3 blocks an interviewer double booking, including overlaps", () => {
  const st = mk(), a = byName(st, "Priya Sharma"), b = byName(st, "Kavya Iyer");
  T.scheduleInterview(st, anita, { candidateId: a.id, interviewer: "Vikram", start: at(11), durationMin: 60 }, NOW);
  const same = T.scheduleInterview(st, anita, { candidateId: b.id, interviewer: "Vikram", start: at(11) }, NOW);
  const overlap = T.scheduleInterview(st, anita, { candidateId: b.id, interviewer: "Vikram", start: at(11, 30) }, NOW);
  const adjacent = T.scheduleInterview(st, anita, { candidateId: b.id, interviewer: "Vikram", start: at(12) }, NOW);
  assert.equal(same.ok, false); assert.match(same.error, /Vikram already has an interview/);
  assert.equal(overlap.ok, false);
  assert.equal(adjacent.ok, true);
});
test("FR3 a different interviewer at the same time is fine, but the candidate cannot be in two places", () => {
  const st = mk(), a = byName(st, "Priya Sharma"), b = byName(st, "Kavya Iyer");
  T.scheduleInterview(st, anita, { candidateId: a.id, interviewer: "Vikram", start: at(11) }, NOW);
  assert.equal(T.scheduleInterview(st, anita, { candidateId: b.id, interviewer: "Sunil", start: at(11) }, NOW).ok, true);
  const r = T.scheduleInterview(st, anita, { candidateId: a.id, interviewer: "Sunil", start: at(11, 15) }, NOW);
  assert.equal(r.ok, false); assert.match(r.error, /Priya Sharma already has/);
});
test("FR3 rejects missing, past, malformed and over-long slots", () => {
  const st = mk(), c = byName(st, "Priya Sharma"), base = { candidateId: c.id, interviewer: "Vikram" };
  assert.equal(T.scheduleInterview(st, anita, Object.assign({ start: NaN }, base), NOW).ok, false);
  assert.equal(T.scheduleInterview(st, anita, Object.assign({ start: NOW - 1 }, base), NOW).ok, false);
  assert.equal(T.scheduleInterview(st, anita, Object.assign({ start: at(11), durationMin: 5 }, base), NOW).ok, false);
  assert.equal(T.scheduleInterview(st, anita, { candidateId: c.id, interviewer: "Nobody", start: at(11) }, NOW).ok, false);
  assert.equal(st.interviews.length, 0);
});
test("parseLocal reads datetime-local values and rejects junk", () => {
  assert.equal(T.parseLocal("2026-11-19T11:00"), at(11));
  assert.ok(Number.isNaN(T.parseLocal("")));
  assert.ok(Number.isNaN(T.parseLocal("tomorrow")));
});

/* ---- persistence ---- */
test("deserialize rejects bad or old data", () => {
  assert.equal(T.deserialize("{not json"), null);
  assert.equal(T.deserialize(JSON.stringify({ v: 1 })), null);
  assert.equal(T.deserialize(null), null);
  assert.ok(T.deserialize(T.serialize(mk())));
});
