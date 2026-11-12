import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  carregarClassificacao,
  carregarPartidas,
  carregarArtilheiros,
} from './services/api'
import {
  processarClassificacao,
  processarPartidas,
  calcularFormas,
  corZona,
  letraFormaCor,
  formatarData,
  STATUS_PT,
  CORES,
} from './utils/helpers'
import type { ClassificacaoItem, PartidaItem, Scorer } from './types'
import './index.css'

type TabId = 'classificacao' | 'estatisticas' | 'analises' | 'artilharia' | 'clubes' | 'partidas' | 'comparador' | 'perfil'
type IconName = TabId | 'leader' | 'users' | 'ball' | 'calendar' | 'info' | 'refresh' | 'trophy'

const Icon = ({ name, size = 18 }: { name: IconName; size?: number }) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'classificacao':
    case 'trophy':
    case 'leader':
      return <svg {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 8H5a3 3 0 0 0 3 3M17 8h2a3 3 0 0 1-3 3"/></svg>
    case 'estatisticas':
      return <svg {...p}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>
    case 'analises':
      return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    case 'artilharia':
      return <svg {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>
    case 'clubes':
      return <svg {...p}><path d="M12 3 4 7v5c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4z"/></svg>
    case 'partidas':
    case 'calendar':
      return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>
    case 'comparador':
      return <svg {...p}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    case 'perfil':
      return <svg {...p}><path d="M4 19V9l6-4 6 4v10"/><path d="M10 19v-6h4v6"/></svg>
    case 'users':
      return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a3 3 0 0 1 0 5.74"/></svg>
    case 'ball':
      return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 3c2 2.5 2 5.5 0 9s-2 6.5 0 9M3.5 9h17M3.5 15h17"/></svg>
    case 'info':
      return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>
    case 'refresh':
      return <svg {...p}><path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/></svg>
    default:
      return <svg {...p}><circle cx="12" cy="12" r="8"/></svg>
  }
}

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'classificacao', label: 'Classificação', icon: 'classificacao' },
  { id: 'estatisticas', label: 'Estatísticas', icon: 'estatisticas' },
  { id: 'analises', label: 'Análises', icon: 'analises' },
  { id: 'artilharia', label: 'Artilharia', icon: 'artilharia' },
  { id: 'clubes', label: 'Clubes', icon: 'clubes' },
  { id: 'partidas', label: 'Partidas', icon: 'partidas' },
  { id: 'comparador', label: 'Comparador', icon: 'comparador' },
  { id: 'perfil', label: 'Perfil do Clube', icon: 'perfil' },
]

const finalizada = (p: PartidaItem) => p.status === 'FINISHED' && p.golsMandante != null && p.golsVisitante != null
const pct = (n: number, total: number) => total ? Math.round((n / total) * 100) : 0

