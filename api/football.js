 const state = {
      comp: "BSA",
      tab: "standings",
      standingType: "TOTAL", // TOTAL | HOME | AWAY
      matchday: "",
      matchStatus: "",
      cache: {} // Cache local em memória para não repetir requisições ao trocar abas
    };

    const appContent = document.getElementById("appContent");
    const compSelect = document.getElementById("compSelect");

    // Função auxiliar para buscar da sua API serverless
    async function fetchAPI(params) {
      const query = new URLSearchParams(params).toString();
      if (state.cache[query]) return state.cache[query];

      const res = await fetch(`/api/football?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar dados");

      state.cache[query] = data;
      return data;
    }

    // Atualiza o cabeçalho com dados gerais da competição
    async function loadCompetitionHeader() {
      try {
        const data = await fetchAPI({ comp: state.comp, type: "competition" });
        const season = data.currentSeason || {};
        state.matchday = season.currentMatchday || "";

        document.getElementById("compHeader").innerHTML = `
          ${data.emblem ? `<img src="${data.emblem}" alt="${data.name}">` : ""}
          <div>
            <h1>${data.name} (${data.area?.name || ""})</h1>
            <div class="comp-meta">
              Temporada: ${season.startDate || "?"} até ${season.endDate || "?"} • 
              Rodada Atual: <strong>${season.currentMatchday || "-"}</strong>
            </div>
          </div>
        `;
      } catch (err) {
        console.error(err);
      }
    }

    // 1. RENDERIZA CLASSIFICAÇÃO (TOTAL, HOME, AWAY)
    async function renderStandings() {
      appContent.innerHTML = `<div class="loading">Carregando tabela...</div>`;
      const data = await fetchAPI({ comp: state.comp, type: "standings" });

      const tableObj = data.standings.find(s => s.type === state.standingType) || data.standings[0];
      if (!tableObj) {
        appContent.innerHTML = `<p>Tabela indisponível para esta competição.</p>`;
        return;
      }

      const rows = tableObj.table.map(row => {
        const formHtml = (row.form || "")
          .split(",")
          .filter(Boolean)
          .map(r => `<span class="badge ${r}">${r === "W" ? "V" : r === "D" ? "E" : "D"}</span>`)
          .join("");

        return `
          <tr>
            <td class="num"><strong>${row.position}</strong></td>
            <td>
              <div class="team-cell">
                <img src="${row.team.crest}" alt="">
                <span>${row.team.shortName || row.team.name}</span>
              </div>
            </td>
            <td class="num"><strong>${row.points}</strong></td>
            <td class="num">${row.playedGames}</td>
            <td class="num">${row.won}</td>
            <td class="num">${row.draw}</td>
            <td class="num">${row.lost}</td>
            <td class="num">${row.goalsFor}</td>
            <td class="num">${row.goalsAgainst}</td>
            <td class="num">${row.goalDifference}</td>
            <td><div class="form-badges">${formHtml || "-"}</div></td>
          </tr>
        `;
      }).join("");

      appContent.innerHTML = `
        <div class="controls">
          <button class="pill-btn ${state.standingType === "TOTAL" ? "active" : ""}" onclick="setStandingType('TOTAL')">Geral</button>
          <button class="pill-btn ${state.standingType === "HOME" ? "active" : ""}" onclick="setStandingType('HOME')">Mandante (Casa)</button>
          <button class="pill-btn ${state.standingType === "AWAY" ? "active" : ""}" onclick="setStandingType('AWAY')">Visitante (Fora)</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="num">#</th>
                <th>Clube</th>
                <th class="num">PTS</th>
                <th class="num">J</th>
                <th class="num">V</th>
                <th class="num">E</th>
                <th class="num">D</th>
                <th class="num">GP</th>
                <th class="num">GC</th>
                <th class="num">SG</th>
                <th class="num">Últimos 5</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    // 2. RENDERIZA PARTIDAS + FILTROS + BOTÃO H2H
    async function renderMatches() {
      appContent.innerHTML = `<div class="loading">Carregando partidas...</div>`;
      const params = { comp: state.comp, type: "matches" };
      if (state.matchday) params.matchday = state.matchday;
      if (state.matchStatus) params.status = state.matchStatus;

      const data = await fetchAPI(params);
      const matches = data.matches || [];

      const statusLabel = {
        FINISHED: "Encerrado",
        IN_PLAY: "🔴 AO VIVO",
        PAUSED: "⏸ Intervalo",
        TIMED: "Agendado",
        SCHEDULED: "A definir",
        POSTPONED: "Adiado"
      };

      const cards = matches.map(m => {
        const date = new Date(m.utcDate).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
        });
        const ft = m.score?.fullTime || {};
        const ht = m.score?.halfTime || {};
        const referee = m.referees?.[0]?.name || "Árbitro não informado";

        return `
          <div class="match-card">
            <div class="match-header">
              <span>Rodada ${m.matchday || "-"} • ${date}</span>
              <span>${statusLabel[m.status] || m.status}</span>
            </div>
            <div class="match-teams">
              <div class="match-row">
                <div class="team-cell">
                  <img src="${m.homeTeam.crest}" alt="">
                  <span>${m.homeTeam.shortName || m.homeTeam.name}</span>
                </div>
                <span class="score">${ft.home ?? "-"}</span>
              </div>
              <div class="match-row">
                <div class="team-cell">
                  <img src="${m.awayTeam.crest}" alt="">
                  <span>${m.awayTeam.shortName || m.awayTeam.name}</span>
                </div>
                <span class="score">${ft.away ?? "-"}</span>
              </div>
            </div>
            <div class="match-footer">
              <span>1ºT: ${ht.home ?? "-"} x ${ht.away ?? "-"} | ${referee}</span>
              <button class="pill-btn" onclick="openH2H(${m.id})">H2H</button>
            </div>
          </div>
        `;
      }).join("");

      appContent.innerHTML = `
        <div class="controls">
          <label>Rodada:
            <input type="number" min="1" max="38" value="${state.matchday}"
              style="width:70px; padding:8px; background:var(--surface); color:#fff; border:1px solid var(--border); border-radius:8px;"
              onchange="setMatchFilter('matchday', this.value)" placeholder="Todas">
          </label>
          <select onchange="setMatchFilter('matchStatus', this.value)">
            <option value="" ${state.matchStatus === "" ? "selected" : ""}>Todos os Status</option>
            <option value="IN_PLAY,PAUSED" ${state.matchStatus === "IN_PLAY,PAUSED" ? "selected" : ""}>Ao Vivo</option>
            <option value="SCHEDULED,TIMED" ${state.matchStatus === "SCHEDULED,TIMED" ? "selected" : ""}>Próximos Jogos</option>
            <option value="FINISHED" ${state.matchStatus === "FINISHED" ? "selected" : ""}>Encerrados</option>
          </select>
        </div>
        <div class="matches-grid">${cards || "<p>Nenhuma partida encontrada para este filtro.</p>"}</div>
      `;
    }

    // 3. RENDERIZA ARTILHARIA E ASSISTÊNCIAS
    async function renderScorers() {
      appContent.innerHTML = `<div class="loading">Carregando artilharia...</div>`;
      const data = await fetchAPI({ comp: state.comp, type: "scorers", limit: 30 });
      const scorers = data.scorers || [];

      const rows = scorers.map((s, idx) => `
        <tr>
          <td class="num">${idx + 1}</td>
          <td>
            <strong>${s.player.name}</strong><br>
            <small style="color:var(--muted)">${s.player.nationality} • ${s.player.position || ""}</small>
          </td>
          <td>
            <div class="team-cell">
              <img src="${s.team.crest}" alt="">
              <span>${s.team.shortName || s.team.name}</span>
            </div>
          </td>
          <td class="num"><strong>${s.goals}</strong></td>
          <td class="num">${s.assists ?? 0}</td>
          <td class="num">${s.penalties ?? 0}</td>
          <td class="num">${s.playedMatches ?? "-"}</td>
        </tr>
      `).join("");

      appContent.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="num">#</th>
                <th>Jogador</th>
                <th>Clube</th>
                <th class="num">Gols</th>
                <th class="num">Assist.</th>
                <th class="num">Pênaltis</th>
                <th class="num">Jogos</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    // 4. RENDERIZA TIMES, ESTÁDIOS, TÉCNICOS E ELENCOS
    async function renderTeams() {
      appContent.innerHTML = `<div class="loading">Carregando clubes e elencos...</div>`;
      const data = await fetchAPI({ comp: state.comp, type: "teams" });
      const teams = data.teams || [];

      const cards = teams.map(t => {
        const squadHtml = (t.squad || [])
          .map(p => `<li><span>${p.name} <small style="color:var(--muted)">(${p.nationality})</small></span><span>${p.position || "-"}</span></li>`)
          .join("");

        return `
          <div class="team-card">
            <div class="team-card-header">
              <img src="${t.crest}" alt="">
              <div>
                <h3>${t.name}</h3>
                <small style="color:var(--muted)">Fundação: ${t.founded || "?"} • ${t.tla || ""}</small>
              </div>
            </div>
            <div class="team-details">
              <span>🏟️ Estádio: <strong>${t.venue || "Não informado"}</strong></span>
              <span>👔 Técnico: <strong>${t.coach?.name || "Não informado"}</strong> (${t.coach?.nationality || "-"})</span>
              <span>🎨 Cores: ${t.clubColors || "-"}</span>
            </div>
            <details>
              <summary>Ver Elenco Completo (${t.squad?.length || 0} jogadores)</summary>
              <ul class="squad-list">${squadHtml || "<li>Elenco indisponível</li>"}</ul>
            </details>
          </div>
        `;
      }).join("");

      appContent.innerHTML = `<div class="teams-grid">${cards}</div>`;
    }

    // MODAL DE CONFRONTO DIRETO (HEAD-TO-HEAD)
    async function openH2H(matchId) {
      const modal = document.getElementById("h2hModal");
      const body = document.getElementById("h2hBody");
      body.innerHTML = `<div class="loading">Buscando histórico...</div>`;
      modal.showModal();

      try {
        const data = await fetchAPI({ type: "matchDetail", id: matchId });
        const agg = data.aggregates || {};
        const h2hMatches = data.head2head?.matches || [];

        body.innerHTML = `
          <p style="font-size:0.9rem; color:var(--muted)">
            Total de jogos analisados: <strong>${agg.numberOfMatches || 0}</strong> • Total de gols: <strong>${agg.totalGoals || 0}</strong>
          </p>
          <div class="h2h-stats">
            <div>
              <strong>${agg.homeTeam?.wins ?? 0}</strong><br>
              <small>Vitórias ${agg.homeTeam?.name || "Mandante"}</small>
            </div>
            <div>
              <strong>${agg.homeTeam?.draws ?? 0}</strong><br>
              <small>Empates</small>
            </div>
            <div>
              <strong>${agg.awayTeam?.wins ?? 0}</strong><br>
              <small>Vitórias ${agg.awayTeam?.name || "Visitante"}</small>
            </div>
          </div>
          <h4 style="margin-bottom:8px;">Últimos Confrontos:</h4>
          <ul class="squad-list">
            ${h2hMatches.map(m => `
              <li>
                <span>${new Date(m.utcDate).toLocaleDateString("pt-BR")} - ${m.homeTeam.shortName} x ${m.awayTeam.shortName}</span>
                <strong>${m.score.fullTime.home} x ${m.score.fullTime.away}</strong>
              </li>
            `).join("") || "<li>Sem histórico recente disponível.</li>"}
          </ul>
        `;
      } catch (e) {
        body.innerHTML = `<p>Não foi possível carregar o H2H desta partida.</p>`;
      }
    }

    // Controles globais
    window.setStandingType = (type) => { state.standingType = type; renderStandings(); };
    window.setMatchFilter = (key, val) => { state[key] = val; renderMatches(); };
    window.openH2H = openH2H;

    function renderCurrentTab() {
      if (state.tab === "standings") renderStandings();
      if (state.tab === "matches") renderMatches();
      if (state.tab === "scorers") renderScorers();
      if (state.tab === "teams") renderTeams();
    }

    // Eventos de troca de aba e competição
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.tab = btn.dataset.tab;
        renderCurrentTab();
      });
    });

    compSelect.addEventListener("change", async (e) => {
      state.comp = e.target.value;
      state.matchday = "";
      await loadCompetitionHeader();
      renderCurrentTab();
    });

    // Inicialização
    (async () => {
      await loadCompetitionHeader();
      renderCurrentTab();
    })();
 