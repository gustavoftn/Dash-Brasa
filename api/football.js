// Função serverless do Vercel (arquivo: api/football.js)
// Recebe ?comp=BSA&type=standings (e outros) e consulta a football-data.org
// com a chave guardada na variável de ambiente FOOTBALL_DATA_KEY.

const BASE = "https://api.football-data.org/v4";

module.exports = async function handler(req, res) {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) {
    return res.status(500).json({ error: "Variável FOOTBALL_DATA_KEY não configurada na Vercel." });
  }

  const { comp = "BSA", type = "standings", id, matchday, status, limit, season } = req.query;

  if (!/^[A-Z0-9]{2,5}$/.test(comp)) return res.status(400).json({ error: "Campeonato inválido." });

  const qs = new URLSearchParams();
  if (/^\d{1,2}$/.test(matchday || "")) qs.set("matchday", matchday);
  if (/^[A-Z_,]+$/.test(status || "")) qs.set("status", status);
  if (/^\d{1,3}$/.test(limit || "")) qs.set("limit", limit);
  if (/^\d{4}$/.test(season || "")) qs.set("season", season);

  let path;
  switch (type) {
    case "competition": path = `competitions/${comp}`; qs.delete("matchday"); qs.delete("status"); break;
    case "standings":   path = `competitions/${comp}/standings`; break;
    case "matches":     path = `competitions/${comp}/matches`; break;
    case "scorers":     path = `competitions/${comp}/scorers`; break;
    case "teams":       path = `competitions/${comp}/teams`; break;
    case "matchDetail":
      if (!/^\d+$/.test(id || "")) return res.status(400).json({ error: "ID da partida inválido." });
      path = `matches/${id}/head2head`;
      qs.set("limit", "10");
      break;
    default:
      return res.status(400).json({ error: "Tipo inválido." });
  }

  try {
    const r = await fetch(`${BASE}/${path}${qs.toString() ? "?" + qs : ""}`, {
      headers: { "X-Auth-Token": key },
    });
    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      const msg = r.status === 429
        ? "Limite de requisições da API atingido. Aguarde um minuto."
        : data.message || "Erro ao consultar a API de futebol.";
      return res.status(r.status).json({ error: msg });
    }

    res.setHeader("Cache-Control", `public, s-maxage=${type === "matches" ? 120 : 900}, stale-while-revalidate=3600`);

    // A tela espera { aggregates, head2head: { matches } }
    if (type === "matchDetail") {
      return res.status(200).json({ aggregates: data.aggregates, head2head: { matches: data.matches || [] } });
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: "Falha ao consultar a API de futebol." });
  }
};
