const test = require("node:test");
const assert = require("node:assert/strict");
const NB = require("./logic.js");

const NOW = Date.UTC(2026, 10, 18, 10, 0, 0); // 18 Nov 2026, 10:00 UTC
const fresh = () => NB.seed(NOW);

/* FR1: add a beneficiary with account validation (AC1, UAT1) */
test("valid account and IFSC resolve the name for confirmation (AC1)", () => {
  const r = NB.startBeneficiary(fresh(), "5010098761 4", "nova0000101");
  assert.equal(r.ok, true);
  assert.equal(r.name, "Arjun Mehta");
  assert.equal(r.ifsc, "NOVA0000101");
});
test("wrong account number gives an error that explains the problem (UAT1)", () => {
  const s = fresh();
  assert.match(NB.startBeneficiary(s, "50100987615", "NOVA0000101").error, /typing mistake/);
  assert.match(NB.startBeneficiary(s, "12ab", "NOVA0000101").error, /only contain digits/);
  assert.match(NB.startBeneficiary(s, "12345", "NOVA0000101").error, /9 to 18 digits/);
  assert.match(NB.startBeneficiary(s, "", "NOVA0000101").error, /Enter the account/);
});
test("unknown but well-formed account is not found", () => {
  assert.match(NB.startBeneficiary(fresh(), "30100000006", "NOVA0000101").error, /could not find/);
});
test("IFSC format and mismatch are reported on the IFSC field", () => {
  const s = fresh();
  const bad = NB.startBeneficiary(s, "50100987614", "ABC123");
  assert.equal(bad.field, "ifsc");
  assert.match(bad.error, /11 characters/);
  const mismatch = NB.startBeneficiary(s, "50100987614", "NOVA0000999");
  assert.equal(mismatch.field, "ifsc");
  assert.match(mismatch.error, /does not match/);
});
test("a duplicate beneficiary is rejected", () => {
  assert.match(NB.startBeneficiary(fresh(), "50100123459", "NOVA0000101").error, /already/);
});
test("every directory account passes the checksum", () => {
  for (const d of NB.DIRECTORY) assert.equal(NB.validateAccount(d.acct).ok, true, d.acct);
});

/* FR4: one-time code for new beneficiaries */
test("correct code is accepted", () => {
  const otp = NB.newOtp(() => 0);
  assert.equal(otp.code, "100000");
  assert.equal(NB.verifyOtp(otp, " 100000 ").ok, true);
});
test("three wrong codes lock the code and a fourth correct code is refused", () => {
  let otp = NB.newOtp(() => 0.5);
  let r = NB.verifyOtp(otp, "000000");
  assert.equal(r.ok, false); assert.equal(r.remaining, 2); assert.match(r.error, /2 tries left/);
  r = NB.verifyOtp(r.otp, "000001");
  assert.equal(r.remaining, 1); assert.match(r.error, /1 try left/);
  r = NB.verifyOtp(r.otp, "000002");
  assert.equal(r.locked, true);
  const after = NB.verifyOtp(r.otp, otp.code);
  assert.equal(after.ok, false); assert.equal(after.locked, true);
});
test("adding a beneficiary after verification stores it as verified and new", () => {
  const s = NB.addBeneficiary(fresh(), { name: "Arjun Mehta", acct: "50100987614", ifsc: "NOVA0000101" }, NOW);
  const b = s.bens[s.bens.length - 1];
  assert.equal(b.verified, true);
  assert.equal(NB.isNewBeneficiary(b, NOW + 3600e3), true);
  assert.equal(NB.isNewBeneficiary(b, NOW + 25 * 3600e3), false);
});

