/**
 * KICKOFF · Football Data Dashboard
 * Dark theme · Favorites · Charts · Trends
 */

const API_BASE = "/api/football";
const FAV_KEY = "fd_favorite_team";

let currentComp = "BSA";
let currentTab = "standings";
let cache = {};
let chartInstances = [];

const content = document.getElementById("content");
const statusText = document.getElementById("statusText");
const spinner = document.querySelector(".spinner");
const compSelect = document.getElementById("compSelect");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const favChip = document.getElementById("favChip");
const favCrest = document.getElementById("favCrest");
const favName = document.getElementById("favName");
const favFallback = document.getElementById("favFallback");
const dateLabel = document.getElementById("dateLabel");
const greeting = document.getElementById("greeting");

// ─── Date & greeting ───────────────────────────────

function updateDateGreeting() {
  const now = new Date();
  const opts = { weekday: "long", day: "numeric", month: "short" };
  dateLabel.textContent = now.toLocaleDateString("en-US", opts).toUpperCase();

  const h = now.getHours();
  let g = "Welcome back";
  if (h < 12) g = "Good morning";
  else if (h < 18) g = "Good afternoon";
  else g = "Good evening";
  greeting.textContent = g;
}

// ─── Favorites ─────────────────────────────────────

function getFavorite() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "null");
  } catch {
    return null;
  }
}

function setFavorite(team) {
  if (!team) {
    localStorage.removeItem(FAV_KEY);
  } else {
    localStorage.setItem(
      FAV_KEY,
      JSON.stringify({
        id: team.id,
        name: team.shortName || team.name,
        crest: team.crest || "",
      })
    );
  }
  renderFavChip();
}

function isFavorite(id) {
  const f = getFavorite();
  return f && String(f.id) === String(id);
}

function renderFavChip() {
  const f = getFavorite();
  if (!f) {
    favChip.hidden = true;
    return;
  }
  favChip.hidden = false;
  favName.textContent = f.name;
  if (f.crest) {
    favCrest.src = f.crest;
    favCrest.hidden = false;
    favFallback.hidden = true;
  } else {
    favCrest.hidden = true;
    favFallback.hidden = false;
  }
}

document.getElementById("favClear").addEventListener("click", (e) => {
  e.stopPropagation();
  setFavorite(null);
});

favChip.addEventListener("click", () => {
  const f = getFavorite();
  if (f) showTeam(f.id);
});

// ─── Helpers ───────────────────────────────────────

function destroyCharts() {
  chartInstances.forEach((c) => {
    try {
      c.destroy();
    } catch (_) {}
  });
  chartInstances = [];
}

function setStatus(msg, loading = false) {
  statusText.textContent = msg;
  spinner.hidden = !loading;
}

function showError(msg) {
  destroyCharts();
  content.innerHTML = `<div class="error">${msg}</div>`;
  setStatus("Error");
}

async function api(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${API_BASE}?${qs}`;
  const key = url;

  if (cache[key] && Date.now() - cache[key].ts < 5 * 60 * 1000) {
    return cache[key].data;
  }

  setStatus("Loading…", true);
  try {
    const res = await fetch(url);
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(
        `Invalid server response (HTTP ${res.status}). Check if /api/football is deployed.`
      );
    }

    if (!res.ok) {
      const msg = data.error || data.message || `HTTP ${res.status}`;
      const extra = data.dica
        ? ` ${data.dica}`
        : data.detalhe
          ? ` (${data.detalhe})`
          : "";
      throw new Error(msg + extra);
    }

    cache[key] = { data, ts: Date.now() };
    setStatus("Ready");
    return data;
  } catch (err) {
    setStatus("Request error");
    throw err;
  }
}

function crest(url, alt = "") {
  if (!url) return "";
  return `<img class="crest" src="${url}" alt="${alt}" loading="lazy" onerror="this.style.display='none'" />`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status) {
  if (!status) return "";
  const s = status.toLowerCase();
  const labels = {
    finished: "Finished",
    scheduled: "Scheduled",
    timed: "Scheduled",
    in_play: "Live",
    paused: "HT",
    postponed: "Postponed",
    cancelled: "Cancelled",
  };
  return `<span class="status-badge ${s}">${labels[s] || status}</span>`;
}

function heartBtn(teamId, extraClass = "") {
  const active = isFavorite(teamId) ? "active" : "";
  return `<button type="button" class="btn-heart ${active} ${extraClass}" data-fav-id="${teamId}" title="Favorite team">♥</button>`;
}

function openModal(html) {
  modalBody.innerHTML = html;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}

function bindHeartButtons(root = document) {
  root.querySelectorAll("[data-fav-id]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.favId;
      if (isFavorite(id)) {
        setFavorite(null);
        btn.classList.remove("active");
        return;
      }
      try {
        const t = await api({ type: "team", id });
        setFavorite(t);
        document.querySelectorAll(".btn-heart").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      } catch (err) {
        console.error(err);
      }
    });
  });
}

// ─── Chart helpers ─────────────────────────────────

function makeBarChart(canvasId, labels, values, label, color = "#a3e635") {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === "undefined") return;

  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label,
          data: values,
          backgroundColor: color,
          borderRadius: 6,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a2029",
          titleFont: { size: 12 },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#8b95a5",
            font: { size: 10 },
            maxRotation: 45,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#8b95a5", font: { size: 11 }, precision: 0 },
        },
      },
    },
  });
  chartInstances.push(chart);
  return chart;
}
// ─── Extra helpers: show as much API data as possible ───

const esc = (v) => escapeHtml(v);

function ageFrom(iso) {
  if (!iso) return null;
  const b = new Date(iso);
  if (isNaN(b)) return null;
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

function formatDay(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? esc(iso) : d.toLocaleDateString("pt-BR");
}

function prettyEnum(v) {
  if (!v) return "";
  return String(v)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}

// value is escaped unless raw === true (then the caller already escaped it)
function detailItem(label, value, raw = false) {
  const empty = value === null || value === undefined || value === "";
  const shown = empty ? "—" : raw ? value : esc(value);
  return `<div class="detail-item"><div class="label">${esc(label)}</div><div class="value">${shown}</div></div>`;
}

function statCard(icon, color, label, value, delta) {
  return `
    <div class="stat-card">
      <div class="stat-label"><span class="stat-icon ${color}">${icon}</span>${esc(label)}</div>
      <div class="stat-value">${esc(value)}</div>
      <div class="stat-delta neutral">${esc(delta || "")}</div>
    </div>`;
}

function scoreText(m) {
  const withScore = ["FINISHED", "IN_PLAY", "PAUSED", "AWARDED"].includes(m.status);
  if (!withScore) return "vs";
  const ft = m.score?.fullTime || {};
  return `${ft.home ?? ft.homeTeam ?? "–"} × ${ft.away ?? ft.awayTeam ?? "–"}`;
}

function scoreBreakdown(m) {
  const s = m.score || {};
  const fmt = (o) => (o && (o.home != null || o.away != null) ? `${o.home ?? "–"}×${o.away ?? "–"}` : null);
  const parts = [];
  const ht = fmt(s.halfTime);
  if (ht) parts.push(`Half-time ${ht}`);
  const et = fmt(s.extraTime);
  if (et) parts.push(`Extra time ${et}`);
  const pen = fmt(s.penalties);
  if (pen) parts.push(`Penalties ${pen}`);
  return parts;
}

function matchCardHtml(m, showComp = false) {
  const home = m.homeTeam?.shortName || m.homeTeam?.name || "—";
  const away = m.awayTeam?.shortName || m.awayTeam?.name || "—";
  const winner = m.score?.winner;
  const tags = [];
  if (showComp && m.competition?.name) tags.push(m.competition.name);
  if (m.stage && m.stage !== "REGULAR_SEASON") tags.push(prettyEnum(m.stage));
  if (m.group) tags.push(prettyEnum(m.group));
  if (m.matchday) tags.push(`MD ${m.matchday}`);
  const extra = scoreBreakdown(m);

  return `
    <div class="match-card" data-match-id="${esc(m.id)}" data-search="${esc(`${home} ${away}`.toLowerCase())}">
      <div class="match-team home${winner === "HOME_TEAM" ? " winner" : ""}"><span>${esc(home)}</span>${crest(m.homeTeam?.crest)}</div>
      <div class="match-score">${scoreText(m)}</div>
      <div class="match-team away${winner === "AWAY_TEAM" ? " winner" : ""}">${crest(m.awayTeam?.crest)}<span>${esc(away)}</span></div>
      <div class="match-meta">
        ${formatDate(m.utcDate)} · ${statusBadge(m.status)}
        ${tags.length ? ` · ${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}` : ""}
        ${extra.length ? `<div class="match-extra">${esc(extra.join(" · "))}</div>` : ""}
      </div>
    </div>`;
}

function bindMatchCards(root) {
  root.querySelectorAll("[data-match-id]").forEach((el) => {
    el.addEventListener("click", () => showMatch(el.dataset.matchId));
  });
}

function formPills(form) {
  if (!form) return "";
  const s = String(form);
  const arr = s.includes(",") ? s.split(",") : s.split("");
  return `<div class="form-pills">${arr
    .slice(-5)
    .map((c) => `<span class="form-pill ${esc(c)}">${esc(c)}</span>`)
    .join("")}</div>`;
}

function makeGroupedBarChart(canvasId, labels, datasets) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === "undefined") return;

  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map((d) => ({
        label: d.label,
        data: d.data,
        backgroundColor: d.color,
        borderRadius: 6,
        maxBarThickness: 22,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: "#8b95a5", boxWidth: 12, font: { size: 11 } } },
        tooltip: { backgroundColor: "#1a2029", padding: 10, cornerRadius: 8 },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#8b95a5", font: { size: 10 }, maxRotation: 45, minRotation: 0 },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#8b95a5", font: { size: 11 }, precision: 0 },
        },
      },
    },
  });
  chartInstances.push(chart);
  return chart;
}

function injectExtraStyles() {
  if (document.getElementById("kickoff-extra-styles")) return;
  const s = document.createElement("style");
  s.id = "kickoff-extra-styles";
  s.textContent = `
    .tag{display:inline-flex;align-items:center;gap:.3rem;padding:.1rem .5rem;margin:0 .25rem .25rem 0;border:1px solid var(--border);border-radius:999px;font-size:.7rem;color:var(--text-muted)}
    .tag .crest{width:14px;height:14px}
    .match-extra{margin-top:.25rem;font-size:.72rem;color:var(--text-muted)}
    .match-team.winner span{font-weight:700}
    tr.fav-row td{background:rgba(163,230,53,.07)}
    .mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.5rem;margin:.75rem 0}
    .section-title{margin:1.25rem 0 .5rem}
    .squad-group{margin:1rem 0 .35rem;font-size:.8rem;color:var(--text-muted);font-weight:600}
    .event-row{display:flex;gap:.6rem;padding:.35rem 0;border-bottom:1px solid var(--border);font-size:.85rem}
    .event-min{min-width:3rem;color:var(--text-muted)}
    .event-sub{color:var(--text-muted);font-size:.78rem}
    .lineup-cols{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
    @media (max-width:640px){.lineup-cols{grid-template-columns:1fr}}
    .filter-input{width:100%;margin:0 0 1rem;padding:.55rem .75rem;border:1px solid var(--border);border-radius:8px;background:transparent;color:inherit;font:inherit}
    .note{font-size:.78rem;color:var(--text-muted);margin:.75rem 0}
  `;
  document.head.appendChild(s);
}
injectExtraStyles();

// ─── Renderers ─────────────────────────────────────

let standingsView = "TOTAL";

function standingsTableHtml(rows, showForm) {
  const fav = getFavorite();
  let html = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Pts/G</th>
            ${showForm ? "<th>Form</th>" : ""}<th></th>
          </tr>
        </thead>
        <tbody>`;

  rows.forEach((r) => {
    const isFav = fav && String(fav.id) === String(r.team.id);
    const ppg = r.playedGames ? (r.points / r.playedGames).toFixed(2) : "—";
    html += `
      <tr class="clickable${isFav ? " fav-row" : ""}" data-team-id="${r.team.id}">
        <td class="pos">${r.position}</td>
        <td>
          <div class="team-cell">
            ${crest(r.team.crest, r.team.name)}
            <span>${esc(r.team.shortName || r.team.name)}</span>
          </div>
        </td>
        <td>${r.playedGames}</td>
        <td>${r.won}</td>
        <td>${r.draw}</td>
        <td>${r.lost}</td>
        <td>${r.goalsFor}</td>
        <td>${r.goalsAgainst}</td>
        <td>${r.goalDifference > 0 ? "+" : ""}${r.goalDifference}</td>
        <td class="pts">${r.points}</td>
        <td>${ppg}</td>
        ${showForm ? `<td>${formPills(r.form)}</td>` : ""}
        <td>${heartBtn(r.team.id)}</td>
      </tr>`;
  });

  return html + `</tbody></table></div>`;
}

