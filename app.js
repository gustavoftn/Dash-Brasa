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

// ─── Renderers ─────────────────────────────────────

function renderStandings(data) {
  destroyCharts();
  const tables = data.standings || [];
  if (!tables.length) {
    content.innerHTML = `<div class="empty">No standings available.</div>`;
    return;
  }

  const total = tables.find((t) => t.type === "TOTAL") || tables[0];
  const rows = total.table || [];
  const top = rows.slice(0, 10);
  const chartLabels = top.map((r) => r.team.shortName || r.team.name || "?");
  const chartPoints = top.map((r) => r.points);

  // Derive simple stats from table
  const leader = rows[0];
  const totalGoals = rows.reduce((s, r) => s + (r.goalsFor || 0), 0);
  const totalPlayed = rows.reduce((s, r) => s + (r.playedGames || 0), 0);
  const totalWins = rows.reduce((s, r) => s + (r.won || 0), 0);
  const winRate = totalPlayed ? Math.round((totalWins / totalPlayed) * 100) : 0;

  let html = `
    <div class="hero-card">
      <div class="hero-content">
        <div class="hero-badge">${data.competition?.name || "League"}</div>
        <div class="hero-title">Every match is a<br><span>new opportunity.</span></div>
        <div class="hero-meta">${data.season?.startDate?.slice(0, 4) || ""} season · ${rows.length} teams</div>
        ${
          leader
            ? `<div class="hero-match">
                <div class="hero-team">
                  <div class="hero-team-badge home">${(leader.team.tla || leader.team.shortName || "?").slice(0, 3)}</div>
                  <span>${leader.team.shortName || leader.team.name}</span>
                </div>
                <span class="hero-vs">leads the table</span>
              </div>`
            : ""
        }
      </div>
      <div class="hero-visual"></div>
      <div class="hero-countdown">01 · 00 · 00</div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">
          <span class="stat-icon green">🏆</span>
          League position
        </div>
        <div class="stat-value">1st</div>
        <div class="stat-delta up">Leader · ${leader?.team?.shortName || "—"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          <span class="stat-icon purple">⚽</span>
          Goals scored
        </div>
        <div class="stat-value">${totalGoals}</div>
        <div class="stat-delta neutral">Across ${rows.length} teams</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          <span class="stat-icon yellow">📊</span>
          Win rate
        </div>
        <div class="stat-value">${winRate}%</div>
        <div class="stat-delta neutral">League average</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          <span class="stat-icon blue">👥</span>
          Teams
        </div>
        <div class="stat-value">${rows.length}</div>
        <div class="stat-delta neutral">In competition</div>
      </div>
    </div>

    <div class="card">
      <h2>Table · ${data.competition?.name || ""} · ${data.season?.startDate?.slice(0, 4) || ""}</h2>
      <div class="chart-box">
        <canvas id="chartPoints"></canvas>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GF</th>
              <th>GA</th>
              <th>GD</th>
              <th>Pts</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
  `;

  rows.forEach((r) => {
    html += `
      <tr class="clickable" data-team-id="${r.team.id}">
        <td class="pos">${r.position}</td>
        <td>
          <div class="team-cell">
            ${crest(r.team.crest, r.team.name)}
            <span>${r.team.shortName || r.team.name}</span>
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
        <td>${heartBtn(r.team.id)}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div></div>`;
  content.innerHTML = html;

  makeBarChart("chartPoints", chartLabels, chartPoints, "Points");

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

  const top = scorers.slice(0, 12);
  const labels = top.map((s) => (s.player?.name || "?").split(" ").pop());
  const goals = top.map((s) => s.goals ?? 0);

  let html = `
    <div class="card">
      <h2>Top Scorers · ${data.competition?.name || ""}</h2>
      <div class="chart-box">
        <canvas id="chartGoals"></canvas>
      </div>
  `;

  scorers.forEach((s, i) => {
    html += `
      <div class="scorer-row" data-person-id="${s.player?.id || ""}">
        <div class="scorer-rank">${i + 1}</div>
        <div class="scorer-info">
          <div class="scorer-name">${s.player?.name || "—"}</div>
          <div class="scorer-team">${s.team?.name || ""}</div>
        </div>
        <div class="scorer-goals">${s.goals ?? "—"}</div>
      </div>
    `;
  });

  html += `</div>`;
  content.innerHTML = html;

  makeBarChart("chartGoals", labels, goals, "Goals", "#22c55e");

  content.querySelectorAll("[data-person-id]").forEach((el) => {
    if (el.dataset.personId) {
      el.addEventListener("click", () => showPerson(el.dataset.personId));
    }
  });
}

function renderMatches(data, title = "Matches") {
  destroyCharts();
  const matches = data.matches || [];
  if (!matches.length) {
    content.innerHTML = `<div class="empty">No matches found.</div>`;
    return;
  }

  let html = `
    <div class="card">
      <h2>${title}</h2>
      <div class="filters" id="matchFilters">
        <button data-status="SCHEDULED,TIMED" class="active">Upcoming</button>
        <button data-status="FINISHED">Finished</button>
        <button data-status="IN_PLAY,PAUSED">Live</button>
        <button data-status="">All</button>
      </div>
      <div class="match-list" id="matchList">
  `;

  matches.forEach((m) => {
    const home = m.homeTeam?.shortName || m.homeTeam?.name || "—";
    const away = m.awayTeam?.shortName || m.awayTeam?.name || "—";
    const score =
      m.status === "FINISHED" || m.status === "IN_PLAY" || m.status === "PAUSED"
        ? `${m.score?.fullTime?.home ?? m.score?.fullTime?.homeTeam ?? "–"} × ${m.score?.fullTime?.away ?? m.score?.fullTime?.awayTeam ?? "–"}`
        : "vs";

    html += `
      <div class="match-card" data-match-id="${m.id}">
        <div class="match-team home">
          <span>${home}</span>
          ${crest(m.homeTeam?.crest)}
        </div>
        <div class="match-score">${score}</div>
        <div class="match-team away">
          ${crest(m.awayTeam?.crest)}
          <span>${away}</span>
        </div>
        <div class="match-meta">
          ${formatDate(m.utcDate)} · ${statusBadge(m.status)}
          ${m.matchday ? ` · MD ${m.matchday}` : ""}
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  content.innerHTML = html;

  content.querySelectorAll("[data-match-id]").forEach((el) => {
    el.addEventListener("click", () => showMatch(el.dataset.matchId));
  });

  document.querySelectorAll("#matchFilters button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll("#matchFilters button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const status = btn.dataset.status;
      try {
        const params = { type: "matches", comp: currentComp };
        if (status) params.status = status;
        const d = await api(params);
        renderMatches(d, title);
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

  let html = `
    <div class="card">
      <h2>Squads · ${data.competition?.name || ""}</h2>
      <div class="teams-grid">
  `;

  teams.forEach((t) => {
    html += `
      <div class="team-card" data-team-id="${t.id}">
        ${crest(t.crest, t.name)}
        <div>
          <div class="name">${t.shortName || t.name}</div>
          <div class="tla">${t.tla || ""}</div>
        </div>
        ${heartBtn(t.id)}
      </div>
    `;
  });

  html += `</div></div>`;
  content.innerHTML = html;

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
    html += `
      <div class="chart-box">
        <canvas id="chartForm"></canvas>
      </div>
    `;
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
    if (!byComp[code]) byComp[code] = [];
    byComp[code].push(m);
  });

  let html = `<div class="card"><h2>Today's matches</h2>`;

  Object.entries(byComp).forEach(([, list]) => {
    html += `<h3>${list[0].competition?.name || "—"}</h3><div class="match-list">`;
    list.forEach((m) => {
      const home = m.homeTeam?.shortName || m.homeTeam?.name || "—";
      const away = m.awayTeam?.shortName || m.awayTeam?.name || "—";
      const score =
        m.status === "FINISHED" || m.status === "IN_PLAY"
          ? `${m.score?.fullTime?.home ?? "–"} × ${m.score?.fullTime?.away ?? "–"}`
          : "vs";
      html += `
        <div class="match-card" data-match-id="${m.id}">
          <div class="match-team home"><span>${home}</span>${crest(m.homeTeam?.crest)}</div>
          <div class="match-score">${score}</div>
          <div class="match-team away">${crest(m.awayTeam?.crest)}<span>${away}</span></div>
          <div class="match-meta">${formatDate(m.utcDate)} · ${statusBadge(m.status)}</div>
        </div>
      `;
    });
    html += `</div>`;
  });

  html += `</div>`;
  content.innerHTML = html;

  content.querySelectorAll("[data-match-id]").forEach((el) => {
    el.addEventListener("click", () => showMatch(el.dataset.matchId));
  });
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

async function showTeam(id) {
  try {
    const t = await api({ type: "team", id });
    const favActive = isFavorite(t.id);

    let squadHtml = "";
    if (t.squad?.length) {
      squadHtml = `
        <h3>Squad (${t.squad.length})</h3>
        <div class="squad-list">
          ${t.squad
            .map(
              (p) => `
            <div class="squad-item" data-person-id="${p.id}">
              <span>${p.name}</span>
              <span class="squad-pos">${p.position || p.role || ""} ${p.nationality ? "· " + p.nationality : ""}</span>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }

    openModal(`
      <div class="detail-header">
        ${crest(t.crest, t.name)}
        <div>
          <h2>${t.name}</h2>
          <div class="detail-meta">${t.area?.name || ""} · Founded ${t.founded || "—"}</div>
        </div>
      </div>
      <div class="detail-grid">
        <div class="detail-item"><div class="label">Stadium</div><div class="value">${t.venue || "—"}</div></div>
        <div class="detail-item"><div class="label">Colors</div><div class="value">${t.clubColors || "—"}</div></div>
        <div class="detail-item"><div class="label">Coach</div><div class="value">${t.coach?.name || "—"}</div></div>
        <div class="detail-item"><div class="label">Website</div><div class="value">${t.website ? `<a href="${t.website}" target="_blank" rel="noopener" style="color:var(--accent)">Link</a>` : "—"}</div></div>
      </div>
      ${squadHtml}
      <div class="modal-actions">
        <button class="btn-primary" id="btnTeamMatches">View matches</button>
        <button class="btn-outline" id="btnToggleFav">${favActive ? "♥ Remove favorite" : "♡ Favorite team"}</button>
      </div>
    `);

    modalBody.querySelectorAll("[data-person-id]").forEach((el) => {
      el.addEventListener("click", () => {
        closeModal();
        showPerson(el.dataset.personId);
      });
    });

    document.getElementById("btnTeamMatches")?.addEventListener("click", async () => {
      closeModal();
      try {
        const m = await api({ type: "teamMatches", id, limit: 15 });
        renderMatches({ matches: m.matches }, `Matches · ${t.shortName || t.name}`);
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

async function showMatch(id) {
  try {
    const m = await api({ type: "match", id });
    const home = m.homeTeam?.name || "—";
    const away = m.awayTeam?.name || "—";
    const scoreH = m.score?.fullTime?.home ?? m.score?.fullTime?.homeTeam ?? "–";
    const scoreA = m.score?.fullTime?.away ?? m.score?.fullTime?.awayTeam ?? "–";

    openModal(`
      <div style="text-align:center;margin-bottom:1.25rem">
        <div class="detail-meta">${m.competition?.name || ""} · ${formatDate(m.utcDate)}</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:1.5rem;margin:1rem 0">
          <div style="text-align:center">
            ${crest(m.homeTeam?.crest)}
            <div style="font-weight:600;margin-top:0.35rem;font-size:0.9rem">${home}</div>
          </div>
          <div style="font-size:1.75rem;font-weight:700">${scoreH} × ${scoreA}</div>
          <div style="text-align:center">
            ${crest(m.awayTeam?.crest)}
            <div style="font-weight:600;margin-top:0.35rem;font-size:0.9rem">${away}</div>
          </div>
        </div>
        ${statusBadge(m.status)}
        ${m.matchday ? `<span style="margin-left:0.5rem;font-size:0.8rem;color:var(--text-muted)">MD ${m.matchday}</span>` : ""}
      </div>
      <div class="detail-grid">
        <div class="detail-item"><div class="label">Venue</div><div class="value">${m.venue || "—"}</div></div>
        <div class="detail-item"><div class="label">Referee</div><div class="value">${m.referees?.[0]?.name || "—"}</div></div>
      </div>
      <button class="btn-primary" id="btnH2H">View Head-to-Head</button>
    `);

    document.getElementById("btnH2H")?.addEventListener("click", async () => {
      try {
        const h2h = await api({ type: "head2head", id, limit: 8 });
        const matches = h2h.matches || h2h.head2head?.matches || [];
        const list = matches
          .map((x) => {
            const sH = x.score?.fullTime?.home ?? "–";
            const sA = x.score?.fullTime?.away ?? "–";
            return `<div style="padding:0.4rem 0;border-bottom:1px solid var(--border);font-size:0.85rem">
              ${x.homeTeam?.shortName || x.homeTeam?.name} ${sH}×${sA} ${x.awayTeam?.shortName || x.awayTeam?.name}
              <span style="color:var(--text-muted);margin-left:0.5rem">${formatDate(x.utcDate)}</span>
            </div>`;
          })
          .join("");
        modalBody.innerHTML += `<h3 style="margin:1.25rem 0 0.5rem">Previous meetings</h3>${list || "<p class='empty'>No history</p>"}`;
      } catch (e) {
        modalBody.innerHTML += `<div class="error">${e.message}</div>`;
      }
    });
  } catch (e) {
    showError(e.message);
  }
}

async function showPerson(id) {
  try {
    const p = await api({ type: "person", id });

    openModal(`
      <div class="detail-header">
        <div>
          <h2>${p.name}</h2>
          <div class="detail-meta">${p.position || p.role || ""} · ${p.nationality || ""}</div>
        </div>
      </div>
      <div class="detail-grid">
        <div class="detail-item"><div class="label">Born</div><div class="value">${p.dateOfBirth || "—"}</div></div>
        <div class="detail-item"><div class="label">Shirt</div><div class="value">${p.shirtNumber ?? "—"}</div></div>
        <div class="detail-item"><div class="label">Current team</div><div class="value">${p.currentTeam?.name || "—"}</div></div>
        <div class="detail-item"><div class="label">Updated</div><div class="value">${formatDate(p.lastUpdated)}</div></div>
      </div>
      <button class="btn-primary" id="btnPersonMatches">View matches</button>
    `);

    document.getElementById("btnPersonMatches")?.addEventListener("click", async () => {
      try {
        const m = await api({ type: "personMatches", id, limit: 12 });
        const matches = m.matches || [];
        const list = matches
          .map((x) => {
            const sH = x.score?.fullTime?.home ?? "–";
            const sA = x.score?.fullTime?.away ?? "–";
            return `<div style="padding:0.4rem 0;border-bottom:1px solid var(--border);font-size:0.85rem">
              ${x.homeTeam?.shortName || "—"} ${sH}×${sA} ${x.awayTeam?.shortName || "—"}
              <span style="color:var(--text-muted);margin-left:0.5rem">${formatDate(x.utcDate)}</span>
            </div>`;
          })
          .join("");
        modalBody.innerHTML += `
          <h3 style="margin:1.25rem 0 0.5rem">Recent matches</h3>
          ${list || "<p class='empty'>No data</p>"}
          ${
            m.aggregations
              ? `<p style="margin-top:0.75rem;font-size:0.8rem;color:var(--text-muted)">
            Goals: ${m.aggregations.goals ?? 0} · Assists: ${m.aggregations.assists ?? 0} · Minutes: ${m.aggregations.minutesPlayed ?? 0}
          </p>`
              : ""
          }
        `;
      } catch (e) {
        modalBody.innerHTML += `<div class="error">${e.message}</div>`;
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
      const data = await api({ type: "scorers", comp: currentComp });
      renderScorers(data);
    } else if (tab === "matches") {
      const data = await api({ type: "matches", comp: currentComp, status: "SCHEDULED,TIMED" });
      renderMatches(data, `Matches · ${compSelect.options[compSelect.selectedIndex].text}`);
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
    // renderSearch is synchronous, so its form exists immediately after loadTab starts.
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

// Theme toggle: the selected theme is saved in this browser.
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

// Settings opens a working panel with refresh and favorite-management actions.
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

// Notifications button shows today's fixtures from the same API used by the Today tab.
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
              <span>${m.status === "FINISHED" || m.status === "IN_PLAY" || m.status === "PAUSED"
                ? `${m.score?.fullTime?.home ?? "–"} × ${m.score?.fullTime?.away ?? "–"}`
                : "vs"}</span>
              <strong>${m.awayTeam?.shortName || m.awayTeam?.name || "—"}</strong>
              <small>${m.competition?.name || ""} · ${formatDate(m.utcDate)}</small>
            </div>
          `).join("")
        : '<p class="empty">Nenhuma partida encontrada para hoje nas competições disponíveis.</p>';
      modalBody.innerHTML = `<h2>Partidas de hoje</h2><p class="detail-meta">${matches.length} partida(s) encontrada(s)</p>${list}`;
    } catch (error) {
      modalBody.innerHTML = `<h2>Partidas de hoje</h2><div class="error">${error.message}</div>`;
    }
  });
}