/* FR2: transfer with amount limit check (AC2, UAT2) */
test("amount above the per-transfer limit is blocked and shows the limit (AC2, UAT2)", () => {
  const r = NB.checkTransfer(fresh(), "60000", NOW);
  assert.equal(r.ok, false); assert.equal(r.kind, "per");
  assert.equal(r.limit, 50000); assert.equal(r.canChangeLimit, true);
  assert.match(r.message, /₹50,000/);
});
test("amount that would pass the daily limit is blocked and shows what is left", () => {
  let s = fresh();
  s.limits = { perTransfer: 50000, daily: 75000 };
  const ben = s.bens[0];
  s = NB.transfer(s, ben, "40000", NOW).state;
  const r = NB.checkTransfer(s, "40000", NOW + 1000);
  assert.equal(r.kind, "daily"); assert.equal(r.remaining, 35000);
  assert.match(r.message, /₹35,000/);
});
test("daily total resets on the next day", () => {
  let s = fresh();
  s = NB.transfer(s, s.bens[0], "40000", NOW).state;
  assert.equal(NB.checkTransfer(s, "40000", NOW + 24 * 3600e3).ok, true);
});
test("amounts must be whole rupees of at least 1", () => {
  const s = fresh();
  for (const bad of ["", "0", "-5", "12.5", "abc"]) assert.equal(NB.checkTransfer(s, bad, NOW).kind, "amount", bad);
  assert.equal(NB.checkTransfer(s, "₹1,500", NOW).ok, true);
});
test("balance can never go negative", () => {
  let s = fresh();
  s.balance = 500;
  const r = NB.transfer(s, s.bens[0], "501", NOW);
  assert.equal(r.ok, false); assert.equal(r.kind, "balance");
  assert.equal(r.state.balance, 500);
  const ok = NB.transfer(s, s.bens[0], "500", NOW);
  assert.equal(ok.state.balance, 0);
});
test("limit change is validated and applied", () => {
  const s = fresh();
  assert.equal(NB.setLimits(s, "70000", "100000").ok, true);
  assert.equal(NB.setLimits(s, "70000", "100000").state.limits.perTransfer, 70000);
  assert.match(NB.setLimits(s, "250000", "300000").error, /cannot be more than ₹2,00,000/);
  assert.match(NB.setLimits(s, "1000", "400000").error, /daily limit cannot be more than/);
  assert.match(NB.setLimits(s, "20000", "10000").error, /more than the daily/);
  assert.match(NB.setLimits(s, "50", "1000").error, /at least/);
  assert.match(NB.setLimits(s, "x", "1000").error, /whole rupees/);
});
test("after raising the limit the same transfer is allowed", () => {
  let s = fresh();
  assert.equal(NB.checkTransfer(s, "60000", NOW).ok, false);
  s = NB.setLimits(s, "70000", "100000").state;
  assert.equal(NB.checkTransfer(s, "60000", NOW).ok, true);
});

/* FR2 / goal: clear confirmation receipt */
test("a transfer produces a receipt with a reference id and updates the books", () => {
  const s = fresh(), before = s.balance;
  const r = NB.transfer(s, s.bens[0], "1500", NOW, "Dinner");
  assert.equal(r.ok, true);
  assert.match(r.receipt.ref, /^NB20261118\d{4}$/);
  assert.equal(r.receipt.balanceAfter, before - 1500);
  assert.equal(r.receipt.acct, "•••• 3459");
  assert.equal(r.state.txns.length, s.txns.length + 1);
  assert.equal(s.balance, before, "original state is not mutated");
});
test("reference ids are unique", () => {
  let s = fresh();
  const a = NB.transfer(s, s.bens[0], "10", NOW); s = a.state;
  const b = NB.transfer(s, s.bens[0], "10", NOW);
  assert.notEqual(a.receipt.ref, b.receipt.ref);
});
test("an unverified beneficiary cannot receive money", () => {
  const s = fresh();
  assert.equal(NB.transfer(s, { name: "X", acct: "1", verified: false }, "10", NOW).ok, false);
  assert.equal(NB.transfer(s, null, "10", NOW).ok, false);
});