function renderStandings(data) {
  destroyCharts();
  const all = data.standings || [];
  if (!all.length) {
    content.innerHTML = `<div class="empty">No standings available.</div>`;
    return;
  }

  const typeOf = (t) => t.type || "TOTAL";
  const hasSplit =
    all.some((t) => typeOf(t) === "HOME") && all.some((t) => typeOf(t) === "AWAY");
  if (!hasSplit || !all.some((t) => typeOf(t) === standingsView)) standingsView = "TOTAL";

  let view = all.filter((t) => typeOf(t) === standingsView);
  if (!view.length) view = [all[0]];
  const single = view.length === 1;
  const rows = view[0].table || [];
  const showForm = view.some((t) => (t.table || []).some((r) => r.form));

  // Stats are always computed from the TOTAL tables (all groups together)
  const totals = all.filter((t) => typeOf(t) === "TOTAL");
  const statRows = (totals.length ? totals : [all[0]]).flatMap((t) => t.table || []);
  const homeRows = all.filter((t) => typeOf(t) === "HOME").flatMap((t) => t.table || []);
  const leaderTable = (totals[0] || all[0]).table || [];
  const leader = leaderTable[0];
  const second = leaderTable[1];

  const sum = (arr, k) => arr.reduce((s, r) => s + (r[k] || 0), 0);
  const totalGoals = sum(statRows, "goalsFor");
  const totalPlayed = sum(statRows, "playedGames");
  const totalMatches = Math.round(totalPlayed / 2);
  const gpg = totalMatches ? (totalGoals / totalMatches).toFixed(2) : "0";
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const drawRate = pct(sum(statRows, "draw"), totalPlayed);

  const played = statRows.filter((r) => r.playedGames > 0);
  const bestAttack = [...played].sort((a, b) => b.goalsFor - a.goalsFor)[0];
  const bestDefense = [...played].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];

  const fav = getFavorite();
  const favRow = fav && statRows.find((r) => String(r.team.id) === String(fav.id));

  let splitCard;
  if (homeRows.length) {
    const hp = sum(homeRows, "playedGames");
    splitCard = statCard(
      "📊", "yellow", "Home · Draw · Away",
      `${pct(sum(homeRows, "won"), hp)}% · ${pct(sum(homeRows, "draw"), hp)}% · ${pct(sum(homeRows, "lost"), hp)}%`,
      "Share of results"
    );
  } else {
    splitCard = statCard("📊", "yellow", "Draw rate", `${drawRate}%`, "Of all matches played");
  }

  const comp = data.competition || {};
  const season = data.season || {};
  const sy = season.startDate?.slice(0, 4);
  const ey = season.endDate?.slice(0, 4);
  const seasonLabel = sy ? (ey && ey !== sy ? `${sy}/${ey.slice(2)}` : sy) : "";
  const metaParts = [
    seasonLabel && `${seasonLabel} season`,
    `${statRows.length} teams`,
    data.area?.name,
    season.startDate && `${formatDay(season.startDate)} – ${formatDay(season.endDate)}`,
  ].filter(Boolean);

  let html = `
    <div class="hero-card">
      <div class="hero-content">
        <div class="hero-badge">${esc(comp.name || "League")}${comp.code ? ` · ${esc(comp.code)}` : ""}</div>
        <div class="hero-title">Every match is a<br><span>new opportunity.</span></div>
        <div class="hero-meta">${esc(metaParts.join(" · "))}</div>
        ${
          leader
            ? `<div class="hero-match">
                <div class="hero-team">
                  <div class="hero-team-badge home">${esc((leader.team.tla || leader.team.shortName || "?").slice(0, 3))}</div>
                  <span>${esc(leader.team.shortName || leader.team.name)}</span>
                </div>
                <span class="hero-vs">leads the table · ${leader.points} pts</span>
              </div>`
            : ""
        }
      </div>
      <div class="hero-visual"></div>
      <div class="hero-countdown">${season.currentMatchday ? `Matchday ${season.currentMatchday}` : ""}</div>
    </div>

    <div class="stats-row">
      ${
        favRow
          ? statCard("♥", "green", "Your team", `#${favRow.position}`, `${favRow.team.shortName || favRow.team.name} · ${favRow.points} pts`)
          : statCard("🏆", "green", "League leader", "1st", `${leader?.team?.shortName || "—"} · ${leader?.points ?? 0} pts`)
      }
      ${statCard("⚽", "purple", "Goals scored", totalGoals, `${gpg} per match · ${totalMatches} matches`)}
      ${splitCard}
      ${statCard("👥", "blue", "Teams", statRows.length, totals.length > 1 ? `${totals.length} groups` : "In competition")}
      ${statCard("🔥", "green", "Best attack", bestAttack?.goalsFor ?? "—", bestAttack?.team?.shortName || "")}
      ${statCard("🧱", "blue", "Best defense", bestDefense ? `${bestDefense.goalsAgainst} GA` : "—", bestDefense?.team?.shortName || "")}
      ${statCard("📏", "yellow", "Gap to 2nd", leader && second ? `${leader.points - second.points} pts` : "—", second ? `${second.team.shortName || second.team.name}` : "")}
      ${statCard("🗓", "purple", "Matchday", season.currentMatchday ?? "—", season.winner?.name ? `Last champion: ${season.winner.name}` : "Current round")}
    </div>

    <div class="card">
      <h2>Table · ${esc(comp.name || "")} · ${esc(seasonLabel)}</h2>
      ${
        hasSplit
          ? `<div class="filters" id="standingsView">
              <button data-view="TOTAL" class="${standingsView === "TOTAL" ? "active" : ""}">Total</button>
              <button data-view="HOME" class="${standingsView === "HOME" ? "active" : ""}">Home</button>
              <button data-view="AWAY" class="${standingsView === "AWAY" ? "active" : ""}">Away</button>
            </div>`
          : ""
      }
      ${
        single && rows.length
          ? `<div class="chart-box"><canvas id="chartPoints"></canvas></div>
             <div class="chart-box"><canvas id="chartGoalsForAgainst"></canvas></div>`
          : ""
      }
  `;

  view.forEach((t) => {
    const heading = [t.stage && t.stage !== "REGULAR_SEASON" ? prettyEnum(t.stage) : "", t.group ? prettyEnum(t.group) : ""]
      .filter(Boolean)
      .join(" · ");
    if (heading) html += `<h3 class="section-title">${esc(heading)}</h3>`;
    html += standingsTableHtml(t.table || [], showForm);
  });

  html += `</div>`;
  content.innerHTML = html;

  if (single && rows.length) {
    const top = rows.slice(0, 10);
    const labels = top.map((r) => r.team.shortName || r.team.name || "?");
    makeBarChart("chartPoints", labels, top.map((r) => r.points), "Points");
    makeGroupedBarChart("chartGoalsForAgainst", labels, [
      { label: "Goals for", data: top.map((r) => r.goalsFor), color: "#22c55e" },
      { label: "Goals against", data: top.map((r) => r.goalsAgainst), color: "#ef4444" },
    ]);
  }

  content.querySelectorAll("#standingsView button").forEach((btn) => {
    btn.addEventListener("click", () => {
      standingsView = btn.dataset.view;
      renderStandings(data);
    });
  });

  content.querySelectorAll("[data-team-id]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".btn-heart")) return;
      showTeam(row.dataset.teamId);
    });
  });
  bindHeartButtons(content);
}

function renderScorers(data) {
  destroyCharts();
  const scorers = data.scorers || [];
  if (!scorers.length) {
    content.innerHTML = `<div class="empty">No scorers found.</div>`;
    return;
  }

  const top = scorers.slice(0, 15);
  const labels = top.map((s) => (s.player?.name || "?").split(" ").pop());
  const hasAssists = scorers.some((s) => s.assists != null);

  const totalGoals = scorers.reduce((a, s) => a + (s.goals || 0), 0);
  const totalPens = scorers.reduce((a, s) => a + (s.penalties || 0), 0);
  const topScorer = scorers[0];
  const topAssist = hasAssists
    ? [...scorers].sort((a, b) => (b.assists || 0) - (a.assists || 0))[0]
    : null;
  const perGame = (s) => (s.playedMatches ? ((s.goals || 0) / s.playedMatches).toFixed(2) : "—");

  let html = `
    <div class="stats-row">
      ${statCard("⚽", "green", "Top scorer", topScorer.goals ?? "—", `${topScorer.player?.name || "—"} · ${topScorer.team?.shortName || topScorer.team?.name || ""}`)}
      ${
        topAssist
          ? statCard("🎯", "purple", "Most assists", topAssist.assists ?? 0, `${topAssist.player?.name || "—"} · ${topAssist.team?.shortName || ""}`)
          : statCard("🎯", "purple", "Best goals/game", perGame(topScorer), topScorer.player?.name || "")
      }
      ${statCard("📈", "blue", "Goals by listed players", totalGoals, `${scorers.length} players`)}
      ${statCard("🥅", "yellow", "Penalties", totalPens, totalGoals ? `${Math.round((totalPens / totalGoals) * 100)}% of goals` : "")}
    </div>

    <div class="card">
      <h2>Top Scorers · ${esc(data.competition?.name || "")}</h2>
      <div class="chart-box"><canvas id="chartGoals"></canvas></div>
  `;

  scorers.forEach((s, i) => {
    const p = s.player || {};
    const age = ageFrom(p.dateOfBirth);
    const line1 = [s.team?.name, p.nationality, p.position, age != null ? `${age} yrs` : "", s.playedMatches != null ? `${s.playedMatches} games` : ""]
      .filter(Boolean)
      .map(esc)
      .join(" · ");
    const line2 = [
      s.assists != null ? `${s.assists} assists` : "",
      s.penalties != null ? `${s.penalties} pens` : "",
      `${perGame(s)} goals/game`,
    ]
      .filter(Boolean)
      .join(" · ");

    html += `
      <div class="scorer-row" data-person-id="${esc(p.id || "")}">
        <div class="scorer-rank">${i + 1}</div>
        ${crest(s.team?.crest, s.team?.name)}
        <div class="scorer-info">
          <div class="scorer-name">${esc(p.name || "—")}</div>
          <div class="scorer-team">${line1}</div>
          <div class="scorer-team">${esc(line2)}</div>
        </div>
        <div class="scorer-goals">${s.goals ?? "—"}</div>
      </div>
    `;
  });

  html += `</div>`;
  content.innerHTML = html;

  const datasets = [{ label: "Goals", data: top.map((s) => s.goals ?? 0), color: "#22c55e" }];
  if (hasAssists) datasets.push({ label: "Assists", data: top.map((s) => s.assists ?? 0), color: "#a3e635" });
  makeGroupedBarChart("chartGoals", labels, datasets);

  content.querySelectorAll("[data-person-id]").forEach((el) => {
    if (el.dataset.personId) {
      el.addEventListener("click", () => showPerson(el.dataset.personId));
    }
  });
}

function renderMatches(data, title = "Matches", baseParams = null) {
  destroyCharts();
  const params0 = baseParams || { type: "matches", comp: currentComp };
  const activeStatus = params0.status ?? "";
  const matches = [...(data.matches || [])];

  if (!matches.length && !baseParams) {
    content.innerHTML = `<div class="empty">No matches found.</div>`;
    return;
  }

  matches.sort((a, b) =>
    activeStatus === "FINISHED"
      ? new Date(b.utcDate) - new Date(a.utcDate)
      : new Date(a.utcDate) - new Date(b.utcDate)
  );

  const finished = matches.filter((m) => m.status === "FINISHED");
  const goals = finished.reduce(
    (s, m) => s + (m.score?.fullTime?.home ?? 0) + (m.score?.fullTime?.away ?? 0),
    0
  );
  const rs = data.resultSet;
  const summary = [
    `${matches.length} matches`,
    rs?.played != null ? `${rs.played} played in the season` : "",
    finished.length ? `${goals} goals · ${(goals / finished.length).toFixed(2)} per match` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const btn = (status, label) =>
    `<button data-status="${status}" class="${activeStatus === status ? "active" : ""}">${label}</button>`;

  let html = `
    <div class="card">
      <h2>${esc(title)}</h2>
      <p class="note">${esc(summary)}</p>
      <div class="filters" id="matchFilters">
        ${btn("SCHEDULED,TIMED", "Upcoming")}
        ${btn("FINISHED", "Finished")}
        ${btn("IN_PLAY,PAUSED", "Live")}
        ${btn("", "All")}
      </div>
      <input class="filter-input" id="matchSearch" type="search" placeholder="Filter by team…" />
      <div class="match-list" id="matchList">
        ${matches.length ? matches.map((m) => matchCardHtml(m, !!baseParams && baseParams.type !== "matches")).join("") : `<div class="empty">No matches for this filter.</div>`}
      </div>
    </div>
  `;
  content.innerHTML = html;

  bindMatchCards(content);

  document.getElementById("matchSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    content.querySelectorAll("#matchList .match-card").forEach((el) => {
      el.style.display = !q || (el.dataset.search || "").includes(q) ? "" : "none";
    });
  });

  document.querySelectorAll("#matchFilters button").forEach((b) => {
    b.addEventListener("click", async () => {
      const params = { ...params0 };
      delete params.status;
      if (b.dataset.status) params.status = b.dataset.status;
      try {
        const d = await api(params);
        renderMatches(d, title, params);
      } catch (e) {
        showError(e.message);
      }
    });
  });
}

function renderTeams(data) {
  destroyCharts();
  const teams = data.teams || [];
  if (!teams.length) {
    content.innerHTML = `<div class="empty">No teams found.</div>`;
    return;
  }

  const season = data.season || {};
  let html = `
    <div class="card">
      <h2>Squads · ${esc(data.competition?.name || "")}</h2>
      <p class="note">${teams.length} teams${season.startDate ? ` · season ${esc(season.startDate.slice(0, 4))}` : ""}</p>
      <input class="filter-input" id="teamSearch" type="search" placeholder="Filter teams…" />
      <div class="teams-grid">
  `;

  teams.forEach((t) => {
    const sub = [t.tla, t.founded ? `Founded ${t.founded}` : "", t.area?.name].filter(Boolean).map(esc).join(" · ");
    html += `
      <div class="team-card" data-team-id="${t.id}" data-search="${esc(`${t.name} ${t.shortName || ""} ${t.tla || ""}`.toLowerCase())}">
        ${crest(t.crest, t.name)}
        <div>
          <div class="name">${esc(t.shortName || t.name)}</div>
          <div class="tla">${sub}</div>
          ${t.venue ? `<div class="tla">${esc(t.venue)}</div>` : ""}
          ${t.coach?.name ? `<div class="tla">Coach: ${esc(t.coach.name)}</div>` : ""}
          ${t.squad?.length ? `<div class="tla">${t.squad.length} players</div>` : ""}
        </div>
        ${heartBtn(t.id)}
      </div>
    `;
  });

  html += `</div></div>`;
  content.innerHTML = html;

  document.getElementById("teamSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    content.querySelectorAll(".team-card").forEach((el) => {
      el.style.display = !q || (el.dataset.search || "").includes(q) ? "" : "none";
    });
  });

  content.querySelectorAll("[data-team-id]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".btn-heart")) return;
      showTeam(el.dataset.teamId);
    });
  });
  bindHeartButtons(content);
}

function renderTrends(data) {
  destroyCharts();
  const trends = data.trends || [];
  if (!trends.length) {
    content.innerHTML = `
      <div class="empty">
        No recent form data available right now.<br>
        <span style="font-size:0.85rem">Trends depend on recent matches in your plan competitions.</span>
      </div>`;
    return;
  }

  const teamStats = {};
  trends.forEach((t) => {
    const home = t.homeTeam || t.home;
    const away = t.awayTeam || t.away;

    if (home?.id) {
      if (!teamStats[home.id]) {
        teamStats[home.id] = {
          name: home.shortName || home.name,
          crest: home.crest,
          forms: [],
          avgPoints: [],
          avgGoals: [],
        };
      }
      if (home.form) teamStats[home.id].forms.push(home.form);
      if (home.avg_points != null) teamStats[home.id].avgPoints.push(home.avg_points);
      if (home.avg_goals_scored != null) teamStats[home.id].avgGoals.push(home.avg_goals_scored);
    }

    if (away?.id) {
      if (!teamStats[away.id]) {
        teamStats[away.id] = {
          name: away.shortName || away.name,
          crest: away.crest,
          forms: [],
          avgPoints: [],
          avgGoals: [],
        };
      }
      if (away.form) teamStats[away.id].forms.push(away.form);
      if (away.avg_points != null) teamStats[away.id].avgPoints.push(away.avg_points);
      if (away.avg_goals_scored != null) teamStats[away.id].avgGoals.push(away.avg_goals_scored);
    }
  });

  const sorted = Object.values(teamStats)
    .map((t) => ({
      ...t,
      pts: t.avgPoints.length ? t.avgPoints.reduce((a, b) => a + b, 0) / t.avgPoints.length : 0,
    }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 10);

  let html = `
    <div class="card">
      <h2>Recent form</h2>
      <p style="font-size:0.82rem;color:var(--text-muted);margin:-0.5rem 0 1rem">
        Average points and sequence (W=win, D=draw, L=loss) in recent matches.
      </p>
  `;

  if (sorted.length) {
    html += `<div class="chart-box"><canvas id="chartForm"></canvas></div>`;
  }

  html += `<div class="trend-list">`;

  trends.slice(0, 25).forEach((t) => {
    const home = t.homeTeam || t.home || {};
    const away = t.awayTeam || t.away || {};
    const homeForm = (home.form || "").split("").slice(0, 5);
    const awayForm = (away.form || "").split("").slice(0, 5);

    const homePills = homeForm.map((c) => `<span class="form-pill ${c}">${c}</span>`).join("");
    const awayPills = awayForm.map((c) => `<span class="form-pill ${c}">${c}</span>`).join("");

    html += `
      <div class="trend-card">
        <div class="trend-header">
          <div class="trend-teams">
            ${crest(home.crest)}
            <span>${home.shortName || home.name || "—"}</span>
            <span class="trend-vs">vs</span>
            <span>${away.shortName || away.name || "—"}</span>
            ${crest(away.crest)}
          </div>
          <div style="display:flex;gap:0.75rem;align-items:center">
            <div class="form-pills" title="Home form">${homePills || "—"}</div>
            <div class="form-pills" title="Away form">${awayPills || "—"}</div>
          </div>
        </div>
        <div class="trend-stats">
          <span>Avg pts home: <strong>${home.avg_points != null ? home.avg_points.toFixed(1) : "—"}</strong></span>
          <span>Avg pts away: <strong>${away.avg_points != null ? away.avg_points.toFixed(1) : "—"}</strong></span>
          <span>Avg goals home: <strong>${home.avg_goals_scored != null ? home.avg_goals_scored.toFixed(1) : "—"}</strong></span>
          <span>Avg goals away: <strong>${away.avg_goals_scored != null ? away.avg_goals_scored.toFixed(1) : "—"}</strong></span>
          ${t.competition?.name ? `<span>${t.competition.name}</span>` : ""}
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  content.innerHTML = html;

  if (sorted.length) {
    makeBarChart(
      "chartForm",
      sorted.map((t) => t.name),
      sorted.map((t) => +t.pts.toFixed(2)),
      "Avg points",
      "#a3e635"
    );
  }
}

