"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const QB = require("./logic.js");

const lines = (...a) => a.map(([id, qty, note]) => ({ id, qty, note }));
function order(state, rid = "spice", l, note = "") {
  l = l || lines([QB.rest(rid).menu[0].id, 1, ""]);
  const r = QB.placeOrder(state, { rid, lines: l, note });
  assert.ok(r.ok, r.error);
  return r.order;
}

/* FR1 */
test("FR1: an order keeps item notes and totals the cart with the delivery fee", () => {
  const s = QB.newState();
  const o = order(s, "spice", lines(["wrap", 2, "no onion"], ["dal", 1, ""]), "ring the bell");
  assert.equal(o.items[0].note, "no onion");
  assert.equal(o.subtotal, 180 * 2 + 160);
  assert.equal(o.total, o.subtotal + QB.FEE);
  assert.equal(o.note, "ring the bell");
  assert.equal(o.st, "Placed");
});
test("FR1: bad carts are refused with a clear message", () => {
  const s = QB.newState();
  assert.equal(QB.placeOrder(s, { rid: "spice", lines: [], note: "" }).ok, false);
  assert.equal(QB.placeOrder(s, { rid: "nope", lines: lines(["wrap", 1]) }).ok, false);
  assert.equal(QB.placeOrder(s, { rid: "spice", lines: lines(["coffee", 1]) }).ok, false, "item from another menu");
  assert.equal(QB.placeOrder(s, { rid: "spice", lines: lines(["wrap", 10]) }).ok, false, "quantity over the limit");
  assert.equal(QB.placeOrder(s, { rid: "spice", lines: lines(["wrap", 1, "x".repeat(81)]) }).ok, false, "item note too long");
  assert.equal(s.orders.length, 0, "refused orders are not stored");
});
test("FR1: control characters in notes are stripped", () => {
  const s = QB.newState();
  const o = order(s, "spice", lines(["wrap", 1, "a\u0007b\nc"]));
  assert.equal(o.items[0].note, "a b c");
});

/* FR2 */
test("FR2: accept sets prep time and ready time; invalid prep time is refused", () => {
  const s = QB.newState();
  const o = order(s);
  assert.equal(QB.acceptOrder(s, o.id, 7).ok, false);
  assert.equal(o.st, "Placed");
  const r = QB.acceptOrder(s, o.id, 15);
  assert.ok(r.ok);
  assert.equal(o.st, "Accepted");
  assert.equal(o.readyAt, s.clock + 15 * 60);
  assert.equal(QB.acceptOrder(s, o.id, 15).ok, false, "cannot accept twice");
});

/* FR3 */
test("FR3: the nearest free rider is assigned and busy riders are skipped", () => {
  const s = QB.newState();
  const o = order(s, "spice"); // spice is at (2,3); Arun (3,4) is nearest
  const res = QB.acceptOrder(s, o.id, 10);
  assert.equal(res.rider.id, "r1");
  assert.equal(o.riderId, "r1");
  assert.equal(s.riders[0].free, false);
  const o2 = order(s, "spice");
  assert.equal(QB.acceptOrder(s, o2.id, 10).rider.id, "r2", "Arun is busy, so Bhavna (5.0 km away) beats Divya (5.1 km)");
});
test("FR3: with no free rider the order waits and is dispatched when one frees up", () => {
  const s = QB.newState();
  s.riders.forEach(r => { r.free = false; });
  const o = order(s);
  const res = QB.acceptOrder(s, o.id, 10);
  assert.equal(res.rider, null);
  assert.equal(o.riderId, null);
  s.riders[1].free = true;
  QB.dispatchWaiting(s);
  assert.equal(o.riderId, "r2");
});
test("FR3: ties between equally distant riders resolve to the lower id", () => {
  const riders = [{ id: "b", x: 0, y: 1, free: true }, { id: "a", x: 1, y: 0, free: true }];
  assert.equal(QB.nearestFreeRider(riders, { x: 0, y: 0 }).id, "a");
  assert.equal(QB.nearestFreeRider([{ id: "z", x: 0, y: 0, free: false }], { x: 0, y: 0 }), null);
});

