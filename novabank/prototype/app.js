/* NovaBank prototype UI. Business rules live in logic.js (window.NB). Fictional bank, fictional data, no network. */
(function () {
  "use strict";
  const KEY = "nb:v2";
  const params = new URLSearchParams(location.search);
  /* The 5-minute inactivity rule is configurable for testing: ?timeout=20&warn=10 (seconds). */
  const TIMEOUT = params.get("timeout") ? Number(params.get("timeout")) * 1000 : NB.SESSION_MS;
  const WARN = params.get("warn") ? Number(params.get("warn")) * 1000 : NB.WARN_MS;

  let st = NB.normalize(S(KEY, null), Date.now());
  const ui = { view: "login", authed: false, pinAttempts: 0, locked: false, err: "", notice: "", reveal: false, last: Date.now(), ben: null, xfer: null, filt: { q: "", amount: "", from: "", to: "" }, focus: null, focusH: true };

  const save = () => V(KEY, st);
  const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const fmtDur = (ms) => (ms >= 60000 ? Math.round(ms / 60000) + " minutes" : Math.round(ms / 1000) + " seconds");

  const live = document.createElement("div");
  live.className = "sr"; live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);
  const announce = (t) => { live.textContent = ""; setTimeout(() => { live.textContent = t; }, 50); };

  /* ---------- session timeout ---------- */
  function logout(msg) {
    ui.authed = false; ui.view = "login"; ui.ben = null; ui.xfer = null; ui.reveal = false; ui.pinAttempts = 0; ui.locked = false;
    ui.err = ""; ui.notice = msg || ""; ui.focusH = true; $("#sess").hidden = true; render();
    if (msg) announce(msg);
  }
  setInterval(() => {
    if (!ui.authed) return;
    const s = NB.sessionStatus(ui.last, Date.now(), TIMEOUT, WARN), el = $("#sess");
    if (s.state === "expired") return logout("You were signed out after " + fmtDur(TIMEOUT) + " of no activity. Please sign in again.");
    if (s.state === "warning") {
      if (el.hidden) {
        el.hidden = false;
        el.innerHTML = '<span>For your safety you will be signed out in under ' + fmtDur(WARN) + '. <b id="cd" aria-hidden="true"></b></span><button class="p" data-a="stay">Stay signed in</button>';
      }
      $("#cd").textContent = "(" + Math.ceil(s.remainingMs / 1000) + "s)";
    } else el.hidden = true;
  }, 1000);
  ["click", "keydown", "input", "touchstart"].forEach((ev) => document.addEventListener(ev, () => {
    if (ui.authed && NB.sessionStatus(ui.last, Date.now(), TIMEOUT, WARN).state !== "expired") ui.last = Date.now();
  }, true));

  /* ---------- views ---------- */
  const nav = () => '<nav class="nav" aria-label="Main">' + [["home", "Home"], ["send", "Send money"], ["bens", "Beneficiaries"], ["search", "Transactions"], ["kpi", "Insights"]]
    .map((v) => '<button data-a="go" data-v="' + v[0] + '"' + (ui.view === v[0] ? ' aria-current="page"' : "") + ">" + v[1] + "</button>").join("") + '<button data-a="logout">Sign out</button></nav>';
  const err = (id, m) => '<p class="err" id="' + id + '" role="alert">' + esc(m || "") + "</p>";
  const txRow = (t) => '<div class="tx"><div><b>' + esc(t.name) + '</b><div class="m">' + fmtDate(t.ts) + " · " + esc(t.note || "") + " · " + esc(t.ref) + '</div></div><div class="amt ' + (t.type === "credit" ? "cr" : "") + '">' + (t.type === "credit" ? "+" : "−") + NB.fmtInr(t.amount) + "</div></div>";
  const acctShown = (a) => (ui.reveal ? a : NB.maskAccount(a));
  const demoBanner = (txt) => '<div class="demo"><b>Demo only.</b> ' + txt + "</div>";

  function vLogin() {
    return '<div class="c"><h2 id="h" tabindex="-1">Sign in to NovaBank</h2>' + demoBanner("This is a fictional bank. Use PIN <b class=\"code\">" + NB.DEMO_PIN + "</b>. No real money or data is used.") +
      (ui.notice ? '<p class="note" role="status">' + esc(ui.notice) + "</p>" : "") +
      '<form data-f="login"><label for="pin">PIN <span class="hint">4 digits</span></label><input id="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="4"' + (ui.locked ? " disabled" : "") + ' aria-describedby="pinerr">' +
      err("pinerr", ui.err) + '<button class="p" type="submit"' + (ui.locked ? " disabled" : "") + ">Sign in</button></form></div>";
  }

  function vHome() {
    const used = NB.dailyUsed(st, Date.now());
    return '<div class="c"><h2 id="h" tabindex="-1">Hello, ' + esc(st.holder) + '</h2><p class="m">Savings account ' + esc(acctShown(st.accountNo)) + '</p><p class="bal">' + NB.maskMoney(st.balance, ui.reveal) + "</p>" +
      '<button id="revbtn" data-a="reveal" aria-pressed="' + ui.reveal + '">' + (ui.reveal ? "Hide balance and account" : "Show balance and account") + "</button>" +
      '<p class="m" style="margin-top:12px">Limits: ' + NB.fmtInr(st.limits.perTransfer) + " per transfer, " + NB.fmtInr(st.limits.daily) + " per day. Sent today: " + NB.fmtInr(used) + ".</p></div>" +
      '<div class="c"><h3>Recent activity</h3>' + NB.searchTxns(st.txns, {}).slice(0, 5).map(txRow).join("") + "</div>";
  }

  /* --- send money --- */
  function vSend() {
    const x = ui.xfer || (ui.xfer = { stage: "form", benId: st.bens[0] && st.bens[0].id, amount: "", note: "", err: "", counted: false, showLimits: false, notice: "" });
    if (!st.bens.length) return '<div class="c"><h2 id="h" tabindex="-1">Send money</h2><p>Add a beneficiary first.</p><button class="p" data-a="go" data-v="bens">Add a beneficiary</button></div>';
    const ben = st.bens.find((b) => b.id === x.benId) || st.bens[0];
    if (x.stage === "done") {
      const r = x.receipt;
      return '<div class="c receipt"><h2 id="h" tabindex="-1">Transfer successful</h2><p>' + NB.fmtInr(r.amount) + " sent to <b>" + esc(r.name) + "</b> (" + esc(r.acct) + ').</p><p class="m">Reference <b>' + esc(r.ref) + "</b> · " + fmtDate(r.ts) + "<br>Balance after: " + NB.maskMoney(r.balanceAfter, ui.reveal) + '</p><div class="row"><button class="p" data-a="xnew">Send another</button><button data-a="go" data-v="home">Back to home</button></div></div>';
    }
    if (x.stage === "confirm") {
      return '<div class="c"><h2 id="h" tabindex="-1">Confirm transfer</h2><p>Send <b>' + NB.fmtInr(NB.parseAmount(x.amount)) + "</b> to <b>" + esc(ben.name) + "</b> (" + esc(acctShown(ben.acct)) + ").</p>" +
        (NB.isNewBeneficiary(ben, Date.now()) ? '<p class="note">This person was added less than 24 hours ago. Check the name once more before you confirm.</p>' : "") +
        '<div class="row"><button class="p" data-a="xconfirm">Confirm transfer</button><button data-a="xback">Change details</button></div></div>';
    }
    const limitForm = x.showLimits ? '<form class="c" data-f="limits"><h3>Change my limits</h3><label for="lp">Per-transfer limit (₹)</label><input id="lp" inputmode="numeric" value="' + st.limits.perTransfer + '"><label for="ld">Daily limit (₹)</label><input id="ld" inputmode="numeric" value="' + st.limits.daily + '"><p class="m">Highest allowed: ' + NB.fmtInr(NB.MAX_PER_TRANSFER) + " per transfer, " + NB.fmtInr(NB.MAX_DAILY) + ' per day.</p>' + err("lerr", x.limitErr) + '<button class="p" type="submit">Save limits</button></form>' : "";
    return '<div class="c"><h2 id="h" tabindex="-1">Send money</h2>' + (x.notice ? '<p class="ok" role="status">' + esc(x.notice) + "</p>" : "") +
      '<form data-f="xfer"><label for="xb">To</label><select id="xb">' + st.bens.map((b) => '<option value="' + b.id + '"' + (b.id === x.benId ? " selected" : "") + ">" + esc(b.name) + " (" + esc(NB.maskAccount(b.acct)) + ")" + (NB.isNewBeneficiary(b, Date.now()) ? " – new" : "") + "</option>").join("") + "</select>" +
      '<label for="xa">Amount (₹) <span class="hint">Limit ' + NB.fmtInr(st.limits.perTransfer) + ' per transfer</span></label><input id="xa" inputmode="numeric" value="' + esc(x.amount) + '" aria-describedby="xerr">' +
      '<label for="xn">Note <span class="hint">optional</span></label><input id="xn" maxlength="40" value="' + esc(x.note) + '">' + err("xerr", x.err) +
      '<button class="p" type="submit">Continue</button></form></div>' + limitForm;
  }

  /* --- beneficiaries --- */
  function vBens() {
    const b = ui.ben;
    let flow = "";
    if (!b) flow = '<button class="p" data-a="benstart">Add a beneficiary</button>';
    else if (b.stage === "form") {
      flow = '<form class="c" data-f="ben1"><h3>Add a beneficiary</h3><label for="ba">Account number <span class="hint">9 to 18 digits</span></label><input id="ba" inputmode="numeric" value="' + esc(b.acct) + '"' + (b.field === "acct" ? ' aria-invalid="true"' : "") + ' aria-describedby="berr"><label for="bi">IFSC code <span class="hint">like NOVA0000101</span></label><input id="bi" value="' + esc(b.ifsc) + '"' + (b.field === "ifsc" ? ' aria-invalid="true"' : "") + ' aria-describedby="berr">' + err("berr", b.err) +
        '<p class="m">Demo accounts you can try: 50100987614 (NOVA0000101), 60200455123 (NOVA0000202).</p><div class="row"><button class="p" type="submit">Find account</button><button type="button" data-a="bencancel">Cancel</button></div></form>';
    } else if (b.stage === "confirm") {
      flow = '<div class="c"><h3>Is this the right person?</h3><p>Account holder: <b>' + esc(b.name) + "</b><br>" + esc(NB.maskAccount(b.acct)) + " · " + esc(b.ifsc) + '</p><p class="m">For your safety we send a one-time code before a new beneficiary is saved.</p><div class="row"><button class="p" data-a="bensend">Yes, send the code</button><button data-a="benback">No, change details</button></div></div>';
    } else if (b.stage === "otp") {
      flow = '<form class="c" data-f="otp"><h3>Enter the one-time code</h3>' + demoBanner("In a real bank this code would arrive by SMS. Your demo code is <b class=\"code\">" + esc(b.otp.code) + "</b>.") + '<label for="bo">6-digit code</label><input id="bo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-describedby="oerr">' + err("oerr", b.err) + '<div class="row"><button class="p" type="submit">Verify and save</button><button type="button" data-a="bencancel">Cancel</button></div></form>';
    } else if (b.stage === "locked") {
      flow = '<div class="c"><h3>Beneficiary not added</h3><p class="err" role="alert">' + esc(b.err) + '</p><button class="p" data-a="benstart">Start again</button></div>';
    }
    return '<div class="c"><h2 id="h" tabindex="-1">Beneficiaries</h2>' + (ui.notice ? '<p class="ok" role="status">' + esc(ui.notice) + "</p>" : "") + st.bens.map((x) => '<div class="tx"><div><b>' + esc(x.name) + '</b> ' + (NB.isNewBeneficiary(x, Date.now()) ? '<span class="tag new">New</span>' : "") + '<div class="m">' + esc(acctShown(x.acct)) + " · " + esc(x.ifsc) + "</div></div></div>").join("") + "</div>" + flow;
  }

  /* --- transaction search --- */
  function vSearch() {
    const f = ui.filt, res = NB.searchTxns(st.txns, f);
    return '<div class="c"><h2 id="h" tabindex="-1">Transactions</h2><form data-f="search"><label for="sq">Name, note or reference</label><input id="sq" value="' + esc(f.q) + '"><label for="sa">Exact amount (₹)</label><input id="sa" inputmode="numeric" value="' + esc(f.amount) + '"><div class="cols"><div><label for="sf">From date</label><input id="sf" type="date" value="' + esc(f.from) + '"></div><div><label for="st">To date</label><input id="st" type="date" value="' + esc(f.to) + '"></div></div>' +
      '<div class="row"><button class="p" type="submit">Search</button><button type="button" data-a="sclear">Clear</button></div></form></div><div class="c"><h3>' + res.length + " transaction" + (res.length === 1 ? "" : "s") + ", newest first</h3>" + (res.map(txRow).join("") || '<p class="m">No transactions match. Try fewer filters.</p>') + "</div>";
  }

  /* --- insights (KPIs measured in this browser) --- */
  function vKpi() {
    const k = NB.kpiSummary(st.kpi), v = (x, u) => (x === null ? "Not measured yet" : x + u);
    return '<div class="c"><h2 id="h" tabindex="-1">Insights</h2><p class="note">Simulated: these numbers come only from what you do in this demo, in this browser. They are not real bank results. The case study targets are assumptions.</p><div class="kpi"><div><b>' + v(k.completionPct, "%") + "</b>Transfer completion<br><span class=\"m\">Target 90% (assumed baseline 78%). " + k.completed + " of " + k.started + " started.</span></div><div><b>" + v(k.avgBenSeconds, " s") + "</b>Time to add a beneficiary<br><span class=\"m\">Target 45 s (assumed baseline 95 s)</span></div><div><b>" + k.failed + "</b>Blocked transfer attempts<br><span class=\"m\">Stands in for failed-transfer support calls (assumed 120 to 60 a week)</span></div></div></div>";
  }

  const VIEWS = { home: vHome, send: vSend, bens: vBens, search: vSearch, kpi: vKpi };
  function render() {
    $("#m").innerHTML = ui.authed ? nav() + VIEWS[ui.view]() : vLogin();
    const t = ui.focus && document.getElementById(ui.focus);
    if (t) t.focus(); else if (ui.focusH) { const h = $("#h"); if (h) h.focus(); }
    ui.focus = null; ui.focusH = false;
  }
  const go = (v) => { ui.view = v; ui.ben = null; ui.xfer = null; ui.notice = ""; ui.focusH = true; render(); };

  /* ---------- actions ---------- */
  const A = {
    go, logout: () => logout("You are signed out."), stay: () => { ui.last = Date.now(); $("#sess").hidden = true; announce("Session extended."); },
    reveal: () => { ui.reveal = !ui.reveal; ui.focus = "revbtn"; render(); },
    benstart: () => { ui.ben = { stage: "form", acct: "", ifsc: "", err: "", field: "", start: Date.now() }; ui.notice = ""; ui.focus = "ba"; render(); },
    bencancel: () => { ui.ben = null; ui.focusH = true; render(); },
    benback: () => { ui.ben.stage = "form"; ui.ben.err = ""; ui.focus = "ba"; render(); },
    bensend: () => { ui.ben.otp = NB.newOtp(); ui.ben.err = ""; ui.ben.stage = "otp"; ui.focus = "bo"; render(); announce("A one-time code was sent. In this demo it is shown on screen."); },
    xnew: () => { ui.xfer = null; ui.focusH = true; render(); },
    xback: () => { ui.xfer.stage = "form"; ui.focus = "xa"; render(); },
    xconfirm: () => {
      const x = ui.xfer, ben = st.bens.find((b) => b.id === x.benId), r = NB.transfer(st, ben, x.amount, Date.now(), x.note);
      if (!r.ok) { st.kpi.failed++; save(); x.stage = "form"; x.err = r.message; ui.focus = "xa"; render(); return; }
      st = r.state; st.kpi.completed++; save(); x.stage = "done"; x.receipt = r.receipt; ui.focusH = true; render(); announce("Transfer successful. Reference " + r.receipt.ref + ".");
    },
    sclear: () => { ui.filt = { q: "", amount: "", from: "", to: "" }; ui.focus = "sq"; render(); announce("Filters cleared."); },
  };
  on(A);

  const F = {
    login(d) {
      const r = NB.pinCheck(ui.pinAttempts, String(d.get("pin") || ""));
      ui.pinAttempts = r.attempts; ui.locked = !!r.locked;
      if (r.ok) { ui.authed = true; ui.view = "home"; ui.last = Date.now(); ui.err = ""; ui.notice = ""; ui.focusH = true; render(); announce("Signed in."); return; }
      ui.err = r.error; ui.focus = r.locked ? null : "pin"; render();
    },
    ben1(d) {
      const b = ui.ben; b.acct = String(d.get("ba") || ""); b.ifsc = String(d.get("bi") || "");
      const r = NB.startBeneficiary(st, b.acct, b.ifsc);
      if (!r.ok) { b.err = r.error; b.field = r.field; ui.focus = r.field === "ifsc" ? "bi" : "ba"; render(); return; }
      Object.assign(b, { stage: "confirm", acct: r.acct, ifsc: r.ifsc, name: r.name, err: "", field: "" }); ui.focusH = false; ui.focus = null; render();
    },
    otp(d) {
      const b = ui.ben, r = NB.verifyOtp(b.otp, d.get("bo"));
      if (r.ok) {
        st = NB.addBeneficiary(st, { name: b.name, acct: b.acct, ifsc: b.ifsc }, Date.now());
        st.kpi.benSeconds.push(Math.max(1, Math.round((Date.now() - b.start) / 1000))); save();
        ui.notice = b.name + " was added. For your safety, new beneficiaries are flagged for 24 hours."; ui.ben = null; ui.focusH = true; render(); announce(ui.notice); return;
      }
      b.otp = r.otp; b.err = r.error;
      if (r.locked) { b.stage = "locked"; ui.focus = null; } else ui.focus = "bo";
      render();
    },
    xfer(d) {
      const x = ui.xfer; x.benId = d.get("xb"); x.amount = String(d.get("xa") || ""); x.note = String(d.get("xn") || ""); x.notice = "";
      if (!x.counted) { st.kpi.started++; x.counted = true; }
      const c = NB.checkTransfer(st, x.amount, Date.now());
      if (!c.ok) { st.kpi.failed++; save(); x.err = c.message; x.showLimits = !!c.canChangeLimit; ui.focus = "xa"; render(); return; }
      save(); x.err = ""; x.showLimits = false; x.stage = "confirm"; ui.focusH = true; render();
    },
    limits(d) {
      const x = ui.xfer, r = NB.setLimits(st, d.get("lp"), d.get("ld"));
      if (!r.ok) { x.limitErr = r.error; ui.focus = "lp"; render(); return; }
      st = r.state; save(); x.limitErr = ""; x.showLimits = false; x.err = ""; x.notice = "Limits updated. You can try the transfer again."; ui.focus = "xa"; render(); announce(x.notice);
    },
    search(d) {
      ui.filt = { q: String(d.get("sq") || ""), amount: String(d.get("sa") || ""), from: String(d.get("sf") || ""), to: String(d.get("st") || "") };
      ui.focus = "sq"; render(); announce(NB.searchTxns(st.txns, ui.filt).length + " transactions found.");
    },
  };
  document.addEventListener("submit", (e) => { const n = e.target.dataset.f; if (n && F[n]) { e.preventDefault(); F[n]({ get: (id) => { const el = document.getElementById(id); return el ? el.value : ""; } }); } });
  render();
})();