function renderToday(data) {
  destroyCharts();
  const matches = data.matches || [];
  if (!matches.length) {
    content.innerHTML = `<div class="empty">No matches today in plan competitions.</div>`;
    return;
  }

  const byComp = {};
  matches.forEach((m) => {
    const code = m.competition?.code || m.competition?.name || "Other";
    (byComp[code] = byComp[code] || []).push(m);
  });

  const live = matches.filter((m) => ["IN_PLAY", "PAUSED"].includes(m.status)).length;
  const done = matches.filter((m) => m.status === "FINISHED").length;

  let html = `
    <div class="card">
      <h2>Today's matches</h2>
      <p class="note">${matches.length} matches · ${live} live · ${done} finished · ${Object.keys(byComp).length} competitions</p>
  `;

  Object.values(byComp).forEach((list) => {
    const c = list[0].competition || {};
    html += `<h3 class="section-title">${crest(c.emblem)} ${esc(c.name || "—")}${c.type ? ` <span class="tag">${esc(prettyEnum(c.type))}</span>` : ""}</h3><div class="match-list">`;
    list
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
      .forEach((m) => {
        html += matchCardHtml(m);
      });
    html += `</div>`;
  });

  html += `</div>`;
  content.innerHTML = html;
  bindMatchCards(content);
}

