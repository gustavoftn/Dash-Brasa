import type {
  StandingsResponse,
  MatchesResponse,
  ScorersResponse,
} from '../types'

const COMPETITION = 'BSA'
const SEASON = 2026

const TOKEN = import.meta.env.VITE_FOOTBALL_DATA_TOKEN || ''

async function fetchApi<T>(endpoint: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (TOKEN) {
    headers['X-Auth-Token'] = TOKEN
  }

  // 1) /api/path... (catch-all)  2) fallback /api/proxy?path=...
  const primary = `/api/${endpoint}`
  let res = await fetch(primary, { headers })

  if (res.status === 404) {
    const [pathOnly, query = ''] = endpoint.split('?')
    const qs = new URLSearchParams(query)
    qs.set('path', pathOnly)
    res = await fetch(`/api/proxy?${qs.toString()}`, { headers })
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let detail = text || res.statusText
    try {
      const parsed = JSON.parse(text) as { error?: string; detail?: string }
      detail = parsed.detail || parsed.error || detail
    } catch {
      // raw
    }
    throw new Error(
      `Erro HTTP ${res.status}: ${detail}. Verifique FOOTBALL_DATA_TOKEN nas Environment Variables da Vercel.`
    )
  }

  return res.json() as Promise<T>
}

export function carregarClassificacao() {
  return fetchApi<StandingsResponse>(
    `competitions/${COMPETITION}/standings?season=${SEASON}`
  )
}

export function carregarPartidas() {
  return fetchApi<MatchesResponse>(
    `competitions/${COMPETITION}/matches?season=${SEASON}`
  )
}

export function carregarArtilheiros() {
  return fetchApi<ScorersResponse>(
    `competitions/${COMPETITION}/scorers?season=${SEASON}&limit=30`
  )
}
