/* QuickBite business rules. Pure functions, no DOM. Runs in the browser (window.QB) and in Node (node --test). */
(function (root, factory) {
  const q = factory();
  if (typeof module === "object" && module.exports) module.exports = q; else root.QB = q;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const SCHEMA = 2, SPEED_KMH = 24, KMS = SPEED_KMH / 3600, HANDOFF_S = 120, TRACK_REFRESH_S = 10;
  const FEE = 30, PREP = [10, 15, 20, 30], SPEEDS = [1, 6, 30], MAX_QTY = 9, NOTE_MAX = 140, ITEM_NOTE_MAX = 80;
  const STEPS = ["Placed", "Accepted", "Picked up", "On the way", "Delivered"];
  const HOME = { x: 8, y: 7, label: "Your home" };
  const RESTAURANTS = [
    { id: "spice", name: "Spice Route Kitchen", x: 2, y: 3, menu: [{ id: "wrap", name: "Paneer wrap", price: 180 }, { id: "biryani", name: "Veg biryani", price: 220 }, { id: "dal", name: "Dal tadka bowl", price: 160 }] },
    { id: "brew", name: "Brew & Bite", x: 5, y: 8, menu: [{ id: "coffee", name: "Cold coffee", price: 120 }, { id: "brownie", name: "Brownie", price: 90 }, { id: "sandwich", name: "Grilled sandwich", price: 140 }] },
    { id: "dosa", name: "Dosa Junction", x: 7, y: 2, menu: [{ id: "dosa", name: "Masala dosa", price: 110 }, { id: "idli", name: "Idli (3 pcs)", price: 80 }, { id: "filter", name: "Filter coffee", price: 50 }] }
  ];
  // Baselines and targets are assumptions from the case study (simulated), not measurements.
  const TARGETS = { otd: { base: 42, target: 35 }, acc: { base: 91, target: 97 }, cancel: { base: 8, target: 4 } };

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rest = id => RESTAURANTS.find(r => r.id === id);
  const clean = s => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  const find = (state, id) => state.orders.find(o => o.id === id);

  function newState() {
    return {
      v: SCHEMA, clock: 0, seq: 0, speed: 6, autopilot: true, lastWall: null, orders: [], notices: [],
      riders: [
        { id: "r1", name: "Arun", x: 3, y: 4, free: true, orderId: null },
        { id: "r2", name: "Bhavna", x: 6, y: 6, free: true, orderId: null },
        { id: "r3", name: "Chetan", x: 9, y: 9, free: true, orderId: null },
        { id: "r4", name: "Divya", x: 1, y: 8, free: true, orderId: null }
      ]
    };
  }
  function migrate(raw) {
    if (!raw || raw.v !== SCHEMA || !Array.isArray(raw.orders) || !Array.isArray(raw.riders) || !Array.isArray(raw.notices)) return newState();
    return raw;
  }

  /* FR1: place an order with item notes */
  function validateCart(rid, lines, note) {
    const R = rest(rid);
    if (!R) return { ok: false, error: "Choose a restaurant." };
    const items = [];
    for (const l of lines || []) {
      const m = R.menu.find(x => x.id === l.id);
      if (!m) return { ok: false, error: "That item is not on this menu." };
      const qty = Number(l.qty);
      if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) return { ok: false, error: `Quantity must be 0 to ${MAX_QTY}.` };
      if (qty === 0) continue;
      const n = clean(l.note);
      if (n.length > ITEM_NOTE_MAX) return { ok: false, error: `Item notes can be up to ${ITEM_NOTE_MAX} characters.` };
      items.push({ id: m.id, name: m.name, price: m.price, qty, note: n });
    }
    if (!items.length) return { ok: false, error: "Add at least one item." };
    const on = clean(note);
    if (on.length > NOTE_MAX) return { ok: false, error: `The order note can be up to ${NOTE_MAX} characters.` };
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    return { ok: true, items, subtotal, fee: FEE, total: subtotal + FEE, note: on };
  }
  function placeOrder(state, { rid, lines, note }) {
    const v = validateCart(rid, lines, note);
    if (!v.ok) return v;
    const o = { id: "QB-" + (101 + state.seq), rid, items: v.items, note: v.note, subtotal: v.subtotal, fee: v.fee, total: v.total, placedAt: state.clock, st: "Placed", dest: { x: HOME.x, y: HOME.y }, riderId: null };
    state.seq++; state.orders.push(o);
    return { ok: true, order: o };
  }

  /* Restaurant tablet */
  function queueFor(state, rid) {
    return state.orders.filter(o => o.rid === rid && o.st === "Placed").sort((a, b) => a.placedAt - b.placedAt)
      .map(o => ({ id: o.id, items: o.items.map(i => ({ name: i.name, qty: i.qty, note: i.note })), note: o.note, total: o.total, waitSec: state.clock - o.placedAt }));
  }
  /* AC2: ids of orders the tablet has not announced yet */
  const alertsFor = (state, rid, seen) => queueFor(state, rid).map(o => o.id).filter(id => !(seen && (seen.has ? seen.has(id) : seen.includes(id))));
  const inKitchen = (state, rid) => state.orders.filter(o => o.rid === rid && ["Accepted", "Picked up", "On the way"].includes(o.st));

  /* FR3: nearest available rider */
  function nearestFreeRider(riders, pt) {
    const free = riders.filter(r => r.free).map(r => ({ r, d: dist(r, pt) }));
    free.sort((a, b) => a.d - b.d || (a.r.id < b.r.id ? -1 : 1));
    return free.length ? free[0].r : null;
  }
  function assign(state, o) {
    const r = nearestFreeRider(state.riders, rest(o.rid));
    if (!r) return null;
    o.riderId = r.id; r.free = false; r.orderId = o.id;
    return r;
  }
  function dispatchWaiting(state) {
    state.orders.filter(o => o.st === "Accepted" && !o.riderId).sort((a, b) => a.acceptedAt - b.acceptedAt).forEach(o => assign(state, o));
  }
  /* FR2: accept and set prep time */
  function acceptOrder(state, id, prepMin) {
    const o = find(state, id);
    if (!o) return { ok: false, error: "Order not found." };
    if (o.st !== "Placed") return { ok: false, error: "This order is no longer waiting." };
    if (!PREP.includes(Number(prepMin))) return { ok: false, error: "Choose a prep time from the list." };
    o.st = "Accepted"; o.prepMin = Number(prepMin); o.acceptedAt = state.clock; o.readyAt = state.clock + o.prepMin * 60; o.atRestaurant = false; o.atDest = false;
    const rider = assign(state, o);
    return { ok: true, order: o, rider };
  }
  /* UA2: reject, notify the customer, refund (simulated) */
  function rejectOrder(state, id, reason) {
    const o = find(state, id);
    if (!o) return { ok: false, error: "Order not found." };
    if (o.st !== "Placed") return { ok: false, error: "Only a new order can be rejected." };
    o.st = "Cancelled"; o.cancelledAt = state.clock; o.cancelReason = clean(reason) || "Restaurant could not accept";
    o.refund = { amount: o.total, status: "Refunded (simulated)", at: state.clock };
    state.notices.push({ orderId: id, at: state.clock, text: `${id} was rejected by ${rest(o.rid).name} (${o.cancelReason}). ${o.total} refunded (simulated).` });
    if (state.notices.length > 50) state.notices.shift();
    return { ok: true, order: o };
  }

  /* Simulated clock and rider movement */
  function move(r, t, km) {
    const d = dist(r, t);
    if (d <= km) { r.x = t.x; r.y = t.y; return true; }
    r.x += (t.x - r.x) / d * km; r.y += (t.y - r.y) / d * km; return false;
  }
  function doPickup(state, o) { o.st = "Picked up"; o.pickedAt = state.clock; }
  function doDeliver(state, o) {
    o.st = "Delivered"; o.deliveredAt = state.clock;
    const r = state.riders.find(x => x.id === o.riderId);
    if (r) { r.free = true; r.orderId = null; }
    dispatchWaiting(state);
  }
  function advanceOrder(state, o, s) {
    const r = state.riders.find(x => x.id === o.riderId);
    if (!r) return;
    if (o.st === "Accepted") {
      if (!o.atRestaurant && move(r, rest(o.rid), KMS * s)) { o.atRestaurant = true; o.arrivedRestAt = state.clock; }
      if (o.atRestaurant && state.clock >= o.readyAt && state.autopilot) doPickup(state, o);
    }
    if (o.st === "Picked up") o.st = "On the way";
    if (o.st === "On the way") {
      if (!o.atDest && move(r, o.dest, KMS * s)) { o.atDest = true; o.arrivedDestAt = state.clock; }
      if (o.atDest && state.autopilot && state.clock - o.arrivedDestAt >= HANDOFF_S) doDeliver(state, o);
    }
  }
  function tick(state, dtSec) {
    let left = Math.max(0, Number(dtSec) || 0);
    while (left > 0) {
      const s = Math.min(1, left); left -= s; state.clock += s;
      state.orders.filter(o => ["Accepted", "Picked up", "On the way"].includes(o.st)).forEach(o => advanceOrder(state, o, s));
    }
    state.orders.forEach(o => {
      const r = state.riders.find(x => x.id === o.riderId);
      if (r && ["Accepted", "Picked up", "On the way"].includes(o.st)) o.track = { x: r.x, y: r.y, at: state.clock };
    });
  }
  /* NFR1: the wall clock drives the sim; the speed multiplier is shared by every tab. */
  function advanceWall(state, nowMs, maxWallMs) {
    if (state.lastWall == null || nowMs < state.lastWall) { state.lastWall = nowMs; return 0; }
    const w = Math.min(nowMs - state.lastWall, maxWallMs == null ? Infinity : maxWallMs);
    state.lastWall = nowMs;
    const dt = w / 1000 * state.speed;
    tick(state, dt);
    return dt;
  }
  function setSpeed(state, x) { if (!SPEEDS.includes(Number(x))) return false; state.speed = Number(x); return true; }

  /* Rider confirmations (used when autopilot is off) */
  function confirmPickup(state, id) {
    const o = find(state, id);
    if (!o || o.st !== "Accepted") return { ok: false, error: "No pickup to confirm." };
    if (!o.atRestaurant) return { ok: false, error: "You have not reached the restaurant yet." };
    if (state.clock < o.readyAt) return { ok: false, error: "The food is not ready yet." };
    doPickup(state, o); return { ok: true, order: o };
  }
  function confirmDelivery(state, id) {
    const o = find(state, id);
    if (!o || o.st !== "On the way") return { ok: false, error: "No delivery to confirm." };
    if (!o.atDest) return { ok: false, error: "You have not reached the customer yet." };
    doDeliver(state, o); return { ok: true, order: o };
  }
  function confirmAccuracy(state, id, correct) {
    const o = find(state, id);
    if (!o || o.st !== "Delivered") return { ok: false, error: "Only a delivered order can be confirmed." };
    o.accurate = !!correct; return { ok: true };
  }

  /* FR4 / AC1: honest arrival time = remaining prep, rider travel and handoff */
  function etaSeconds(state, o) {
    if (o.st === "Delivered" || o.st === "Cancelled") return 0;
    if (o.st === "Placed") return null;
    const R = rest(o.rid), r = state.riders.find(x => x.id === o.riderId), run = dist(R, o.dest) / KMS;
    if (o.st === "Accepted") {
      const prepLeft = Math.max(0, o.readyAt - state.clock);
      const toRest = r ? (o.atRestaurant ? 0 : dist(r, R) / KMS) : 0;
      return Math.max(prepLeft, toRest) + run + HANDOFF_S;
    }
    if (o.st === "Picked up") return dist(r, o.dest) / KMS + HANDOFF_S;
    return (o.atDest ? 0 : dist(r, o.dest) / KMS) + (o.atDest ? Math.max(0, HANDOFF_S - (state.clock - o.arrivedDestAt)) : HANDOFF_S);
  }
  function trackView(state, o) {
    const R = rest(o.rid), r = state.riders.find(x => x.id === o.riderId);
    const sec = etaSeconds(state, o), min = sec == null ? null : Math.ceil(sec / 60);
    let text;
    if (o.st === "Cancelled") text = "Cancelled";
    else if (o.st === "Delivered") text = "Delivered";
    else if (o.st === "Placed") text = "Waiting for the restaurant to confirm";
    else if (!r) text = `About ${min} min (waiting for a rider)`;
    else text = min <= 0 ? "Arriving now" : `Arriving in about ${min} min`;
    const target = o.st === "Accepted" ? R : o.dest;
    return {
      id: o.id, st: o.st, steps: STEPS, idx: STEPS.indexOf(o.st), cancelled: o.st === "Cancelled", etaSec: sec, etaMin: min, text,
      rider: r ? { id: r.id, name: r.name, x: r.x, y: r.y } : null, riderKm: r && target ? dist(r, target) : null,
      restaurant: R, dest: o.dest, refreshedAt: o.track ? o.track.at : null
    };
  }
  function riderTask(state, riderId) {
    const r = state.riders.find(x => x.id === riderId);
    const o = r && r.orderId ? find(state, r.orderId) : null;
    if (!o) return { idle: true };
    const R = rest(o.rid);
    let phase, d;
    if (o.st === "Accepted") { d = dist(r, R); phase = !o.atRestaurant ? "Heading to restaurant" : (state.clock >= o.readyAt ? "Food ready: confirm pickup" : "Waiting for the food"); }
    else { d = dist(r, o.dest); phase = o.atDest ? "At the customer: confirm delivery" : "Delivering"; }
    return { idle: false, order: o, restaurant: R, phase, distKm: d, canPickup: o.st === "Accepted" && !!o.atRestaurant && state.clock >= o.readyAt, canDeliver: o.st === "On the way" && !!o.atDest, readyInSec: Math.max(0, o.readyAt - state.clock) };
  }

  /* AC3 / UA3: KPIs from real in-app orders */
  const round1 = n => Math.round(n * 10) / 10;
  const against = (v, t, lower) => v == null ? "no data" : (lower ? v <= t : v >= t) ? "meets target" : "not at target yet";
  function kpis(orders) {
    const del = orders.filter(o => o.st === "Delivered"), can = orders.filter(o => o.st === "Cancelled");
    const conf = del.filter(o => typeof o.accurate === "boolean");
    const otd = del.length ? round1(del.reduce((s, o) => s + (o.deliveredAt - o.placedAt) / 60, 0) / del.length) : null;
    const acc = conf.length ? round1(conf.filter(o => o.accurate).length / conf.length * 100) : null;
    const cr = orders.length ? round1(can.length / orders.length * 100) : null;
    return {
      placed: orders.length, delivered: del.length, cancelled: can.length, sample: orders.filter(o => o.sample).length, confirmed: conf.length,
      avgOtdMin: otd, accuracyPct: acc, cancelRatePct: cr,
      status: { otd: against(otd, TARGETS.otd.target, true), acc: against(acc, TARGETS.acc.target, false), cancel: against(cr, TARGETS.cancel.target, true) }
    };
  }
  function removeSample(state) { state.orders = state.orders.filter(o => !o.sample); }
  /* A deterministic "day of orders" (simulated) so the dashboard can be shown with volume. */
  function addSampleDay(state, seed) {
    removeSample(state);
    let x = (seed == null ? 7 : seed) >>> 0 || 7;
    const rnd = () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296;
    const N = 24;
    for (let i = 0; i < N; i++) {
      const R = RESTAURANTS[i % RESTAURANTS.length], m = R.menu[i % R.menu.length], qty = 1 + (i % 2);
      const placedAt = state.clock - (N - i) * 900 - Math.floor(rnd() * 300);
      const o = { id: "S-" + String(i + 1).padStart(3, "0"), sample: true, rid: R.id, items: [{ id: m.id, name: m.name, price: m.price, qty, note: "" }], note: "", subtotal: m.price * qty, fee: FEE, total: m.price * qty + FEE, placedAt, dest: { x: HOME.x, y: HOME.y }, riderId: null };
      if (rnd() < 0.08) { o.st = "Cancelled"; o.cancelledAt = placedAt + 120; o.refund = { amount: o.total, status: "Refunded (simulated)", at: placedAt + 120 }; }
      else { o.st = "Delivered"; o.deliveredAt = placedAt + Math.round((28 + rnd() * 22) * 60); o.accurate = rnd() < 0.92; }
      state.orders.push(o);
    }
    return N;
  }
  function fmtClock(sec) {
    const t = (((11 * 3600 + Math.round(sec)) % 86400) + 86400) % 86400;
    return String(Math.floor(t / 3600)).padStart(2, "0") + ":" + String(Math.floor(t % 3600 / 60)).padStart(2, "0");
  }

  return { SCHEMA, SPEED_KMH, HANDOFF_S, TRACK_REFRESH_S, FEE, PREP, SPEEDS, MAX_QTY, NOTE_MAX, ITEM_NOTE_MAX, STEPS, HOME, RESTAURANTS, TARGETS,
    dist, rest, newState, migrate, validateCart, placeOrder, queueFor, alertsFor, inKitchen, nearestFreeRider, acceptOrder, rejectOrder, dispatchWaiting,
    tick, advanceWall, setSpeed, confirmPickup, confirmDelivery, confirmAccuracy, etaSeconds, trackView, riderTask, kpis, addSampleDay, removeSample, fmtClock };
});