function renderSearch() {
  destroyCharts();
  content.innerHTML = `
    <div class="card">
      <h2>Advanced search</h2>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem">
        Use the numeric ID of a team, match or player (visible when clicking other tabs).
      </p>
      <form class="search-form" id="searchForm">
        <select id="searchType">
          <option value="team">Team (ID)</option>
          <option value="match">Match (ID)</option>
          <option value="person">Player (ID)</option>
          <option value="teamMatches">Team matches</option>
          <option value="head2head">Head-to-Head (match ID)</option>
        </select>
        <input type="text" id="searchId" placeholder="e.g. 86 (Real Madrid)" required />
        <button type="submit">Search</button>
      </form>
      <div id="searchResult"></div>
    </div>
  `;

  document.getElementById("searchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = document.getElementById("searchType").value;
    const id = document.getElementById("searchId").value.trim();
    if (!id) return;

    const resultEl = document.getElementById("searchResult");
    resultEl.innerHTML = "";

    try {
      if (type === "team") await showTeam(id);
      else if (type === "match") await showMatch(id);
      else if (type === "person") await showPerson(id);
      else if (type === "teamMatches") {
        const data = await api({ type: "teamMatches", id, status: "SCHEDULED,FINISHED", limit: 20 });
        resultEl.innerHTML = `<h3>Recent / upcoming matches</h3>`;
        const list = document.createElement("div");
        list.className = "match-list";

        (data.matches || []).forEach((m) => {
          const home = m.homeTeam?.shortName || m.homeTeam?.name || "—";
          const away = m.awayTeam?.shortName || m.awayTeam?.name || "—";
          const score =
            m.status === "FINISHED"
              ? `${m.score?.fullTime?.home ?? "–"} × ${m.score?.fullTime?.away ?? "–"}`
              : "vs";

          list.innerHTML += `
            <div class="match-card" data-match-id="${m.id}">
              <div class="match-team home"><span>${home}</span>${crest(m.homeTeam?.crest)}</div>
              <div class="match-score">${score}</div>
              <div class="match-team away">${crest(m.awayTeam?.crest)}<span>${away}</span></div>
              <div class="match-meta">${formatDate(m.utcDate)} · ${statusBadge(m.status)}</div>
            </div>
          `;
        });

        resultEl.appendChild(list);
        resultEl.querySelectorAll("[data-match-id]").forEach((el) => {
          el.addEventListener("click", () => showMatch(el.dataset.matchId));
        });
      } else if (type === "head2head") {
        const data = await api({ type: "head2head", id, limit: 10 });
        resultEl.innerHTML = `<h3>Head-to-Head</h3>`;
        const list = document.createElement("div");
        list.className = "match-list";

        (data.matches || data.head2head?.matches || []).forEach((m) => {
          const home = m.homeTeam?.shortName || m.homeTeam?.name || "—";
          const away = m.awayTeam?.shortName || m.awayTeam?.name || "—";
          const score = `${m.score?.fullTime?.home ?? "–"} × ${m.score?.fullTime?.away ?? "–"}`;

          list.innerHTML += `
            <div class="match-card">
              <div class="match-team home"><span>${home}</span></div>
              <div class="match-score">${score}</div>
              <div class="match-team away"><span>${away}</span></div>
              <div class="match-meta">${formatDate(m.utcDate)}</div>
            </div>
          `;
        });

        resultEl.appendChild(list);
      }
    } catch (err) {
      resultEl.innerHTML = `<div class="error">${err.message}</div>`;
    }
  });
}