/* FR4 and AC1 */
test("AC1: with a rider assigned, tracking shows the map points and an arrival time that updates", () => {
  const s = QB.newState();
  const o = order(s, "dosa");
  QB.acceptOrder(s, o.id, 10);
  const v0 = QB.trackView(s, o);
  assert.ok(v0.rider, "rider is on the map");
  assert.ok(v0.restaurant && v0.dest);
  assert.match(v0.text, /Arriving in about \d+ min/);
  QB.tick(s, 600); // prep is done and the rider has reached the restaurant
  const v1 = QB.trackView(s, o);
  assert.ok(v1.rider.x !== v0.rider.x || v1.rider.y !== v0.rider.y, "rider position changed");
  QB.tick(s, 300);
  const v2 = QB.trackView(s, o);
  assert.ok(v2.etaSec < v1.etaSec, "arrival time counts down once the food is on its way");
});
test("FR4: the arrival time is honest: it never drops below remaining prep plus the run to the customer", () => {
  const s = QB.newState();
  const o = order(s, "spice");
  QB.acceptOrder(s, o.id, 30);
  const run = QB.dist(QB.rest("spice"), o.dest) / (QB.SPEED_KMH / 3600);
  assert.ok(QB.etaSeconds(s, o) >= 30 * 60 + run + QB.HANDOFF_S - 1);
  QB.tick(s, 10 * 60);
  assert.ok(QB.etaSeconds(s, o) >= 20 * 60 + run + QB.HANDOFF_S - 1, "prep time still counts after 10 minutes");
});
test("FR4: a new order has no arrival time until the restaurant accepts", () => {
  const s = QB.newState();
  const o = order(s);
  assert.equal(QB.etaSeconds(s, o), null);
  assert.equal(QB.trackView(s, o).text, "Waiting for the restaurant to confirm");
});
test("FR4: an order moves through every step and the rider is freed on delivery", () => {
  const s = QB.newState();
  const o = order(s, "brew");
  QB.acceptOrder(s, o.id, 10);
  const seen = new Set([o.st]);
  for (let i = 0; i < 400 && o.st !== "Delivered"; i++) { QB.tick(s, 10); seen.add(o.st); }
  assert.equal(o.st, "Delivered");
  ["Accepted", "On the way", "Delivered"].forEach(x => assert.ok(seen.has(x), x));
  assert.equal(s.riders.find(r => r.id === o.riderId).free, true);
  assert.equal(QB.trackView(s, o).text, "Delivered");
});
test("FR4: with autopilot off the rider must confirm pickup and delivery", () => {
  const s = QB.newState(); s.autopilot = false;
  const o = order(s, "brew");
  QB.acceptOrder(s, o.id, 10);
  assert.equal(QB.confirmPickup(s, o.id).ok, false, "not at the restaurant");
  QB.tick(s, 1200);
  assert.equal(o.st, "Accepted", "waits for the rider");
  assert.ok(QB.riderTask(s, o.riderId).canPickup);
  assert.ok(QB.confirmPickup(s, o.id).ok);
  assert.equal(QB.confirmDelivery(s, o.id).ok, false, "not at the customer");
  QB.tick(s, 2400);
  assert.equal(o.st, "On the way");
  assert.ok(QB.riderTask(s, o.riderId).canDeliver);
  assert.ok(QB.confirmDelivery(s, o.id).ok);
  assert.equal(o.st, "Delivered");
});

/* AC2 and UA1 */
test("AC2: a new order raises an alert and shows its items on the restaurant tablet", () => {
  const s = QB.newState();
  const o = order(s, "spice", lines(["biryani", 1, "extra spicy"]));
  const seen = new Set();
  assert.deepEqual(QB.alertsFor(s, "spice", seen), [o.id]);
  const q = QB.queueFor(s, "spice");
  assert.equal(q.length, 1);
  assert.equal(q[0].items[0].name, "Veg biryani");
  seen.add(o.id);
  assert.deepEqual(QB.alertsFor(s, "spice", seen), [], "already announced");
  assert.deepEqual(QB.alertsFor(s, "brew", new Set()), [], "other restaurants are unaffected");
});
test("UA1: the note on an item is visible to the restaurant", () => {
  const s = QB.newState();
  order(s, "dosa", lines(["dosa", 2, "less oil"]), "gate code 4");
  const q = QB.queueFor(s, "dosa")[0];
  assert.equal(q.items[0].note, "less oil");
  assert.equal(q.note, "gate code 4");
});
test("AC2: the queue is oldest first and leaves the queue once accepted", () => {
  const s = QB.newState();
  const a = order(s, "spice"); s.clock += 60; const b = order(s, "spice");
  assert.deepEqual(QB.queueFor(s, "spice").map(x => x.id), [a.id, b.id]);
  QB.acceptOrder(s, a.id, 10);
  assert.deepEqual(QB.queueFor(s, "spice").map(x => x.id), [b.id]);
  assert.equal(QB.inKitchen(s, "spice").length, 1);
});

/* UA2 */
test("UA2: rejecting an order notifies the customer and records a refund", () => {
  const s = QB.newState();
  const o = order(s, "spice");
  const r = QB.rejectOrder(s, o.id, "Out of paneer");
  assert.ok(r.ok);
  assert.equal(o.st, "Cancelled");
  assert.equal(o.refund.amount, o.total);
  assert.match(o.refund.status, /simulated/);
  assert.equal(s.notices.length, 1);
  assert.match(s.notices[0].text, /rejected/);
  assert.match(s.notices[0].text, /Out of paneer/);
  assert.equal(QB.trackView(s, o).cancelled, true);
  assert.equal(QB.queueFor(s, "spice").length, 0);
});
test("UA2: only a new order can be rejected, and an accepted one cannot", () => {
  const s = QB.newState();
  const o = order(s);
  QB.acceptOrder(s, o.id, 10);
  assert.equal(QB.rejectOrder(s, o.id, "x").ok, false);
  assert.equal(QB.rejectOrder(s, "QB-999", "x").ok, false);
});
test("UA2: a rejected order cannot be accepted afterwards", () => {
  const s = QB.newState();
  const o = order(s);
  QB.rejectOrder(s, o.id, "");
  assert.equal(o.cancelReason, "Restaurant could not accept");
  assert.equal(QB.acceptOrder(s, o.id, 10).ok, false);
});