/* FR3: search transactions (AC3, UAT3) */
test("keyword search returns matches newest first (AC3)", () => {
  const r = NB.searchTxns(fresh().txns, { q: "metro" });
  assert.equal(r.length, 2);
  assert.ok(r[0].ts > r[1].ts);
  assert.ok(r.every((t) => /metro/i.test(t.name)));
});
test("search by exact amount returns only that amount (UAT3)", () => {
  const r = NB.searchTxns(fresh().txns, { amount: "18000" });
  assert.equal(r.length, 2);
  assert.ok(r.every((t) => t.amount === 18000));
  assert.equal(NB.searchTxns(fresh().txns, { amount: "7" }).length, 0);
});
test("search by date range is inclusive", () => {
  const all = fresh().txns;
  const r = NB.searchTxns(all, { from: NB.dayKey(NOW - 6 * 86400e3), to: NB.dayKey(NOW - 1 * 86400e3) });
  assert.deepEqual(r.map((t) => t.name), ["Orbit Tech salary", "Green Leaf Rentals", "Bright Power Utility", "Metro Mart", "Priya Nair"]);
});
test("no filters returns everything, newest first", () => {
  const r = NB.searchTxns(fresh().txns, {});
  assert.equal(r.length, 12);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].ts >= r[i].ts);
});

/* NFR1: session expires after 5 minutes of inactivity, with a warning at 30 s */
test("session is active, warns at 30 seconds left, then expires at 5 minutes", () => {
  const t0 = 1000000;
  assert.equal(NB.sessionStatus(t0, t0 + 60e3).state, "active");
  assert.equal(NB.sessionStatus(t0, t0 + 269e3).state, "active");
  const w = NB.sessionStatus(t0, t0 + 270e3);
  assert.equal(w.state, "warning"); assert.equal(w.remainingMs, 30e3);
  assert.equal(NB.sessionStatus(t0, t0 + 299999).state, "warning");
  assert.equal(NB.sessionStatus(t0, t0 + 300e3).state, "expired");
});
test("timeout and warning are configurable", () => {
  assert.equal(NB.sessionStatus(0, 7000, 10000, 5000).state, "warning");
  assert.equal(NB.sessionStatus(0, 10000, 10000, 5000).state, "expired");
});
test("activity resets the clock", () => {
  assert.equal(NB.sessionStatus(300e3, 301e3).state, "active");
});

/* NFR2: sensitive data masked */
test("account numbers and balances are masked until revealed", () => {
  assert.equal(NB.maskAccount("50100123459"), "•••• 3459");
  assert.equal(NB.maskMoney(84250, false), "₹ ••••••");
  assert.equal(NB.maskMoney(84250, true), "₹84,250");
});

/* Demo PIN and persistence */
test("PIN check locks after five wrong tries", () => {
  let a = 0, r;
  for (let i = 0; i < 4; i++) { r = NB.pinCheck(a, "0000"); a = r.attempts; assert.equal(r.locked, false); }
  r = NB.pinCheck(a, "0000");
  assert.equal(r.locked, true);
  assert.equal(NB.pinCheck(r.attempts, NB.DEMO_PIN).ok, false);
  assert.equal(NB.pinCheck(0, NB.DEMO_PIN).ok, true);
});
test("corrupt or old saved data falls back to seed data", () => {
  assert.equal(NB.normalize(null, NOW).v, 2);
  assert.equal(NB.normalize({ v: 1 }, NOW).v, 2);
  assert.equal(NB.normalize({ v: 2, txns: [], bens: [], balance: -5, limits: {}, kpi: { benSeconds: [] } }, NOW).balance, 84250);
  const s = fresh();
  assert.equal(NB.normalize(JSON.parse(JSON.stringify(s)), NOW).balance, s.balance);
});

/* KPIs */
test("KPI summary computes completion and average beneficiary time", () => {
  assert.deepEqual(NB.kpiSummary(NB.emptyKpi()), { completionPct: null, avgBenSeconds: null, failed: 0, started: 0, completed: 0 });
  const k = { started: 4, completed: 3, failed: 1, benSeconds: [40, 50] };
  const r = NB.kpiSummary(k);
  assert.equal(r.completionPct, 75); assert.equal(r.avgBenSeconds, 45);
});