// ─── Details (modal) ───────────────────────────────
// ─── Details (modal) ───────────────────────────────

const POSITION_ORDER = ["Goalkeeper", "Defence", "Defender", "Midfield", "Midfielder", "Offence", "Attacker", "Forward"];

function fillTeamForm(box, t, matches) {
  const byDate = (a, b) => new Date(a.utcDate) - new Date(b.utcDate);
  const done = matches.filter((m) => m.status === "FINISHED").sort(byDate);
  const next = matches.filter((m) => ["SCHEDULED", "TIMED"].includes(m.status)).sort(byDate).slice(0, 5);

  if (!done.length && !next.length) {
    box.innerHTML = `<p class="empty">No matches returned for this team.</p>`;
    return;
  }

  const st = { w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, hw: 0, hd: 0, hl: 0, aw: 0, ad: 0, al: 0 };
  const results = [];

  done.forEach((m) => {
    const isHome = m.homeTeam?.id === t.id;
    const ft = m.score?.fullTime || {};
    const gf = isHome ? ft.home : ft.away;
    const ga = isHome ? ft.away : ft.home;
    if (gf == null || ga == null) return;

    const r = gf > ga ? "W" : gf < ga ? "L" : "D";
    results.push(r);
    st.gf += gf;
    st.ga += ga;
    if (ga === 0) st.cs++;
    const k = r === "W" ? "w" : r === "D" ? "d" : "l";
    st[k]++;
    st[(isHome ? "h" : "a") + k]++;
  });

  const played = results.length;
  const pts = st.w * 3 + st.d;
  const avg = (n) => (played ? (n / played).toFixed(2) : "—");
  const last5 = results.slice(-5);

  let html = `
    ${last5.length ? `<div class="form-pills" style="margin-bottom:.5rem">${last5.map((r) => `<span class="form-pill ${r}">${r}</span>`).join("")}</div>` : ""}
    <div class="mini-grid">
      ${detailItem("Played", played)}
      ${detailItem("W · D · L", `${st.w} · ${st.d} · ${st.l}`)}
      ${detailItem("Goals for · against", `${st.gf} · ${st.ga}`)}
      ${detailItem("Points", `${pts} (${avg(pts)}/game)`)}
      ${detailItem("Goals for / game", avg(st.gf))}
      ${detailItem("Goals against / game", avg(st.ga))}
      ${detailItem("Clean sheets", st.cs)}
      ${detailItem("Home W · D · L", `${st.hw} · ${st.hd} · ${st.hl}`)}
      ${detailItem("Away W · D · L", `${st.aw} · ${st.ad} · ${st.al}`)}
    </div>
  `;

  if (done.length) {
    html += `<h4 class="squad-group">Latest results</h4><div class="match-list">${done
      .slice(-5)
      .reverse()
      .map((m) => matchCardHtml(m, true))
      .join("")}</div>`;
  }
  if (next.length) {
    html += `<h4 class="squad-group">Next matches</h4><div class="match-list">${next
      .map((m) => matchCardHtml(m, true))
      .join("")}</div>`;
  }

  box.innerHTML = html;
  bindMatchCards(box);
}

