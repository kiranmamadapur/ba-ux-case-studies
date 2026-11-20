/* MediCare Plus: UI and state. All business rules live in logic.js (window.MC). */
(function () {
  "use strict";
  let store;
  try { store = window.localStorage; store.getItem("mc:probe"); }
  catch (e) { const m = {}; store = { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; }

  const TODAY = MC.iso(new Date()), DATES = MC.dateList(TODAY);
  let st = MC.load(store, TODAY);
  const id = S("mc:id", { patient: "", phone: "" });
  const ui = { role: "patient", doc: "rao", date: DATES[1], sel: null, resched: null, msg: "", err: "", walk: { doc: "rao", name: "", phone: "" } };
  const m = document.getElementById("m"), live = document.getElementById("live");

  const LBL = { booked: "Booked", checked_in: "Checked in", in_consult: "In consultation", done: "Done", no_show: "No-show", cancelled: "Cancelled" };
  const D = d => new Date(d + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const DT = ms => new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const dn = i => MC.doctor(i).name;
  const byTime = (x, y) => MC.slotMs(x.date, x.time) - MC.slotMs(y.date, y.time) || x.doctor.localeCompare(y.doctor);
  const b = (t, a, v, o) => {
    o = o || {};
    return '<button class="' + (o.p ? "p " : "") + (o.on ? "on" : "") + '" data-a="' + a + '"' + (v != null ? ' data-v="' + esc(v) + '"' : "") +
      (o.on !== undefined ? ' aria-pressed="' + !!o.on + '"' : "") + (o.dis ? " disabled" : "") + (o.label ? ' aria-label="' + esc(o.label) + '"' : "") + ">" + t + "</button>";
  };
  const badge = s => '<span class="st st-' + s + '">' + LBL[s] + "</span>";
  const dateChips = list => '<div class="row" role="group" aria-label="Date">' + list.map(d => b(D(d), "date", d, { on: ui.date === d })).join("") + "</div>";
  const docChips = () => '<div class="row" role="group" aria-label="Doctor">' + MC.DOCTORS.map(d => b(esc(d.name), "doc", d.id, { on: ui.doc === d.id })).join("") + "</div>";
  const mine = a => a && ui.role !== "patient" ? true : !!a && !!id.phone && a.phone === id.phone;

  /* ---------- views ---------- */
  function slotGrid() {
    const free = MC.availableSlots(st, ui.doc, ui.date), cur = ui.resched && st.appts.find(a => a.id === ui.resched);
    return '<div class="slots" role="group" aria-label="Slots for ' + esc(dn(ui.doc)) + " on " + D(ui.date) + '">' + MC.SLOTS.map(t => {
      const isCur = cur && cur.doctor === ui.doc && cur.date === ui.date && cur.time === t, ok = free.includes(t);
      return b(t + (isCur ? "<small>Current</small>" : ok ? "" : "<small>Taken</small>"), "slot", t,
        { on: ui.sel === t, dis: !ok, label: t + (ok ? " available" : isCur ? " current time" : " taken") });
    }).join("") + "</div>";
  }
  function bookingPanel() {
    const re = !!ui.resched;
    return '<div class="c" id="book"><h2>' + (re ? "Reschedule your visit" : "Book a visit") + "</h2>" +
      '<p class="m">' + (re ? "Pick the new doctor, date and slot, then confirm." : "Doctor, slot, confirm: 3 taps once your details are saved. The date starts on tomorrow.") + "</p>" +
      "<h3>1. Doctor</h3>" + docChips() + '<h3 style="margin-top:12px">Date</h3>' + dateChips(DATES.slice(1)) +
      '<h3 style="margin-top:12px">2. Slot</h3>' + slotGrid() +
      (ui.sel ? '<div class="note"><b>3. Confirm:</b> ' + (re ? "move to " : "book ") + esc(dn(ui.doc)) + ", " + D(ui.date) + " at " + ui.sel + ".</div>" : '<p class="m">Pick a slot to continue.</p>') +
      '<div class="row">' + (ui.sel ? b(re ? "Confirm new time" : "Confirm booking", "confirm", null, { p: 1 }) : "") + (re ? b("Keep old time", "stopre") : "") + "</div></div>";
  }
  function apptCard(a) {
    let extra = "", btn = "";
    if (a.status === "booked") {
      btn = b("Check in", "checkin", a.id, { label: "Check in for " + D(a.date) + " " + a.time }) + b("Reschedule", "resched", a.id, { label: "Reschedule " + D(a.date) + " " + a.time }) +
        b("Cancel", "cancel", a.id, { label: "Cancel " + D(a.date) + " " + a.time });
    } else if (a.status === "checked_in") { const w = MC.waitFor(st, a); extra = '<div class="ok"><b>Expected wait about ' + w.minutes + " min</b> (" + w.ahead + " ahead of you)</div>"; }
    else if (a.status === "in_consult") extra = '<div class="ok"><b>You are being seen now.</b></div>';
    return '<div class="appt"><div><b>' + esc(dn(a.doctor)) + "</b> · " + D(a.date) + " · " + a.time + " " + badge(a.status) + extra + '</div><div class="row">' + btn + "</div></div>";
  }
  function patientView() {
    const list = id.phone ? MC.patientView(st, id.phone) : [], rem = id.phone ? MC.reminders(st, id.phone, Date.now()) : [];
    return '<div class="c"><h2>Your details</h2><label for="pn">Name</label><input id="pn" autocomplete="name" value="' + esc(id.patient) + '">' +
      '<label for="pp">Phone (10 digits)</label><input id="pp" inputmode="numeric" maxlength="10" autocomplete="tel" value="' + esc(id.phone) + '">' +
      b("Save details", "saveid", null, { p: 1 }) + '<p class="m">You only see appointments booked with this phone number.</p></div>' +
      bookingPanel() +
      '<div class="c"><h2>Your appointments</h2>' + (list.length ? list.map(apptCard).join("") : '<p class="m">' + (id.phone ? "No appointments yet." : "Save your details to see your appointments.") + "</p>") +
      '<p class="note" style="margin-top:12px">Demo: check-in is allowed on any day so you can try it.</p></div>' +
      '<div class="c"><h2>Reminders</h2>' + (rem.length ? "<ul>" + rem.map(r => { const a = st.appts.find(x => x.id === r.apptId); return "<li>" + esc(dn(a.doctor)) + " " + D(a.date) + " " + a.time + ": reminder " + DT(r.at) + " (" + r.state + ")</li>"; }).join("") + "</ul>" : '<p class="m">No reminders scheduled.</p>') +
      '<p class="m">Reminders are generated 24 hours before each visit. Nothing is actually sent in this demo.</p></div>';
  }
  function visitButtons(a, withCancel) {
    const l = " for " + a.patient + " " + a.time;
    if (a.status === "booked") return b("Check in", "checkin", a.id, { label: "Check in" + l }) + b("No-show", "noshow", a.id, { label: "No-show" + l }) + (withCancel ? b("Cancel", "cancel", a.id, { label: "Cancel" + l }) : "");
    if (a.status === "checked_in") return b("Call in", "callin", a.id, { label: "Call in" + l }) + b("Mark done", "done", a.id, { label: "Mark done" + l });
    if (a.status === "in_consult") return b("Mark done", "done", a.id, { label: "Mark done" + l });
    return "";
  }
  function reportCard() {
    const r = MC.report(st);
    return '<div class="c"><h2>Clinic report <span class="tag">Simulated</span></h2><div class="kpis">' +
      "<div><b>" + (r.avgWait == null ? "n/a" : r.avgWait + " min") + "</b><span>Average quoted wait</span></div>" +
      "<div><b>" + r.doubleBookings + "</b><span>Double bookings</span></div>" +
      "<div><b>" + r.blockedAttempts + "</b><span>Blocked double-booking attempts</span></div>" +
      "<div><b>" + (r.noShowRate == null ? "n/a" : r.noShowRate + "%") + "</b><span>No-show rate (" + r.closedVisits + " closed visits)</span></div></div>" +
      '<p class="m">Computed from appointments in this browser' + (r.includesSeed ? ", including 7 seeded sample visits" : "") + ". Not real clinic data.</p></div>";
  }
  function recView() {
    const cal = MC.calendar(st, ui.date);
    const head = '<tr><th scope="col">Time</th>' + cal.map(c => '<th scope="col">' + esc(c.doctor.name) + "</th>").join("") + "</tr>";
    const rows = MC.SLOTS.map((t, i) => '<tr><th scope="row">' + t + "</th>" + cal.map(c => {
      const x = c.slots[i].appt;
      return "<td>" + (x ? "<b>" + esc(x.patient) + "</b><br>" + badge(x.status) + (x.walkin ? ' <span class="tag">Walk-in</span>' : "") : '<span class="m">Open</span>') + "</td>";
    }).join("") + "</tr>").join("");
    const visits = st.appts.filter(a => a.date === ui.date && ["booked", "checked_in", "in_consult"].includes(a.status)).sort(byTime);
    return '<div class="c"><h2>Shared calendar</h2>' + dateChips(DATES) + '<div class="tw" style="margin-top:12px"><table class="cal"><caption class="sr">Appointments on ' + D(ui.date) + "</caption>" + head + rows + "</table></div></div>" +
      '<div class="c"><h2>Visits on ' + D(ui.date) + "</h2>" + (visits.length ? visits.map(a => '<div class="appt"><div><b>' + esc(a.patient) + "</b> · " + a.time + " · " + esc(dn(a.doctor)) + " " + badge(a.status) +
        (a.phone ? '<div class="m">Phone ' + esc(a.phone) + "</div>" : "") + '</div><div class="row">' + visitButtons(a, true) + "</div></div>").join("") : '<p class="m">No open visits.</p>') + "</div>" +
      '<div class="c"><h2>Add a walk-in</h2><p class="m">Takes the next free slot today for the chosen doctor.</p><label for="wd">Doctor</label><select id="wd">' +
      MC.DOCTORS.map(d => '<option value="' + d.id + '"' + (ui.walk.doc === d.id ? " selected" : "") + ">" + esc(d.name) + "</option>").join("") + "</select>" +
      '<label for="wn">Patient name</label><input id="wn" value="' + esc(ui.walk.name) + '"><label for="wp">Phone (optional, 10 digits)</label><input id="wp" inputmode="numeric" maxlength="10" value="' + esc(ui.walk.phone) + '">' +
      b("Add walk-in", "walk", null, { p: 1 }) + "</div>" + reportCard();
  }
  function docView() {
    const list = MC.dayList(st, ui.doc, ui.date);
    return '<div class="c"><h2>Doctor day list</h2>' + docChips() + '<div style="margin-top:12px">' + dateChips(DATES) + "</div></div>" +
      '<div class="c"><h2>' + esc(dn(ui.doc)) + " · " + D(ui.date) + "</h2>" + (list.length ? list.map(a => '<div class="appt"><div><b>' + a.time + "</b> · " + esc(a.patient) + " " + badge(a.status) +
        (a.status === "checked_in" ? '<div class="m">Waiting, expected wait ' + MC.waitFor(st, a).minutes + " min</div>" : "") + '</div><div class="row">' + visitButtons(a, false) + "</div></div>").join("") : '<p class="m">No visits on this day.</p>') + "</div>";
  }
  function view() {
    const roles = [["patient", "Patient"], ["reception", "Receptionist"], ["doctor", "Doctor"]];
    return '<div class="tabs" role="group" aria-label="Role">' + roles.map(r => b(r[1], "role", r[0], { on: ui.role === r[0] })).join("") + "</div>" +
      '<p class="note">Demo only. Data sits unencrypted in this browser\'s storage. The case study asks for encrypted, role-restricted patient data; here only the role-restricted views are built, not encryption.</p>' +
      (ui.err ? '<p class="banner err">' + esc(ui.err) + "</p>" : ui.msg ? '<p class="banner ok">' + esc(ui.msg) + "</p>" : "") +
      (ui.role === "patient" ? patientView() : ui.role === "reception" ? recView() : docView());
  }

  /* ---------- render with focus restore ---------- */
  function R() {
    const ae = document.activeElement; let key = null;
    if (ae && m.contains(ae)) key = ae.id ? "#" + ae.id : ae.dataset && ae.dataset.a ? '[data-a="' + ae.dataset.a + '"]' + (ae.dataset.v != null ? '[data-v="' + ae.dataset.v + '"]' : "") : null;
    m.innerHTML = view();
    const n = key && m.querySelector(key);
    if (n && !n.disabled) n.focus(); else if (key) m.focus({ preventScroll: true });
    live.textContent = "";
    const t = ui.err || ui.msg; if (t) setTimeout(() => { live.textContent = t; }, 50);
  }
  const clr = () => { ui.msg = ""; ui.err = ""; };
  function act(fn, okMsg, after) {
    const r = MC.commit(store, TODAY, fn); st = MC.load(store, TODAY); clr();
    if (r.ok) { ui.msg = okMsg(r); if (after) after(r); } else { ui.err = r.error; if (r.conflict) ui.sel = null; }
    R(); return r;
  }
  const own = v => mine(st.appts.find(a => a.id === v));

  const A = {
    role: v => { ui.role = v; ui.sel = null; ui.resched = null; clr(); R(); },
    doc: v => { ui.doc = v; ui.sel = null; clr(); R(); },
    date: v => { ui.date = v; ui.sel = null; clr(); R(); },
    slot: v => { ui.sel = v; clr(); R(); },
    saveid: () => {
      clr();
      if (!id.patient.trim()) ui.err = "Enter your name."; else if (!MC.isPhone(id.phone)) ui.err = "Enter a 10-digit phone number."; else { V("mc:id", id); ui.msg = "Details saved."; }
      R();
    },
    confirm: () => {
      if (!ui.sel) return;
      const to = { doctor: ui.doc, date: ui.date, time: ui.sel }, re = ui.resched;
      if (re && !own(re)) return;
      act(s => re ? MC.reschedule(s, re, to, TODAY) : MC.book(s, { doctor: to.doctor, date: to.date, time: to.time, patient: id.patient, phone: id.phone }, TODAY),
        r => (re ? "Moved to " : "Booked ") + dn(r.appt.doctor) + ", " + D(r.appt.date) + " at " + r.appt.time + ".", () => { ui.sel = null; ui.resched = null; });
    },
    resched: v => {
      const a = st.appts.find(x => x.id === v); if (!a || !own(v)) return;
      ui.resched = v; ui.doc = a.doctor; ui.date = DATES.includes(a.date) && a.date !== TODAY ? a.date : DATES[1]; ui.sel = null; clr(); R();
      const el = document.getElementById("book"); if (el) el.scrollIntoView({ block: "start" });
    },
    stopre: () => { ui.resched = null; ui.sel = null; clr(); R(); },
    cancel: v => { if (own(v)) act(s => MC.cancel(s, v), () => "Appointment cancelled. The slot is open again."); },
    checkin: v => { if (own(v)) act(s => MC.checkIn(s, v, Date.now()), r => "Checked in. Expected wait about " + r.wait.minutes + " min (" + r.wait.ahead + " ahead)."); },
    callin: v => act(s => MC.callIn(s, v), () => "Patient called in."),
    done: v => act(s => MC.markDone(s, v), () => "Visit marked done."),
    noshow: v => act(s => MC.markNoShow(s, v), () => "Marked as no-show."),
    walk: () => act(s => MC.walkIn(s, { doctor: ui.walk.doc, patient: ui.walk.name, phone: ui.walk.phone }, TODAY, Date.now()),
      r => "Walk-in added with " + dn(r.appt.doctor) + " at " + r.appt.time + ".", () => { ui.walk.name = ""; ui.walk.phone = ""; })
  };
  on(A);

  /* keep typed values without re-rendering on each key */
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "pn") id.patient = t.value;
    else if (t.id === "pp") { t.value = t.value.replace(/\D/g, ""); id.phone = t.value; }
    else if (t.id === "wd") ui.walk.doc = t.value;
    else if (t.id === "wn") ui.walk.name = t.value;
    else if (t.id === "wp") { t.value = t.value.replace(/\D/g, ""); ui.walk.phone = t.value; }
  });

  /* another tab changed the data: reload and warn if the chosen slot is gone */
  window.addEventListener("storage", e => {
    if (e.key !== MC.KEY && e.key !== null) return;
    st = MC.load(store, TODAY); clr();
    if (ui.sel && !MC.availableSlots(st, ui.doc, ui.date).includes(ui.sel)) { ui.sel = null; ui.err = "That slot was just taken in another tab. Choose another."; }
    else ui.msg = "Calendar updated from another tab.";
    R();
  });

  R();
})();
