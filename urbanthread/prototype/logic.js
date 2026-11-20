/* UrbanThread business rules. Pure functions, no DOM. Runs in the browser (window.UT) and in Node (tests). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.UT = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const SCHEMA = 2, KEY = "ut:v2", ANY = 99999, DEMO_SPEED = 60;
  const SIZES = ["S", "M", "L", "XL"], CATS = ["All", "Tops", "Bottoms", "Outerwear"];
  const COLOURS = { Black: "#22232e", White: "#f1f1f4", Sand: "#d9c7a3", Olive: "#6b7048", Navy: "#243a6b", Grey: "#9aa0ad", Indigo: "#3b4a8c", Rust: "#b4572f" };
  const RAW = [
    ["Oversized tee", "Tops", 899, ["Black", "White", "Sand"], [6, 8, 5, 2]],
    ["Graphic tee", "Tops", 799, ["White", "Black"], [4, 0, 3, 0]],
    ["Boxy polo", "Tops", 1199, ["Olive", "Sand"], [2, 5, 5, 3]],
    ["Ribbed tank", "Tops", 649, ["Black", "Grey"], [5, 5, 0, 0]],
    ["Hoodie", "Tops", 1599, ["Grey", "Navy", "Black"], [3, 6, 6, 4]],
    ["Cargo pants", "Bottoms", 1799, ["Olive", "Black"], [0, 4, 5, 3]],
    ["Slim jeans", "Bottoms", 1999, ["Indigo", "Black"], [4, 6, 5, 2]],
    ["Track pants", "Bottoms", 1299, ["Black", "Grey"], [0, 5, 7, 6]],
    ["Wide-leg chinos", "Bottoms", 1699, ["Sand", "Navy"], [3, 4, 4, 0]],
    ["Denim shorts", "Bottoms", 1099, ["Indigo"], [5, 5, 2, 0]],
    ["Denim jacket", "Outerwear", 2999, ["Indigo", "Black"], [2, 3, 2, 0]],
    ["Bomber jacket", "Outerwear", 3499, ["Olive", "Black"], [0, 3, 0, 0]],
    ["Coach jacket", "Outerwear", 2499, ["Navy", "Rust"], [3, 4, 4, 2]],
    ["Puffer vest", "Outerwear", 2799, ["Black", "Rust"], [1, 2, 2, 1]],
    ["Overshirt", "Outerwear", 2199, ["Sand", "Olive"], [4, 5, 3, 2]],
    ["Varsity jacket", "Outerwear", 3999, ["Navy"], [0, 0, 0, 0]],
  ];
  const PRODUCTS = RAW.map((r, i) => ({ id: i + 1, name: r[0], cat: r[1], price: r[2], colours: r[3], seed: Object.fromEntries(SIZES.map((s, k) => [s, r[4][k]])) }));
  // Steps with offsets in simulated minutes from order time.
  const STEPS = [["Placed", 0], ["Packed", 30], ["Shipped", 240], ["Out for delivery", 1440], ["Delivered", 1800]];

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const find = (id) => PRODUCTS.find((p) => p.id === Number(id));
  const stockOf = (stock, id, size) => ((stock || {})[id] || {})[size] || 0;
  const seedStock = () => Object.fromEntries(PRODUCTS.map((p) => [p.id, { ...p.seed }]));
  const newState = () => ({ v: SCHEMA, stock: seedStock(), wishlist: [], bag: [], orders: [], lastAddress: null });

  /** Load a saved state. Any corrupt or old-version value falls back to a fresh state. */
  function restore(raw) {
    try {
      const s = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!s || typeof s !== "object" || s.v !== SCHEMA) return newState();
      if (!Array.isArray(s.wishlist) || !Array.isArray(s.bag) || !Array.isArray(s.orders) || typeof s.stock !== "object" || !s.stock) return newState();
      const out = newState();
      out.wishlist = s.wishlist.filter((id) => find(id));
      out.bag = s.bag.filter((b) => b && find(b.id) && SIZES.includes(b.size) && b.qty > 0);
      out.orders = s.orders.filter((o) => o && o.id && Array.isArray(o.items) && typeof o.placedAt === "number");
      for (const p of PRODUCTS) for (const sz of SIZES) { const n = stockOf(s.stock, p.id, sz); if (Number.isInteger(n) && n >= 0) out.stock[p.id][sz] = n; }
      if (s.lastAddress && typeof s.lastAddress.email === "string" && typeof s.lastAddress.address === "string") out.lastAddress = s.lastAddress;
      return out;
    } catch (e) { return newState(); }
  }

  const availableSizes = (p, stock) => SIZES.filter((s) => stockOf(stock, p.id, s) > 0);
  const isSoldOut = (p, stock) => availableSizes(p, stock).length === 0;
  const defaultFilters = () => ({ q: "", sizes: [], maxPrice: ANY, cat: "All", sort: "featured" });
  const activeFilterCount = (f) => f.sizes.length + (f.maxPrice < ANY ? 1 : 0) + (f.cat !== "All" ? 1 : 0) + (f.sort !== "featured" ? 1 : 0);

  /** FR1: several filters applied together; only matching items are returned. */
  function filterProducts(products, stock, f) {
    const q = (f.q || "").trim().toLowerCase();
    let r = products.filter((p) => {
      if (f.cat && f.cat !== "All" && p.cat !== f.cat) return false;
      if (p.price > (f.maxPrice == null ? ANY : f.maxPrice)) return false;
      if (f.sizes && f.sizes.length && !f.sizes.some((s) => stockOf(stock, p.id, s) > 0)) return false;
      if (q && !(p.name + " " + p.cat + " " + p.colours.join(" ")).toLowerCase().includes(q)) return false;
      return true;
    });
    if (f.sort === "low") r = r.slice().sort((a, b) => a.price - b.price);
    else if (f.sort === "high") r = r.slice().sort((a, b) => b.price - a.price);
    else if (f.sort === "name") r = r.slice().sort((a, b) => a.name.localeCompare(b.name));
    return r;
  }

  /** FR2: wishlist works with no account. */
  const toggleWishlist = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const qtyInBag = (bag, id, size) => bag.filter((b) => b.id === id && b.size === size).reduce((n, b) => n + b.qty, 0);
  function addToBag(bag, stock, id, size, qty = 1, colour) {
    const p = find(id);
    if (!p) return { ok: false, bag, error: "Product not found." };
    if (!size) return { ok: false, bag, error: "Choose a size first." };
    const have = stockOf(stock, id, size), inBag = qtyInBag(bag, id, size);
    if (have === 0) return { ok: false, bag, error: `${p.name} in ${size} is sold out.` };
    if (inBag + qty > have) return { ok: false, bag, error: `Only ${have} left in size ${size}${inBag ? ` (${inBag} already in your bag)` : ""}.` };
    const col = colour || p.colours[0], nb = clone(bag), line = nb.find((b) => b.id === id && b.size === size && b.colour === col);
    if (line) line.qty += qty; else nb.push({ id, size, colour: col, qty });
    return { ok: true, bag: nb, error: "" };
  }
  function setQty(bag, stock, id, size, colour, qty) {
    if (qty <= 0) return { ok: true, bag: bag.filter((b) => !(b.id === id && b.size === size && b.colour === colour)), error: "" };
    const others = qtyInBag(bag, id, size) - (bag.find((b) => b.id === id && b.size === size && b.colour === colour) || { qty: 0 }).qty;
    const have = stockOf(stock, id, size);
    if (others + qty > have) return { ok: false, bag, error: `Only ${have} left in size ${size}.` };
    return { ok: true, bag: bag.map((b) => (b.id === id && b.size === size && b.colour === colour ? { ...b, qty } : b)), error: "" };
  }
  const bagCount = (bag) => bag.reduce((n, b) => n + b.qty, 0);
  const bagTotal = (bag) => bag.reduce((s, b) => s + find(b.id).price * b.qty, 0);

  /** FR3: guest checkout needs an email and a delivery address, never an account or password. */
  function validateCheckout(form) {
    const e = {}, email = String((form && form.email) || "").trim(), address = String((form && form.address) || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email, for example name@example.com.";
    if (address.length < 8) e.address = "Enter your full delivery address (at least 8 characters).";
    return e;
  }
  const lastAddress = (state) => state.lastAddress || (state.orders.length ? { email: state.orders[0].email, address: state.orders[0].address } : { email: "", address: "" });

  /** Places the order, decrements stock, clears the bag, remembers the address. Returns a new state. */
  function placeOrder(state, form, now) {
    const errors = validateCheckout(form);
    if (!state.bag.length) return { ok: false, errors, reason: "Your bag is empty." };
    if (errors.email || errors.address) return { ok: false, errors, reason: "Check the highlighted fields." };
    const ns = clone(state);
    for (const b of ns.bag) {
      const need = qtyInBag(ns.bag, b.id, b.size);
      if (need > stockOf(state.stock, b.id, b.size)) return { ok: false, errors: {}, reason: `${find(b.id).name} (${b.size}) just sold out. Update your bag.` };
    }
    const items = ns.bag.map((b) => ({ id: b.id, name: find(b.id).name, size: b.size, colour: b.colour, qty: b.qty, price: find(b.id).price }));
    for (const b of ns.bag) ns.stock[b.id][b.size] -= b.qty;
    const email = form.email.trim(), address = form.address.trim();
    const order = { id: "UT-" + (1001 + state.orders.length), email, address, items, count: bagCount(ns.bag), total: bagTotal(ns.bag), placedAt: now };
    ns.orders.unshift(order);
    ns.bag = [];
    ns.lastAddress = { email, address };
    return { ok: true, state: ns, order, errors: {}, reason: "" };
  }

  /** FR4: every status step carries a date. Progress advances with time since the order (simulated clock: 1 real minute = 1 simulated hour). */
  function trackingSteps(order, now, speed = DEMO_SPEED) {
    const elapsed = Math.max(0, ((now - order.placedAt) / 60000) * speed);
    let current = -1;
    const steps = STEPS.map(([label, off], i) => {
      const done = elapsed >= off;
      if (done) current = i;
      return { label, offsetMin: off, at: order.placedAt + off * 60000, done, current: false };
    });
    if (current >= 0) steps[current].current = true;
    return steps;
  }

  /** KPIs derived from in-session events (simulated demo, not business data). */
  function kpis(events) {
    const n = (t) => events.filter((e) => e.t === t).length;
    const sessions = Math.max(1, n("session")), starts = n("checkout_start"), orders = n("order");
    return { checkoutCompletion: starts ? Math.round((orders / starts) * 100) : null, filtersPerSession: +(n("filter_apply") / sessions).toFixed(1), starts, orders };
  }

  return { SCHEMA, KEY, ANY, DEMO_SPEED, SIZES, CATS, COLOURS, PRODUCTS, STEPS, find, stockOf, seedStock, newState, restore, availableSizes, isSoldOut, defaultFilters, activeFilterCount, filterProducts, toggleWishlist, qtyInBag, addToBag, setQty, bagCount, bagTotal, validateCheckout, lastAddress, placeOrder, trackingSteps, kpis };
});