async function showTeam(id) {
  try {
    const t = await api({ type: "team", id });
    const favActive = isFavorite(t.id);
    const squad = t.squad || [];

    const groups = {};
    squad.forEach((p) => {
      const key = p.position || "Other";
      (groups[key] = groups[key] || []).push(p);
    });
    const keys = Object.keys(groups).sort((a, b) => {
      const ia = POSITION_ORDER.indexOf(a);
      const ib = POSITION_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const ages = squad.map((p) => ageFrom(p.dateOfBirth)).filter((a) => a != null);
    const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : null;
    const nations = new Set(squad.map((p) => p.nationality).filter(Boolean));

    const squadHtml = squad.length
      ? `<h3 class="section-title">Squad (${squad.length})</h3>` +
        keys
          .map(
            (k) => `
          <h4 class="squad-group">${esc(k)} (${groups[k].length})</h4>
          <div class="squad-list">
            ${groups[k]
              .map((p) => {
                const age = ageFrom(p.dateOfBirth);
                const info = [age != null ? `${age} yrs` : "", p.nationality, p.shirtNumber ? `#${p.shirtNumber}` : ""]
                  .filter(Boolean)
                  .map(esc)
                  .join(" · ");
                return `<div class="squad-item" data-person-id="${esc(p.id)}"><span>${esc(p.name)}</span><span class="squad-pos">${info}</span></div>`;
              })
              .join("")}
          </div>`
          )
          .join("")
      : "";

    const staffHtml = t.staff?.length
      ? `<h3 class="section-title">Staff</h3><div class="squad-list">${t.staff
          .map((s) => `<div class="squad-item"><span>${esc(s.name)}</span><span class="squad-pos">${esc([s.role, s.nationality].filter(Boolean).join(" · "))}</span></div>`)
          .join("")}</div>`
      : "";

    const comps = (t.runningCompetitions || [])
      .map((c) => `<span class="tag">${crest(c.emblem)}${esc(c.name)}</span>`)
      .join("");

    const coach = t.coach || {};
    const coachAge = ageFrom(coach.dateOfBirth);
    const coachLine = coach.name
      ? [coach.name, coach.nationality, coachAge != null ? `${coachAge} yrs` : ""].filter(Boolean).join(" · ")
      : null;
    const contract = coach.contract?.until ? `${coach.contract.start || "?"} → ${coach.contract.until}` : null;
    const site = t.website
      ? `<a href="${esc(t.website)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(t.website.replace(/^https?:\/\//, ""))}</a>`
      : null;

    openModal(`
      <div class="detail-header">
        ${crest(t.crest, t.name)}
        <div>
          <h2>${esc(t.name)}</h2>
          <div class="detail-meta">${esc([t.area?.name, t.tla, t.founded ? `Founded ${t.founded}` : ""].filter(Boolean).join(" · "))}</div>
        </div>
      </div>
      ${comps ? `<div style="margin:.5rem 0">${comps}</div>` : ""}
      <div class="detail-grid">
        ${detailItem("Stadium", t.venue)}
        ${detailItem("Colors", t.clubColors)}
        ${detailItem("Address", t.address)}
        ${detailItem("Coach", coachLine)}
        ${detailItem("Coach contract", contract)}
        ${detailItem("Website", site, true)}
        ${detailItem("Squad size", squad.length || null)}
        ${detailItem("Average age", avgAge)}
        ${detailItem("Nationalities", nations.size || null)}
        ${detailItem("Updated", t.lastUpdated ? formatDate(t.lastUpdated) : null)}
      </div>
      <h3 class="section-title">Season form · all competitions</h3>
      <div id="teamFormBox" data-for-team="${esc(t.id)}"><p class="empty">Loading matches…</p></div>
      ${squadHtml}
      ${staffHtml}
      <div class="modal-actions">
        <button class="btn-primary" id="btnTeamMatches">View all matches</button>
        <button class="btn-outline" id="btnToggleFav">${favActive ? "♥ Remove favorite" : "♡ Favorite team"}</button>
      </div>
    `);

    modalBody.querySelectorAll("[data-person-id]").forEach((el) => {
      el.addEventListener("click", () => {
        closeModal();
        showPerson(el.dataset.personId);
      });
    });

    // Same request as "View all matches", so the second use is served from cache.
    const teamMatchesParams = { type: "teamMatches", id };

    api(teamMatchesParams)
      .then((d) => {
        const box = document.getElementById("teamFormBox");
        if (box && box.dataset.forTeam === String(t.id)) fillTeamForm(box, t, d.matches || []);
      })
      .catch((e) => {
        const box = document.getElementById("teamFormBox");
        if (box && box.dataset.forTeam === String(t.id)) box.innerHTML = `<div class="error">${esc(e.message)}</div>`;
      });

    document.getElementById("btnTeamMatches")?.addEventListener("click", async () => {
      closeModal();
      try {
        const m = await api(teamMatchesParams);
        renderMatches({ matches: m.matches, resultSet: m.resultSet }, `Matches · ${t.shortName || t.name}`, teamMatchesParams);
        currentTab = "matches";
        document.querySelectorAll(".nav-item[data-tab]").forEach((tb) =>
          tb.classList.toggle("active", tb.dataset.tab === "matches")
        );
      } catch (e) {
        showError(e.message);
      }
    });

    document.getElementById("btnToggleFav")?.addEventListener("click", () => {
      if (isFavorite(t.id)) {
        setFavorite(null);
        document.getElementById("btnToggleFav").textContent = "♡ Favorite team";
      } else {
        setFavorite(t);
        document.getElementById("btnToggleFav").textContent = "♥ Remove favorite";
      }
    });
  } catch (e) {
    showError(e.message);
  }
}

function eventMinute(e) {
  if (e.minute == null) return "";
  return `${e.minute}${e.injuryTime ? "+" + e.injuryTime : ""}'`;
}

function lineupHtml(team) {
  if (!team || (!team.lineup?.length && !team.bench?.length && !team.formation)) return "";
  const player = (p) =>
    `<div class="squad-item" data-person-id="${esc(p.id)}"><span>${p.shirtNumber != null ? esc(p.shirtNumber) + " · " : ""}${esc(p.name)}</span><span class="squad-pos">${esc(p.position || "")}</span></div>`;
  return `
    <div>
      <h4 class="squad-group">${esc(team.shortName || team.name)}${team.formation ? ` · ${esc(team.formation)}` : ""}</h4>
      ${team.coach?.name ? `<div class="event-sub">Coach: ${esc(team.coach.name)}</div>` : ""}
      <div class="squad-list">${(team.lineup || []).map(player).join("")}</div>
      ${team.bench?.length ? `<h4 class="squad-group">Bench</h4><div class="squad-list">${team.bench.map(player).join("")}</div>` : ""}
    </div>`;
}

async function showMatch(id) {
  try {
    const m = await api({ type: "match", id });
    const home = m.homeTeam?.name || "—";
    const away = m.awayTeam?.name || "—";
    const ft = m.score?.fullTime || {};
    const scoreH = ft.home ?? ft.homeTeam ?? "–";
    const scoreA = ft.away ?? ft.awayTeam ?? "–";
    const breakdown = scoreBreakdown(m);
    const winnerName =
      m.score?.winner === "HOME_TEAM" ? home : m.score?.winner === "AWAY_TEAM" ? away : m.score?.winner === "DRAW" ? "Draw" : null;

    const refs = (m.referees || [])
      .map((r) => [r.name, r.type ? prettyEnum(r.type) : "", r.nationality].filter(Boolean).join(" · "))
      .join("; ");
    const odds = m.odds && m.odds.homeWin != null ? `${m.odds.homeWin} / ${m.odds.draw} / ${m.odds.awayWin}` : null;
    const season = m.season || {};

    const goals = m.goals || [];
    const bookings = m.bookings || [];
    const subs = m.substitutions || [];
    const hasLineups = lineupHtml(m.homeTeam) || lineupHtml(m.awayTeam);

    const goalsHtml = goals.length
      ? `<h3 class="section-title">Goals</h3>` +
        goals
          .map(
            (g) => `
        <div class="event-row">
          <span class="event-min">${esc(eventMinute(g))}</span>
          <div>
            <strong>${esc(g.scorer?.name || "—")}</strong>${g.type && g.type !== "REGULAR" ? ` <span class="tag">${esc(prettyEnum(g.type))}</span>` : ""}
            <div class="event-sub">${esc(g.team?.shortName || g.team?.name || "")}${g.assist?.name ? ` · assist ${esc(g.assist.name)}` : ""}${g.score ? ` · ${esc(g.score.home)}–${esc(g.score.away)}` : ""}</div>
          </div>
        </div>`
          )
          .join("")
      : "";

    const bookingsHtml = bookings.length
      ? `<h3 class="section-title">Cards</h3>` +
        bookings
          .map(
            (b) => `
        <div class="event-row">
          <span class="event-min">${esc(eventMinute(b))}</span>
          <div>
            <strong>${esc(b.player?.name || "—")}</strong> <span class="tag">${esc(prettyEnum(b.card))}</span>
            <div class="event-sub">${esc(b.team?.shortName || b.team?.name || "")}</div>
          </div>
        </div>`
          )
          .join("")
      : "";

    const subsHtml = subs.length
      ? `<h3 class="section-title">Substitutions</h3>` +
        subs
          .map(
            (s) => `
        <div class="event-row">
          <span class="event-min">${esc(eventMinute(s))}</span>
          <div>
            <strong>${esc(s.playerIn?.name || "—")}</strong> in · ${esc(s.playerOut?.name || "—")} out
            <div class="event-sub">${esc(s.team?.shortName || s.team?.name || "")}</div>
          </div>
        </div>`
          )
          .join("")
      : "";

    const noEvents =
      m.status === "FINISHED" && !goals.length && !bookings.length && !subs.length && !hasLineups
        ? `<p class="note">Goals, cards and lineups are only returned by the API for some competitions and plans.</p>`
        : "";

    openModal(`
      <div style="text-align:center;margin-bottom:1.25rem">
        <div class="detail-meta">${esc(m.competition?.name || "")}${m.area?.name ? ` · ${esc(m.area.name)}` : ""} · ${formatDate(m.utcDate)}</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:1.5rem;margin:1rem 0">
          <div style="text-align:center">
            ${crest(m.homeTeam?.crest)}
            <div style="font-weight:600;margin-top:0.35rem;font-size:0.9rem">${esc(home)}</div>
          </div>
          <div style="font-size:1.75rem;font-weight:700">${scoreH} × ${scoreA}</div>
          <div style="text-align:center">
            ${crest(m.awayTeam?.crest)}
            <div style="font-weight:600;margin-top:0.35rem;font-size:0.9rem">${esc(away)}</div>
          </div>
        </div>
        ${statusBadge(m.status)}
        ${m.matchday ? `<span style="margin-left:0.5rem;font-size:0.8rem;color:var(--text-muted)">MD ${m.matchday}</span>` : ""}
        ${breakdown.length ? `<div class="match-extra">${esc(breakdown.join(" · "))}</div>` : ""}
      </div>
      <div class="detail-grid">
        ${detailItem("Venue", m.venue)}
        ${detailItem("Referees", refs)}
        ${detailItem("Stage", prettyEnum(m.stage))}
        ${detailItem("Group", prettyEnum(m.group))}
        ${detailItem("Winner", winnerName)}
        ${detailItem("Result type", prettyEnum(m.score?.duration))}
        ${detailItem("Season", season.startDate ? `${formatDay(season.startDate)} – ${formatDay(season.endDate)}` : null)}
        ${detailItem("Odds (H / D / A)", odds)}
        ${detailItem("Updated", m.lastUpdated ? formatDate(m.lastUpdated) : null)}
      </div>
      ${goalsHtml}${bookingsHtml}${subsHtml}
      ${hasLineups ? `<h3 class="section-title">Lineups</h3><div class="lineup-cols">${lineupHtml(m.homeTeam)}${lineupHtml(m.awayTeam)}</div>` : ""}
      ${noEvents}
      <button class="btn-primary" id="btnH2H">View Head-to-Head</button>
      <div id="h2hBox"></div>
    `);

    modalBody.querySelectorAll("[data-person-id]").forEach((el) => {
      el.addEventListener("click", () => {
        closeModal();
        showPerson(el.dataset.personId);
      });
    });

    document.getElementById("btnH2H")?.addEventListener("click", async () => {
      const box = document.getElementById("h2hBox");
      if (!box) return;
      try {
        const h2h = await api({ type: "head2head", id, limit: 10 });
        const list = h2h.matches || h2h.head2head?.matches || [];
        const agg = h2h.aggregates || h2h.head2head?.aggregates;
        const aggHtml = agg
          ? `<div class="mini-grid">
              ${detailItem("Meetings", agg.numberOfMatches)}
              ${detailItem("Total goals", agg.totalGoals)}
              ${detailItem(`${agg.homeTeam?.shortName || agg.homeTeam?.name || "Home"} wins`, agg.homeTeam?.wins)}
              ${detailItem("Draws", agg.homeTeam?.draws)}
              ${detailItem(`${agg.awayTeam?.shortName || agg.awayTeam?.name || "Away"} wins`, agg.awayTeam?.wins)}
            </div>`
          : "";
        box.innerHTML = `
          <h3 class="section-title">Previous meetings</h3>
          ${aggHtml}
          ${list.length ? `<div class="match-list">${list.map((x) => matchCardHtml(x, true)).join("")}</div>` : "<p class='empty'>No history</p>"}
        `;
        bindMatchCards(box);
      } catch (e) {
        box.innerHTML = `<div class="error">${esc(e.message)}</div>`;
      }
    });
  } catch (e) {
    showError(e.message);
  }
}

