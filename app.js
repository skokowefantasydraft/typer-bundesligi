"use strict";
// Typer Bundesligi – strona dla graczy. Czyta data/index.json i data/sezon-RRRR.json opublikowane przez aplikację admina.

const DATA_DIR = "data/";
const TZ = "Europe/Warsaw";
const ICONS = {
  table: '<svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  matchday: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  current: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  players: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.6 3.6-5.5 6.5-5.5s5.5 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.6.2 4.4 2 5.2 4.9"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  archive: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/></svg>',
  stats: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  rules: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/></svg>',
};
const SIDE = ["table", "matchday", "current", "players", "archive", "stats", "rules"];
const BOTTOM = ["table", "matchday", "current", "players", "more"];
const NAV_LABEL = { table: "nav_table", matchday: "nav_matchday", current: "nav_current", players: "nav_players",
  more: "nav_more", archive: "nav_archive", stats: "nav_stats", rules: "nav_rules" };

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* tryb prywatny */ } },
};

let IDX = null;            // data/index.json
const SEASONS = {};        // rok → dane sezonu
let offline = false;
const st = {
  lang: store.get("lang", "pl"),
  theme: store.get("theme", null),
  view: store.get("view", "all"),
  year: null,
  page: "table",
  p: {},
};

// ---------------------------------------------------------------- pomocnicze
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function t(key, vars) {
  const dict = window.I18N[st.lang] || window.I18N.pl;
  let s = key.split(".").reduce((o, k) => (o ? o[k] : undefined), dict);
  if (s === undefined) s = key;
  if (vars) Object.keys(vars).forEach(k => { s = String(s).split("{" + k + "}").join(vars[k]); });
  return s;
}
const locale = () => (st.lang === "pl" ? "pl-PL" : "en-GB");
function fmt(iso, opts) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale(), { timeZone: TZ, ...opts }).format(new Date(iso));
}
const fmtKick = iso => fmt(iso, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDay = d => fmt(d + "T12:00:00Z", { weekday: "long", day: "numeric", month: "numeric" });
const S = () => SEASONS[st.year];
const player = id => (S().players.find(p => p.id === Number(id)) || { name: "#" + id, kind: "human" });
const pname = id => player(id).name;
const isAgent = id => player(id).kind === "agent";
const agentTag = id => (isAgent(id) ? ` <span class="tag tag-agent">${esc(t("agent"))}</span>` : "");
const placeBadge = p => `<span class="place${p <= 3 ? " p" + p : ""}">${p ?? "–"}</span>`;
function viewIds(view) {
  const ps = S().players;
  return ps.filter(p => view === "all" || (view === "humans" ? p.kind === "human" : p.kind === "agent")).map(p => p.id);
}
function hasAgents() { return S().players.some(p => p.kind === "agent"); }
function viewChips() {
  if (!hasAgents()) return "";
  return `<div class="chips">${["all", "humans", "agents"].map(v =>
    `<button class="chip${st.view === v ? " on" : ""}" data-view="${v}">${esc(t("view_" + v))}</button>`).join("")}</div>`;
}
function crest(url) { return url ? `<img class="crest" src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ""; }
function teamLine(m) {
  return `${crest(m.home_icon)} ${esc(m.home_short || m.home)} – ${esc(m.away_short || m.away)} ${crest(m.away_icon)}`;
}
function goalText(m) {
  if (m.cancelled) return t("cancelled");
  if (!m.finished) return m.postponed ? t("postponed") : fmtKick(m.kickoff);
  if (m.score && m.score[0] + m.score[1] === 0) return t("no_goal");
  if (!m.first_goal) return t("provisional");
  const who = m.first_goal.own_goal ? t("own_goal") + (m.first_goal.scorer ? ` (${m.first_goal.scorer})` : "") : m.first_goal.scorer;
  return `${t("first_goal")}: ${m.first_goal.minute}' ${esc(who)}`;
}
function matchTags(m) {
  const out = [];
  if (m.double) out.push(`<span class="tag tag-red">${esc(t("double"))}</span>`);
  if (m.postponed) out.push(`<span class="tag tag-muted">${esc(t("postponed"))}</span>`);
  if (m.finished && !m.goals_known) out.push(`<span class="tag tag-muted">${esc(t("provisional"))}</span>`);
  return out.join(" ");
}
function tipBox(s, m) {
  if (!s || (!s.has_tip && !s.tip)) return `<span class="tip none">–</span>`;
  if (!s.tip) return `<span class="tip none" title="${esc(t("hidden"))}">✓</span>`;
  const cls = s.exact ? "exact" : s.outcome ? "outcome" : "";
  const extra = [];
  if (s.minute) extra.push("min");
  if (s.scorer) extra.push(st.lang === "pl" ? "strz" : "scr");
  const pts = m.finished ? `+${s.points}` : "";
  const inv = s.valid === false ? ` title="${st.lang === "pl" ? "po terminie" : "too late"}"` : "";
  return `<span class="tip ${cls}"${inv}>${s.tip.home}:${s.tip.away}<span class="p">${pts}${s.tip.minute ? " · " + s.tip.minute + "'" : ""}</span>` +
    (extra.length ? `<span class="b">${extra.join(" + ")}</span>` : "") + `</span>`;
}
function mdRanking(md, view) {
  const r = (md.ranking && md.ranking[view]) || {};
  return viewIds(view).filter(id => md.scores[String(id)]).sort((a, b) => (r[a] || 99) - (r[b] || 99) || pname(a).localeCompare(pname(b)));
}
function defaultMatchday() {
  const mds = S().matchdays;
  const now = Date.now();
  const started = mds.filter(md => md.matches.some(m => new Date(m.kickoff).getTime() <= now));
  return (started.length ? started[started.length - 1] : mds[0] || {}).number;
}

// ---------------------------------------------------------------- ekran: tabela
function pageTable() {
  const s = S();
  const rows = (s.general[st.view] || []).filter(r => viewIds(st.view).includes(r.player_id));
  const seasonSel = IDX && IDX.seasons.length > 1
    ? `<select id="selSeason" aria-label="${esc(t("season"))}">${IDX.seasons.map(x => `<option value="${x.year}"${x.year === st.year ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : "";
  let h = `<div class="spread"><div><h1>${esc(t("general"))}</h1><div class="muted small">${esc(t("season"))} ${esc(s.season.name)}</div></div>${seasonSel}</div>`;
  h += viewChips();
  const body = rows.map(r => {
    let delta = "";
    if (r.prev_place && r.prev_place !== r.place) {
      delta = r.prev_place > r.place ? `<span class="delta up">▲${r.prev_place - r.place}</span>` : `<span class="delta down">▼${r.place - r.prev_place}</span>`;
    }
    return `<tr class="${r.place === 1 && r.points > 0 ? "lead" : ""}"><td class="c">${placeBadge(r.place)}</td>
      <td><a href="#players/${r.player_id}" class="strong" style="text-decoration:none">${esc(pname(r.player_id))}</a>${agentTag(r.player_id)}${delta}</td>
      <td class="r strong num">${r.points}</td><td class="r num">${r.wins}</td><td class="r num">${r.exact}</td>
      <td class="r num only-desktop-cell">${r.outcomes}</td></tr>`;
  }).join("");
  h += `<div class="card"><div class="scroll-x"><table><thead><tr><th class="c">${esc(t("place"))}</th><th>${esc(t("player"))}</th>
    <th class="r">${esc(t("points"))}</th><th class="r">${esc(t("wins"))}</th><th class="r">${esc(t("exact"))}</th>
    <th class="r only-desktop-cell">${esc(t("outcomes"))}</th></tr></thead><tbody>${body || `<tr><td colspan="6" class="empty">—</td></tr>`}</tbody></table></div>
    <div class="muted small">${esc(t("tiebreak_note", { team: s.rules.tiebreak_team }))}</div></div>`;
  return h;
}

// ---------------------------------------------------------------- ekran: kolejka
function pageMatchday() {
  const s = S();
  if (!s.matchdays.length) return `<h1>${esc(t("matchday"))}</h1><div class="card"><div class="empty">—</div></div>`;
  const num = Number(st.p.md) || defaultMatchday();
  const md = s.matchdays.find(x => x.number === num) || s.matchdays[0];
  const idx = s.matchdays.indexOf(md);
  const prev = s.matchdays[idx - 1], next = s.matchdays[idx + 1];
  let h = `<div class="spread"><h1>${esc(t("matchday_n", { n: md.number }))}</h1><div class="row">
    <button class="icon-btn" data-md="${prev ? prev.number : ""}" ${prev ? "" : "disabled"} aria-label="prev">‹</button>
    <select id="selMd">${s.matchdays.map(x => `<option value="${x.number}"${x.number === md.number ? " selected" : ""}>${esc(t("matchday_n", { n: x.number }))}</option>`).join("")}</select>
    <button class="icon-btn" data-md="${next ? next.number : ""}" ${next ? "" : "disabled"} aria-label="next">›</button></div></div>`;
  h += `<div class="row"><span class="tag tag-muted">${esc(t("status." + md.status))}</span>${md.last ? ` <span class="tag tag-red">${esc(t("last_matchday"))}</span>` : ""}</div>`;
  h += viewChips();
  const ids = mdRanking(md, st.view);
  const rank = (md.ranking && md.ranking[st.view]) || {};
  const rrows = ids.map(id => {
    const sc = md.scores[String(id)];
    return `<tr><td class="c">${placeBadge(rank[id])}</td><td><span class="strong">${esc(pname(id))}</span>${agentTag(id)}</td>
      <td class="r strong num">${sc.points}</td><td class="r num">${sc.bonus ? "+" + sc.bonus : "–"}</td><td class="r num">${sc.exact}</td></tr>`;
  }).join("");
  h += `<div class="card"><h2>${esc(t("ranking"))}</h2><div class="scroll-x"><table><thead><tr><th class="c">${esc(t("place"))}</th>
    <th>${esc(t("player"))}</th><th class="r">${esc(t("points"))}</th><th class="r">${esc(t("bonus"))}</th><th class="r">${esc(t("exact"))}</th></tr></thead>
    <tbody>${rrows}</tbody></table></div></div>`;
  // siatka (komputer)
  const grid = md.matches.map(m => `<tr class="${m.double ? "double" : ""}"><td class="match-cell"><div class="teams">${teamLine(m)}</div>
      <div class="meta">${m.finished ? `<span class="score">${m.score[0]}:${m.score[1]}</span> · ` : ""}${goalText(m)} ${matchTags(m)}</div></td>
      ${ids.map(id => `<td class="tipcell">${tipBox(md.scores[String(id)].matches[String(m.id)], m)}</td>`).join("")}</tr>`).join("");
  h += `<div class="card only-desktop"><h2>${esc(t("matches"))}</h2><div class="scroll-x"><table class="grid"><thead><tr><th>${esc(t("matches"))}</th>
    ${ids.map(id => `<th class="pl">${esc(pname(id))}</th>`).join("")}</tr></thead><tbody>${grid}</tbody></table></div>
    <div class="muted small">${esc(t("tips_hidden_note"))}</div></div>`;
  // karty (telefon)
  h += `<div class="card only-mobile"><h2>${esc(t("matches"))}</h2>${md.matches.map(m => `<div class="mcard${m.double ? " double" : ""}">
      <div class="mhead"><span class="teams">${teamLine(m)}</span>${m.finished ? `<span class="score">${m.score[0]}:${m.score[1]}</span>` : ""}</div>
      <div class="muted small">${goalText(m)} ${matchTags(m)}</div>
      <div class="plist">${ids.map(id => {
        const sc = md.scores[String(id)].matches[String(m.id)];
        const cls = sc && sc.tip ? (sc.exact ? "exact" : sc.outcome ? "outcome" : "") : "";
        const tip = sc && sc.tip ? `${sc.tip.home}:${sc.tip.away}` : (sc && sc.has_tip ? "✓" : "–");
        return `<div class="pitem ${cls}"><span>${esc(pname(id))}</span><span class="strong num">${tip}${m.finished && sc ? ` · ${sc.points}` : ""}</span></div>`;
      }).join("")}</div></div>`).join("")}<div class="muted small">${esc(t("tips_hidden_note"))}</div></div>`;
  return h;
}

// ---------------------------------------------------------------- ekran: bieżąca kolejka
function pageCurrent() {
  const s = S();
  const now = Date.now();
  const md = s.matchdays.find(x => x.matches.some(m => !m.finished && !m.cancelled && new Date(m.kickoff).getTime() > now));
  let h = `<h1>${esc(t("current"))}</h1>`;
  if (!md) return h + `<div class="card"><div class="empty">${esc(t("no_current"))}</div></div>`;
  h += `<div class="row"><span class="strong">${esc(t("matchday_n", { n: md.number }))}</span>${md.last ? ` <span class="tag tag-red">${esc(t("last_matchday"))}</span>` : ""}</div>`;
  const humans = viewIds("humans");
  if (md.forms.length) {
    h += `<div class="card"><h2>${esc(t("forms"))}</h2>${md.forms.map(f => {
      const closed = new Date(f.closes_at).getTime() <= now;
      const label = f.kind === "resched" ? t("rescheduled_form") : fmtDay(f.day);
      return `<div class="form-day"><div class="d"><div class="strong">${esc(label)}</div>
        <div class="muted small">${esc(closed ? t("closed") : t("closes") + " " + fmtKick(f.closes_at))}</div>
        <div class="who">${humans.map(id => `<span class="tag ${f.submitted.includes(id) ? "tag-yellow" : "tag-muted"}">${esc(pname(id))}</span>`).join("")}</div></div>
        <a class="btn" href="${esc(f.url)}" target="_blank" rel="noopener" aria-disabled="${closed}">${esc(t("fill_form"))}</a></div>`;
    }).join("")}</div>`;
  } else {
    h += `<div class="notice">${esc(t("no_forms"))}</div>`;
  }
  const byDay = {};
  md.matches.forEach(m => { const d = fmt(m.kickoff, { year: "numeric", month: "2-digit", day: "2-digit" }); (byDay[d] = byDay[d] || []).push(m); });
  h += `<div class="card"><h2>${esc(t("fixtures"))}</h2>${Object.values(byDay).map(ms => `<div><div class="muted small strong">${esc(fmt(ms[0].kickoff, { weekday: "long", day: "numeric", month: "long" }))}</div>
    <table><tbody>${ms.map(m => `<tr class="${m.double ? "double" : ""}"><td class="num" style="width:64px">${esc(fmt(m.kickoff, { hour: "2-digit", minute: "2-digit" }))}</td>
      <td>${teamLine(m)} ${matchTags(m)}</td><td class="r">${m.finished ? `<span class="score">${m.score[0]}:${m.score[1]}</span>` : ""}</td></tr>`).join("")}</tbody></table></div>`).join("")}
    <div class="muted small">${esc(t("tips_hidden_note"))}</div></div>`;
  return h;
}

// ---------------------------------------------------------------- ekran: gracze
function pagePlayers() {
  const s = S();
  if (!s.players.length) return `<h1>${esc(t("profile"))}</h1><div class="card"><div class="empty">—</div></div>`;
  const pid = s.players.some(p => p.id === Number(st.p.id)) ? Number(st.p.id) : s.players[0].id;
  const n = st.p.n != null ? Number(st.p.n) : 5;
  let h = `<h1>${esc(t("profile"))}</h1><div class="row"><select id="selPlayer">${s.players.map(p =>
    `<option value="${p.id}"${p.id === pid ? " selected" : ""}>${esc(p.name)}${p.kind === "agent" ? " (" + esc(t("agent")) + ")" : ""}</option>`).join("")}</select>
    <select id="selN">${[[3, t("last", { n: 3 })], [5, t("last", { n: 5 })], [10, t("last", { n: 10 })], [0, t("all")]].map(([v, l]) =>
      `<option value="${v}"${v === n ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
  const key = String(pid);
  const mds = s.matchdays.filter(md => md.scores[key] && md.matches.some(m => m.finished));
  const pts = mds.map(md => md.scores[key].points);
  const gen = (s.general.all || []).find(r => r.player_id === pid);
  const best = pts.length ? Math.max(...pts) : 0;
  const nMatches = mds.reduce((a, md) => a + md.matches.filter(m => m.finished).length, 0);
  const stats = [[t("general"), gen ? gen.place + "." : "–"], [t("total"), gen ? gen.points : 0],
    [t("avg"), pts.length ? (pts.reduce((a, b) => a + b, 0) / pts.length).toFixed(1) : "–"], [t("best_md"), best || "–"],
    [t("exact_rate"), gen && nMatches ? Math.round(100 * gen.exact / nMatches) + "%" : "–"],
    [t("outcome_rate"), gen && nMatches ? Math.round(100 * gen.outcomes / nMatches) + "%" : "–"],
    [t("wins"), gen ? gen.wins : 0], [t("played"), gen ? gen.played : 0]];
  h += `<div class="stats">${stats.map(([k, v]) => `<div class="stat"><div class="v">${esc(v)}</div><div class="k">${esc(k)}</div></div>`).join("")}</div>`;
  if (mds.length) {
    const max = Math.max(best, 1);
    h += `<div class="card"><h2>${esc(t("per_matchday"))}</h2><div class="bars">${mds.map(md => {
      const v = md.scores[key].points;
      return `<div class="bar${v === best && v > 0 ? " best" : ""}" style="height:${Math.max(2, 100 * v / max)}%" title="${esc(t("matchday_n", { n: md.number }))}: ${v}"></div>`;
    }).join("")}</div><div class="bars-x">${mds.map(md => `<span>${md.number}</span>`).join("")}</div></div>`;
  }
  let hist = s.matchdays.filter(md => md.scores[key] && md.matches.some(m => new Date(m.kickoff).getTime() <= Date.now())).reverse();
  if (n) hist = hist.slice(0, n);
  h += `<div class="card"><h2>${esc(t("history"))}</h2>${hist.length ? hist.map(md => {
    const sc = md.scores[key];
    return `<div><div class="spread"><span class="strong">${esc(t("matchday_n", { n: md.number }))}</span><span class="strong num">${sc.points} ${esc(t("points"))}${sc.bonus ? ` (${esc(t("bonus"))} +${sc.bonus})` : ""}</span></div>
      <table><tbody>${md.matches.map(m => `<tr class="${m.double ? "double" : ""}"><td>${teamLine(m)}</td><td class="c">${m.finished ? `${m.score[0]}:${m.score[1]}` : "–"}</td>
      <td class="c">${tipBox(sc.matches[String(m.id)], m)}</td></tr>`).join("")}</tbody></table></div>`;
  }).join("") : `<div class="empty">—</div>`}</div>`;
  const at = IDX && IDX.all_time.find(r => r.player_id === pid);
  if (at && IDX.seasons.length > 1) {
    h += `<div class="card"><h2>${esc(t("all_seasons"))}</h2><div class="row"><span class="tag tag-muted">${esc(t("seasons_n"))}: ${at.seasons}</span>
      <span class="tag tag-muted">${esc(t("points"))}: ${at.points}</span><span class="tag tag-yellow">${esc(t("titles"))}: ${at.titles}</span></div></div>`;
  }
  return h;
}

// ---------------------------------------------------------------- ekran: archiwum
function pageArchive() {
  let h = `<h1>${esc(t("archive"))}</h1>`;
  if (!IDX) return h + `<div class="card"><div class="empty">—</div></div>`;
  h += `<div class="card"><table><tbody>${IDX.seasons.map(x => `<tr><td class="strong">${esc(x.name)}</td>
    <td><span class="tag ${x.status === "current" ? "tag-yellow" : "tag-muted"}">${esc(t(x.status === "current" ? "status_current" : "status_archived"))}</span></td>
    <td class="r"><button class="btn secondary" data-season="${x.year}">${esc(t("open_season"))}</button></td></tr>`).join("")}</tbody></table></div>`;
  h += `<div class="card"><h2>${esc(t("all_time"))}</h2><div class="scroll-x"><table><thead><tr><th>${esc(t("player"))}</th><th class="r">${esc(t("titles"))}</th>
    <th class="r">${esc(t("seasons_n"))}</th><th class="r">${esc(t("points"))}</th><th class="r">${esc(t("wins"))}</th></tr></thead><tbody>
    ${IDX.all_time.map((r, i) => `<tr class="${i === 0 ? "lead" : ""}"><td class="strong">${esc(r.name)}${r.kind === "agent" ? ` <span class="tag tag-agent">${esc(t("agent"))}</span>` : ""}</td>
      <td class="r">${"★".repeat(r.titles) || "–"}</td><td class="r num">${r.seasons}</td><td class="r num strong">${r.points}</td><td class="r num">${r.wins}</td></tr>`).join("")}
    </tbody></table></div></div>`;
  return h;
}

// ---------------------------------------------------------------- ekran: statystyki
function pageStats() {
  const s = S();
  const exactCount = {}, scorerCount = {}, nobody = [], bests = [];
  s.matchdays.forEach(md => {
    md.matches.filter(m => m.finished).forEach(m => {
      let any = false;
      Object.values(md.scores).forEach(sc => {
        const x = sc.matches[String(m.id)];
        if (!x) return;
        if (x.outcome) any = true;
        if (x.exact) { const k = `${m.score[0]}:${m.score[1]}`; exactCount[k] = (exactCount[k] || 0) + 1; }
        if (x.tip && x.tip.scorer) { const k = x.tip.scorer.trim().toLowerCase(); scorerCount[k] = (scorerCount[k] || 0) + 1; }
      });
      if (!any && Object.keys(md.scores).length) nobody.push([md, m]);
    });
    Object.entries(md.scores).forEach(([pid, sc]) => { if (md.matches.some(m => m.finished)) bests.push([sc.points, pid, md.number]); });
  });
  const top = (obj, k) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, k);
  const list = (rows, f) => rows.length ? `<table><tbody>${rows.map(f).join("")}</tbody></table>` : `<div class="empty">—</div>`;
  let h = `<h1>${esc(t("stats"))}</h1>`;
  h += `<div class="card"><h2>${esc(t("best_rounds"))}</h2>${list(bests.sort((a, b) => b[0] - a[0]).slice(0, 5),
    ([p, pid, n]) => `<tr><td class="strong">${esc(pname(pid))}</td><td>${esc(t("matchday_n", { n }))}</td><td class="r strong num">${p}</td></tr>`)}</div>`;
  h += `<div class="card"><h2>${esc(t("top_results"))}</h2>${list(top(exactCount, 6), ([k, v]) => `<tr><td class="strong num">${esc(k)}</td><td class="r">${v} ${esc(t("times"))}</td></tr>`)}</div>`;
  h += `<div class="card"><h2>${esc(t("nobody"))}</h2>${list(nobody.slice(-8).reverse(), ([md, m]) =>
    `<tr><td>${esc(t("matchday_n", { n: md.number }))}</td><td>${teamLine(m)}</td><td class="r strong">${m.score[0]}:${m.score[1]}</td></tr>`)}</div>`;
  h += `<div class="card"><h2>${esc(t("top_scorers"))}</h2>${list(top(scorerCount, 8), ([k, v]) =>
    `<tr><td style="text-transform:capitalize">${esc(k)}</td><td class="r">${v} ${esc(t("times"))}</td></tr>`)}</div>`;
  return h;
}

// ---------------------------------------------------------------- ekran: regulamin
function pageRules() {
  const r = S().rules;
  const row = (a, b) => `<tr><td class="num">${esc(a)}</td><td>${esc(b)}</td></tr>`;
  return `<h1>${esc(t("rules"))}</h1><div class="muted">${esc(t("rules_lead", { season: S().season.name }))}</div>
  <div class="card rules"><h3>${esc(t("r_result"))}</h3><table><tbody>${row(r.pts_outcome + " " + t("points"), t("r_outcome"))}
    ${row(r.pts_exact + " " + t("points"), t("r_exact", { o: r.pts_outcome }))}</tbody></table>
    <h3>${esc(t("r_bonus_match"))}</h3><table><tbody>${row(r.pts_minute + " " + t("points"), t("r_minute", { tol: r.minute_tolerance }))}
    ${row(r.pts_scorer + " " + t("points"), t("r_scorer"))}</tbody></table>
    <p>${esc(t("r_nil", { e: r.pts_exact }))}</p>
    <h3>${esc(t("r_bonus_md"))}</h3><table><tbody>${row(r.bonus_outcome_points + " " + t("points"), t("r_b_outcome", { n: r.bonus_outcome_threshold }))}
    ${row(r.bonus_exact_points + " " + t("points"), t("r_b_exact", { n: r.bonus_exact_threshold, o: r.bonus_outcome_points }))}</tbody></table>
    <h3>${esc(t("r_double"))}</h3><p>${esc(t("r_double_t", { m: r.double_multiplier }))}</p>
    <h3>${esc(t("r_last"))}</h3><p>${esc(t("r_last_t", { n: r.last_matchday, m: r.last_matchday_multiplier, mm: r.double_multiplier * r.last_matchday_multiplier }))}</p>
    <h3>${esc(t("r_ties"))}</h3><p>${esc(t("r_ties_md", { team: r.tiebreak_team }))}</p><p>${esc(t("r_ties_gen", { team: r.tiebreak_team }))}</p>
    <h3>${esc(t("r_forms"))}</h3><p>${esc(t("r_forms_t", { h: 60 }))}</p>
    <h3>${esc(t("r_agents"))}</h3><p>${esc(t("r_agents_t"))}</p>
    <h3>${esc(t("r_example"))}</h3><p>${esc(t("r_example_t"))}</p></div>
  <div class="muted small">${esc(t("source"))}</div>`;
}

function pageMore() {
  return `<h1>${esc(t("nav_more"))}</h1><div class="card">${["archive", "stats", "rules"].map(k =>
    `<button class="btn secondary" style="justify-content:flex-start" data-go="${k}">${ICONS[k].replace("<svg", '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"')} ${esc(t(NAV_LABEL[k]))}</button>`).join("")}</div>`;
}

const PAGES = { table: pageTable, matchday: pageMatchday, current: pageCurrent, players: pagePlayers, archive: pageArchive,
  stats: pageStats, rules: pageRules, more: pageMore };

// ---------------------------------------------------------------- rysowanie i nawigacja
function applyTheme() {
  const dark = st.theme ? st.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#121214" : "#FFFFFF");
  document.getElementById("btnTheme").innerHTML = dark ? ICONS.sun : ICONS.moon;
  document.getElementById("btnTheme").title = dark ? t("theme_light") : t("theme_dark");
  return dark;
}

function render() {
  document.documentElement.lang = st.lang;
  document.title = t("app");
  document.getElementById("appTitle").textContent = t("app");
  document.getElementById("btnLang").textContent = t("lang");
  document.getElementById("btnRefresh").title = t("refresh");
  applyTheme();
  const sub = S() ? `${S().season.name} · ${t("updated")}: ${fmt(S().published_at || S().generated_at, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}${offline ? " · " + t("offline") : ""}` : "";
  document.getElementById("appSub").textContent = sub;
  const activeBottom = ["archive", "stats", "rules"].includes(st.page) ? "more" : st.page;
  document.getElementById("side").innerHTML = SIDE.map(k => `<button class="${st.page === k ? "active" : ""}" data-go="${k}">${ICONS[k]}<span>${esc(t(NAV_LABEL[k]))}</span></button>`).join("") +
    `<div class="foot">${esc(t("source"))}</div>`;
  document.getElementById("bottom").innerHTML = BOTTOM.map(k => `<button class="${activeBottom === k ? "active" : ""}" data-go="${k}">${ICONS[k]}<span>${esc(t(NAV_LABEL[k]))}</span></button>`).join("");
  const main = document.getElementById("main");
  if (!S()) { main.innerHTML = `<div class="card"><div class="empty">${esc(t("no_data"))}</div></div>`; return; }
  try { main.innerHTML = (PAGES[st.page] || pageTable)(); }
  catch (e) { console.error(e); main.innerHTML = `<div class="card"><div class="notice">${esc(e.message)}</div></div>`; }
}

function go(page, p = {}, push = true) {
  st.page = page; st.p = p;
  if (push) history.pushState({ page, p }, "", "#" + page + (p.id ? "/" + p.id : p.md ? "/" + p.md : ""));
  render();
  window.scrollTo(0, 0);
}
function parseHash() {
  const [page, arg] = (location.hash || "#table").slice(1).split("/");
  if (!PAGES[page]) return { page: "table", p: {} };
  return { page, p: page === "players" ? { id: arg } : page === "matchday" ? { md: arg } : {} };
}
window.addEventListener("popstate", () => { const r = parseHash(); st.page = r.page; st.p = r.p; render(); });

document.addEventListener("click", e => {
  const g = e.target.closest("[data-go]");
  if (g) return go(g.dataset.go);
  const v = e.target.closest("[data-view]");
  if (v) { st.view = v.dataset.view; store.set("view", st.view); return render(); }
  const m = e.target.closest("[data-md]");
  if (m && m.dataset.md) return go("matchday", { md: m.dataset.md });
  const s = e.target.closest("[data-season]");
  if (s) return loadSeason(Number(s.dataset.season)).then(() => go("table"));
  const a = e.target.closest('a[href^="#players/"]');
  if (a) { e.preventDefault(); return go("players", { id: a.getAttribute("href").split("/")[1] }); }
});
document.addEventListener("change", e => {
  const id = e.target.id;
  if (id === "selMd") go("matchday", { md: e.target.value });
  if (id === "selPlayer") go("players", { ...st.p, id: e.target.value }, false);
  if (id === "selN") go("players", { ...st.p, n: e.target.value }, false);
  if (id === "selSeason") loadSeason(Number(e.target.value)).then(render);
});

// ---------------------------------------------------------------- dane
async function fetchJson(name) {
  const r = await fetch(DATA_DIR + name + "?t=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = await r.json();
  store.set("cache:" + name, data);
  return data;
}
async function loadSeason(year) {
  if (!SEASONS[year]) {
    try { SEASONS[year] = await fetchJson(`sezon-${year}.json`); }
    catch (e) { SEASONS[year] = store.get(`cache:sezon-${year}.json`, null); offline = true; }
  }
  if (SEASONS[year]) st.year = year;
}
async function load() {
  const btn = document.getElementById("btnRefresh");
  btn.disabled = true;
  offline = false;
  Object.keys(SEASONS).forEach(k => delete SEASONS[k]);
  try { IDX = await fetchJson("index.json"); }
  catch (e) { IDX = store.get("cache:index.json", null); offline = true; }
  if (IDX) await loadSeason(st.year && IDX.seasons.some(s => s.year === st.year) ? st.year : IDX.current);
  btn.disabled = false;
  render();
}

document.getElementById("btnTheme").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark";
  st.theme = dark ? "light" : "dark"; store.set("theme", st.theme); render();
});
document.getElementById("btnLang").addEventListener("click", () => { st.lang = st.lang === "pl" ? "en" : "pl"; store.set("lang", st.lang); render(); });
document.getElementById("btnRefresh").addEventListener("click", load);
document.getElementById("logo").addEventListener("click", () => go("table"));
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!st.theme) render(); });

(function start() {
  const r = parseHash(); st.page = r.page; st.p = r.p;
  history.replaceState({ page: st.page, p: st.p }, "", location.hash || "#table");
  IDX = store.get("cache:index.json", null);
  if (IDX) { const y = IDX.current; SEASONS[y] = store.get(`cache:sezon-${y}.json`, null); if (SEASONS[y]) st.year = y; }
  render();
  load();
  const forced = new URLSearchParams(location.search).get("karetsas") === "1";
  const plan = forced ? window.Easter.plan(() => 0) : window.Easter.plan(Math.random);
  if (plan) setTimeout(() => window.Easter.show(plan), 1200 + Math.random() * 2500);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
