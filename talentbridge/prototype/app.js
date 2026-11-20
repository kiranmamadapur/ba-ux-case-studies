/* TalentBridge UI. State lives in localStorage under "tb:v2"; all rules come from logic.js (window.TB). */
(() => {
  "use strict";
  const KEY = "tb:v2", ST = TB.STAGES;

  function load() {
    try { const raw = localStorage.getItem(KEY), s = raw && TB.deserialize(raw); if (s) return s; } catch (e) { /* fall through */ }
    return TB.createState(Date.now());
  }
  let st = load();
  const save = () => { try { localStorage.setItem(KEY, TB.serialize(st)); } catch (e) { /* storage full or blocked: keep working in memory */ } };

  const ui = { role: "Recruiter", name: "Anita", view: "board", job: "all", sel: null, msg: "", err: false, perf: "", aerr: {}, aform: { name: "", email: "", phone: "", job: "ba" }, perr: {}, pdraft: null, ierr: "", idraft: null };
  const user = () => ({ role: ui.role, name: ui.role === "Recruiter" ? ui.name : ui.role === "Hiring manager" ? "Vikram" : "HR head" });
  const fmt = t => new Date(t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const jobTitle = id => (st.jobs.find(j => j.id === id) || { title: id }).title;
  const v = id => { const e = document.getElementById(id); return e ? e.value : ""; };
  const stars = r => r ? `<span aria-label="Rating ${r} of 5">${"★".repeat(r)}${"☆".repeat(5 - r)}</span>` : "<span>Unrated</span>";
  function localStr(ms) { const d = new Date(ms), p = n => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()); }
  function say(m, err) { ui.msg = m; ui.err = !!err; const l = document.getElementById("live"); if (l) l.textContent = m; }

  /* ---------- views ---------- */
  function head() {
    const u = user();
    const roles = TB.USER_ROLES.map(r => `<button class="${ui.role === r ? "on" : ""}" data-a="role" data-v="${r}" aria-pressed="${ui.role === r}">${r}</button>`).join("");
    const who = ui.role === "Recruiter"
      ? `<label class="inl">Signed in as <select data-c="name" aria-label="Recruiter name">${TB.RECRUITERS.map(n => `<option ${n === ui.name ? "selected" : ""}>${n}</option>`).join("")}</select></label>`
      : `<span class="m">Signed in as ${esc(u.name)} (${esc(ui.role)})</span>`;
    const views = [["board", "Pipeline board"], ["shortlist", "Shortlist"], ["report", "Weekly report"]]
      .map(x => `<button class="${ui.view === x[0] ? "on" : ""}" data-a="view" data-v="${x[0]}" aria-pressed="${ui.view === x[0]}">${x[1]}</button>`).join("");
    const jobs = ui.view === "report" ? "" : `<label class="inl">Role <select data-c="job" aria-label="Filter by role"><option value="all">All roles</option>${st.jobs.map(j => `<option value="${j.id}" ${ui.job === j.id ? "selected" : ""}>${esc(j.title)}</option>`).join("")}</select></label>`;
    const hint = ui.role === "Recruiter" ? "You can move, edit and schedule candidates assigned to you, and see their contact details."
      : ui.role === "Hiring manager" ? "You can move shortlisted candidates (rating 4 or above) to Offer or Closed. Contact details are hidden."
      : "Read-only access to the board, shortlist and weekly report. Contact details are hidden.";
    const demoCount = st.candidates.filter(c => c.demo).length;
    const demo = `<div class="tbbar"><span class="m">${st.candidates.length} candidates in total.</span>${demoCount ? `<button data-a="removeDemo">Remove ${demoCount} demo candidates</button>` : `<button data-a="loadDemo">Load 500 demo candidates</button>`}<span id="perf" class="m">${esc(ui.perf)}</span></div>`;
    return `<div class="tabs" role="group" aria-label="Role">${roles}</div><div class="tbbar">${who}</div><p class="note tbhint">${hint}</p>
<div class="tabs" role="group" aria-label="View">${views}</div><div class="tbbar">${jobs}</div>${demo}
<p class="${ui.err ? "err" : "ok"}" ${ui.msg ? "" : "hidden"}>${esc(ui.msg)}</p>`;
  }

  function card(c) {
    const u = user(), i = ST.indexOf(c.stage);
    const pv = i > 0 && TB.canMove(u, c, ST[i - 1]).ok, nx = i < ST.length - 1 && TB.canMove(u, c, ST[i + 1]).ok;
    return `<div class="card tbc${ui.sel === c.id ? " sel" : ""}" draggable="true" data-id="${c.id}"><b>${esc(c.name)}</b>
<div class="m">${esc(jobTitle(c.job))} · ${stars(c.rating)}</div><div class="m">Recruiter: ${esc(c.recruiter)}</div>
<div class="row"><button data-a="prev" data-v="${c.id}" ${pv ? "" : "disabled"} aria-label="Move ${esc(c.name)} back${i > 0 ? " to " + ST[i - 1] : ""}">◀</button><button data-a="open" data-v="${c.id}" aria-label="Open profile of ${esc(c.name)}">Open</button><button data-a="next" data-v="${c.id}" ${nx ? "" : "disabled"} aria-label="Move ${esc(c.name)} forward${i < ST.length - 1 ? " to " + ST[i + 1] : ""}">▶</button></div></div>`;
  }

  function addForm() {
    if (ui.role !== "Recruiter") return "";
    const e = ui.aerr, f = ui.aform, fe = (k, id) => e[k] ? `<span class="err fe" id="${id}-e" role="alert">${esc(e[k])}</span>` : "";
    const ad = (k, id) => e[k] ? `aria-invalid="true" aria-describedby="${id}-e"` : "";
    return `<details class="c"><summary><b>Add candidate</b></summary><div class="tbgrid" style="margin-top:10px">
<div><label for="an">Name</label><input id="an" value="${esc(f.name)}" autocomplete="off" ${ad("name", "an")}>${fe("name", "an")}</div>
<div><label for="ae">Email</label><input id="ae" type="email" value="${esc(f.email)}" ${ad("email", "ae")}>${fe("email", "ae")}</div>
<div><label for="ap">Phone (optional, 10 digits)</label><input id="ap" inputmode="numeric" value="${esc(f.phone)}" ${ad("phone", "ap")}>${fe("phone", "ap")}</div>
<div><label for="aj">Role</label><select id="aj">${st.jobs.map(j => `<option value="${j.id}" ${f.job === j.id ? "selected" : ""}>${esc(j.title)}</option>`).join("")}</select>${fe("job", "aj")}</div>
</div><button class="p" data-a="addCandidate">Add to Sourced</button></details>`;
  }

  function board() {
    const L = st.candidates.filter(c => ui.job === "all" || c.job === ui.job), by = {};
    ST.forEach(s => { by[s] = []; }); L.forEach(c => by[c.stage].push(c));
    const cols = ST.map(s => `<section class="col tbcol" data-stage="${s}" aria-label="${s}, ${by[s].length} candidates"><h3>${s} <span class="tag">${by[s].length}</span></h3><div class="tbl">${by[s].map(card).join("") || '<p class="m">Drop a candidate here.</p>'}</div></section>`).join("");
    return `${addForm()}<p class="m">Drag a card to another column, or use the ◀ ▶ buttons (works with a keyboard).</p><div class="board">${cols}</div>`;
  }

  function shortlistView() {
    const u = user(), L = TB.shortlist(st, ui.job);
    const rows = L.map(c => {
      const acts = ["Offer", "Closed"].map(s => `<button data-a="moveTo" data-v="${c.id}|${s}" ${TB.canMove(u, c, s).ok ? "" : "disabled"} aria-label="Move ${esc(c.name)} to ${s}">${s === "Offer" ? "Make offer" : "Close"}</button>`).join("");
      return `<tr><td>${esc(c.name)}</td><td>${esc(jobTitle(c.job))}</td><td>${stars(c.rating)}</td><td>${c.stage}</td><td>${esc(c.recruiter)}</td><td><div class="row"><button data-a="open" data-v="${c.id}" aria-label="Open profile of ${esc(c.name)}">Open</button>${acts}</div></td></tr>`;
    }).join("");
    return `<h2>Shortlist <span class="tag">${L.length}</span></h2><p class="m" role="status">Only candidates rated 4 or above are shown.</p>
<div class="c tw"><table><thead><tr><th>Candidate</th><th>Role</th><th>Rating</th><th>Stage</th><th>Recruiter</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No shortlisted candidates for this role yet.</td></tr>'}</tbody></table></div>`;
  }

  function reportView() {
    const rep = TB.weeklyReport(st, Date.now()), board = TB.boardCounts(st);
    const same = rep.rows.every(r => ST.every(s => r.counts[s] === board[r.jobId][s])) && rep.totals.total === st.candidates.length;
    const head = ["Role"].concat(ST, ["Total", "Days open", "Moves in 7 days"]).map((h, i) => `<th${i ? ' class="n"' : ""}>${h}</th>`).join("");
    const body = rep.rows.map(r => `<tr><td>${esc(r.title)}</td>${ST.map(s => `<td class="n">${r.counts[s]}</td>`).join("")}<td class="n">${r.total}</td><td class="n">${r.daysOpen}</td><td class="n">${r.movesLast7}</td></tr>`).join("");
    const tot = `<tr class="tot"><td>All roles</td>${ST.map(s => `<td class="n">${rep.totals.counts[s]}</td>`).join("")}<td class="n">${rep.totals.total}</td><td class="n"></td><td class="n">${rep.totals.movesLast7}</td></tr>`;
    return `<h2>Weekly pipeline report</h2><p class="m">Generated ${fmt(rep.generatedAt)}. ${same ? `<span class="ok">Matches the board: ${rep.totals.total} candidates.</span>` : '<span class="err">Does not match the board.</span>'}</p>
<div class="c tw"><table><thead><tr>${head}</tr></thead><tbody>${body}${tot}</tbody></table></div><button class="p" data-a="csv">Download CSV</button>`;
  }

  function profile() {
    const c = TB.findCandidate(st, ui.sel);
    if (!c) return "";
    const u = user(), ed = TB.canEdit(u, c), ct = TB.contactFor(u, c), d = ui.pdraft || c, pe = ui.perr, dis = ed ? "" : "disabled";
    const contact = ct ? `<p>Email: <b>${esc(ct.email)}</b><br>Phone: <b>${esc(ct.phone || "not given")}</b></p>` : `<p class="note">Contact details are hidden. Only the assigned recruiter (${esc(c.recruiter)}) can see them.</p>`;
    const err = k => pe[k] ? `<span class="err fe" id="p${k}-e" role="alert">${esc(pe[k])}</span>` : "";
    const hist = c.history.slice().reverse().map(h => `<li>${fmt(h.t)}: ${h.from ? esc(h.from) + " → " + esc(h.to) : "Added to " + esc(h.to)} by ${esc(h.by)}</li>`).join("");
    const ivs = TB.interviewsFor(st, c.id).map(i => `<li>${fmt(i.start)} to ${new Date(i.end).toLocaleTimeString("en-IN", { timeStyle: "short" })} with ${esc(i.interviewer)}</li>`).join("");
    const dr = ui.idraft || { iw: localStr(Date.now() + 864e5).slice(0, 11) + "10:00", ii: TB.INTERVIEWERS[0], id: "45" };
    const sched = TB.canSchedule(u, c) ? `<h3 style="margin-top:12px">Schedule an interview</h3><div class="tbgrid"><div><label for="iw">Date and time</label><input id="iw" type="datetime-local" value="${esc(dr.iw)}" min="${localStr(Date.now())}"></div>
<div><label for="ii">Interviewer</label><select id="ii">${TB.INTERVIEWERS.map(n => `<option ${n === dr.ii ? "selected" : ""}>${n}</option>`).join("")}</select></div>
<div><label for="id">Length</label><select id="id">${[30, 45, 60, 90].map(n => `<option value="${n}" ${String(n) === String(dr.id) ? "selected" : ""}>${n} minutes</option>`).join("")}</select></div></div>
${ui.ierr ? `<p class="err" role="alert">${esc(ui.ierr)}</p>` : ""}<button class="p" data-a="schedule">Schedule</button>` : "";
    return `<section class="c" id="profile" aria-labelledby="ph"><div class="row" style="justify-content:space-between"><h2 id="ph" tabindex="-1">${esc(c.name)} <span class="tag">${c.stage}</span></h2><button data-a="close">Close profile</button></div>
<p class="m">${esc(jobTitle(c.job))} · Recruiter: ${esc(c.recruiter)}</p>${contact}${ed ? "" : '<p class="note">Read-only: only the assigned recruiter can edit this profile.</p>'}
<div class="tbgrid"><div><label for="pr">Rating (0 = unrated)</label><select id="pr" ${dis}>${[0, 1, 2, 3, 4, 5].map(n => `<option ${n === Number(d.rating) ? "selected" : ""}>${n}</option>`).join("")}</select>${err("rating")}</div>
<div><label for="pf">Resume file name</label><input id="pf" value="${esc(d.resume || "")}" placeholder="name.pdf" ${dis}>${err("resume")}</div></div>
<label for="pn">Notes</label><textarea id="pn" rows="4" ${dis}>${esc(d.notes || "")}</textarea>${err("notes")}
${ed ? '<button class="p" data-a="saveProfile">Save profile</button>' : ""}
<div class="tbgrid" style="margin-top:14px"><div><h3>Interviews</h3><ul class="hist">${ivs || "<li>None scheduled.</li>"}</ul></div><div><h3>History</h3><ol class="hist" reversed>${hist}</ol></div></div>${sched}</section>`;
  }

  /* ---------- render ---------- */
  function render(...focus) {
    const t0 = performance.now(), scr = [...document.querySelectorAll(".tbl")].map(e => e.scrollTop);
    document.getElementById("app").innerHTML = head() + (ui.view === "board" ? board() : ui.view === "shortlist" ? shortlistView() : reportView()) + (ui.sel && ui.view !== "report" ? profile() : "");
    [...document.querySelectorAll(".tbl")].forEach((e, i) => { if (scr[i]) e.scrollTop = scr[i]; });
    for (const s of focus) { const el = document.querySelector(s); if (el && !el.disabled) { el.focus(); break; } }
    if (ui.view === "board") {
      const n = st.candidates.filter(c => ui.job === "all" || c.job === ui.job).length;
      requestAnimationFrame(() => setTimeout(() => {
        ui.perf = "Board of " + n + " candidates rendered in " + Math.round(performance.now() - t0) + " ms (target: under 3000 ms).";
        const p = document.getElementById("perf"); if (p) p.textContent = ui.perf;
      }, 0));
    }
  }

  /* ---------- actions ---------- */
  function move(id, to, focusDir) {
    const r = TB.moveCandidate(st, user(), id, to, Date.now());
    if (!r.ok) { say(r.error, true); render(); return; }
    save(); say(r.candidate.name + " moved from " + r.from + " to " + r.to + " at " + fmt(r.at) + ".");
    const base = '.tbc[data-id="' + id + '"] ';
    render(base + '[data-a="' + (focusDir || "open") + '"]', base + '[data-a="open"]', '[data-a="moveTo"][data-v^="' + id + '|"]');
  }
  const A = {
    role(r) { ui.role = r; ui.pdraft = null; ui.perr = {}; ui.idraft = null; ui.ierr = ""; say(r + " view."); render(); },
    view(x) { ui.view = x; say({ board: "Pipeline board", shortlist: "Shortlist", report: "Weekly report" }[x] + "."); render(); },
    open(id) { ui.sel = +id; ui.pdraft = null; ui.perr = {}; ui.idraft = null; ui.ierr = ""; say(""); render("#ph"); const p = document.getElementById("profile"); if (p && p.scrollIntoView) p.scrollIntoView({ block: "nearest" }); },
    close() { const id = ui.sel; ui.sel = null; ui.pdraft = null; ui.perr = {}; say(""); render('.tbc[data-id="' + id + '"] [data-a="open"]', '[data-a="open"][data-v="' + id + '"]'); },
    prev(id) { const c = TB.findCandidate(st, +id); if (c) move(c.id, ST[ST.indexOf(c.stage) - 1], "prev"); },
    next(id) { const c = TB.findCandidate(st, +id); if (c) move(c.id, ST[ST.indexOf(c.stage) + 1], "next"); },
    moveTo(val) { const p = val.split("|"); move(+p[0], p[1]); },
    saveProfile() {
      const d = { rating: v("pr"), resume: v("pf"), notes: v("pn") }, r = TB.saveProfile(st, user(), ui.sel, d);
      if (!r.ok) { ui.perr = r.errors; ui.pdraft = d; say("Profile not saved. Check the highlighted fields.", true); render(r.errors.rating ? "#pr" : r.errors.resume ? "#pf" : "#pn"); return; }
      ui.perr = {}; ui.pdraft = null; save(); say("Profile saved."); render("#ph");
    },
    schedule() {
      const dr = { iw: v("iw"), ii: v("ii"), id: v("id") };
      const r = TB.scheduleInterview(st, user(), { candidateId: ui.sel, interviewer: dr.ii, start: TB.parseLocal(dr.iw), durationMin: Number(dr.id) }, Date.now());
      if (!r.ok) { ui.ierr = r.error; ui.idraft = dr; say(r.error, true); render("#iw"); return; }
      ui.ierr = ""; ui.idraft = null; save(); say("Interview scheduled for " + fmt(r.interview.start) + " with " + r.interview.interviewer + "."); render("#ph");
    },
    addCandidate() {
      const f = { name: v("an"), email: v("ae"), phone: v("ap"), job: v("aj") }, r = TB.addCandidate(st, user(), f, Date.now());
      if (!r.ok) { ui.aerr = r.errors; ui.aform = f; say("Candidate not added. Check the highlighted fields.", true); render(r.errors.name ? "#an" : r.errors.email ? "#ae" : r.errors.phone ? "#ap" : "#aj"); return; }
      ui.aerr = {}; ui.aform = { name: "", email: "", phone: "", job: f.job }; ui.sel = r.candidate.id; ui.pdraft = null; ui.perr = {};
      save(); say(r.candidate.name + " added to Sourced."); render("#ph");
    },
    loadDemo() { TB.generateDemo(st, 500, Date.now(), 42); save(); say("Loaded 500 demo candidates."); render(); },
    removeDemo() { const n = TB.removeDemo(st); if (ui.sel && !TB.findCandidate(st, ui.sel)) ui.sel = null; save(); say("Removed " + n + " demo candidates."); render(); },
    csv() {
      const blob = new Blob([TB.reportToCsv(TB.weeklyReport(st, Date.now()))], { type: "text/csv" }), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "talentbridge-weekly-report.csv"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000); say("Report downloaded as CSV.");
    }
  };
  on(A);

  const C = {
    name(x) { ui.name = x; ui.sel = null; say("Signed in as " + x + "."); render(); },
    job(x) { ui.job = x; render(); }
  };
  document.addEventListener("change", e => { const t = e.target.closest && e.target.closest("[data-c]"); if (t && C[t.dataset.c]) C[t.dataset.c](t.value); });

  /* drag and drop (the buttons above are the keyboard and touch alternative) */
  document.addEventListener("dragstart", e => { const c = e.target.closest && e.target.closest(".tbc"); if (c) { e.dataTransfer.setData("text/plain", c.dataset.id); e.dataTransfer.effectAllowed = "move"; } });
  document.addEventListener("dragover", e => { if (e.target.closest && e.target.closest(".tbcol")) e.preventDefault(); });
  document.addEventListener("drop", e => {
    const col = e.target.closest && e.target.closest(".tbcol"); if (!col) return;
    e.preventDefault(); const id = Number(e.dataTransfer.getData("text/plain")); if (id) move(id, col.dataset.stage);
  });

  /* keep other tabs in step */
  window.addEventListener("storage", e => { if (e.key === KEY && e.newValue) { const s = TB.deserialize(e.newValue); if (s) { st = s; render(); } } });

  say("");
  render();
})();