async function showPerson(id) {
  try {
    const p = await api({ type: "person", id });
    const age = ageFrom(p.dateOfBirth);
    const team = p.currentTeam || {};
    const contract = team.contract?.until ? `${team.contract.start || "?"} → ${team.contract.until}` : null;
    const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");

    openModal(`
      <div class="detail-header">
        ${crest(team.crest, team.name)}
        <div>
          <h2>${esc(p.name)}</h2>
          <div class="detail-meta">${esc([p.position || p.role, p.nationality, team.name].filter(Boolean).join(" · "))}</div>
        </div>
      </div>
      <div class="detail-grid">
        ${detailItem("Full name", fullName && fullName !== p.name ? fullName : null)}
        ${detailItem("Born", p.dateOfBirth ? `${formatDay(p.dateOfBirth)}${age != null ? ` (${age} yrs)` : ""}` : null)}
        ${detailItem("Nationality", p.nationality)}
        ${detailItem("Position", p.position)}
        ${detailItem("Section", prettyEnum(p.section))}
        ${detailItem("Shirt", p.shirtNumber)}
        ${detailItem("Current team", team.name)}
        ${detailItem("Team country", team.area?.name)}
        ${detailItem("Contract", contract)}
        ${detailItem("Updated", p.lastUpdated ? formatDate(p.lastUpdated) : null)}
      </div>
      <button class="btn-primary" id="btnPersonMatches">View matches &amp; stats</button>
      <div id="personBox"></div>
    `);

    const teamCrest = modalBody.querySelector(".detail-header .crest");
    if (teamCrest && team.id) {
      teamCrest.style.cursor = "pointer";
      teamCrest.addEventListener("click", () => {
        closeModal();
        showTeam(team.id);
      });
    }

    document.getElementById("btnPersonMatches")?.addEventListener("click", async () => {
      const box = document.getElementById("personBox");
      if (!box) return;
      try {
        const m = await api({ type: "personMatches", id, limit: 50 });
        const matches = [...(m.matches || [])]
          .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
          .slice(0, 15);

        const labels = {
          numberOfMatches: "Matches",
          startingXI: "Starting XI",
          minutesPlayed: "Minutes",
          goals: "Goals",
          ownGoals: "Own goals",
          assists: "Assists",
          penalties: "Penalties",
          subbedIn: "Subbed in",
          subbedOut: "Subbed out",
          yellowCards: "Yellow cards",
          yellowRedCards: "Yellow-red",
          redCards: "Red cards",
        };
        const agg = m.aggregations || {};
        const aggHtml = Object.keys(labels)
          .filter((k) => agg[k] != null)
          .map((k) => detailItem(labels[k], agg[k]))
          .join("");

        box.innerHTML = `
          ${aggHtml ? `<h3 class="section-title">Stats</h3><div class="mini-grid">${aggHtml}</div>` : ""}
          <h3 class="section-title">Recent matches</h3>
          ${matches.length ? `<div class="match-list">${matches.map((x) => matchCardHtml(x, true)).join("")}</div>` : "<p class='empty'>No data</p>"}
        `;
        bindMatchCards(box);
      } catch (e) {
        box.innerHTML = `<div class="error">${esc(e.message)}</div>`;
      }
    });
  } catch (e) {
    showError(e.message);
  }
}

// ─── Navigation ────────────────────────────────────

async function loadTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".nav-item[data-tab]").forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === tab)
  );

  try {
    if (tab === "standings") {
      const data = await api({ type: "standings", comp: currentComp });
      renderStandings(data);
    } else if (tab === "scorers") {
      const data = await api({ type: "scorers", comp: currentComp, limit: 50 });
      renderScorers(data);
    } else if (tab === "matches") {
      const data = await api({ type: "matches", comp: currentComp, status: "SCHEDULED,TIMED" });
      renderMatches(
        data,
        `Matches · ${compSelect.options[compSelect.selectedIndex].text}`,
        { type: "matches", comp: currentComp, status: "SCHEDULED,TIMED" }
      );
    } else if (tab === "teams") {
      const data = await api({ type: "teams", comp: currentComp });
      renderTeams(data);
    } else if (tab === "trends") {
      const data = await api({ type: "trends", competitions: currentComp, window: 5 });
      renderTrends(data);
    } else if (tab === "today") {
      const data = await api({ type: "matchesToday" });
      renderToday(data);
    } else if (tab === "search") {
      renderSearch();
      setStatus("Ready");
    }
  } catch (err) {
    showError(err.message || "Failed to load data.");
  }
}

document.getElementById("mainTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-item[data-tab]");
  if (btn?.dataset.tab) loadTab(btn.dataset.tab);
});

compSelect.addEventListener("change", () => {
  currentComp = compSelect.value;
  standingsView = "TOTAL";
  cache = {};
  const keep = currentTab === "today" || currentTab === "search" ? "standings" : currentTab;
  loadTab(keep);
});

document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalBackdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// Init
updateDateGreeting();
renderFavChip();
loadTab("standings");
// ─── Header controls ───────────────────────────────

// Search accepts a numeric Football-Data ID and opens the existing search screen.
const globalSearch = document.getElementById("globalSearch");
if (globalSearch) {
  globalSearch.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = globalSearch.value.trim();
    loadTab("search");

    requestAnimationFrame(() => {
      const searchId = document.getElementById("searchId");
      const searchForm = document.getElementById("searchForm");
      if (!searchId || !searchForm) return;
      searchId.value = value;
      if (value) searchForm.requestSubmit();
      else searchId.focus();
    });
  });
}

// Theme toggle
const themeToggle = document.getElementById("themeToggle");

function applySavedTheme() {
  const light = localStorage.getItem("fd_theme") === "light";
  document.body.classList.toggle("light-theme", light);
  if (themeToggle) themeToggle.setAttribute("aria-pressed", String(light));
}

