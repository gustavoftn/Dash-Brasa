import type {
  StandingsResponse,
  MatchesResponse,
  ClassificacaoItem,
  PartidaItem,
  Match,
} from '../types'

export const CORES = {
  verde: '#10b981',
  azul: '#3b82f6',
  laranja: '#f59e0b',
  vermelho: '#ef4444',
  rosa: '#f43f5e',
  roxo: '#8b5cf6',
}

export const STATUS_PT: Record<string, string> = {
  FINISHED: 'Encerrado',
  SCHEDULED: 'Agendado',
  TIMED: 'Agendado',
  IN_PLAY: 'Ao vivo',
  PAUSED: 'Intervalo',
  POSTPONED: 'Adiado',
  SUSPENDED: 'Suspenso',
  CANCELLED: 'Cancelado',
}

export function corZona(posicao: number, total = 20): string {
  if (posicao <= 4) return CORES.verde
  if (posicao <= 6) return CORES.azul
  if (posicao >= total - 3) return CORES.vermelho
  return CORES.laranja
}

export function formatarData(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function processarClassificacao(
  data: StandingsResponse,
  formas: Record<string, string[]>
): ClassificacaoItem[] {
  const tabelas = data.standings || []
  const tabelaTotal =
    tabelas.find((t) => t.type === 'TOTAL')?.table || tabelas[0]?.table || []

  return tabelaTotal.map((item) => ({
    posicao: item.position,
    time: item.team.name,
    pontos: item.points,
    jogos: item.playedGames,
    vitorias: item.won,
    empates: item.draw,
    derrotas: item.lost,
    golsPro: item.goalsFor,
    golsContra: item.goalsAgainst,
    saldo: item.goalDifference,
    escudo: item.team.crest || '',
    forma: formas[item.team.name] || [],
  }))
}

export function processarPartidas(data: MatchesResponse): PartidaItem[] {
  return (data.matches || []).map((jogo: Match) => ({
    id: jogo.id,
    rodada: jogo.matchday,
    data: jogo.utcDate,
    mandante: jogo.homeTeam?.name || '',
    visitante: jogo.awayTeam?.name || '',
    golsMandante: jogo.score?.fullTime?.home ?? null,
    golsVisitante: jogo.score?.fullTime?.away ?? null,
    status: jogo.status,
    escudoMandante: jogo.homeTeam?.crest || '',
    escudoVisitante: jogo.awayTeam?.crest || '',
  }))
}

/** Calcula forma recente (últimos 5 resultados) por time */
export function calcularFormas(
  partidas: PartidaItem[],
  quantidade = 5
): Record<string, string[]> {
  const finalizados = partidas
    .filter(
      (p) =>
        p.status === 'FINISHED' &&
        p.golsMandante != null &&
        p.golsVisitante != null
    )
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

  const resultados: Record<string, string[]> = {}

  for (const p of finalizados) {
    const gm = p.golsMandante!
    const gv = p.golsVisitante!

    const add = (time: string, letra: string) => {
      if (!resultados[time]) resultados[time] = []
      if (resultados[time].length < quantidade) {
        resultados[time].push(letra)
      }
    }

    if (gm > gv) {
      add(p.mandante, 'V')
      add(p.visitante, 'D')
    } else if (gm < gv) {
      add(p.mandante, 'D')
      add(p.visitante, 'V')
    } else {
      add(p.mandante, 'E')
      add(p.visitante, 'E')
    }
  }

  return resultados
}

export function letraFormaCor(letra: string): string {
  if (letra === 'V') return CORES.verde
  if (letra === 'D') return CORES.vermelho
  return '#94a3b8'
}
