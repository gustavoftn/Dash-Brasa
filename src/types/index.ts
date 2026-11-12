export interface Team {
  id: number
  name: string
  shortName?: string
  tla?: string
  crest?: string
}

export interface StandingRow {
  position: number
  team: Team
  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  form?: string
}

export interface StandingsResponse {
  standings: Array<{
    type: string
    table: StandingRow[]
  }>
}

export interface MatchScore {
  fullTime?: { home: number | null; away: number | null }
  halfTime?: { home: number | null; away: number | null }
}

export interface Match {
  id: number
  utcDate: string
  status: string
  matchday: number | null
  homeTeam: Team
  awayTeam: Team
  score: MatchScore
}

export interface MatchesResponse {
  matches: Match[]
}

export interface Scorer {
  player: { id: number; name: string; nationality?: string }
  team: Team
  goals: number
  assists?: number | null
  penalties?: number | null
}

export interface ScorersResponse {
  scorers: Scorer[]
}

export interface ClassificacaoItem {
  posicao: number
  time: string
  pontos: number
  jogos: number
  vitorias: number
  empates: number
  derrotas: number
  golsPro: number
  golsContra: number
  saldo: number
  escudo: string
  forma: string[]
}

export interface PartidaItem {
  id: number
  rodada: number | null
  data: string
  mandante: string
  visitante: string
  golsMandante: number | null
  golsVisitante: number | null
  status: string
  escudoMandante: string
  escudoVisitante: string
}

export type TabId =
  | 'classificacao'
  | 'estatisticas'
  | 'artilharia'
  | 'partidas'
