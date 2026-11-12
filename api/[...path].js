// Proxy Node.js — compatível com Vite na Vercel
// Configure: FOOTBALL_DATA_TOKEN (recomendado) ou VITE_FOOTBALL_DATA_TOKEN

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const segments = req.query.path
  const path = Array.isArray(segments) ? segments.join('/') : segments || ''

  if (!path) {
    return res.status(400).json({ error: 'Missing API path' })
  }

  const q = { ...req.query }
  delete q.path
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (Array.isArray(v)) v.forEach((item) => qs.append(k, String(item)))
    else if (v != null) qs.append(k, String(v))
  }
  const search = qs.toString() ? `?${qs.toString()}` : ''

  const token =
    process.env.FOOTBALL_DATA_TOKEN ||
    process.env.VITE_FOOTBALL_DATA_TOKEN ||
    ''

  if (!token) {
    return res.status(500).json({
      error:
        'Token não configurado. Defina FOOTBALL_DATA_TOKEN nas Environment Variables da Vercel.',
    })
  }

  const target = `https://api.football-data.org/v4/${path}${search}`

  try {
    const upstream = await fetch(target, {
      headers: {
        'X-Auth-Token': token,
        Accept: 'application/json',
      },
    })

    const text = await upstream.text()
    const contentType =
      upstream.headers.get('content-type') || 'application/json; charset=utf-8'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600')
    return res.status(upstream.status).send(text)
  } catch (err) {
    return res.status(502).json({
      error: 'Falha ao consultar football-data.org',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}