if (themeToggle) {
  applySavedTheme();

  themeToggle.addEventListener("click", () => {
    const light = !document.body.classList.contains("light-theme");
    document.body.classList.toggle("light-theme", light);
    localStorage.setItem("fd_theme", light ? "light" : "dark");
    themeToggle.setAttribute("aria-pressed", String(light));
  });
}

// Settings
const settingsButton = document.querySelector(".settings-btn");

if (settingsButton) {
  settingsButton.addEventListener("click", () => {
    const favorite = getFavorite();

    openModal(`
      <div class="settings-panel">
        <h2>Configurações</h2>
        <p class="detail-meta">Preferências do dashboard KICKOFF.</p>

        <div class="detail-item" style="margin:1rem 0">
          <div class="label">Competição selecionada</div>
          <div class="value">${compSelect.options[compSelect.selectedIndex].text}</div>
        </div>

        <div class="detail-item" style="margin:1rem 0">
          <div class="label">Time favorito</div>
          <div class="value">${favorite ? favorite.name : "Nenhum time selecionado"}</div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-primary" id="settingsRefresh">Atualizar dados</button>
          <button type="button" class="btn-outline" id="settingsClearFavorite">Remover favorito</button>
        </div>
      </div>
    `);

    document.getElementById("settingsRefresh").addEventListener("click", () => {
      cache = {};
      closeModal();
      loadTab(currentTab);
    });

    document.getElementById("settingsClearFavorite").addEventListener("click", () => {
      setFavorite(null);
      closeModal();
    });
  });
}

// Notifications
const notificationsButton = document.getElementById("notificationsBtn");

if (notificationsButton) {
  notificationsButton.addEventListener("click", async () => {
    openModal('<h2>Partidas de hoje</h2><p class="detail-meta">Carregando partidas…</p>');

    try {
      const data = await api({ type: "matchesToday" });
      const matches = data.matches || [];

      const list = matches.length
        ? matches.map((m) => `
            <div class="notification-match">
              <strong>${m.homeTeam?.shortName || m.homeTeam?.name || "—"}</strong>
              <span>${
                m.status === "FINISHED" || m.status === "IN_PLAY" || m.status === "PAUSED"
                  ? `${m.score?.fullTime?.home ?? "–"} × ${m.score?.fullTime?.away ?? "–"}`
                  : "vs"
              }</span>
              <strong>${m.awayTeam?.shortName || m.awayTeam?.name || "—"}</strong>
              <small>${m.competition?.name || ""} · ${formatDate(m.utcDate)}</small>
            </div>
          `).join("")
        : '<p class="empty">Nenhuma partida encontrada para hoje nas competições disponíveis.</p>';

      modalBody.innerHTML = `
        <h2>Partidas de hoje</h2>
        <p class="detail-meta">${matches.length} partida(s) encontrada(s)</p>
        ${list}
      `;
    } catch (error) {
      modalBody.innerHTML = `<h2>Partidas de hoje</h2><div class="error">${error.message}</div>`;
    }
  });
}

// ─── Supabase Auth (cadastro e login de usuários) ─────────────

// Configure a URL e a chave publicável do Supabase abaixo.
// NUNCA coloque a chave service_role neste arquivo.

const SUPABASE_URL = "https://pupcggbdnmurrflcizkf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_eRIUE5Kw2x_poM3N7dg6TQ_4UsfscN-";

let supabaseClient = null;
let currentAuthUser = null;

function isSupabaseConfigured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("COLE_AQUI") &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.includes("COLE_AQUI")
  );
}

function updateAuthButton(user) {
  const button = document.getElementById("authButton");
  const buttonText = document.getElementById("authButtonText");
  const userLabel = document.getElementById("authUserLabel");

  if (!button || !buttonText || !userLabel) return;

  if (user) {
    const displayName = user.user_metadata?.full_name || user.email || "Usuário";

    buttonText.textContent = "Minha conta / Sair";
    userLabel.textContent = displayName;
    userLabel.hidden = false;

    greeting.textContent = `Olá, ${displayName.split(" ")[0]}`;
  } else {
    buttonText.textContent = "Entrar / Criar conta";
    userLabel.hidden = true;
    updateDateGreeting();
  }
}

function showAuthModal(mode = "login", message = "") {
  const isSignup = mode === "signup";

  openModal(`
    <section class="auth-panel">
      <div class="auth-heading-icon">⚽</div>

      <h2>${isSignup ? "Criar sua conta" : "Entrar no KICKOFF"}</h2>

      <p class="detail-meta">
        ${isSignup
          ? "Crie sua conta para acessar sua experiência."
          : "Acesse sua conta com e-mail e senha."}
      </p>

      ${message ? `<div class="auth-message" role="status">${escapeHtml(message)}</div>` : ""}

      <form id="authForm" class="auth-form">
        ${
          isSignup
            ? `
              <label for="authName">Nome</label>
              <input
                id="authName"
                name="name"
                type="text"
                autocomplete="name"
                placeholder="Seu nome"
                required
                minlength="2"
              />
            `
            : ""
        }

        <label for="authEmail">E-mail</label>
        <input
          id="authEmail"
          name="email"
          type="email"
          autocomplete="email"
          placeholder="voce@email.com"
          required
        />

        <label for="authPassword">Senha</label>
        <input
          id="authPassword"
          name="password"
          type="password"
          autocomplete="${isSignup ? "new-password" : "current-password"}"
          placeholder="Mínimo de 6 caracteres"
          required
          minlength="6"
        />

        <button class="btn-primary auth-submit" type="submit">
          ${isSignup ? "Criar conta" : "Entrar"}
        </button>
      </form>

      <p class="auth-switch">
        ${isSignup ? "Já tem uma conta?" : "Ainda não tem uma conta?"}
        <button type="button" id="authSwitch">
          ${isSignup ? "Fazer login" : "Criar conta"}
        </button>
      </p>
    </section>
  `);

  document.getElementById("authSwitch").addEventListener("click", () => {
    showAuthModal(isSignup ? "login" : "signup");
  });

  document.getElementById("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const submit = form.querySelector("button[type='submit']");

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const name = isSignup ? form.elements.name.value.trim() : "";

    submit.disabled = true;
    submit.textContent = isSignup ? "Criando conta…" : "Entrando…";

    try {
      let result;

      if (isSignup) {
        result = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });
      } else {
        result = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });
      }

      if (result.error) throw result.error;

      if (isSignup && !result.data.session) {
        showAuthModal(
          "login",
          "Conta criada! Confira seu e-mail para confirmar o cadastro e depois faça login."
        );
        return;
      }

      currentAuthUser = result.data.user || result.data.session?.user || null;

      updateAuthButton(currentAuthUser);
      closeModal();

    } catch (error) {
      showAuthModal(
        mode,
        error.message || "Não foi possível autenticar. Tente novamente."
      );
    }
  });
}

async function initializeSupabaseAuth() {
  const button = document.getElementById("authButton");

  if (!button) return;

  if (!isSupabaseConfigured()) {
    button.addEventListener("click", () => {
      openModal(`
        <div class="auth-panel">
          <h2>Conectar ao Supabase</h2>

          <p>
            Para ativar cadastro e login, configure
            <strong>SUPABASE_URL</strong> e
            <strong>SUPABASE_ANON_KEY</strong>
            no início da seção Supabase Auth do arquivo app.js.
          </p>

          <ol class="auth-steps">
            <li>Abra seu projeto no Supabase.</li>
            <li>Entre em Project Settings → API.</li>
            <li>Copie a Project URL e a chave publishable (ou anon legacy).</li>
            <li>Cole os valores nas duas constantes do app.js.</li>
          </ol>

          <p class="auth-warning">
            Nunca use a chave service_role no navegador.
          </p>
        </div>
      `);
    });

    updateAuthButton(null);
    return;
  }

  if (!window.supabase?.createClient) {
    console.error("Biblioteca do Supabase não foi carregada.");
    return;
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  button.addEventListener("click", async () => {
    if (currentAuthUser) {
      const confirmed = window.confirm("Deseja sair da sua conta?");
      if (!confirmed) return;

      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        openModal(`<div class="error">${escapeHtml(error.message)}</div>`);
        return;
      }

      currentAuthUser = null;
      updateAuthButton(null);
      return;
    }

    showAuthModal("login");
  });

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Erro ao recuperar sessão Supabase:", error.message);
  }

  currentAuthUser = data?.session?.user || null;
  updateAuthButton(currentAuthUser);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentAuthUser = session?.user || null;
    updateAuthButton(currentAuthUser);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

initializeSupabaseAuth();