/* AC3 and UA3 */
test("AC3/UA3: the dashboard shows average order-to-door time from real orders", () => {
  const s = QB.newState();
  const a = order(s, "brew"), b = order(s, "brew");
  a.st = "Delivered"; a.deliveredAt = a.placedAt + 30 * 60;
  b.st = "Delivered"; b.deliveredAt = b.placedAt + 40 * 60;
  const k = QB.kpis(s.orders);
  assert.equal(k.avgOtdMin, 35);
  assert.equal(k.delivered, 2);
  assert.equal(k.status.otd, "meets target");
});
test("AC3: accuracy only counts orders the customer confirmed; cancel rate counts all orders", () => {
  const s = QB.newState();
  const a = order(s), b = order(s), c = order(s), d = order(s);
  [a, b, c].forEach(o => { o.st = "Delivered"; o.deliveredAt = o.placedAt + 1800; });
  QB.rejectOrder(s, d.id, "");
  QB.confirmAccuracy(s, a.id, true); QB.confirmAccuracy(s, b.id, false);
  const k = QB.kpis(s.orders);
  assert.equal(k.confirmed, 2);
  assert.equal(k.accuracyPct, 50);
  assert.equal(k.cancelRatePct, 25);
  assert.equal(QB.confirmAccuracy(s, d.id, true).ok, false, "cancelled orders are not rated");
});
test("AC3: with no orders the dashboard reports no data instead of zeros", () => {
  const k = QB.kpis([]);
  assert.equal(k.avgOtdMin, null);
  assert.equal(k.accuracyPct, null);
  assert.equal(k.cancelRatePct, null);
  assert.equal(k.status.otd, "no data");
});
test("AC3: the sample day is deterministic, flagged as sample and replaceable", () => {
  const a = QB.newState(), b = QB.newState();
  QB.addSampleDay(a, 7); QB.addSampleDay(b, 7);
  assert.deepEqual(QB.kpis(a.orders), QB.kpis(b.orders));
  assert.equal(QB.kpis(a.orders).sample, 24);
  QB.addSampleDay(a, 7);
  assert.equal(a.orders.length, 24, "adding again replaces, not stacks");
  QB.removeSample(a);
  assert.equal(a.orders.length, 0);
});

/* NFR1: tracking location refreshes every 10 seconds */
test("NFR1: the refresh interval is 10 seconds", () => {
  assert.equal(QB.TRACK_REFRESH_S, 10);
});
test("NFR1: the wall clock drives the simulation at the chosen speed and a long gap is capped", () => {
  const s = QB.newState(); s.speed = 6;
  assert.equal(QB.advanceWall(s, 1000), 0, "first call only records the time");
  assert.equal(QB.advanceWall(s, 11000), 60, "10 s of wall time at 6x is 60 sim seconds");
  assert.equal(s.clock, 60);
  assert.equal(QB.advanceWall(s, 3600000, 30000), 180, "a sleeping tab is capped at 30 s of wall time");
  assert.equal(QB.advanceWall(s, 100), 0, "time going backwards is ignored");
});
test("NFR1: only the listed speeds are accepted", () => {
  const s = QB.newState();
  assert.ok(QB.setSpeed(s, 30)); assert.equal(s.speed, 30);
  assert.equal(QB.setSpeed(s, 5), false); assert.equal(s.speed, 30);
});
test("NFR1: the tracked location is stamped on every tick", () => {
  const s = QB.newState();
  const o = order(s, "dosa");
  QB.acceptOrder(s, o.id, 10);
  QB.tick(s, 10);
  assert.equal(o.track.at, s.clock);
  const before = { x: o.track.x, y: o.track.y };
  QB.tick(s, 10);
  assert.notDeepEqual({ x: o.track.x, y: o.track.y }, before);
});

/* Persistence */
test("migrate: bad or old saved data falls back to a fresh state", () => {
  assert.equal(QB.migrate(null).v, QB.SCHEMA);
  assert.equal(QB.migrate({ v: 1, orders: [] }).orders.length, 0);
  assert.equal(QB.migrate({ v: 2, orders: "x", riders: [], notices: [] }).orders.length, 0);
  const good = QB.newState(); good.seq = 5;
  assert.equal(QB.migrate(good).seq, 5);
});
test("fmtClock wraps at midnight and never goes negative", () => {
  assert.equal(QB.fmtClock(0), "11:00");
  assert.equal(QB.fmtClock(13 * 3600), "00:00");
  assert.match(QB.fmtClock(-5000), /^\d\d:\d\d$/);
});