function SectionTitle({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return <div className="secao"><div className="secao-icone">{icon}</div><div><h2 className="secao-titulo">{title}</h2><p className="secao-sub">{subtitle}</p></div></div>
}
function SubTabs({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  return <div className="subtabs">{items.map(x => <button key={x} className={`subtab ${value === x ? 'active' : ''}`} onClick={() => onChange(x)}>{x}</button>)}</div>
}
function Card({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}><h3>{title}</h3>{children}</div>
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="info" size={20} /></span><p>{children}</p></div>
}
function BarList({ rows, value, color = CORES.verde }: { rows: { time: string; value: number }[]; value: string; color?: string }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return <div className="chart-bars">{rows.map((r, i) => <div className="bar-row" key={`${r.time}-${i}`}><div className="bar-label"><span title={r.time}>{r.time}</span><b>{r.value}{value}</b></div><div className="bar-track"><div className="bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: color }} /></div></div>)}</div>
}
function RoundBars({ rows }: { rows: { time: string; value: number }[] }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  if (!rows.length) return <Empty>Sem gols registrados por rodada ainda.</Empty>
  return (
    <div className="round-bars">
      <div className="round-bars-plot">
        {rows.map((r) => (
          <div className="round-bar-col" key={r.time} title={`${r.time}: ${r.value} gols`}>
            <span className="round-bar-value">{r.value}</span>
            <div className="round-bar-track">
              <div className="round-bar-fill" style={{ height: `${Math.max((r.value / max) * 100, r.value ? 6 : 0)}%` }} />
            </div>
            <span className="round-bar-label">{r.time}</span>
          </div>
        ))}
      </div>
      <p className="chart-hint">Total de gols em cada rodada (jogos finalizados)</p>
    </div>
  )
}
function LineChart({ values, color = CORES.verde, labels, invertY = false }: { values: number[]; color?: string; labels?: string[]; invertY?: boolean }) {
  if (!values.length) return <Empty>Dados insuficientes para montar a evolução.</Empty>
  const max = Math.max(...values, 1), min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)
  const yOf = (v: number) => invertY ? (12 + ((v - min) / range) * 72) : (88 - ((v - min) / range) * 72)
  const xOf = (i: number) => values.length === 1 ? 50 : 12 + i * 76 / (values.length - 1)
  const points = values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')
  const area = `${xOf(0)},88 ` + points + ` ${xOf(values.length - 1)},88`
  return (
    <div className="line-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Gráfico de evolução">
        <line x1="10" y1="88" x2="90" y2="88" stroke="currentColor" opacity=".15" />
        <line x1="10" y1="52" x2="90" y2="52" stroke="currentColor" opacity=".08" />
        <line x1="10" y1="16" x2="90" y2="16" stroke="currentColor" opacity=".08" />
        <polygon points={area} fill={color} opacity=".12" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => <circle key={i} cx={xOf(i)} cy={yOf(v)} r="1.6" fill={color} stroke="#0a0e17" strokeWidth="0.6" />)}
      </svg>
      <div className="chart-axis">{(labels || values.map((_, i) => `R${i + 1}`)).map((l, i) => <span key={i}>{l}</span>)}</div>
      <div className="chart-values">{values.map((v, i) => <span key={i}>{v}</span>)}</div>
    </div>
  )
}
function RadarPlot({ team, all }: { team: ClassificacaoItem; all: ClassificacaoItem[] }) {
  const max = (fn: (t: ClassificacaoItem) => number) => Math.max(...all.map(fn), 1)
  const vals = [team.golsPro/max(t=>t.golsPro), 1-team.golsContra/max(t=>t.golsContra), team.vitorias/max(t=>t.vitorias), team.pontos/max(t=>t.pontos)]
  const angles = [-90,0,90,180]
  const points = vals.map((v,i)=>{const r=12+v*32;const a=angles[i]*Math.PI/180;return `${50+Math.cos(a)*r},${50+Math.sin(a)*r}`}).join(' ')
  const labels = [{x:50,y:5,t:'Ataque'},{x:95,y:51,t:'Defesa'},{x:50,y:97,t:'Vitórias'},{x:5,y:51,t:'Pontos'}]
  return <div className="radar-wrap"><svg viewBox="0 0 100 100" role="img" aria-label={`Radar de desempenho de ${team.time}`}><polygon points="50,18 82,50 50,82 18,50" fill="none" stroke="currentColor" opacity=".2"/><polygon points="50,34 66,50 50,66 34,50" fill="none" stroke="currentColor" opacity=".2"/><line x1="50" y1="50" x2="50" y2="12" stroke="currentColor" opacity=".25"/><line x1="50" y1="50" x2="88" y2="50" stroke="currentColor" opacity=".25"/><line x1="50" y1="50" x2="50" y2="88" stroke="currentColor" opacity=".25"/><line x1="50" y1="50" x2="12" y2="50" stroke="currentColor" opacity=".25"/><polygon points={points} fill="rgba(16,185,129,.22)" stroke={CORES.verde} strokeWidth="1.5"/></svg><div className="radar-labels">{labels.map(l=><span key={l.t} style={{left:`${l.x}%`,top:`${l.y}%`}}>{l.t}</span>)}</div><p className="muted small">{team.time} · indicadores normalizados entre os clubes</p></div>
}
function ScorerScatter({ players }: { players: Scorer[] }) {
  if (!players.length) return <Empty>Sem dados suficientes para o gráfico.</Empty>
  const maxG = Math.max(...players.map(p=>p.goals),1), maxA = Math.max(...players.map(p=>p.assists||0),1)
  return <div className="scorer-scatter"><svg viewBox="0 0 100 100" role="img" aria-label="Gols por assistências"><line x1="10" y1="90" x2="94" y2="90" stroke="currentColor" opacity=".35"/><line x1="10" y1="90" x2="10" y2="8" stroke="currentColor" opacity=".35"/>{players.map(p=><circle key={p.player.id} cx={12+(p.goals/maxG)*78} cy={88-((p.assists||0)/maxA)*74} r="2.5" fill={CORES.verde}><title>{p.player.name}: {p.goals} gols, {p.assists||0} assistências</title></circle>)}</svg><div className="scatter-axis-labels"><span>Mais gols →</span><span>↑ Assistências</span></div></div>
}
function Donut({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const total = wins + draws + losses || 1
  const a = wins / total * 100, b = draws / total * 100
  return <div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(${CORES.verde} 0 ${a}%, ${CORES.laranja} ${a}% ${a + b}%, ${CORES.vermelho} ${a + b}% 100%)` }}><div><b>{total}</b><small>jogos</small></div></div><div className="donut-legend"><span><i style={{ background: CORES.verde }} />Vitórias <b>{wins}</b></span><span><i style={{ background: CORES.laranja }} />Empates <b>{draws}</b></span><span><i style={{ background: CORES.vermelho }} />Derrotas <b>{losses}</b></span></div></div>
}
function Heatmap({ matches }: { matches: PartidaItem[] }) {
  const finished = matches.filter(finalizada).slice().sort((a, b) => (a.rodada || 0) - (b.rodada || 0) || new Date(a.data).getTime() - new Date(b.data).getTime())
  if (!finished.length) return <Empty>O mapa de resultados aparecerá conforme as rodadas forem concluídas.</Empty>
  const byRound = finished.reduce<Record<number, PartidaItem[]>>((acc, p) => {
    const r = p.rodada || 0
    if (!acc[r]) acc[r] = []
    acc[r].push(p)
    return acc
  }, {})
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b)
  const colorFor = (g: number) => g >= 5 ? '#0f766e' : g >= 4 ? '#0d9488' : g >= 3 ? '#14b8a6' : g >= 2 ? '#334155' : g >= 1 ? '#1e293b' : '#0f172a'
  return (
    <div className="heatmap-panel">
      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Gols na partida</span>
        <div className="heatmap-legend-scale">
          {[{ g: 0, l: '0' }, { g: 1, l: '1' }, { g: 2, l: '2' }, { g: 3, l: '3' }, { g: 4, l: '4' }, { g: 5, l: '5+' }].map(x => (
            <span key={x.l}><i style={{ background: colorFor(x.g) }} />{x.l}</span>
          ))}
        </div>
      </div>
      <div className="heatmap-rounds">
        {rounds.map(r => (
          <div className="heatmap-round" key={r}>
            <div className="heatmap-round-label">R{r}</div>
            <div className="heatmap-round-cells">
              {byRound[r].map(p => {
                const g = (p.golsMandante || 0) + (p.golsVisitante || 0)
                return (
                  <div
                    className="heat-cell"
                    key={p.id}
                    title={`${p.mandante} ${p.golsMandante} × ${p.golsVisitante} ${p.visitante}`}
                    style={{ background: colorFor(g) }}
                  >
                    <b>{p.golsMandante}×{p.golsVisitante}</b>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AttackDefenseChart({ teams }: { teams: ClassificacaoItem[] }) {
  if (!teams.length) return <Empty>Sem dados de classificação.</Empty>
  const maxGP = Math.max(...teams.map(t => t.golsPro), 1)
  const maxGC = Math.max(...teams.map(t => t.golsContra), 1)
  const pad = 12
  const w = 100 - pad * 2
  const h = 100 - pad * 2
  const xOf = (gp: number) => pad + (gp / maxGP) * w
  const yOf = (gc: number) => pad + (1 - gc / maxGC) * h
  const midX = pad + w / 2
  const midY = pad + h / 2
  // label a few extremes to avoid clutter
  const labeled = new Set<string>()
  const byAttack = [...teams].sort((a, b) => b.golsPro - a.golsPro)
  const byDefense = [...teams].sort((a, b) => a.golsContra - b.golsContra)
  ;[byAttack[0], byAttack[byAttack.length - 1], byDefense[0], byDefense[byDefense.length - 1]].forEach(t => { if (t) labeled.add(t.time) })
  teams.slice(0, 3).forEach(t => labeled.add(t.time))

  return (
    <div className="ad-chart">
      <svg viewBox="0 0 100 100" role="img" aria-label="Ataque versus defesa">
        <rect x={pad} y={pad} width={w} height={h} fill="rgba(148,163,184,0.03)" stroke="currentColor" strokeOpacity="0.12" />
        <line x1={midX} y1={pad} x2={midX} y2={pad + h} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="2 2" />
        <line x1={pad} y1={midY} x2={pad + w} y2={midY} stroke="currentColor" strokeOpacity="0.1" strokeDasharray="2 2" />
        {teams.map(t => (
          <g key={t.time}>
            <circle
              cx={xOf(t.golsPro)}
              cy={yOf(t.golsContra)}
              r="2.2"
              fill={corZona(t.posicao, teams.length)}
              opacity="0.9"
            >
              <title>{`${t.time}: ${t.golsPro} GP · ${t.golsContra} GC · ${t.pontos} pts`}</title>
            </circle>
            {labeled.has(t.time) && (
              <text
                x={xOf(t.golsPro)}
                y={yOf(t.golsContra) - 3.2}
                textAnchor="middle"
                fontSize="2.6"
                fill="currentColor"
                opacity="0.7"
              >{t.time.length > 12 ? t.time.slice(0, 11) + '…' : t.time}</text>
            )}
          </g>
        ))}
      </svg>
      <div className="ad-axis">
        <span>Menos gols sofridos ↑</span>
        <span>Mais gols marcados →</span>
      </div>
      <div className="ad-quadrants">
        <span>Ofensivo / poroso</span>
        <span>Equilibrado alto</span>
        <span>Baixo volume</span>
        <span>Sólido defensivo</span>
      </div>
    </div>
  )
}

function App() {
  const [tab, setTab] = useState<TabId>('classificacao')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [classificacao, setClassificacao] = useState<ClassificacaoItem[]>([])
  const [partidas, setPartidas] = useState<PartidaItem[]>([])
  const [artilheiros, setArtilheiros] = useState<Scorer[]>([])
  const [filtroStatus, setFiltroStatus] = useState('TODOS')
  const [filtroRodada, setFiltroRodada] = useState('TODAS')
  const [estatSub, setEstatSub] = useState('Visão geral')
  const [analiseSub, setAnaliseSub] = useState('Desempenho')
  const [clubeA, setClubeA] = useState('')
  const [clubeB, setClubeB] = useState('')
  const [clubePerfil, setClubePerfil] = useState('')
  const [evolucaoClube, setEvolucaoClube] = useState('')
  const [evolucaoMetrica, setEvolucaoMetrica] = useState<'pontos' | 'posicao'>('pontos')
  const [limiteArtilharia, setLimiteArtilharia] = useState(10)
  const [selecionados, setSelecionados] = useState<string[]>([])

  const carregar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [standingsRes, matchesRes] = await Promise.all([carregarClassificacao(), carregarPartidas()])
      const partidasProc = processarPartidas(matchesRes)
      const tabela = processarClassificacao(standingsRes, calcularFormas(partidasProc))
      setPartidas(partidasProc); setClassificacao(tabela)
      try { const scorersRes = await carregarArtilheiros(); setArtilheiros(scorersRes.scorers || []) } catch { setArtilheiros([]) }
      setClubeA(tabela[0]?.time || ''); setClubeB(tabela[1]?.time || ''); setClubePerfil(tabela[0]?.time || ''); setEvolucaoClube(tabela[0]?.time || '')
      setSelecionados(tabela.slice(0, 4).map(t => t.time))
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar dados') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const jogosFinalizados = useMemo(() => partidas.filter(finalizada), [partidas])
  const rodadas = useMemo<number[]>(() => Array.from(new Set<number>(partidas.flatMap(p => p.rodada == null ? [] : [p.rodada]))).sort((a,b) => a-b), [partidas])
  const kpis = useMemo(() => classificacao.length ? ({
    lider: classificacao[0].time, totalTimes: classificacao.length,
    totalGols: classificacao.reduce((s,t) => s + t.golsPro, 0),
    totalJogos: Math.floor(classificacao.reduce((s,t) => s + t.jogos, 0) / 2),
  }) : null, [classificacao])
  const partidasFiltradas = useMemo(() => partidas.filter(p => (filtroStatus === 'TODOS' || p.status === filtroStatus) && (filtroRodada === 'TODAS' || String(p.rodada) === filtroRodada)).sort((a,b) => (a.rodada||0)-(b.rodada||0) || new Date(a.data).getTime() - new Date(b.data).getTime()), [partidas, filtroStatus, filtroRodada])
  const golsPorRodada = useMemo(() => rodadas.map(r => ({ time: `R${r}`, value: jogosFinalizados.filter(p => p.rodada === r).reduce((s,p) => s + (p.golsMandante || 0) + (p.golsVisitante || 0), 0) })), [rodadas, jogosFinalizados])
  const evolucaoRodadas = useMemo(() => {
    const times = new Set<string>(classificacao.map(t => t.time))
    const tabela = new Map<string, { pontos: number; gp: number; gc: number; v: number; e: number; d: number }>()
    times.forEach(nome => tabela.set(nome, { pontos: 0, gp: 0, gc: 0, v: 0, e: 0, d: 0 }))
    const snapshots: { rodada: number; clubes: Record<string, { pontos: number; posicao: number }> }[] = []
    rodadas.forEach(rodada => {
      jogosFinalizados.filter(p => p.rodada === rodada).forEach(p => {
        const casa = tabela.get(p.mandante); const fora = tabela.get(p.visitante)
        if (!casa || !fora || p.golsMandante == null || p.golsVisitante == null) return
        casa.gp += p.golsMandante; casa.gc += p.golsVisitante
        fora.gp += p.golsVisitante; fora.gc += p.golsMandante
        if (p.golsMandante > p.golsVisitante) { casa.pontos += 3; casa.v++; fora.d++ }
        else if (p.golsMandante < p.golsVisitante) { fora.pontos += 3; fora.v++; casa.d++ }
        else { casa.pontos++; fora.pontos++; casa.e++; fora.e++ }
      })
      const ordenados = [...tabela.entries()].sort((a,b) => b[1].pontos-a[1].pontos || (b[1].gp-b[1].gc)-(a[1].gp-a[1].gc) || b[1].gp-a[1].gp)
      const clubes: Record<string,{pontos:number;posicao:number}> = {}
      ordenados.forEach(([nome,stats],i) => { clubes[nome] = { pontos:stats.pontos, posicao:i+1 } })
      snapshots.push({ rodada, clubes })
    })
    return snapshots
  }, [classificacao, rodadas, jogosFinalizados])
  const historicoClube = evolucaoRodadas.map(r => ({ rodada: r.rodada, ...(r.clubes[evolucaoClube] || { pontos: 0, posicao: 20 }) }))
  const topAtaque = useMemo(() => [...classificacao].sort((a,b) => b.golsPro - a.golsPro).slice(0,8).map(t => ({ time: t.time, value: t.golsPro })), [classificacao])
  const topDefesa = useMemo(() => [...classificacao].sort((a,b) => a.golsContra - b.golsContra).slice(0,8).map(t => ({ time: t.time, value: t.golsContra })), [classificacao])
  const clubeSelecionado = classificacao.find(t => t.time === clubePerfil)
  const clubeComparadoA = classificacao.find(t => t.time === clubeA)
  const clubeComparadoB = classificacao.find(t => t.time === clubeB)
  const getJogosClube = (nome: string) => jogosFinalizados.filter(p => p.mandante === nome || p.visitante === nome).sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  const resultadoClube = (p: PartidaItem, nome: string) => {
    const ehMandante = p.mandante === nome
    const gf = ehMandante ? p.golsMandante! : p.golsVisitante!
    const ga = ehMandante ? p.golsVisitante! : p.golsMandante!
    return gf > ga ? 'V' : gf === ga ? 'E' : 'D'
  }
  const calcMando = (nome: string) => {
    const js = getJogosClube(nome)
    const casa = js.filter(p => p.mandante === nome), fora = js.filter(p => p.visitante === nome)
    return { casa, fora }
  }
  const clubes = classificacao.map(t => t.time)

  if (loading) return <div className="app"><div className="center-msg"><div className="spinner" /><h2>Carregando Brasileirão 2026…</h2><p>Buscando classificação, partidas e estatísticas</p></div></div>
  if (error) return <div className="app"><div className="center-msg"><h2>Não foi possível carregar os dados</h2><p>{error}</p><p>Confira o token em <code>.env</code> (VITE_FOOTBALL_DATA_TOKEN) e as permissões da API.</p><button className="btn-refresh" onClick={carregar}>Tentar novamente</button></div></div>

  return <div className="app">
    <header className="hero"><div className="hero-icone"><Icon name="ball" size={26} /></div><div className="hero-copy"><span className="eyebrow">CENTRAL DE DADOS · TEMPORADA 2026</span><h1 className="hero-titulo">Brasileirão <em>2026</em></h1><div className="hero-sub"><span>Dashboard de desempenho</span><span>·</span><span>football-data.org v4</span></div></div><div className="hero-side"><span className="live-dot" />DADOS DA TEMPORADA</div></header>
    <div className="header-actions"><span className="update-note">Atualize para buscar os dados mais recentes</span><button className="btn-refresh" onClick={carregar}><Icon name="refresh" size={15} /> Atualizar dados</button></div>
    {kpis && <div className="kpi-grid">
      {([{icon:'leader' as IconName,label:'Líder',val:kpis.lider},{icon:'users' as IconName,label:'Clubes',val:kpis.totalTimes},{icon:'ball' as IconName,label:'Gols marcados',val:kpis.totalGols},{icon:'calendar' as IconName,label:'Jogos disputados',val:kpis.totalJogos}]).map(({icon,label,val}) => <div className="kpi" key={label}><div className="kpi-icone"><Icon name={icon} size={18} /></div><div><p className="kpi-rotulo">{label}</p><p className="kpi-valor">{val}</p></div></div>)}
    </div>}
    <nav className="tabs">{TABS.map(t => <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}><Icon name={t.icon} size={16} /><span>{t.label}</span></button>)}</nav>

    {tab === 'classificacao' && <section>
      <SectionTitle icon={<Icon name="classificacao" size={16} />} title="Classificação do Brasileirão" subtitle="Tabela geral, zonas de competição e forma recente" />
      <div className="legenda"><span><i style={{background:CORES.verde}}/>1º ao 4º · Libertadores</span><span><i style={{background:CORES.azul}}/>5º ao 6º · Pré-Libertadores</span><span><i style={{background:CORES.laranja}}/>7º ao 16º · Meio da tabela</span><span><i style={{background:CORES.vermelho}}/>Últimos 4 · Rebaixamento</span></div>
      <div className="tabela-wrap"><table className="tabela"><thead><tr>{['#','Clube','Pts','J','V','E','D','GP','GC','SG','Forma'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{classificacao.map(row=><tr key={row.time}><td className="pos" style={{ ['--zona' as string]: corZona(row.posicao, classificacao.length) }}>{row.posicao}</td><td className="clube"><div className="clube-cell">{row.escudo && <img src={row.escudo} alt=""/>}{row.time}</div></td><td className="pts">{row.pontos}</td><td>{row.jogos}</td><td>{row.vitorias}</td><td>{row.empates}</td><td>{row.derrotas}</td><td>{row.golsPro}</td><td>{row.golsContra}</td><td>{row.saldo>0?`+${row.saldo}`:row.saldo}</td><td><div className="forma">{row.forma.map((l,i)=><span key={i} style={{background:letraFormaCor(l)}}>{l}</span>)}</div></td></tr>)}</tbody></table></div>
      <p className="caption">As zonas são indicativas e podem variar conforme regulamento e classificação final.</p>
    </section>}

    {tab === 'estatisticas' && <section><SectionTitle icon={<Icon name="estatisticas" size={16} />} title="Estatísticas" subtitle="Indicadores gerais e evolução do campeonato"/><SubTabs items={['Visão geral','Evolução']} value={estatSub} onChange={setEstatSub}/>
      {estatSub === 'Visão geral' ? <div className="stats-grid">
        <Card title="Gols por rodada"><RoundBars rows={golsPorRodada} /></Card>
        <Card title="Melhores ataques"><BarList rows={topAtaque} value=" gols" color={CORES.azul}/></Card>
        <Card title="Melhores defesas · menos gols sofridos"><BarList rows={topDefesa} value=" gols" color={CORES.roxo}/></Card>
        <Card title="Comparação de pontos"><p className="muted small">Selecione até 6 clubes para comparar a pontuação.</p><div className="check-grid">{clubes.map(n=><label key={n}><input type="checkbox" checked={selecionados.includes(n)} onChange={e=>setSelecionados(old=>e.target.checked?[...old,n].slice(-6):old.filter(x=>x!==n))}/>{n}</label>)}</div><BarList rows={classificacao.filter(t=>selecionados.includes(t.time)).map(t=>({time:t.time,value:t.pontos}))} value=" pts" color={CORES.laranja}/></Card>
      </div> : <div className="stats-grid"><Card title="Evolução rodada a rodada"><div className="filtros"><select value={evolucaoClube} onChange={e=>setEvolucaoClube(e.target.value)}>{clubes.map(n=><option key={n}>{n}</option>)}</select><select value={evolucaoMetrica} onChange={e=>setEvolucaoMetrica(e.target.value as 'pontos'|'posicao')}><option value="pontos">Pontos acumulados</option><option value="posicao">Posição na tabela</option></select></div><LineChart values={historicoClube.map(x=>evolucaoMetrica==='pontos'?x.pontos:x.posicao)} labels={historicoClube.map(x=>`R${x.rodada}`)} color={evolucaoMetrica==='pontos'?CORES.verde:CORES.azul} invertY={evolucaoMetrica==='posicao'}/><p className="caption">Classificação reconstruída com os jogos finalizados de cada rodada. Critérios de desempate: pontos, saldo e gols pró.</p></Card><Card title="Pontuação atual"><BarList rows={classificacao.slice().sort((a,b)=>b.pontos-a.pontos).map(t=>({time:t.time,value:t.pontos}))} value=" pts"/></Card></div>}
    </section>}

    {tab === 'analises' && <section><SectionTitle icon={<Icon name="analises" size={16} />} title="Análises avançadas" subtitle="Leituras de desempenho, placares e comportamento das rodadas"/><SubTabs items={['Desempenho','Placares','Rodada a rodada']} value={analiseSub} onChange={setAnaliseSub}/>
      {analiseSub === 'Desempenho' && <div className="stats-grid">
        <Card title="Ataque × defesa"><AttackDefenseChart teams={classificacao} /><p className="caption">Cada ponto é um clube. Cor indica zona da tabela. Eixo X = gols pró, eixo Y = gols sofridos (invertido).</p></Card>
        <Card title="Vitórias, empates e derrotas"><div className="stacked-list">{classificacao.map(t=><div className="stacked-row" key={t.time}><span>{t.time}</span><div><i style={{width:`${pct(t.vitorias,t.jogos)}%`,background:CORES.verde}}/><i style={{width:`${pct(t.empates,t.jogos)}%`,background:CORES.laranja}}/><i style={{width:`${pct(t.derrotas,t.jogos)}%`,background:CORES.vermelho}}/></div><small>{t.vitorias}/{t.empates}/{t.derrotas}</small></div>)}</div></Card>
        <Card title="Desempenho como mandante e visitante"><div className="table-scroll"><table className="mini-table"><thead><tr><th>Clube</th><th>Casa</th><th>Fora</th></tr></thead><tbody>{classificacao.map(t=>{const m=calcMando(t.time);return <tr key={t.time}><td>{t.time}</td><td>{m.casa.length}j · {m.casa.filter(p=>resultadoClube(p,t.time)==='V').length}V</td><td>{m.fora.length}j · {m.fora.filter(p=>resultadoClube(p,t.time)==='V').length}V</td></tr>})}</tbody></table></div></Card>
        <Card title="Distribuição de pontos"><div className="treemap">{classificacao.map(t=><div key={t.time} style={{flex:`${Math.max(t.pontos,1)} 1 90px`}}><b>{t.time}</b><strong>{t.pontos} pts</strong></div>)}</div><p className="caption">Área proporcional aos pontos conquistados.</p></Card><Card title="Radar de desempenho">{classificacao[0] && <RadarPlot team={classificacao[0]} all={classificacao}/>}</Card>
      </div>}
      {analiseSub === 'Placares' && <div className="stats-grid">
        <Card title="Distribuição de vitórias, empates e derrotas"><Donut wins={jogosFinalizados.filter(p=>p.golsMandante!>p.golsVisitante!).length} draws={jogosFinalizados.filter(p=>p.golsMandante===p.golsVisitante).length} losses={jogosFinalizados.filter(p=>p.golsMandante!<p.golsVisitante!).length}/></Card>
        <Card title="Frequência dos placares"><div className="score-cloud">{(Object.entries(jogosFinalizados.reduce<Record<string,number>>((a,p)=>{const k=`${p.golsMandante} × ${p.golsVisitante}`;a[k]=(a[k]||0)+1;return a},{})) as [string,number][]).sort((a,b)=>b[1]-a[1]).slice(0,16).map(([s,n])=><div key={s}><b>{s}</b><small>{n} vez(es)</small></div>)}</div></Card>
        <Card title="Gols por partida"><BarList rows={(Object.entries(jogosFinalizados.reduce<Record<string,number>>((a,p)=>{const n=(p.golsMandante||0)+(p.golsVisitante||0);a[String(n)]=(a[String(n)]||0)+1;return a},{})) as [string,number][]).sort((a,b)=>Number(a[0])-Number(b[0])).map(([n,v])=>({time:`${n} gols`,value:v}))} value=" jogos" color={CORES.azul}/></Card>
        <Card title="Gols por tempo / arbitragem"><Empty>A resposta de partidas disponível nesta integração não inclui eventos por minuto nem árbitro. Esses indicadores precisam de uma fonte complementar ou endpoint com cobertura específica.</Empty></Card>
      </div>}
      {analiseSub === 'Rodada a rodada' && <div className="stats-grid"><Card title="Mapa de resultados por partida"><Heatmap matches={partidas}/></Card><Card title="Gols por rodada"><RoundBars rows={golsPorRodada} /></Card><Card title="Média de gols por jogo"><div className="big-number">{jogosFinalizados.length ? (jogosFinalizados.reduce((s,p)=>s+(p.golsMandante||0)+(p.golsVisitante||0),0)/jogosFinalizados.length).toFixed(2) : '—'}</div><p className="muted">gols por partida finalizada</p></Card></div>}
    </section>}

    {tab === 'artilharia' && <section><SectionTitle icon={<Icon name="artilharia" size={16} />} title="Artilharia" subtitle="Goleadores da temporada e eficiência ofensiva"/><div className="slider-control"><label>Exibir jogadores: <b>{limiteArtilharia}</b></label><input type="range" min="5" max="30" step="5" value={limiteArtilharia} onChange={e=>setLimiteArtilharia(Number(e.target.value))}/></div>
      {!artilheiros.length ? <Empty>Nenhum artilheiro disponível. A cobertura deste endpoint depende do plano e das permissões da API.</Empty> : <div className="stats-grid"><Card title="Goleadores"><div className="scorers-list">{artilheiros.slice(0,limiteArtilharia).map((s,i)=><div className="scorer-row" key={s.player.id}><div className="scorer-pos">{i+1}</div><div className="scorer-info">{s.team.crest&&<img src={s.team.crest} alt=""/>}<div><p className="scorer-nome">{s.player.name}</p><p className="scorer-time">{s.team.name}</p></div></div><div className="scorer-gols">{s.goals}</div></div>)}</div></Card><Card title="Gols por jogador"><BarList rows={artilheiros.slice(0,limiteArtilharia).map(s=>({time:s.player.name,value:s.goals}))} value=" gols"/></Card><Card title="Participações em gols"><BarList rows={artilheiros.slice(0,limiteArtilharia).map(s=>({time:s.player.name,value:s.goals+(s.assists||0)}))} value=" participações" color={CORES.azul}/></Card><Card title="Gols × assistências"><ScorerScatter players={artilheiros.slice(0,limiteArtilharia)}/></Card><Card title="Distribuição de gols"><div className="treemap">{artilheiros.slice(0,limiteArtilharia).map(s=><div key={s.player.id} style={{flex:`${Math.max(s.goals,1)} 1 75px`}}><b>{s.player.name}</b><strong>{s.goals}</strong></div>)}</div></Card><Card title="Eficiência"><Empty>A API não fornece minutos jogados para calcular gols por 90 minutos. O gráfico de eficiência real depende desse dado.</Empty></Card></div>}</section>}

    {tab === 'clubes' && <section><SectionTitle icon={<Icon name="clubes" size={16} />} title="Clubes" subtitle="Identidade, campanha e informações disponíveis dos participantes"/><div className="club-grid">{classificacao.map(t => {
        const zona = corZona(t.posicao, classificacao.length)
        const forma = (t.forma || []).slice(0, 5)
        return (
          <button className="club-card" key={t.time} onClick={() => { setClubePerfil(t.time); setTab('perfil') }} style={{ ['--zona' as string]: zona }}>
            <div className="club-card-top">
              <span className="club-position" style={{ background: zona }}>{t.posicao}º</span>
              <div className="club-crest">{t.escudo ? <img src={t.escudo} alt="" /> : <span className="club-placeholder"><Icon name="ball" size={22} /></span>}</div>
            </div>
            <b className="club-name">{t.time}</b>
            <div className="club-stats">
              <span><strong>{t.pontos}</strong> pts</span>
              <span><strong>{t.jogos}</strong> J</span>
              <span><strong>{t.vitorias}</strong> V</span>
              <span><strong>{t.saldo > 0 ? `+${t.saldo}` : t.saldo}</strong> SG</span>
            </div>
            <div className="club-form">{forma.length ? forma.map((l, i) => <span key={i} style={{ background: letraFormaCor(l) }}>{l}</span>) : <span className="muted small">Sem forma</span>}</div>
            <span className="club-cta">Ver perfil</span>
          </button>
        )
      })}</div><div className="stats-grid clubs-insights"><Card title="Tradição × desempenho atual"><p className="muted">A API não fornece ano de fundação nem títulos históricos. A classificação abaixo compara apenas campanha atual.</p><BarList rows={classificacao.slice().sort((a,b)=>b.pontos-a.pontos).map(t=>({time:t.time,value:t.pontos}))} value=" pts"/></Card><Card title="Elencos e idade dos atletas"><Empty>Idade média, origem, posições e nacionalidades dos elencos não estão presentes nos dados retornados para esta competição. Não exibiremos estimativas sem fonte verificável.</Empty></Card></div></section>}

    {tab === 'partidas' && <section><SectionTitle icon={<Icon name="partidas" size={16} />} title="Partidas" subtitle="Resultados recentes e calendário completo por rodada"/><div className="filtros"><select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}><option value="TODOS">Todos os status</option><option value="FINISHED">Encerrados</option><option value="SCHEDULED">Agendados</option><option value="TIMED">Agendados (horário)</option><option value="IN_PLAY">Ao vivo</option></select><select value={filtroRodada} onChange={e=>setFiltroRodada(e.target.value)}><option value="TODAS">Todas as rodadas</option>{rodadas.map(r=><option key={r} value={String(r)}>Rodada {r}</option>)}</select></div><h3 className="list-heading">Jogos encontrados: {partidasFiltradas.length}</h3><div className="jogos-grid">{partidasFiltradas.slice(0,60).map(p=>{const statusKey=p.status==='FINISHED'?'fim':p.status==='IN_PLAY'||p.status==='PAUSED'?'vivo':'agenda';const placar=p.golsMandante!=null&&p.golsVisitante!=null?`${p.golsMandante} × ${p.golsVisitante}`:'×';return <article className="jogo" key={p.id}><div className="jogo-topo"><span>{p.rodada!=null?`Rodada ${p.rodada}`:'—'} · {formatarData(p.data)}</span><span className={`badge ${statusKey}`}>{STATUS_PT[p.status]||p.status}</span></div><div className="jogo-corpo"><div className="time">{p.escudoMandante?<img src={p.escudoMandante} alt=""/>:<span className="crest-placeholder"/>}<b>{p.mandante}</b></div><div className="placar">{placar}</div><div className="time">{p.escudoVisitante?<img src={p.escudoVisitante} alt=""/>:<span className="crest-placeholder"/>}<b>{p.visitante}</b></div></div></article>})}</div>{!partidasFiltradas.length&&<Empty>Nenhuma partida encontrada com os filtros atuais.</Empty>}</section>}

    {tab === 'comparador' && <section><SectionTitle icon={<Icon name="comparador" size={16} />} title="Comparador de clubes" subtitle="Compare campanhas, resultados e produção ofensiva"/><div className="compare-selects"><label>Clube A<select value={clubeA} onChange={e=>setClubeA(e.target.value)}>{clubes.map(n=><option key={n}>{n}</option>)}</select></label><span>×</span><label>Clube B<select value={clubeB} onChange={e=>setClubeB(e.target.value)}>{clubes.map(n=><option key={n}>{n}</option>)}</select></label></div>{clubeComparadoA&&clubeComparadoB&&<><div className="compare-head"><div>{clubeComparadoA.escudo&&<img src={clubeComparadoA.escudo} alt=""/>}<b>{clubeA}</b></div><strong>VS</strong><div>{clubeComparadoB.escudo&&<img src={clubeComparadoB.escudo} alt=""/>}<b>{clubeB}</b></div></div><div className="compare-kpis">{[['Pontos',clubeComparadoA.pontos,clubeComparadoB.pontos],['Vitórias',clubeComparadoA.vitorias,clubeComparadoB.vitorias],['Gols pró',clubeComparadoA.golsPro,clubeComparadoB.golsPro],['Saldo',clubeComparadoA.saldo,clubeComparadoB.saldo],['Jogos',clubeComparadoA.jogos,clubeComparadoB.jogos]].map(([label,a,b])=><div className="compare-kpi" key={String(label)}><span>{a}</span><small>{label}</small><span>{b}</span></div>)}</div><Card title="Comparação de indicadores"><div className="compare-bars">{[['Pontos',clubeComparadoA.pontos,clubeComparadoB.pontos],['Vitórias',clubeComparadoA.vitorias,clubeComparadoB.vitorias],['Gols marcados',clubeComparadoA.golsPro,clubeComparadoB.golsPro]].map(([l,a,b])=><div className="compare-bar-row" key={String(l)}><b>{l}</b><div className="compare-bar-pair"><i style={{width:`${pct(Number(a),Math.max(Number(a),Number(b),1))}%`,background:CORES.verde}}/><i style={{width:`${pct(Number(b),Math.max(Number(a),Number(b),1))}%`,background:CORES.azul}}/></div><small>{a} × {b}</small></div>)}</div></Card></>}</section>}

    {tab === 'perfil' && <section><SectionTitle icon={<Icon name="perfil" size={16} />} title="Perfil do Clube" subtitle="Campanha, forma recente e trajetória do participante"/><div className="profile-picker"><label>Selecione um clube<select value={clubePerfil} onChange={e=>setClubePerfil(e.target.value)}>{clubes.map(n=><option key={n}>{n}</option>)}</select></label></div>{clubeSelecionado&&(()=>{const js=getJogosClube(clubeSelecionado.time);const recentes=js.slice(0,5);return <><div className="profile-hero">{clubeSelecionado.escudo&&<img src={clubeSelecionado.escudo} alt=""/>}<div><span>PERFIL DA TEMPORADA</span><h2>{clubeSelecionado.time}</h2><p>{clubeSelecionado.posicao}º colocado · {clubeSelecionado.pontos} pontos</p></div></div><div className="profile-kpis">{[['Pontos',clubeSelecionado.pontos],['Jogos',clubeSelecionado.jogos],['Vitórias',clubeSelecionado.vitorias],['Gols pró',clubeSelecionado.golsPro],['Gols contra',clubeSelecionado.golsContra],['Saldo',clubeSelecionado.saldo>0?`+${clubeSelecionado.saldo}`:clubeSelecionado.saldo]].map(([l,v])=><div key={String(l)}><small>{l}</small><b>{v}</b></div>)}</div><div className="stats-grid"><Card title="Últimos 5 jogos"><div className="recent-results">{recentes.map(p=><div key={p.id}><span className={`result-letter ${resultadoClube(p,clubeSelecionado.time).toLowerCase()}`}>{resultadoClube(p,clubeSelecionado.time)}</span><span>{p.mandante} {p.golsMandante} × {p.golsVisitante} {p.visitante}</span><small>R{p.rodada??'—'}</small></div>)}</div></Card><Card title="Forma recente"><div className="profile-form">{recentes.slice().reverse().map(p=><span key={p.id} className={resultadoClube(p,clubeSelecionado.time).toLowerCase()}>{resultadoClube(p,clubeSelecionado.time)}</span>)}</div><p className="muted small">Sequência cronológica dos últimos jogos disponíveis.</p></Card></div><Card title="Posição rodada a rodada"><LineChart values={evolucaoRodadas.map(r=>r.clubes[clubeSelecionado.time]?.posicao ?? 20)} labels={evolucaoRodadas.map(r=>`R${r.rodada}`)} color={CORES.azul} invertY/><p className="caption">Posições reconstruídas a partir dos resultados finalizados por rodada.</p></Card></>})()}</section>}

    <p className="caption">Fonte: football-data.org v4 · Competição BSA · Temporada 2026. Indicadores calculados a partir da classificação e das partidas disponíveis.</p>
  </div>
}
export default App
