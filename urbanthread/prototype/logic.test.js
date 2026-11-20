const test = require("node:test");
const assert = require("node:assert/strict");
const UT = require("./logic.js");

const fresh = () => UT.newState();
const withBag = (s, id, size, qty = 1) => { const r = UT.addToBag(s.bag, s.stock, id, size, qty); assert.ok(r.ok, r.error); return { ...s, bag: r.bag }; };
const T0 = Date.UTC(2026, 10, 18, 9, 0, 0);

// ---- AC1 / UAT1: several filters together ----
test("AC1: size + price filters apply together and the count matches", () => {
  const s = fresh();
  const f = { ...UT.defaultFilters(), sizes: ["XL"], maxPrice: 2000 };
  const r = UT.filterProducts(UT.PRODUCTS, s.stock, f);
  assert.ok(r.length > 0);
  for (const p of r) { assert.ok(p.price <= 2000); assert.ok(UT.stockOf(s.stock, p.id, "XL") > 0); }
  const expected = UT.PRODUCTS.filter((p) => p.price <= 2000 && UT.stockOf(s.stock, p.id, "XL") > 0).length;
  assert.equal(r.length, expected);
});
test("UAT1: matching items only, nothing outside the filters", () => {
  const s = fresh();
  const r = UT.filterProducts(UT.PRODUCTS, s.stock, { ...UT.defaultFilters(), sizes: ["S", "M"], maxPrice: 1000, cat: "Tops" });
  for (const p of r) { assert.equal(p.cat, "Tops"); assert.ok(p.price <= 1000); }
  assert.ok(r.some((p) => p.name === "Oversized tee"));
  assert.ok(!r.some((p) => p.name === "Hoodie"));
});
test("FR1: clearing filters restores the full list; sort and search work", () => {
  const s = fresh();
  assert.equal(UT.filterProducts(UT.PRODUCTS, s.stock, UT.defaultFilters()).length, UT.PRODUCTS.length);
  const low = UT.filterProducts(UT.PRODUCTS, s.stock, { ...UT.defaultFilters(), sort: "low" });
  assert.deepEqual(low.map((p) => p.price), low.map((p) => p.price).slice().sort((a, b) => a - b));
  const q = UT.filterProducts(UT.PRODUCTS, s.stock, { ...UT.defaultFilters(), q: "denim" });
  assert.deepEqual(q.map((p) => p.name).sort(), ["Denim jacket", "Denim shorts"]);
  assert.equal(UT.activeFilterCount({ ...UT.defaultFilters(), sizes: ["S"], maxPrice: 1000 }), 2);
});
test("NFR: filtering the catalogue completes in well under 1 second", () => {
  const s = fresh(), t = process.hrtime.bigint();
  for (let i = 0; i < 1000; i++) UT.filterProducts(UT.PRODUCTS, s.stock, { ...UT.defaultFilters(), sizes: ["M"], maxPrice: 2500, q: "a" });
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  assert.ok(ms / 1000 < 1000, `1000 filters took ${ms}ms`);
});

// ---- FR2: wishlist without sign-in ----
test("FR2: wishlist toggles with no account and survives a save/restore", () => {
  let s = fresh();
  s.wishlist = UT.toggleWishlist(s.wishlist, 3);
  s.wishlist = UT.toggleWishlist(s.wishlist, 5);
  assert.deepEqual(s.wishlist, [3, 5]);
  s.wishlist = UT.toggleWishlist(s.wishlist, 3);
  assert.deepEqual(s.wishlist, [5]);
  assert.deepEqual(UT.restore(JSON.stringify(s)).wishlist, [5]);
});

// ---- Bag ----
test("Bag: add, merge, edit quantity, remove and stock limits", () => {
  let s = fresh();
  s = withBag(s, 1, "M"); s = withBag(s, 1, "M");
  assert.equal(UT.bagCount(s.bag), 2);
  assert.equal(UT.bagTotal(s.bag), 899 * 2);
  let r = UT.setQty(s.bag, s.stock, 1, "M", s.bag[0].colour, 5);
  assert.ok(r.ok); assert.equal(UT.bagCount(r.bag), 5);
  r = UT.setQty(s.bag, s.stock, 1, "M", s.bag[0].colour, 99);
  assert.ok(!r.ok); assert.match(r.error, /Only 8 left/);
  r = UT.setQty(s.bag, s.stock, 1, "M", s.bag[0].colour, 0);
  assert.equal(r.bag.length, 0);
});
test("Bag: sold-out size and missing size are refused with a clear message", () => {
  const s = fresh();
  assert.ok(UT.isSoldOut(UT.find(16), s.stock));
  let r = UT.addToBag(s.bag, s.stock, 2, "M", 1);
  assert.ok(!r.ok); assert.match(r.error, /sold out/);
  r = UT.addToBag(s.bag, s.stock, 2, "", 1);
  assert.ok(!r.ok); assert.match(r.error, /size/i);
});

