/* QuickBite UI. Business rules live in logic.js (window.QB). Shared helpers ($, S, V, esc, inr, on) come from ../../shared/app.js. */
(() => {
  "use strict";
  const KEY = "qb:v2", ROLES = [["customer", "Customer"], ["restaurant", "Restaurant"], ["rider", "Rider"], ["manager", "Manager"]];
  const TICK_MS = Number(new URLSearchParams(location.search).get("tick")) || window.QB_TICK_MS || QB.TRACK_REFRESH_S * 1000;
  const load = () => QB.migrate(S(KEY, null));
  const save = () => V(KEY, st);
  let st = load();
  let role = "customer";
  try { role = sessionStorage.getItem("qb:role") || "customer"; } catch (e) { /* private mode */ }
  const ui = { rid: "spice", cart: {}, note: "", err: "", track: null, restId: "spice", riderId: "r1", flash: {}, sound: false, banner: "" };
  const seen = new Set(); let primedFor = null, ac = null;
  const live = msg => { const l = $("#live"); if (l) { l.textContent = ""; setTimeout(() => { l.textContent = msg; }, 30); } };
  const act = fn => { st = load(); const r = fn(); save(); render(); return r; };
  const mine = () => st.orders.filter(o => !o.sample).slice().reverse();
  const stamp = s => QB.fmtClock(s);

  /* ---------- small helpers ---------- */
  function beep() {
    if (!ui.sound || !ac) return;
    try {
      [0, 0.25].forEach(t => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.15;
        o.connect(g); g.connect(ac.destination);
        o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.15);
      });
    } catch (e) { /* audio unavailable */ }
  }
  function mapSvg(v) {
    const X = n => Math.round(n * 30 + 15), grid = [];
    for (let i = 0; i < 10; i++) grid.push(`<line x1="${X(i)}" y1="5" x2="${X(i)}" y2="295"/><line x1="5" y1="${X(i)}" x2="295" y2="${X(i)}"/>`);
    const rider = v.rider ? `<g><circle cx="${X(v.rider.x)}" cy="${X(v.rider.y)}" r="9" fill="#e8590c" stroke="#fff" stroke-width="2"/><text x="${X(v.rider.x)}" y="${X(v.rider.y) - 13}" text-anchor="middle" font-size="11" font-weight="700">${esc(v.rider.name)}</text></g>` : "";
    return `<svg class="map" viewBox="0 0 300 300" role="img" aria-label="Map. Restaurant ${esc(v.restaurant.name)}${v.rider ? ", rider " + esc(v.rider.name) + " is " + (v.riderKm == null ? "" : v.riderKm.toFixed(1) + " km away") : ""}, your home."><rect width="300" height="300" rx="10" fill="#eef0fb"/><g stroke="#d3d7ee" stroke-width="1">${grid.join("")}</g>
      <rect x="${X(v.restaurant.x) - 9}" y="${X(v.restaurant.y) - 9}" width="18" height="18" rx="3" fill="#4b4bff"/><text x="${X(v.restaurant.x)}" y="${X(v.restaurant.y) + 24}" text-anchor="middle" font-size="11">${esc(v.restaurant.name)}</text>
      <path d="M${X(v.dest.x)} ${X(v.dest.y) - 11} l11 11 h-4 v9 h-14 v-9 h-4 z" fill="#14633a"/><text x="${X(v.dest.x)}" y="${X(v.dest.y) + 24}" text-anchor="middle" font-size="11">Home</text>${rider}</svg>`;
  }

  /* ---------- views ---------- */
  function customerView() {
    let h = "";
    const msgs = st.notices.slice(-3).reverse();
    if (msgs.length) h += `<div class="c" role="status"><h2>Messages</h2>${msgs.map(m => `<p class="err">${esc(m.text)}</p>`).join("")}</div>`;
    const o = ui.track ? st.orders.find(x => x.id === ui.track) : null;
    if (o) return h + trackingView(o);
    const R = QB.rest(ui.rid);
    h += `<div class="c"><h2>Choose a restaurant</h2><div class="row">${QB.RESTAURANTS.map(r => `<button data-a="rest" data-v="${r.id}" class="${r.id === ui.rid ? "on" : ""}" aria-pressed="${r.id === ui.rid}">${esc(r.name)}</button>`).join("")}</div></div>`;
    h += `<div class="c"><h2>${esc(R.name)}</h2>${R.menu.map(m => {
      const l = ui.cart[m.id] || { qty: 0, note: "" };
      return `<div class="item"><div class="row between"><b>${esc(m.name)}</b><span>${inr(m.price)}</span></div>
        <div class="row"><button data-a="qty" data-v="${m.id}|-1" aria-label="Remove one ${esc(m.name)}" ${l.qty ? "" : "disabled"}>−</button><output aria-label="Quantity of ${esc(m.name)}" class="qty">${l.qty}</output><button data-a="qty" data-v="${m.id}|1" aria-label="Add one ${esc(m.name)}" ${l.qty >= QB.MAX_QTY ? "disabled" : ""}>+</button></div>
        ${l.qty ? `<label class="m">Note for the kitchen<input data-note="${m.id}" maxlength="${QB.ITEM_NOTE_MAX}" value="${esc(l.note)}" placeholder="For example: no onion"></label>` : ""}</div>`;
    }).join("")}
      <label>Note for the whole order<textarea id="onote" rows="2" maxlength="${QB.NOTE_MAX}" placeholder="Gate code, landmark">${esc(ui.note)}</textarea></label>`;
    const v = QB.validateCart(ui.rid, Object.entries(ui.cart).map(([id, l]) => ({ id, qty: l.qty, note: l.note })), ui.note);
    h += v.ok ? `<p><b>Items ${inr(v.subtotal)}</b> + delivery ${inr(v.fee)} = <b>${inr(v.total)}</b></p>` : `<p class="m">Add an item to see your total.</p>`;
    h += `<p class="err" role="alert">${esc(ui.err)}</p><button class="p" data-a="place">Place order (pay on delivery, demo)</button></div>`;
    const list = mine();
    h += `<div class="c"><h2>My orders</h2>${list.length ? list.map(x => `<div class="row between item"><span><b>${x.id}</b> · ${esc(QB.rest(x.rid).name)} · ${inr(x.total)}<br><span class="m">${x.st}</span></span><button data-a="track" data-v="${x.id}">Track</button></div>`).join("") : `<p class="m">No orders yet.</p>`}</div>`;
    return h;
  }
  function trackingView(o) {
    const v = QB.trackView(st, o);
    let h = `<div class="c"><div class="row between"><h2>Order ${o.id}</h2><button data-a="back">Back to menu</button></div>`;
    h += `<p class="eta" role="status"><b>${esc(v.text)}</b></p>`;
    if (!v.cancelled) h += `<ol class="steps" aria-label="Order progress">${v.steps.map((s, i) => `<li class="${i < v.idx ? "done" : i === v.idx ? "now" : ""}" ${i === v.idx ? 'aria-current="step"' : ""}>${s}${i < v.idx ? " (done)" : ""}</li>`).join("")}</ol>`;
    if (v.cancelled) h += `<p class="err">${esc(o.cancelReason)}.</p><p>${inr(o.refund.amount)}: ${esc(o.refund.status)}.</p>`;
    else if (o.st !== "Delivered") h += mapSvg(v) + `<p class="m">${v.rider ? `${esc(v.rider.name)} is ${v.riderKm.toFixed(1)} km away. ` : "Rider not assigned yet. "}Location refreshed ${v.refreshedAt == null ? "when the restaurant accepts" : "at " + stamp(v.refreshedAt)} and then every ${QB.TRACK_REFRESH_S} seconds (simulated).</p>`;
    if (o.st === "Delivered") {
      h += `<p class="ok">Delivered at ${stamp(o.deliveredAt)} in ${Math.round((o.deliveredAt - o.placedAt) / 60)} min.</p>`;
      h += typeof o.accurate === "boolean" ? `<p>Thanks. You told us the order was ${o.accurate ? "correct" : "not correct"}.</p>` : `<p>Was your order correct?</p><div class="row"><button class="p" data-a="acc" data-v="${o.id}|1">Yes, all correct</button><button data-a="acc" data-v="${o.id}|0">No, something was wrong</button></div>`;
    }
    h += `<h3 style="margin-top:14px">Items</h3><ul>${o.items.map(i => `<li>${i.qty} × ${esc(i.name)}${i.note ? ` <span class="m">(${esc(i.note)})</span>` : ""}</li>`).join("")}</ul></div>`;
    return h;
  }
  function restaurantView() {
    const R = QB.rest(ui.restId);
    let h = `<div class="c"><h2>Restaurant tablet</h2><div class="row">${QB.RESTAURANTS.map(r => `<button data-a="restid" data-v="${r.id}" class="${r.id === ui.restId ? "on" : ""}" aria-pressed="${r.id === ui.restId}">${esc(r.name)}</button>`).join("")}</div>
      <div class="row" style="margin-top:10px"><button data-a="sound" aria-pressed="${ui.sound}">${ui.sound ? "Sound alert on" : "Turn sound alert on"}</button><span class="m">Browsers only play sound after you tap this once.</span></div></div>`;
    if (ui.banner) h += `<div class="alertbar" role="alert">${esc(ui.banner)}</div>`;
    const q = QB.queueFor(st, ui.restId);
    h += `<div class="c tablet"><h2>New orders (${q.length})</h2>${q.length ? q.map(o => `<div class="ticket ${ui.flash[o.id] ? "flash" : ""}"><div class="row between"><b class="big">${o.id}</b><span>${Math.floor(o.waitSec / 60)} min waiting</span></div>
      <ul class="big">${o.items.map(i => `<li>${i.qty} × ${esc(i.name)}${i.note ? `<br><em class="note2">${esc(i.note)}</em>` : ""}</li>`).join("")}</ul>${o.note ? `<p class="big">Order note: ${esc(o.note)}</p>` : ""}
      <p class="m">Accept and set the prep time:</p><div class="row">${QB.PREP.map(p => `<button class="p" data-a="accept" data-v="${o.id}|${p}">${p} min</button>`).join("")}</div>
      <div class="row" style="margin-top:8px"><button data-a="reject" data-v="${o.id}|Out of stock">Reject: out of stock</button><button data-a="reject" data-v="${o.id}|Too busy">Reject: too busy</button></div></div>`).join("") : `<p class="big m">No new orders.</p>`}</div>`;
    const k = QB.inKitchen(st, ui.restId);
    h += `<div class="c"><h2>In the kitchen (${k.length})</h2>${k.length ? k.map(o => { const left = Math.max(0, o.readyAt - st.clock); return `<div class="item big"><b>${o.id}</b> · ${o.st}${o.st === "Accepted" ? ` · ready in ${Math.ceil(left / 60)} min` : ""}<br><span class="m">${o.items.map(i => `${i.qty} × ${esc(i.name)}`).join(", ")}</span></div>`; }).join("") : `<p class="m">Nothing being prepared.</p>`}</div>`;
    return h + `<p class="m">${esc(R.name)} · restaurant clock ${stamp(st.clock)}</p>`;
  }
  function riderView() {
    const t = QB.riderTask(st, ui.riderId);
    let h = `<div class="c"><h2>Rider app</h2><div class="row">${st.riders.map(r => `<button data-a="rid" data-v="${r.id}" class="${r.id === ui.riderId ? "on" : ""}" aria-pressed="${r.id === ui.riderId}">${esc(r.name)}${r.free ? "" : " (busy)"}</button>`).join("")}</div></div>`;
    if (t.idle) return h + `<div class="c"><p>No delivery assigned. You are first in line when a restaurant accepts an order nearby.</p></div>`;
    h += `<div class="c"><h2>${esc(t.phase)}</h2><p><b>${t.order.id}</b> from ${esc(t.restaurant.name)}<br><span class="m">${t.distKm.toFixed(1)} km to go${t.readyInSec > 0 && t.order.st === "Accepted" ? ` · food ready in about ${Math.ceil(t.readyInSec / 60)} min` : ""}</span></p>
      <ul>${t.order.items.map(i => `<li>${i.qty} × ${esc(i.name)}${i.note ? ` <span class="m">(${esc(i.note)})</span>` : ""}</li>`).join("")}</ul>`;
    h += st.autopilot ? `<p class="note">Auto-confirm is on, so pickup and delivery are confirmed for you. Turn it off at the top to confirm them yourself.</p>` : `<div class="row"><button class="p" data-a="pickup" data-v="${t.order.id}" ${t.canPickup ? "" : "disabled"}>Confirm pickup</button><button class="p" data-a="deliver" data-v="${t.order.id}" ${t.canDeliver ? "" : "disabled"}>Confirm delivery</button></div>`;
    return h + `</div>`;
  }
  function managerView() {
    const k = QB.kpis(st.orders), T = QB.TARGETS, f = v => v == null ? "No data yet" : v;
    const card = (name, val, unit, base, tgt, s) => `<div class="card kpi"><b>${name}</b><div class="big">${f(val)}${val == null ? "" : unit}</div><span class="m">Assumed baseline ${base}${unit}, target ${tgt}${unit}</span><br><span class="tag">${s}</span></div>`;
    let h = `<div class="c"><h2>Delivery KPIs</h2><p class="note">Simulated. Figures come from orders placed in this browser${k.sample ? ` plus ${k.sample} generated sample orders` : ""}. Baselines and targets are assumptions from the case study, not measurements.</p>
      <div class="cols">${card("Order-to-door time", k.avgOtdMin, " min", T.otd.base, T.otd.target, k.status.otd)}${card("Order accuracy", k.accuracyPct, "%", T.acc.base, T.acc.target, k.status.acc)}${card("Cancelled orders", k.cancelRatePct, "%", T.cancel.base, T.cancel.target, k.status.cancel)}</div>
      <p class="m">${k.placed} orders · ${k.delivered} delivered · ${k.cancelled} cancelled · ${k.confirmed} rated by customers</p>
      <div class="row"><button class="p" data-a="sample">Load a simulated day of 24 orders</button><button data-a="nosample" ${k.sample ? "" : "disabled"}>Remove sample orders</button></div></div>`;
    const recent = st.orders.slice().sort((a, b) => b.placedAt - a.placedAt).slice(0, 12);
    h += `<div class="c"><h2>Recent orders</h2><div class="tw"><table><thead><tr><th>Order</th><th>Restaurant</th><th>Status</th><th>Minutes</th></tr></thead><tbody>${recent.map(o => `<tr><td>${o.id}${o.sample ? " (sample)" : ""}</td><td>${esc(QB.rest(o.rid).name)}</td><td>${o.st}</td><td>${o.st === "Delivered" ? Math.round((o.deliveredAt - o.placedAt) / 60) : "-"}</td></tr>`).join("") || `<tr><td colspan="4" class="m">No orders yet.</td></tr>`}</tbody></table></div></div>`;
    return h;
  }
  function controls() {
    return `<div class="c bar"><div class="tabs" role="group" aria-label="Choose who you are">${ROLES.map(r => `<button data-a="role" data-v="${r[0]}" class="${role === r[0] ? "on" : ""}" aria-pressed="${role === r[0]}">${r[1]}</button>`).join("")}</div>
      <div class="row"><span class="m">Speed</span>${QB.SPEEDS.map(s => `<button data-a="speed" data-v="${s}" class="${st.speed === s ? "on" : ""}" aria-pressed="${st.speed === s}" aria-label="Simulation speed ${s} times">${s}×</button>`).join("")}
      <label class="inl"><input type="checkbox" data-a="auto" ${st.autopilot ? "checked" : ""}> Rider auto-confirms</label><span class="m">Clock ${stamp(st.clock)}</span></div></div>`;
  }

  /* ---------- render with focus kept ---------- */
  function render() {
    const a = document.activeElement, typing = a && a.matches && a.matches("[data-note],#onote,textarea,input[type=text]");
    if (typing) return;
    let key = null;
    if (a && a.dataset && a.dataset.a) key = `[data-a="${a.dataset.a}"]` + (a.dataset.v != null ? `[data-v="${a.dataset.v}"]` : "");
    if (role === "restaurant") {
      if (primedFor !== ui.restId) { seen.clear(); QB.queueFor(st, ui.restId).forEach(o => seen.add(o.id)); primedFor = ui.restId; }
      else {
        const fresh = QB.alertsFor(st, ui.restId, seen);
        if (fresh.length) { fresh.forEach(id => { seen.add(id); ui.flash[id] = true; setTimeout(() => { delete ui.flash[id]; render(); }, 4000); }); ui.banner = `New order: ${fresh.join(", ")}`; beep(); live(ui.banner); }
      }
    }
    const body = role === "customer" ? customerView() : role === "restaurant" ? restaurantView() : role === "rider" ? riderView() : managerView();
    $("#m").innerHTML = controls() + body;
    if (key) { const el = $("#m " + key); if (el) el.focus(); }
  }

  /* ---------- actions ---------- */
  const A = {
    role: v => { role = v; try { sessionStorage.setItem("qb:role", v); } catch (e) { /* ignore */ } ui.banner = ""; primedFor = null; render(); },
    speed: v => act(() => QB.setSpeed(st, v)),
    rest: v => { ui.rid = v; ui.cart = {}; ui.err = ""; render(); },
    qty: v => { const [id, d] = v.split("|"), l = ui.cart[id] || { qty: 0, note: "" }; l.qty = Math.max(0, Math.min(QB.MAX_QTY, l.qty + Number(d))); ui.cart[id] = l; ui.err = ""; render(); },
    place: () => {
      ui.note = ($("#onote") || { value: ui.note }).value;
      const r = act(() => QB.placeOrder(st, { rid: ui.rid, lines: Object.entries(ui.cart).map(([id, l]) => ({ id, qty: l.qty, note: l.note })), note: ui.note }));
      if (!r.ok) { ui.err = r.error; render(); live(r.error); return; }
      ui.cart = {}; ui.note = ""; ui.err = ""; ui.track = r.order.id; render(); live(`Order ${r.order.id} placed. Waiting for the restaurant.`);
    },
    track: v => { ui.track = v; render(); },
    back: () => { ui.track = null; render(); },
    acc: v => { const [id, c] = v.split("|"); act(() => QB.confirmAccuracy(st, id, c === "1")); },
    restid: v => { ui.restId = v; ui.banner = ""; render(); },
    sound: () => { ui.sound = !ui.sound; if (ui.sound) { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); beep(); } catch (e) { ui.sound = false; } } render(); },
    accept: v => { const [id, p] = v.split("|"); const r = act(() => QB.acceptOrder(st, id, Number(p))); live(r.ok ? `${id} accepted, ${p} minutes.` : r.error); },
    reject: v => { const [id, why] = v.split("|"); const r = act(() => QB.rejectOrder(st, id, why)); live(r.ok ? `${id} rejected. Customer notified and refunded (simulated).` : r.error); },
    rid: v => { ui.riderId = v; render(); },
    pickup: v => { const r = act(() => QB.confirmPickup(st, v)); if (!r.ok) live(r.error); },
    deliver: v => { const r = act(() => QB.confirmDelivery(st, v)); if (!r.ok) live(r.error); },
    sample: () => act(() => QB.addSampleDay(st, 7)),
    nosample: () => act(() => QB.removeSample(st)),
    auto: (v, el) => act(() => { st.autopilot = !!el.checked; })
  };
  on(A);
  document.addEventListener("change", e => { if (e.target.matches && e.target.matches('input[data-a="auto"]')) A.auto(null, e.target); });
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset && t.dataset.note && ui.cart[t.dataset.note]) ui.cart[t.dataset.note].note = t.value;
    if (t.id === "onote") ui.note = t.value;
  });
  /* Cross-tab sync: another tab (for example the restaurant tablet) wrote the shared state. */
  window.addEventListener("storage", e => { if (e.key === KEY) { st = load(); render(); } });
  document.addEventListener("focusout", () => setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) render(); }, 0));

  /* The simulated clock follows the real clock, once per refresh interval. */
  function step() { st = load(); QB.advanceWall(st, Date.now(), TICK_MS * 3); save(); render(); }
  window.QB_APP = { step, state: () => st };
  step();
  setInterval(step, TICK_MS);
})();
