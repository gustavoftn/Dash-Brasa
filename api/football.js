// Função serverless do Vercel: guarda a chave da API no servidor
// e faz cache para não estourar o limite do plano gratuito.

const COMPETICOES = [
  "BSA", "PL", "PD", "SA", "BL1", "FL1", "CL",
  "ELC", "DED", "PPL", "WC", "EC" // as 12 do free tier
];

const ROTAS = {
  // === Competição ===
  standings: (c) => `competitions/${c}/standings`,
  scorers:   (c) => `competitions/${c}/scorers?limit=20`,
  teams:     (c) => `competitions/${c}/teams`,
  matches:   (c, q) => {
    const params = new URLSearchParams();
    if (q.status)   params.set("status", q.status);
    if (q.matchday) params.set("matchday", q.matchday);
    if (q.dateFrom) params.set("dateFrom", q.dateFrom);
    if (q.dateTo)   params.set("dateTo", q.dateTo);
    if (q.season)   params.set("season", q.season);
    if (q.stage)    params.set("stage", q.stage);
    if (q.group)    params.set("group", q.group);
    // default: próximos jogos
    if (!params.has("status") && !params.has("dateFrom")) {
      params.set("status", "SCHEDULED,TIMED");
    }
    const qs = params.toString();
    return `competitions/${c}/matches${qs ? `?${qs}` : ""}`;
  },

  // === Time ===
  team:         (id) => `teams/${id}`,
  teamMatches:  (id, q) => {
    const params = new URLSearchParams();
    if (q.status)       params.set("status", q.status);
    if (q.venue)        params.set("venue", q.venue); // HOME | AWAY
    if (q.season)       params.set("season", q.season);
    if (q.dateFrom)     params.set("dateFrom", q.dateFrom);
    if (q.dateTo)       params.set("dateTo", q.dateTo);
    if (q.competitions) params.set("competitions", q.competitions);
    if (q.limit)        params.set("limit", q.limit);
    const qs = params.toString();
    return `teams/${id}/matches${qs ? `?${qs}` : ""}`;
  },

  // === Partida ===
  match:     (id) => `matches/${id}`,
  head2head: (id, q) => {
    const params = new URLSearchParams();
    if (q.limit)    params.set("limit", q.limit);
    if (q.dateFrom) params.set("dateFrom", q.dateFrom);
    if (q.dateTo)   params.set("dateTo", q.dateTo);
    const qs = params.toString();
    return `matches/${id}/head2head${qs ? `?${qs}` : ""}`;
  },

  // === Jogador / Pessoa ===
  person:        (id) => `persons/${id}`,
  personMatches: (id, q) => {
    const params = new URLSearchParams();
    if (q.status)       params.set("status", q.status);
    if (q.competitions) params.set("competitions", q.competitions);
    if (q.lineup)       params.set("lineup", q.lineup); // STARTING | BENCH
    if (q.e)            params.set("e", q.e);           // GOAL | ASSIST | SUB_IN | SUB_OUT
    if (q.limit)        params.set("limit", q.limit || "20");
    if (q.offset)       params.set("offset", q.offset);
    const qs = params.toString();
    return `persons/${id}/matches${qs ? `?${qs}` : ""}`;
  },

  // === Gerais ===
  competitions: () => "competitions",
  areas:        () => "areas",
  matchesToday: (q) => {
    const params = new URLSearchParams();
    if (q.competitions) params.set("competitions", q.competitions);
    if (q.status)       params.set("status", q.status);
    if (q.date)         params.set("date", q.date); // YESTERDAY | TODAY | TOMORROW ou yyyy-MM-dd
    if (q.dateFrom)     params.set("dateFrom", q.dateFrom);
    if (q.dateTo)       params.set("dateTo", q.dateTo);
    const qs = params.toString();
    return `matches${qs ? `?${qs}` : ""}`;
  },
  trends: (q) => {
    const params = new URLSearchParams();
    if (q.date)          params.set("date", q.date);
    if (q.window)        params.set("window", q.window);
    if (q.competitions)  params.set("competitions", q.competitions);
    if (q.consider_side) params.set("consider_side", "true");
    const qs = params.toString();
    return `trends${qs ? `?${qs}` : ""}`;
  },
};

export default async function handler(req, res) {
  const { type = "standings", comp, id, ...query } = req.query;

  // Validação básica
  if (!ROTAS[type]) {
    return res.status(400).json({
      error: "Tipo inválido.",
      tiposDisponiveis: Object.keys(ROTAS),
    });
  }

  // Rotas que precisam de competição
  const precisaComp = ["standings", "scorers", "teams", "matches"].includes(type);
  if (precisaComp) {
    if (!comp || !COMPETICOES.includes(comp)) {
      return res.status(400).json({
        error: "Competição inválida ou ausente.",
        competicoesPermitidas: COMPETICOES,
      });
    }
  }

  // Rotas que precisam de ID (time, partida, pessoa)
  const precisaId = ["team", "teamMatches", "match", "head2head", "person", "personMatches"].includes(type);
  if (precisaId && !id) {
    return res.status(400).json({ error: "Parâmetro 'id' é obrigatório para este tipo." });
  }

  if (!process.env.FOOTBALL_DATA_KEY) {
    return res.status(500).json({ error: "Variável FOOTBALL_DATA_KEY não configurada." });
  }

  try {
    let path;
    if (precisaComp) {
      path = ROTAS[type](comp, query);
    } else if (precisaId) {
      path = ROTAS[type](id, query);
    } else {
      path = ROTAS[type](query);
    }

    const r = await fetch(`https://api.football-data.org/v4/${path}`, {
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY },
    });

    const data = await r.json();

    // Cache: 10 min na CDN do Vercel (pode ajustar por tipo se quiser)
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    return res.status(r.status).json(data);
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "Falha ao consultar a API de futebol." });
  }
}