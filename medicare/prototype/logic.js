/* MediCare Plus: pure business rules. No DOM access. UMD: window.MC in browser, module.exports in node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MC = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const KEY = "mc:v2", VERSION = 2;
  const SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];
  const DOCTORS = [
    { id: "rao", name: "Dr. Rao", avg: 12 },
    { id: "iyer", name: "Dr. Iyer", avg: 10 },
    { id: "khan", name: "Dr. Khan", avg: 15 }
  ];
  const ACTIVE = ["booked", "checked_in", "in_consult", "done"]; // statuses that occupy a slot
  const WAITING = ["checked_in", "in_consult"];
  const BOOKING_FLOW = ["Choose doctor", "Choose slot", "Confirm booking"]; // taps once the patient is signed in

  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const addDays = (dateStr, n) => { const d = new Date(dateStr + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const dateList = today => [0, 1, 2, 3].map(n => addDays(today, n));
  const slotMs = (date, time) => new Date(date + "T" + time + ":00").getTime();
  const doctor = id => DOCTORS.find(d => d.id === id);
  const isPhone = p => /^\d{10}$/.test(String(p || "").trim());

  function freshState(today) {
    const s = { v: VERSION, seq: 0, blocked: 0, appts: [] };
    // Seeded sample history so the report is not empty. Marked seed:true and labelled simulated in the UI.
    const seed = [
      ["rao", "09:00", "done", "Seed Patient A", 9], ["rao", "10:00", "done", "Seed Patient B", 14],
      ["rao", "11:00", "no_show", "Seed Patient C", 0], ["iyer", "09:00", "done", "Seed Patient D", 6],
      ["iyer", "10:00", "done", "Seed Patient E", 11], ["khan", "09:00", "no_show", "Seed Patient F", 0],
      ["khan", "10:00", "done", "Seed Patient G", 20]
    ];
    seed.forEach(x => {
      s.seq++;
      s.appts.push({ id: "a" + s.seq, doctor: x[0], date: today, time: x[1], patient: x[3], phone: "9000000" + pad(s.seq) + "0",
        status: x[2], walkin: false, seed: true, waitQuoted: x[2] === "done" ? x[4] : null, checkedAt: null });
    });
    return s;
  }
  function migrate(raw, today) {
    if (!raw || typeof raw !== "object" || raw.v !== VERSION || !Array.isArray(raw.appts)) return freshState(today);
    return raw;
  }
  function load(storage, today) {
    let raw = null;
    try { raw = JSON.parse(storage.getItem(KEY)); } catch (e) { raw = null; }
    return migrate(raw, today);
  }
  function save(storage, state) { try { storage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ } }
  /* Re-check at commit: always re-reads the latest stored state, applies the change, writes back.
     A second tab holding a stale view therefore cannot overwrite the first tab's booking. */
  function commit(storage, today, fn) {
    const s = load(storage, today);
    const r = fn(s);
    save(storage, s);
    return r;
  }

  const taken = (s, d, date, time, ignoreId) => s.appts.some(a => a.id !== ignoreId && a.doctor === d && a.date === date && a.time === time && ACTIVE.includes(a.status));
  function availableSlots(s, d, date) { return SLOTS.filter(t => !taken(s, d, date, t)); }
  function validateSlot(d, date, time, today, allowToday) {
    if (!doctor(d)) return "Choose a doctor.";
    if (!SLOTS.includes(time)) return "Choose a slot.";
    if (!dateList(today).includes(date)) return "Choose a date in the next 3 days.";
    if (date === today && !allowToday) return "Online booking starts from tomorrow.";
    return "";
  }
  function book(s, a, today) {
    const patient = String(a.patient || "").trim();
    if (!patient) return { ok: false, error: "Enter a patient name." };
    if (!isPhone(a.phone)) return { ok: false, error: "Enter a 10-digit phone number." };
    const bad = validateSlot(a.doctor, a.date, a.time, today, false);
    if (bad) return { ok: false, error: bad };
    if (taken(s, a.doctor, a.date, a.time)) { s.blocked++; return { ok: false, error: "That slot was just taken. Choose another.", conflict: true }; }
    const appt = { id: "a" + (++s.seq), doctor: a.doctor, date: a.date, time: a.time, patient, phone: String(a.phone).trim(),
      status: "booked", walkin: false, seed: false, waitQuoted: null, checkedAt: null };
    s.appts.push(appt);
    return { ok: true, appt };
  }
  function reschedule(s, id, to, today) {
    const a = s.appts.find(x => x.id === id);
    if (!a || a.status !== "booked") return { ok: false, error: "Only a booked appointment can be rescheduled." };
    const bad = validateSlot(to.doctor || a.doctor, to.date, to.time, today, false);
    if (bad) return { ok: false, error: bad };
    if (taken(s, to.doctor || a.doctor, to.date, to.time, id)) { s.blocked++; return { ok: false, error: "That slot was just taken. Choose another.", conflict: true }; }
    a.doctor = to.doctor || a.doctor; a.date = to.date; a.time = to.time; // old slot reopens because occupancy is derived
    return { ok: true, appt: a };
  }
  function cancel(s, id) {
    const a = s.appts.find(x => x.id === id);
    if (!a || a.status !== "booked") return { ok: false, error: "Only a booked appointment can be cancelled." };
    a.status = "cancelled";
    return { ok: true, appt: a };
  }
  function walkIn(s, a, today, nowMs) {
    const patient = String(a.patient || "").trim();
    if (!patient) return { ok: false, error: "Enter a patient name." };
    if (a.phone && !isPhone(a.phone)) return { ok: false, error: "Phone must be 10 digits or left empty." };
    const now = new Date(nowMs), hhmm = pad(now.getHours()) + ":" + pad(now.getMinutes());
    const t = availableSlots(s, a.doctor, today).find(x => x >= hhmm) || availableSlots(s, a.doctor, today)[0];
    if (!t) return { ok: false, error: "No free slot today for this doctor." };
    const appt = { id: "a" + (++s.seq), doctor: a.doctor, date: today, time: t, patient, phone: String(a.phone || "").trim(),
      status: "booked", walkin: true, seed: false, waitQuoted: null, checkedAt: null };
    s.appts.push(appt);
    return { ok: true, appt };
  }

  /* Reminders: derived from booked appointments, due 24 hours before the slot. Nothing is actually sent. */
  const reminderAt = a => slotMs(a.date, a.time) - 24 * 3600 * 1000;
  function reminders(s, phone, nowMs) {
    return s.appts.filter(a => a.status === "booked" && a.phone === phone).sort((x, y) => slotMs(x.date, x.time) - slotMs(y.date, y.time))
      .map(a => ({ apptId: a.id, at: reminderAt(a), state: nowMs >= reminderAt(a) ? "due, simulated send" : "scheduled" }));
  }

  /* Queue and wait time */
  function waitFor(s, a) {
    const d = doctor(a.doctor), ahead = s.appts.filter(x => x.id !== a.id && x.doctor === a.doctor && x.date === a.date &&
      WAITING.includes(x.status) && (x.checkedAt || 0) <= (a.checkedAt || Infinity)).length;
    return { ahead, minutes: ahead * d.avg + 5 };
  }
  function checkIn(s, id, nowMs) {
    const a = s.appts.find(x => x.id === id);
    if (!a || a.status !== "booked") return { ok: false, error: "Only a booked appointment can be checked in." };
    a.status = "checked_in"; a.checkedAt = nowMs;
    const w = waitFor(s, a); a.waitQuoted = w.minutes;
    return { ok: true, appt: a, wait: w };
  }
  function callIn(s, id) {
    const a = s.appts.find(x => x.id === id);
    if (!a || a.status !== "checked_in") return { ok: false, error: "Patient is not waiting." };
    a.status = "in_consult"; return { ok: true, appt: a };
  }
  function markDone(s, id) {
    const a = s.appts.find(x => x.id === id);
    if (!a || !["checked_in", "in_consult"].includes(a.status)) return { ok: false, error: "Visit has not started." };
    a.status = "done"; return { ok: true, appt: a };
  }
  function markNoShow(s, id) {
    const a = s.appts.find(x => x.id === id);
    if (!a || a.status !== "booked") return { ok: false, error: "Only a booked appointment can be a no-show." };
    a.status = "no_show"; return { ok: true, appt: a };
  }

  /* Role-restricted views */
  const byTime = (x, y) => slotMs(x.date, x.time) - slotMs(y.date, y.time);
  const patientView = (s, phone) => s.appts.filter(a => a.phone && a.phone === phone && a.status !== "cancelled").sort(byTime);
  const dayList = (s, d, date) => s.appts.filter(a => a.doctor === d && a.date === date && ACTIVE.concat(["no_show"]).includes(a.status)).sort(byTime);
  const calendar = (s, date) => DOCTORS.map(d => ({ doctor: d, slots: SLOTS.map(t => ({ time: t, appt: s.appts.find(a => a.doctor === d.id && a.date === date && a.time === t && ACTIVE.concat(["no_show"]).includes(a.status)) || null })) }));

  function report(s) {
    const quoted = s.appts.filter(a => a.waitQuoted != null).map(a => a.waitQuoted);
    const keys = s.appts.filter(a => ACTIVE.includes(a.status)).map(a => a.doctor + "|" + a.date + "|" + a.time);
    const doubleBookings = keys.length - new Set(keys).size;
    const closed = s.appts.filter(a => a.status === "done" || a.status === "no_show");
    const noShows = closed.filter(a => a.status === "no_show").length;
    return {
      avgWait: quoted.length ? Math.round(quoted.reduce((p, c) => p + c, 0) / quoted.length) : null,
      doubleBookings, blockedAttempts: s.blocked,
      noShowRate: closed.length ? Math.round(noShows / closed.length * 100) : null,
      closedVisits: closed.length, includesSeed: s.appts.some(a => a.seed)
    };
  }
  return { KEY, VERSION, SLOTS, DOCTORS, BOOKING_FLOW, freshState, migrate, load, save, commit, dateList, addDays, iso, slotMs, doctor, isPhone,
    availableSlots, book, reschedule, cancel, walkIn, reminders, reminderAt, waitFor, checkIn, callIn, markDone, markNoShow,
    patientView, dayList, calendar, report };
});
