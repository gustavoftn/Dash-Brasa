// Função serverless do Vercel: guarda a chave da API no servidor
// e faz cache para não estourar o limite do plano gratuito.

const COMPETICOES = ["BSA", "PL", "PD", "SA", "BL1", "FL1", "CL"];

const ROTAS = {
  standings: (c) => `competitions/${c}/standings`,
  scorers: (c) => `competitions/${c}/scorers?limit=15`,
  matches: (c) => `competitions/${c}/matches?status=SCHEDULED,TIMED`,
};

export default async function handler(req, res) {
  const { comp = "BSA", type = "standings" } = req.query;

  if (!COMPETICOES.includes(comp) || !ROTAS[type]) {
    return res.status(400).json({ error: "Parâmetros inválidos." });
  }
  if (!process.env.FOOTBALL_DATA_KEY) {
    return res.status(500).json({ error: "Variável FOOTBALL_DATA_KEY não configurada." });
  }

  try {
    const r = await fetch(`https://api.football-data.org/v4/${ROTAS[type](comp)}`, {
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY },
    });
    const data = await r.json();

    // Cache de 10 min na CDN do Vercel
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: "Falha ao consultar a API de futebol." });
  }
}
