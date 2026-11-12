/**
 * Proxy serverless para a football-data.org v4.
 * Mantém o token no servidor (não exposto no bundle do browser em produção).
 *
 * Configure na Vercel:
 *   FOOTBALL_DATA_TOKEN=seu_token
 * (opcionalmente também VITE_FOOTBALL_DATA_TOKEN para fallback)
 */
export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    })
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const url = new URL(request.url)
  // /api/competitions/BSA/standings -> competitions/BSA/standings
  const path = url.pathname.replace(/^\/api\/?/, '')
  if (!path) {
    return json({ error: 'Missing API path' }, 400)
  }

  const token =
    process.env.FOOTBALL_DATA_TOKEN ||
    process.env.VITE_FOOTBALL_DATA_TOKEN ||
    ''

  if (!token) {
    return json(
      {
        error:
          'Token não configurado. Defina FOOTBALL_DATA_TOKEN nas variáveis de ambiente da Vercel.',
      },
      500
    )
  }

  const target = `https://api.football-data.org/v4/${path}${url.search}`

  try {
    const upstream = await fetch(target, {
      method: 'GET',
      headers: {
        'X-Auth-Token': token,
        Accept: 'application/json',
      },
    })

    const body = await upstream.text()
    const contentType =
      upstream.headers.get('Content-Type') || 'application/json; charset=utf-8'

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 's-maxage=120, stale-while-revalidate=600',
        ...corsHeaders(),
      },
    })
  } catch (err) {
    return json(
      {
        error: 'Falha ao consultar a API football-data.org',
        detail: err instanceof Error ? err.message : String(err),
      },
      502
    )
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
  })
}