// ---- AC2 / FR3 / UAT2: guest checkout ----
test("AC2: guest can pay with an email and address only (no account)", () => {
  const s = withBag(fresh(), 7, "L");
  const r = UT.placeOrder(s, { email: "riya@example.com", address: "12 MG Road, Bengaluru" }, T0);
  assert.ok(r.ok);
  assert.equal(r.order.email, "riya@example.com");
  assert.equal(r.state.bag.length, 0);
  assert.ok(!("password" in r.order));
});
test("UAT2: order is confirmed, stock drops, order id issued", () => {
  const s = withBag(withBag(fresh(), 7, "L"), 7, "L");
  const before = UT.stockOf(s.stock, 7, "L");
  const r = UT.placeOrder(s, { email: "a@b.co", address: "Flat 4, 12 MG Road" }, T0);
  assert.equal(UT.stockOf(r.state.stock, 7, "L"), before - 2);
  assert.match(r.order.id, /^UT-\d+$/);
  assert.equal(r.order.total, 1999 * 2);
  assert.equal(r.state.orders.length, 1);
});
test("FR3: invalid email, short address and empty bag are rejected", () => {
  const s = withBag(fresh(), 1, "M");
  let r = UT.placeOrder(s, { email: "nope", address: "short" }, T0);
  assert.ok(!r.ok); assert.ok(r.errors.email); assert.ok(r.errors.address);
  r = UT.placeOrder(fresh(), { email: "a@b.co", address: "12 MG Road, Bengaluru" }, T0);
  assert.ok(!r.ok); assert.match(r.reason, /empty/);
});
test("Checkout: a size that sold out after being bagged blocks the order", () => {
  const s = withBag(fresh(), 1, "XL", 2);
  s.stock[1].XL = 1;
  const r = UT.placeOrder(s, { email: "a@b.co", address: "12 MG Road, Bengaluru" }, T0);
  assert.ok(!r.ok); assert.match(r.reason, /sold out/);
});
test("FR3: address autofills from the last order", () => {
  const s = withBag(fresh(), 1, "M");
  const r = UT.placeOrder(s, { email: "riya@example.com", address: "12 MG Road, Bengaluru" }, T0);
  assert.deepEqual(UT.lastAddress(r.state), { email: "riya@example.com", address: "12 MG Road, Bengaluru" });
  assert.deepEqual(UT.lastAddress(fresh()), { email: "", address: "" });
});

// ---- AC3 / FR4 / UAT3: tracking ----
test("AC3: every status step shows its date and the steps run in order", () => {
  const order = { id: "UT-1001", placedAt: T0 };
  const steps = UT.trackingSteps(order, T0 + 60000 * 5, 60);
  assert.deepEqual(steps.map((s) => s.label), ["Placed", "Packed", "Shipped", "Out for delivery", "Delivered"]);
  for (const st of steps) assert.ok(Number.isFinite(st.at));
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i].at > steps[i - 1].at);
});
test("UAT3: status steps match the order age", () => {
  const order = { id: "UT-1001", placedAt: T0 };
  let st = UT.trackingSteps(order, T0, 60);
  assert.equal(st.filter((s) => s.done).length, 1);
  st = UT.trackingSteps(order, T0 + 60000, 60); // 60 simulated minutes
  assert.deepEqual(st.map((s) => s.done), [true, true, false, false, false]);
  assert.equal(st.find((s) => s.current).label, "Packed");
  st = UT.trackingSteps(order, T0 + 60000 * 40, 60);
  assert.ok(st.every((s) => s.done));
  assert.equal(st[4].current, true);
});

// ---- Persistence ----
test("Persistence: corrupt, old-schema and partial saves fall back safely", () => {
  assert.deepEqual(UT.restore("{not json"), UT.newState());
  assert.deepEqual(UT.restore(JSON.stringify({ v: 1, bag: [] })), UT.newState());
  assert.deepEqual(UT.restore(null), UT.newState());
  const s = fresh(); s.bag = [{ id: 1, size: "M", colour: "Black", qty: 2 }, { id: 999, size: "M", qty: 1 }, { id: 1, size: "ZZ", qty: 1 }];
  const r = UT.restore(JSON.stringify(s));
  assert.equal(r.bag.length, 1);
  assert.equal(UT.restore(JSON.stringify({ ...s, stock: { 1: { M: -4, S: "x" } } })).stock[1].M, UT.PRODUCTS[0].seed.M);
});
test("Persistence: a placed order survives a round trip", () => {
  const s = withBag(fresh(), 4, "S");
  const r = UT.placeOrder(s, { email: "a@b.co", address: "12 MG Road, Bengaluru" }, T0);
  const back = UT.restore(JSON.stringify(r.state));
  assert.equal(back.orders.length, 1);
  assert.equal(UT.stockOf(back.stock, 4, "S"), UT.stockOf(r.state.stock, 4, "S"));
});

// ---- KPIs ----
test("KPIs: computed from in-session events only", () => {
  const ev = [{ t: "session" }, { t: "filter_apply" }, { t: "filter_apply" }, { t: "checkout_start" }, { t: "checkout_start" }, { t: "order" }];
  const k = UT.kpis(ev);
  assert.equal(k.checkoutCompletion, 50);
  assert.equal(k.filtersPerSession, 2);
  assert.equal(UT.kpis([]).checkoutCompletion, null);
});

// ---- Data sanity ----
test("Catalogue: ids unique, prices positive, every product has colours", () => {
  const ids = new Set(UT.PRODUCTS.map((p) => p.id));
  assert.equal(ids.size, UT.PRODUCTS.length);
  for (const p of UT.PRODUCTS) { assert.ok(p.price > 0); assert.ok(p.colours.length > 0); }
});
