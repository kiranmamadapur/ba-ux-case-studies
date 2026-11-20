/* NovaBank business rules. Pure functions, no DOM. Works in Node (module.exports) and the browser (window.NB). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NB = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCHEMA = 2;
  const MIN_AMOUNT = 1;
  const MAX_PER_TRANSFER = 200000; // bank-wide ceiling the customer cannot exceed
  const MAX_DAILY = 300000;
  const MIN_LIMIT = 100;
  const OTP_MAX_ATTEMPTS = 3;
  const PIN_MAX_ATTEMPTS = 5;
  const NEW_BENEFICIARY_MS = 24 * 3600 * 1000;
  const DEMO_PIN = "2468";

  /* Fictional account directory used to "resolve" a name. Every number passes the Luhn rule below. */
  const DIRECTORY = [
    { acct: "50100123459", ifsc: "NOVA0000101", name: "Priya Nair" },
    { acct: "50100987614", ifsc: "NOVA0000101", name: "Arjun Mehta" },
    { acct: "60200455123", ifsc: "NOVA0000202", name: "Green Leaf Rentals" },
    { acct: "70300111898", ifsc: "NOVA0000303", name: "Bright Power Utility" },
    { acct: "40100777347", ifsc: "NOVA0000404", name: "Sana Qureshi" },
  ];

  const fmtInr = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const dayKey = (ts) => { const d = new Date(ts), p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }; // local calendar day, so the daily limit resets at local midnight
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- account and IFSC validation ---------- */
  function luhnValid(digits) {
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = digits.charCodeAt(i) - 48;
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }
  function validateAccount(raw) {
    const a = String(raw == null ? "" : raw).replace(/\s+/g, "");
    if (!a) return { ok: false, error: "Enter the account number." };
    if (!/^\d+$/.test(a)) return { ok: false, error: "The account number can only contain digits." };
    if (a.length < 9 || a.length > 18) return { ok: false, error: "The account number must be 9 to 18 digits long." };
    if (!luhnValid(a)) return { ok: false, error: "This account number does not look right. Check it for a typing mistake." };
    return { ok: true, value: a };
  }
  function validateIfsc(raw) {
    const c = String(raw == null ? "" : raw).replace(/\s+/g, "").toUpperCase();
    if (!c) return { ok: false, error: "Enter the IFSC code." };
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(c)) return { ok: false, error: "The IFSC code must be 11 characters, like NOVA0000101." };
    return { ok: true, value: c };
  }
  /* Step 1 of adding a beneficiary: validate and resolve the account holder name for confirmation. */
  function startBeneficiary(state, acctRaw, ifscRaw) {
    const a = validateAccount(acctRaw);
    if (!a.ok) return { ok: false, field: "acct", error: a.error };
    const i = validateIfsc(ifscRaw);
    if (!i.ok) return { ok: false, field: "ifsc", error: i.error };
    if ((state.bens || []).some((b) => b.acct === a.value)) return { ok: false, field: "acct", error: "This person is already in your beneficiaries." };
    const hit = DIRECTORY.find((d) => d.acct === a.value);
    if (!hit) return { ok: false, field: "acct", error: "We could not find this account. Check the account number and IFSC code." };
    if (hit.ifsc !== i.value) return { ok: false, field: "ifsc", error: "The IFSC code does not match this account." };
    return { ok: true, acct: a.value, ifsc: i.value, name: hit.name };
  }

  /* ---------- one-time code ---------- */
  function newOtp(rand) {
    const r = typeof rand === "function" ? rand : Math.random;
    return { code: String(100000 + Math.floor(r() * 900000)), attempts: 0, max: OTP_MAX_ATTEMPTS, locked: false };
  }
  function verifyOtp(otp, input) {
    if (otp.locked) return { ok: false, locked: true, otp, error: "Too many wrong codes. This beneficiary was not added. Please start again." };
    if (String(input == null ? "" : input).trim() === otp.code) return { ok: true, otp };
    const next = { code: otp.code, attempts: otp.attempts + 1, max: otp.max, locked: false };
    if (next.attempts >= next.max) {
      next.locked = true;
      return { ok: false, locked: true, otp: next, error: "Too many wrong codes. This beneficiary was not added. Please start again." };
    }
    const left = next.max - next.attempts;
    return { ok: false, locked: false, otp: next, remaining: left, error: "That code is not correct. You have " + left + (left === 1 ? " try" : " tries") + " left." };
  }
  function addBeneficiary(state, info, now) {
    const s = clone(state);
    s.counter += 1;
    s.bens.push({ id: "b" + s.counter, name: info.name, acct: info.acct, ifsc: info.ifsc, verified: true, added: now });
    return s;
  }
  function isNewBeneficiary(ben, now) { return now - ben.added < NEW_BENEFICIARY_MS; }

  /* ---------- limits and transfers ---------- */
  function dailyUsed(state, now) {
    const k = dayKey(now);
    return state.txns.filter((t) => t.type === "debit" && dayKey(t.ts) === k).reduce((s, t) => s + t.amount, 0);
  }
  function parseAmount(raw) {
    const t = String(raw == null ? "" : raw).replace(/[,\s₹]/g, "");
    if (!/^\d+$/.test(t)) return null;
    const n = Number(t);
    return n >= MIN_AMOUNT ? n : null;
  }
  function checkTransfer(state, amountRaw, now) {
    const a = parseAmount(amountRaw);
    if (a === null) return { ok: false, kind: "amount", message: "Enter a whole-rupee amount of " + fmtInr(MIN_AMOUNT) + " or more." };
    const per = state.limits.perTransfer, daily = state.limits.daily, used = dailyUsed(state, now);
    if (a > per) return { ok: false, kind: "per", limit: per, canChangeLimit: true, message: "This is above your per-transfer limit of " + fmtInr(per) + ". Send a smaller amount or change your limit." };
    if (used + a > daily) {
      const left = Math.max(0, daily - used);
      return { ok: false, kind: "daily", limit: daily, remaining: left, canChangeLimit: true, message: "This would go over your daily limit of " + fmtInr(daily) + ". You can still send " + fmtInr(left) + " today. Send less or change your limit." };
    }
    if (a > state.balance) return { ok: false, kind: "balance", message: "Your balance is not enough for this transfer. Try a smaller amount." };
    return { ok: true, amount: a };
  }
  function setLimits(state, perRaw, dailyRaw) {
    const per = parseAmount(perRaw), daily = parseAmount(dailyRaw);
    if (per === null || daily === null) return { ok: false, error: "Enter both limits as whole rupees." };
    if (per < MIN_LIMIT || daily < MIN_LIMIT) return { ok: false, error: "Limits must be at least " + fmtInr(MIN_LIMIT) + "." };
    if (per > MAX_PER_TRANSFER) return { ok: false, error: "The per-transfer limit cannot be more than " + fmtInr(MAX_PER_TRANSFER) + "." };
    if (daily > MAX_DAILY) return { ok: false, error: "The daily limit cannot be more than " + fmtInr(MAX_DAILY) + "." };
    if (per > daily) return { ok: false, error: "The per-transfer limit cannot be more than the daily limit." };
    const s = clone(state);
    s.limits = { perTransfer: per, daily: daily };
    return { ok: true, state: s };
  }
  function makeRef(counter, now) { return "NB" + dayKey(now).replace(/-/g, "") + String(counter).padStart(4, "0"); }
  function maskAccount(acct) { const a = String(acct); return "•••• " + a.slice(-4); }
  function maskMoney(n, revealed) { return revealed ? fmtInr(n) : "₹ ••••••"; }

  function transfer(state, ben, amountRaw, now, note) {
    if (!ben || !ben.verified) return { ok: false, kind: "beneficiary", message: "Choose a verified beneficiary first.", state };
    const c = checkTransfer(state, amountRaw, now);
    if (!c.ok) return Object.assign({ state }, c);
    const s = clone(state);
    s.balance -= c.amount; // checkTransfer guarantees this cannot go below zero
    s.counter += 1;
    const ref = makeRef(s.counter, now);
    s.txns.push({ id: s.counter, ts: now, type: "debit", name: ben.name, amount: c.amount, ref: ref, note: note || "" });
    return { ok: true, state: s, receipt: { ref: ref, ts: now, name: ben.name, acct: maskAccount(ben.acct), amount: c.amount, balanceAfter: s.balance } };
  }

  /* ---------- transaction search (newest first) ---------- */
  function searchTxns(txns, f) {
    f = f || {};
    const q = String(f.q || "").trim().toLowerCase();
    const amt = f.amount === "" || f.amount == null ? null : Number(String(f.amount).replace(/[,\s₹]/g, ""));
    return txns
      .filter((t) => {
        if (q && !(t.name.toLowerCase().includes(q) || t.ref.toLowerCase().includes(q) || String(t.note || "").toLowerCase().includes(q))) return false;
        if (amt !== null && !Number.isNaN(amt) && t.amount !== amt) return false;
        const d = dayKey(t.ts);
        if (f.from && d < f.from) return false;
        if (f.to && d > f.to) return false;
        return true;
      })
      .sort((a, b) => b.ts - a.ts || b.id - a.id);
  }

  /* ---------- session timeout (5 minutes by default) ---------- */
  const SESSION_MS = 5 * 60 * 1000, WARN_MS = 30 * 1000;
  function sessionStatus(lastActive, now, timeoutMs, warnMs) {
    const t = timeoutMs == null ? SESSION_MS : timeoutMs, w = warnMs == null ? WARN_MS : warnMs;
    const remaining = t - (now - lastActive);
    if (remaining <= 0) return { state: "expired", remainingMs: 0 };
    if (remaining <= w) return { state: "warning", remainingMs: remaining };
    return { state: "active", remainingMs: remaining };
  }

  /* ---------- demo PIN ---------- */
  function pinCheck(attempts, pin, expected) {
    const exp = expected || DEMO_PIN;
    if (attempts >= PIN_MAX_ATTEMPTS) return { ok: false, locked: true, attempts: attempts, error: "Too many wrong PINs. Reload the page to try again." };
    if (String(pin) === exp) return { ok: true, locked: false, attempts: 0 };
    const n = attempts + 1;
    if (n >= PIN_MAX_ATTEMPTS) return { ok: false, locked: true, attempts: n, error: "Too many wrong PINs. Reload the page to try again." };
    return { ok: false, locked: false, attempts: n, error: "That PIN is not correct. You have " + (PIN_MAX_ATTEMPTS - n) + " tries left." };
  }

  /* ---------- KPIs measured from in-app use (simulated) ---------- */
  function emptyKpi() { return { started: 0, completed: 0, failed: 0, benSeconds: [] }; }
  function kpiSummary(k) {
    const avg = k.benSeconds.length ? Math.round(k.benSeconds.reduce((s, x) => s + x, 0) / k.benSeconds.length) : null;
    return { completionPct: k.started ? Math.round((k.completed / k.started) * 100) : null, avgBenSeconds: avg, failed: k.failed, started: k.started, completed: k.completed };
  }

  /* ---------- seed data and persistence ---------- */
  function seed(now) {
    const day = 24 * 3600 * 1000;
    const rows = [
      [1, "credit", "Orbit Tech salary", 62000, "Salary"], [2, "debit", "Green Leaf Rentals", 18000, "Rent"],
      [3, "debit", "Bright Power Utility", 1840, "Electricity"], [4, "debit", "Metro Mart", 2260, "Groceries"],
      [6, "debit", "Priya Nair", 1500, "Lunch share"], [8, "debit", "Cinema Hub", 780, "Movie"],
      [10, "credit", "Refund - ShopEasy", 1299, "Refund"], [12, "debit", "Metro Mart", 3140, "Groceries"],
      [15, "debit", "Bright Power Utility", 1720, "Electricity"], [18, "debit", "Arjun Mehta", 5000, "Trip share"],
      [21, "credit", "Orbit Tech salary", 62000, "Salary"], [24, "debit", "Green Leaf Rentals", 18000, "Rent"],
    ];
    const txns = rows.map((r, i) => ({ id: i + 1, ts: now - r[0] * day, type: r[1], name: r[2], amount: r[3], ref: "NB" + dayKey(now - r[0] * day).replace(/-/g, "") + String(i + 1).padStart(4, "0"), note: r[4] }));
    return {
      v: SCHEMA, counter: 100, holder: "Demo Customer", accountNo: "50100555554", balance: 84250,
      limits: { perTransfer: 50000, daily: 75000 },
      bens: [{ id: "b1", name: "Priya Nair", acct: "50100123459", ifsc: "NOVA0000101", verified: true, added: now - 40 * day }],
      txns: txns, kpi: emptyKpi(),
    };
  }
  function normalize(raw, now) {
    try {
      const ok = raw && raw.v === SCHEMA && Array.isArray(raw.txns) && Array.isArray(raw.bens) && typeof raw.balance === "number" && raw.balance >= 0 && raw.limits && raw.kpi && Array.isArray(raw.kpi.benSeconds);
      return ok ? raw : seed(now);
    } catch (e) { return seed(now); }
  }

  return {
    SCHEMA, DEMO_PIN, DIRECTORY, MAX_PER_TRANSFER, MAX_DAILY, OTP_MAX_ATTEMPTS, SESSION_MS, WARN_MS, NEW_BENEFICIARY_MS,
    fmtInr, dayKey, luhnValid, validateAccount, validateIfsc, startBeneficiary, newOtp, verifyOtp, addBeneficiary, isNewBeneficiary,
    dailyUsed, parseAmount, checkTransfer, setLimits, makeRef, maskAccount, maskMoney, transfer, searchTxns,
    sessionStatus, pinCheck, emptyKpi, kpiSummary, seed, normalize,
  };
});
