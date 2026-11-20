/* UrbanThread UI. State lives in localStorage under 'ut:v2'. Business rules are in logic.js. */
(function () {
  "use strict";
  const U = window.UT, EKEY = "ut:v2:events";
  let st = U.restore(S(U.KEY, null));
  let events = S(EKEY, []);
  if (!Array.isArray(events)) events = [];
  let view = "shop", pid = null, filters = U.defaultFilters(), draft = U.defaultFilters(), sheet = false;
  let step = 0, form = U.lastAddress(st), errs = {}, msg = null, lastOrderId = null, pick = { size: "", colour: "" };

  const save = () => V(U.KEY, st);
  const log = (t) => { events.push({ t, at: Date.now() }); if (events.length > 500) events = events.slice(-500); V(EKEY, events); };
  const say = (t) => { const l = $("#live"); if (l) l.textContent = t; };
  const toast = (t, bad) => { msg = { t, bad: !!bad }; say(t); };
  log("session");

  const NAV = [["shop", "Shop"], ["wish", "Wishlist"], ["bag", "Bag"], ["track", "Orders"], ["kpi", "Demo KPIs"]];
  const swatch = (p, i = 0) => U.COLOURS[p.colours[i]] || "#ccc";
  const dark = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) < 120; };

  function nav() {
    const count = { wish: st.wishlist.length, bag: U.bagCount(st.bag) };
    $("#nav").innerHTML = NAV.map(([k, l]) => `<button data-a="go" data-v="${k}" class="${view === k || (view === "product" && k === "shop") ? "on" : ""}" ${view === k ? 'aria-current="page"' : ""}>${l}${count[k] ? `<span class="badge" aria-label="${count[k]} items">${count[k]}</span>` : ""}</button>`).join("");
  }
  const toastHtml = () => { if (!msg) return ""; const h = `<div class="toast${msg.bad ? " bad" : ""}" role="${msg.bad ? "alert" : "status"}">${esc(msg.t)}</div>`; msg = null; return h; };

  function card(p) {
    const out = U.isSoldOut(p, st.stock), liked = st.wishlist.includes(p.id), bg = swatch(p);
    return `<article class="c pc${out ? " so" : ""}"><div class="sw" style="background:${bg}">${out ? "" : `<span>${p.colours.length} colour${p.colours.length > 1 ? "s" : ""}</span>`}</div>
<button class="t" data-a="open" data-v="${p.id}" aria-label="Open ${esc(p.name)}">${esc(p.name)}</button>
<div class="m">${p.cat} · ${inr(p.price)}</div>${out ? '<span class="tagso">Sold out</span>' : `<div class="m">Sizes: ${U.availableSizes(p, st.stock).join(", ")}</div>`}
<div class="row"><button data-a="open" data-v="${p.id}" class="p">View</button><button data-a="heart" data-v="${p.id}" aria-pressed="${liked}" aria-label="${liked ? "Remove" : "Add"} ${esc(p.name)} ${liked ? "from" : "to"} wishlist">${liked ? "♥" : "♡"}</button></div></article>`;
  }
  function results() {
    const L = U.filterProducts(U.PRODUCTS, st.stock, filters);
    return { n: L.length, html: L.length ? L.map(card).join("") : '<p class="c">No items match these filters. Try clearing one.</p>' };
  }
  function renderResults() {
    const r = results(), g = $("#results"), c = $("#count");
    if (g) g.innerHTML = r.html;
    if (c) c.textContent = `${r.n} item${r.n === 1 ? "" : "s"}`;
    const f = $("#fbtn"); if (f) f.textContent = "Filters" + (U.activeFilterCount(filters) ? ` (${U.activeFilterCount(filters)})` : "");
  }
  function sheetHtml() {
    const n = U.filterProducts(U.PRODUCTS, st.stock, draft).length;
    const chip = (l, a, v, on) => `<button data-a="${a}" data-v="${v}" aria-pressed="${!!on}" class="${on ? "on" : ""}">${l}</button>`;
    return `<section class="c sheet" aria-label="Filters"><h2>Filters</h2>
<h3>Size</h3><div class="chips">${U.SIZES.map((s) => chip(s, "dsz", s, draft.sizes.includes(s))).join("")}</div>
<h3>Category</h3><div class="chips">${U.CATS.map((c) => chip(c, "dcat", c, draft.cat === c)).join("")}</div>
<h3>Price</h3><div class="chips">${[[1000, "Up to ₹1,000"], [2000, "Up to ₹2,000"], [4000, "Up to ₹4,000"], [U.ANY, "Any"]].map((x) => chip(x[1], "dmx", x[0], draft.maxPrice === x[0])).join("")}</div>
<h3>Sort</h3><div class="chips">${[["featured", "Featured"], ["low", "Price: low to high"], ["high", "Price: high to low"], ["name", "Name"]].map((x) => chip(x[1], "dsort", x[0], draft.sort === x[0])).join("")}</div>
<p class="m" aria-live="polite">Show ${n} item${n === 1 ? "" : "s"}</p>
<div class="row"><button class="p" data-a="apply">Apply</button><button data-a="clearf">Clear all</button><button data-a="closef">Close</button></div></section>`;
  }

  function shop() {
    const r = results();
    return `${toastHtml()}<div class="bar"><label class="sr" for="q">Search</label><input id="q" type="search" placeholder="Search tees, jackets, colours" value="${esc(filters.q)}" autocomplete="off">
<button id="fbtn" data-a="sheet" aria-expanded="${sheet}">Filters${U.activeFilterCount(filters) ? ` (${U.activeFilterCount(filters)})` : ""}</button><span class="m" id="count" aria-live="polite">${r.n} item${r.n === 1 ? "" : "s"}</span></div>
${sheet ? sheetHtml() : ""}<div class="g" id="results">${r.html}</div>`;
  }
  function wish() {
    const L = U.PRODUCTS.filter((p) => st.wishlist.includes(p.id));
    return `${toastHtml()}<h2>Wishlist</h2><p class="m">Saved on this device. No account needed.</p>${L.length ? `<div class="g">${L.map(card).join("")}</div>` : "<p>Nothing saved yet. Tap ♡ on any item.</p>"}`;
  }
  function product() {
    const p = U.find(pid); if (!p) return shop();
    const colour = pick.colour || p.colours[0], liked = st.wishlist.includes(p.id);
    const sizes = U.SIZES.map((s) => { const n = U.stockOf(st.stock, p.id, s); return `<button data-a="psz" data-v="${s}" ${n === 0 ? "disabled" : ""} aria-pressed="${pick.size === s}" class="${pick.size === s ? "on" : ""}" aria-label="Size ${s}${n === 0 ? ", sold out" : n <= 2 ? `, only ${n} left` : ""}">${s}</button>`; }).join("");
    const col = U.COLOURS[colour];
    return `${toastHtml()}<button data-a="go" data-v="shop">← Back to shop</button>
<div class="detail" style="margin-top:12px"><div class="hero" style="background:${col}"><span style="${dark(col) ? "" : ""}">${esc(colour)}</span></div>
<div><h2>${esc(p.name)}</h2><p class="m">${p.cat} · ${inr(p.price)}</p>
<h3>Colour</h3><div class="chips">${p.colours.map((c) => `<button data-a="pcol" data-v="${c}" aria-pressed="${colour === c}" class="${colour === c ? "on" : ""}"><span class="dot" style="background:${U.COLOURS[c]}"></span>${c}</button>`).join("")}</div>
<h3>Size</h3><div class="chips" role="group" aria-label="Size">${sizes}</div>
${U.isSoldOut(p, st.stock) ? '<p class="err">This item is sold out in every size.</p>' : ""}
<div class="row"><button class="p" data-a="addbag" data-v="${p.id}" ${U.isSoldOut(p, st.stock) ? "disabled" : ""}>Add to bag</button><button data-a="heart" data-v="${p.id}" aria-pressed="${liked}">${liked ? "♥ Saved" : "♡ Save"}</button></div></div></div>`;
  }
  function bag() {
    if (step === 4) {
      const o = st.orders.find((x) => x.id === lastOrderId);
      return `<div class="c"><h2 class="ok">Order confirmed</h2>${o ? `<p>Order <b>${o.id}</b> · ${o.count} item(s) · ${inr(o.total)}</p><p class="m">Confirmation would be emailed to ${esc(o.email)}. Demo only: no email is sent and no payment is taken.</p>` : ""}<div class="row"><button class="p" data-a="go" data-v="track">Track order</button><button data-a="go" data-v="shop">Keep shopping</button></div></div>`;
    }
    if (!st.bag.length) return `${toastHtml()}<h2>Bag</h2><p>Your bag is empty.</p><button class="p" data-a="go" data-v="shop">Browse the shop</button>`;
    const total = U.bagTotal(st.bag);
    const lines = st.bag.map((b) => { const p = U.find(b.id); return `<div class="line"><div><b>${esc(p.name)}</b><div class="m">${b.colour} · size ${b.size} · ${inr(p.price)}</div></div>
<div class="qty" role="group" aria-label="Quantity for ${esc(p.name)}"><button data-a="qdec" data-v="${b.id}|${b.size}|${b.colour}" aria-label="Decrease quantity">−</button><b aria-live="polite">${b.qty}</b><button data-a="qinc" data-v="${b.id}|${b.size}|${b.colour}" aria-label="Increase quantity">+</button><button data-a="qdel" data-v="${b.id}|${b.size}|${b.colour}">Remove</button></div></div>`; }).join("");
    const bar = step > 0 ? `<div class="stepper" aria-label="Checkout progress">${["Review", "Details", "Pay"].map((s, i) => `<span class="${i + 1 === step ? "a" : ""}" ${i + 1 === step ? 'aria-current="step"' : ""}>${i + 1}. ${s}</span>`).join("")}</div>` : "";
    let body = "";
    if (step === 0) body = `<p><b>Total ${inr(total)}</b></p><button class="p" data-a="start">Checkout as guest</button>`;
    if (step === 1) body = `<p><b>Total ${inr(total)}</b></p><p class="m">No account needed.</p><div class="row"><button class="p" data-a="next">Continue as guest</button><button data-a="back">Back to bag</button></div>`;
    if (step === 2) body = `<form id="f" novalidate><label for="em">Email</label><input id="em" name="email" type="email" autocomplete="email" value="${esc(form.email)}" aria-invalid="${!!errs.email}" aria-describedby="eem">${errs.email ? `<div class="fe" id="eem" role="alert">${esc(errs.email)}</div>` : '<div id="eem"></div>'}
<label for="ad">Delivery address</label><textarea id="ad" name="address" rows="3" autocomplete="street-address" aria-invalid="${!!errs.address}" aria-describedby="ead">${esc(form.address)}</textarea>${errs.address ? `<div class="fe" id="ead" role="alert">${esc(errs.address)}</div>` : '<div id="ead"></div>'}
${st.lastAddress ? '<p class="m">Filled in from your last order. Edit if needed.</p>' : ""}<div class="row"><button class="p" type="submit" data-a="next">Continue</button><button type="button" data-a="back">Back</button></div></form>`;
    if (step === 3) body = `<p>Deliver to <b>${esc(form.email)}</b><br>${esc(form.address)}</p><p><b>Total ${inr(total)}</b></p><p class="note">Pay on delivery (demo). No payment is taken and nothing is sent.</p><div class="row"><button class="p" data-a="pay">Place order</button><button data-a="back">Back</button></div>`;
    return `${toastHtml()}<h2>Bag</h2><div class="c">${lines}</div><div class="c">${bar}${body}</div>`;
  }
  function track() {
    if (!st.orders.length) return "<h2>Orders</h2><p>No orders yet.</p>";
    const fmt = (t) => new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return `<h2>Orders</h2><p class="note">Demo clock: one real minute equals one simulated hour, so statuses advance while you watch. Status steps are simulated.</p>` + st.orders.map((o) => {
      const steps = U.trackingSteps(o, Date.now());
      return `<section class="c" aria-label="Order ${o.id}"><h3>${o.id}</h3><p class="m">${o.count} item(s) · ${inr(o.total)} · placed ${fmt(o.placedAt)}</p><ol class="steps">${steps.map((s) => `<li class="${s.done ? "d" : ""} ${s.current ? "cur" : ""}"><span aria-hidden="true">${s.done ? "✔" : "○"}</span><div>${s.label}${s.current ? " (current)" : ""}<div class="when">${s.done ? "" : "Expected "}${fmt(s.at)}</div></div></li>`).join("")}</ol></section>`;
    }).join("");
  }
  function kpi() {
    const k = U.kpis(events);
    return `<h2>Demo KPIs</h2><p class="note">Simulated. These count what you did in this browser only. They are not business results.</p><div class="kv"><div><b>${k.checkoutCompletion == null ? "n/a" : k.checkoutCompletion + "%"}</b>Checkout completion (${k.orders} of ${k.starts} started)</div><div><b>${k.filtersPerSession}</b>Filters applied per session</div><div><b>${st.orders.length}</b>Orders placed</div></div><p class="m" style="margin-top:12px">Project targets (assumptions): completion 52% to 65%, filters per session 1.1 to 2.</p>`;
  }

  function render(focus) {
    nav();
    const html = { shop, wish, product, bag, track, kpi }[view]();
    $("#m").innerHTML = html;
    if (focus) { const m = $("#m"); m.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    const q = $("#q"); if (q) q.addEventListener("input", () => { filters.q = q.value; renderResults(); say(`${U.filterProducts(U.PRODUCTS, st.stock, filters).length} items`); });
    const f = $("#f"); if (f) f.addEventListener("submit", (e) => { e.preventDefault(); A.next(); });
    const fe = $("#em"), fa = $("#ad");
    if (fe) fe.addEventListener("input", () => { form.email = fe.value; });
    if (fa) fa.addEventListener("input", () => { form.address = fa.value; });
  }
  const go = (v, focus = true) => { view = v; if (v !== "bag") { if (step !== 4) step = 0; } msg = msg; render(focus); };

  const key = (v) => { const [id, size, colour] = v.split("|"); return [Number(id), size, colour]; };
  const A = {
    go: (v) => { if (v === "bag" && step === 4) step = 0; go(v); },
    open: (v) => { pid = Number(v); pick = { size: "", colour: "" }; view = "product"; render(true); },
    heart: (v) => { const id = Number(v); st.wishlist = U.toggleWishlist(st.wishlist, id); save(); toast(`${U.find(id).name} ${st.wishlist.includes(id) ? "saved to" : "removed from"} wishlist.`); const keep = view; render(false); view = keep; },
    sheet: () => { sheet = !sheet; draft = { ...filters, sizes: [...filters.sizes] }; render(false); },
    closef: () => { sheet = false; render(false); },
    dsz: (v) => { draft.sizes = draft.sizes.includes(v) ? draft.sizes.filter((x) => x !== v) : [...draft.sizes, v]; render(false); },
    dcat: (v) => { draft.cat = v; render(false); }, dmx: (v) => { draft.maxPrice = Number(v); render(false); }, dsort: (v) => { draft.sort = v; render(false); },
    apply: () => { filters = { ...draft, q: filters.q, sizes: [...draft.sizes] }; sheet = false; log("filter_apply"); render(false); say(`${U.filterProducts(U.PRODUCTS, st.stock, filters).length} items shown`); },
    clearf: () => { filters = U.defaultFilters(); draft = U.defaultFilters(); sheet = false; render(false); },
    psz: (v) => { pick.size = v; render(false); }, pcol: (v) => { pick.colour = v; render(false); },
    addbag: (v) => { const r = U.addToBag(st.bag, st.stock, Number(v), pick.size, 1, pick.colour || U.find(v).colours[0]); if (r.ok) { st.bag = r.bag; save(); toast(`${U.find(v).name} (${pick.size}) added to bag.`); } else toast(r.error, true); render(false); },
    qinc: (v) => { const [id, s, c] = key(v), cur = st.bag.find((b) => b.id === id && b.size === s && b.colour === c); const r = U.setQty(st.bag, st.stock, id, s, c, cur.qty + 1); if (r.ok) { st.bag = r.bag; save(); } else toast(r.error, true); render(false); },
    qdec: (v) => { const [id, s, c] = key(v), cur = st.bag.find((b) => b.id === id && b.size === s && b.colour === c); st.bag = U.setQty(st.bag, st.stock, id, s, c, cur.qty - 1).bag; if (!st.bag.length) step = 0; save(); render(false); },
    qdel: (v) => { const [id, s, c] = key(v); st.bag = U.setQty(st.bag, st.stock, id, s, c, 0).bag; if (!st.bag.length) step = 0; save(); render(false); },
    start: () => { step = 1; log("checkout_start"); render(false); },
    back: () => { step = Math.max(0, step - 1); errs = {}; render(false); },
    next: () => {
      if (step === 2) { const e = $("#em"), a = $("#ad"); if (e) form.email = e.value; if (a) form.address = a.value; errs = U.validateCheckout(form); if (errs.email || errs.address) { say("Check the highlighted fields."); render(false); const first = errs.email ? $("#em") : $("#ad"); if (first) first.focus(); return; } }
      step++; render(false);
    },
    pay: () => {
      const r = U.placeOrder(st, form, Date.now());
      if (!r.ok) { toast(r.reason, true); step = 0; errs = r.errors || {}; render(false); return; }
      st = r.state; save(); log("order"); lastOrderId = r.order.id; step = 4; say(`Order ${r.order.id} confirmed.`); render(true);
    },
  };
  on(A);
  // Keep the shared "Reset demo data" button honest: it clears all localStorage then reloads, so nothing else to do.
  setInterval(() => { if (view === "track") { const y = window.scrollY; $("#m").innerHTML = track(); window.scrollTo(0, y); } }, 5000);
  window.addEventListener("storage", (e) => { if (e.key === U.KEY) { st = U.restore(S(U.KEY, null)); render(false); } });
  render(false);
})();
