const test = require("node:test"), assert = require("node:assert/strict"), MC = require("./logic.js");
const TODAY = "2026-06-10", TOM = "2026-06-11";
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const B = (o = {}) => Object.assign({ doctor: "rao", date: TOM, time: "10:00", patient: "Lakshmi", phone: "9876543210" }, o);

test("AC1: booking an open slot removes it for other patients", () => {
  const s = MC.freshState(TODAY);
  assert.ok(MC.availableSlots(s, "rao", TOM).includes("10:00"));
  assert.equal(MC.book(s, B(), TODAY).ok, true);
  assert.ok(!MC.availableSlots(s, "rao", TOM).includes("10:00"));
  const r = MC.book(s, B({ patient: "Other", phone: "9123456780" }), TODAY);
  assert.equal(r.ok, false); assert.equal(r.conflict, true);
});
test("AC2: staff calendar shows the booking with the patient name", () => {
  const s = MC.freshState(TODAY); MC.book(s, B(), TODAY);
  const cell = MC.calendar(s, TOM).find(c => c.doctor.id === "rao").slots.find(x => x.time === "10:00");
  assert.equal(cell.appt.patient, "Lakshmi");
});
test("AC3: reminder is due 24 hours before the visit", () => {
  const s = MC.freshState(TODAY); const { appt } = MC.book(s, B(), TODAY);
  assert.equal(MC.slotMs(TOM, "10:00") - MC.reminderAt(appt), 24 * 3600 * 1000);
  const before = MC.reminders(s, "9876543210", MC.reminderAt(appt) - 1)[0];
  const after = MC.reminders(s, "9876543210", MC.reminderAt(appt))[0];
  assert.equal(before.state, "scheduled"); assert.match(after.state, /^due/);
});
test("AC4 / FR4: check-in shows wait time from queue and consult length", () => {
  const s = MC.freshState(TODAY);
  const a = MC.book(s, B({ time: "09:00" }), TODAY).appt, b = MC.book(s, B({ time: "10:00", patient: "B", phone: "9123456780" }), TODAY).appt;
  assert.equal(MC.checkIn(s, a.id, 1000).wait.minutes, 5);
  const w = MC.checkIn(s, b.id, 2000).wait;
  assert.equal(w.ahead, 1); assert.equal(w.minutes, 1 * MC.doctor("rao").avg + 5);
});
test("UAT1: two users book the same slot, second is blocked (also across stale tabs)", () => {
  const store = mem();
  const staleA = MC.load(store, TODAY), staleB = MC.load(store, TODAY); // both tabs show the slot as open
  assert.ok(MC.availableSlots(staleA, "rao", TOM).includes("10:00") && MC.availableSlots(staleB, "rao", TOM).includes("10:00"));
  const r1 = MC.commit(store, TODAY, s => MC.book(s, B(), TODAY));
  const r2 = MC.commit(store, TODAY, s => MC.book(s, B({ patient: "Second", phone: "9123456780" }), TODAY));
  assert.equal(r1.ok, true); assert.equal(r2.ok, false);
  const fin = MC.load(store, TODAY);
  assert.equal(MC.report(fin).doubleBookings, 0); assert.equal(fin.blocked, 1);
});
test("UAT2: rescheduling reopens the old slot", () => {
  const s = MC.freshState(TODAY); const a = MC.book(s, B(), TODAY).appt;
  assert.equal(MC.reschedule(s, a.id, { date: TOM, time: "11:00" }, TODAY).ok, true);
  assert.ok(MC.availableSlots(s, "rao", TOM).includes("10:00")); assert.ok(!MC.availableSlots(s, "rao", TOM).includes("11:00"));
});
test("reschedule into a taken slot is blocked and the original is kept", () => {
  const s = MC.freshState(TODAY); const a = MC.book(s, B(), TODAY).appt; MC.book(s, B({ time: "11:00", phone: "9123456780" }), TODAY);
  const r = MC.reschedule(s, a.id, { date: TOM, time: "11:00" }, TODAY);
  assert.equal(r.ok, false); assert.equal(a.time, "10:00");
});
test("UAT3: check-in shows wait time; cancel reopens the slot", () => {
  const s = MC.freshState(TODAY); const a = MC.book(s, B(), TODAY).appt;
  assert.equal(typeof MC.checkIn(s, a.id, 5).wait.minutes, "number");
  const c = MC.book(s, B({ time: "12:00" }), TODAY).appt; MC.cancel(s, c.id);
  assert.ok(MC.availableSlots(s, "rao", TOM).includes("12:00"));
});
test("validation: name, 10-digit phone, window, no same-day online booking", () => {
  const s = MC.freshState(TODAY);
  assert.equal(MC.book(s, B({ patient: " " }), TODAY).ok, false);
  assert.equal(MC.book(s, B({ phone: "12345" }), TODAY).ok, false);
  assert.equal(MC.book(s, B({ date: TODAY }), TODAY).ok, false);
  assert.equal(MC.book(s, B({ date: "2026-07-01" }), TODAY).ok, false);
  assert.equal(MC.book(s, B({ time: "13:00" }), TODAY).ok, false);
});
test("walk-in takes the next free slot today and is flagged", () => {
  const s = MC.freshState(TODAY); const now = new Date(TODAY + "T11:30:00").getTime();
  const r = MC.walkIn(s, { doctor: "iyer", patient: "Walk In" }, TODAY, now);
  assert.equal(r.ok, true); assert.equal(r.appt.time, "12:00"); assert.equal(r.appt.walkin, true);
});
test("call-in and mark done follow the visit order", () => {
  const s = MC.freshState(TODAY); const a = MC.book(s, B(), TODAY).appt;
  assert.equal(MC.callIn(s, a.id).ok, false); MC.checkIn(s, a.id, 1);
  assert.equal(MC.callIn(s, a.id).ok, true); assert.equal(MC.markDone(s, a.id).ok, true); assert.equal(a.status, "done");
});
test("doctor day list is ordered by time", () => {
  const s = MC.freshState(TODAY);
  MC.book(s, B({ time: "15:00" }), TODAY); MC.book(s, B({ time: "09:00", phone: "9123456780" }), TODAY); MC.book(s, B({ time: "12:00", phone: "9123456781" }), TODAY);
  assert.deepEqual(MC.dayList(s, "rao", TOM).map(a => a.time), ["09:00", "12:00", "15:00"]);
});
test("NFR: a patient sees only their own appointments", () => {
  const s = MC.freshState(TODAY); MC.book(s, B(), TODAY); MC.book(s, B({ time: "11:00", patient: "Other", phone: "9123456780" }), TODAY);
  const v = MC.patientView(s, "9876543210"); assert.equal(v.length, 1); assert.equal(v[0].patient, "Lakshmi");
});
test("NFR: booking flow is within 4 taps", () => { assert.ok(MC.BOOKING_FLOW.length <= 4); });
test("report: no-show rate and wait from in-app data, double bookings 0", () => {
  const s = MC.freshState(TODAY); const r = MC.report(s);
  assert.equal(r.noShowRate, Math.round(2 / 7 * 100)); assert.equal(r.doubleBookings, 0); assert.equal(r.includesSeed, true);
  const a = MC.book(s, B(), TODAY).appt; MC.checkIn(s, a.id, 1); assert.ok(MC.report(s).avgWait > 0);
});
test("persistence: versioned storage, bad or old data falls back to fresh state", () => {
  const store = mem(); store.setItem(MC.KEY, "{not json"); assert.equal(MC.load(store, TODAY).v, MC.VERSION);
  store.setItem(MC.KEY, JSON.stringify({ v: 1, appts: [] })); assert.equal(MC.load(store, TODAY).appts.length, 7);
  assert.equal(MC.KEY, "mc:v2");
});
