import type {
  StandingsResponse,
  MatchesResponse,
  ScorersResponse,
} from '../types'

const COMPETITION = 'BSA'
const SEASON = 2026

/** Token só é necessário no dev (proxy do Vite). Em produção o proxy da Vercel injeta o token no servidor. */
const TOKEN = import.meta.env.VITE_FOOTBALL_DATA_TOKEN || ''

async function fetchApi<T>(endpoint: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  // Em desenvolvimento o Vite encaminha /api → football-data.org e o token vai no header.
  // Em produção a Edge Function em /api/[...path] usa FOOTBALL_DATA_TOKEN do servidor.
  if (TOKEN) {
    headers['X-Auth-Token'] = TOKEN
  }

  const url = `/api/${endpoint}`
  const res = await fetch(url, { headers })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let detail = text || res.statusText
    try {
      const parsed = JSON.parse(text) as { error?: string; detail?: string }
      detail = parsed.detail || parsed.error || detail
    } catch {
      // keep raw text
    }
    throw new Error(
      `Erro HTTP ${res.status}: ${detail}. Verifique o token e o plano da API.`
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
