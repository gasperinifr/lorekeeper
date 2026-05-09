import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookMarked, Calendar, Crosshair, GitBranch, Link2, ZoomIn, ZoomOut } from 'lucide-react'
import { clsx } from 'clsx'
import { ENTITY_CONFIG, ENTITY_TYPES } from '@/config/entityConfig'
import { useEntityList } from '@/hooks/useEntities'
import { useAllLinks } from '@/hooks/useLinks'
import { useArcs, useCampaignSessions } from '@/hooks/useArcs'
import { useEvents } from '@/hooks/useEvents'
import { useGroups } from '@/hooks/useGroups'
import type { EntityLink, EntityType, LinkableType, RelationType } from '@/types'

declare global {
  interface Window {
    d3?: any
  }
}

type GraphType = LinkableType | 'events'

type GraphNode = {
  id: string
  entityId: string
  type: GraphType
  label: string
  path: string
  icon: React.ElementType
  accentClass: string
  color: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

type GraphEdge = {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  label?: string
  relation_type?: RelationType
}

const RELATION_TYPE_HEX: Record<RelationType, string> = {
  alianca: '#34d399',
  rivalidade: '#fb7185',
  familia: '#38bdf8',
  lealdade: '#a78bfa',
  segredo: '#fbbf24',
  divida: '#fb923c',
  amor: '#f472b6',
  odio: '#ef4444',
  mentor: '#22d3ee',
  neutro: '#c9c0aa',
  outro: '#8f8777',
}

function edgeStyle(edge: GraphEdge) {
  return {
    stroke: RELATION_TYPE_HEX[edge.relation_type ?? 'outro'],
    strokeWidth: 1.6,
    opacity: 0.62,
  }
}

function zoomFade(scale: number, start: number, end: number) {
  return Math.max(0, Math.min(1, (scale - start) / (end - start)))
}

const TYPE_META: Partial<Record<GraphType, {
  label: string
  labelPlural: string
  icon: React.ElementType
  accentClass: string
  color: string
}>> = {
  ...Object.fromEntries(ENTITY_TYPES.map(type => {
    const cfg = ENTITY_CONFIG[type]
    return [type, {
      label: cfg.label,
      labelPlural: cfg.labelPlural,
      icon: cfg.icon,
      accentClass: cfg.accentClass,
      color: accentToColor(cfg.accentClass),
    }]
  })),
  arcs: { label: 'Arco', labelPlural: 'Arcos', icon: GitBranch, accentClass: 'text-gold', color: '#c9a227' },
  sessions: { label: 'Sessão', labelPlural: 'Sessões', icon: Calendar, accentClass: 'text-sky-300', color: '#7dd3fc' },
  events: { label: 'Evento', labelPlural: 'Eventos', icon: BookMarked, accentClass: 'text-crimson-light', color: '#f87171' },
}

const GRAPH_TYPES = [...ENTITY_TYPES, 'arcs', 'sessions', 'events'] as GraphType[]

function accentToColor(accentClass: string) {
  const colors: Record<string, string> = {
    'text-sky-400': '#38bdf8',
    'text-violet-400': '#a78bfa',
    'text-emerald-400': '#34d399',
    'text-amber-400': '#fbbf24',
    'text-cyan-300': '#67e8f9',
    'text-rose-400': '#fb7185',
    'text-parchment/60': '#c9c0aa',
  }
  return colors[accentClass] ?? '#c9a227'
}

function isEntityType(type: GraphType): type is EntityType {
  return type in ENTITY_CONFIG
}

function displayName(type: GraphType, item: any) {
  if (isEntityType(type)) return ENTITY_CONFIG[type].displayName(item)
  if (type === 'arcs') return item.title
  if (type === 'sessions') return [item.title, item.arc_title].filter(Boolean).join(' - ')
  if (type === 'events') return item.title
  return item.title ?? item.name ?? item.id
}

function itemPath(campaignId: string, type: GraphType, item: any, id: string) {
  if (type === 'arcs') return `/campaigns/${campaignId}/arcs/${id}`
  if (type === 'sessions') return `/campaigns/${campaignId}/arcs/${item?.arc_id}/sessions/${id}`
  if (type === 'events') return `/campaigns/${campaignId}/chronicle`
  return `/campaigns/${campaignId}/${type}/${id}`
}

function nodeKey(type: GraphType, id: string) {
  return `${type}:${id}`
}

export function RelationshipGraphPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<any>(null)
  const lastTransformRef = useRef<any>(null)
  const didDragRef = useRef(false)
  const [enabledTypes, setEnabledTypes] = useState<GraphType[]>(GRAPH_TYPES)
  const [size, setSize] = useState({ width: 960, height: 620 })
  const [version, setVersion] = useState(0)
  const [zoomScale, setZoomScale] = useState(1)

  const characters = useEntityList(campaignId!, 'characters')
  const npcs = useEntityList(campaignId!, 'npcs')
  const locations = useEntityList(campaignId!, 'locations')
  const items = useEntityList(campaignId!, 'items')
  const spells = useEntityList(campaignId!, 'spells')
  const creatures = useEntityList(campaignId!, 'creatures')
  const notes = useEntityList(campaignId!, 'notes')
  const groups = useGroups(campaignId!)
  const arcs = useArcs(campaignId!)
  const sessions = useCampaignSessions(campaignId!)
  const events = useEvents(campaignId!)
  const links = useAllLinks(campaignId!)

  const isLoading = [
    characters, npcs, locations, items, spells, creatures, notes, groups, arcs, sessions, events, links,
  ].some(query => query.isLoading)

  const { nodes, edges } = useMemo(() => {
    const active = new Set(enabledTypes)
    const allNodes = new Map<string, GraphNode>()
    const lists: Partial<Record<GraphType, any[]>> = {
      characters: characters.data ?? [],
      npcs: npcs.data ?? [],
      locations: locations.data ?? [],
      items: items.data ?? [],
      spells: spells.data ?? [],
      creatures: creatures.data ?? [],
      notes: notes.data ?? [],
      groups: groups.data ?? [],
      arcs: arcs.data ?? [],
      sessions: sessions.data ?? [],
      events: events.data ?? [],
    }

    GRAPH_TYPES.forEach(type => {
      if (!active.has(type)) return
      const meta = TYPE_META[type]
      if (!meta) return

      ;(lists[type] ?? []).forEach((item: any) => {
        allNodes.set(nodeKey(type, item.id), {
          id: nodeKey(type, item.id),
          entityId: item.id,
          type,
          label: displayName(type, item),
          path: itemPath(campaignId!, type, item, item.id),
          icon: meta.icon,
          accentClass: meta.accentClass,
          color: meta.color,
        })
      })
    })

    const graphEdges: GraphEdge[] = [
      ...(links.data ?? [])
        .filter((link: EntityLink) => active.has(link.source_type) && active.has(link.target_type))
        .map((link: EntityLink) => ({
          id: link.id,
          source: nodeKey(link.source_type, link.source_id),
          target: nodeKey(link.target_type, link.target_id),
          label: link.relation_label,
          relation_type: link.relation_type,
        })),
      ...(events.data ?? []).flatMap(event => {
        const eventEdges = event.entity_links
          .filter(link => active.has('events') && active.has(link.entity_type))
          .map(link => ({
            id: `event-link:${link.id}`,
            source: nodeKey('events', event.id),
            target: nodeKey(link.entity_type, link.entity_id),
            label: link.role,
          }))
        if (event.arc_id && active.has('events') && active.has('arcs')) {
          eventEdges.push({
            id: `event-arc:${event.id}`,
            source: nodeKey('events', event.id),
            target: nodeKey('arcs', event.arc_id),
            label: 'arco',
          })
        }
        if (event.session_id && active.has('events') && active.has('sessions')) {
          eventEdges.push({
            id: `event-session:${event.id}`,
            source: nodeKey('events', event.id),
            target: nodeKey('sessions', event.session_id),
            label: 'sessão',
          })
        }
        return eventEdges
      }),
    ]
      .filter(edge => {
        const sourceId = edge.source as string
        const targetId = edge.target as string
        return allNodes.has(sourceId) && allNodes.has(targetId)
      })

    const connected = new Set<string>()
    graphEdges.forEach(edge => {
      connected.add(edge.source as string)
      connected.add(edge.target as string)
    })

    return {
      nodes: [...allNodes.values()].filter(node => connected.has(node.id)),
      edges: graphEdges,
    }
  }, [
    campaignId,
    enabledTypes,
    links.data,
    characters.data,
    npcs.data,
    locations.data,
    items.data,
    spells.data,
    creatures.data,
    notes.data,
    groups.data,
    arcs.data,
    sessions.data,
    events.data,
  ])

  useEffect(() => {
    const element = svgRef.current?.parentElement
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(360, Math.floor(entry.contentRect.width))
      const availableHeight = Math.floor(entry.contentRect.height)
      setSize({ width, height: Math.max(360, availableHeight || Math.floor(width * 0.58)) })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const d3 = window.d3
    const svg = svgRef.current
    if (!d3 || !svg || !nodes.length) return

    const simulationNodes = nodes.map(node => ({ ...node }))
    const simulationEdges = edges.map(edge => ({ ...edge }))

    const compactness = simulationNodes.length > 35 ? 0.78 : simulationNodes.length > 18 ? 0.9 : 1
    const linkDistance = Math.round(142 * compactness)
    const chargeStrength = simulationNodes.length > 35 ? -185 : simulationNodes.length > 18 ? -245 : -320

    const simulation = d3.forceSimulation(simulationNodes)
      .force('link', d3.forceLink(simulationEdges).id((node: GraphNode) => node.id).distance(linkDistance).strength(0.62))
      .force('charge', d3.forceManyBody().strength(chargeStrength).distanceMax(360))
      .force('center', d3.forceCenter(size.width / 2, size.height / 2))
      .force('x', d3.forceX(size.width / 2).strength(0.04))
      .force('y', d3.forceY(size.height / 2).strength(0.04))
      .force('collision', d3.forceCollide().radius(50))
      .on('tick', () => {
        simulationNodes.forEach((node: GraphNode, index: number) => {
          nodes[index].x = node.x
          nodes[index].y = node.y
        })
        setVersion(value => value + 1)
      })

    const zoom = d3.zoom()
      .scaleExtent([0.06, 4.5])
      .on('zoom', (event: any) => {
        lastTransformRef.current = event.transform
        setZoomScale(event.transform.k)
        d3.select(svg).select('.graph-stage').attr('transform', event.transform)
      })
    zoomRef.current = zoom
    d3.select(svg).call(zoom)

    const drag = d3.drag()
      .on('start', (event: any, node: GraphNode) => {
        didDragRef.current = false
        if (!event.active) simulation.alphaTarget(0.25).restart()
        const target = simulationNodes.find((entry: GraphNode) => entry.id === node.id)
        if (target) {
          target.fx = target.x
          target.fy = target.y
        }
      })
      .on('drag', (event: any, node: GraphNode) => {
        didDragRef.current = true
        const target = simulationNodes.find((entry: GraphNode) => entry.id === node.id)
        if (target) {
          target.fx = event.x
          target.fy = event.y
          node.fx = event.x
          node.fy = event.y
        }
      })
      .on('end', (event: any, node: GraphNode) => {
        if (!event.active) simulation.alphaTarget(0)
        const target = simulationNodes.find((entry: GraphNode) => entry.id === node.id)
        if (target) {
          target.fx = target.x
          target.fy = target.y
          node.fx = target.x
          node.fy = target.y
        }
      })

    d3.select(svg)
      .selectAll('.graph-node')
      .datum(function (this: SVGGElement) {
        return simulationNodes.find((node: GraphNode) => node.id === this.getAttribute('data-node-id'))
      })
      .call(drag)
    return () => simulation.stop()
  }, [edges, nodes, size.height, size.width])

  const transformGraph = (action: 'in' | 'out' | 'fit') => {
    const d3 = window.d3
    const svg = svgRef.current
    if (!d3 || !svg || !zoomRef.current) return
    const selection = d3.select(svg)

    if (action === 'fit') {
      const positioned = nodes.filter(node => Number.isFinite(node.x) && Number.isFinite(node.y))
      if (!positioned.length) return
      const padding = 96
      const minX = Math.min(...positioned.map(node => node.x!))
      const maxX = Math.max(...positioned.map(node => node.x!))
      const minY = Math.min(...positioned.map(node => node.y!))
      const maxY = Math.max(...positioned.map(node => node.y!))
      const graphWidth = Math.max(1, maxX - minX + padding * 2)
      const graphHeight = Math.max(1, maxY - minY + padding * 2)
      const scale = Math.min(2.2, Math.max(0.06, Math.min(size.width / graphWidth, size.height / graphHeight)))
      const tx = size.width / 2 - scale * ((minX + maxX) / 2)
      const ty = size.height / 2 - scale * ((minY + maxY) / 2)
      selection.transition().duration(260).call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
      return
    }

    selection.transition().duration(180).call(
      action === 'in' ? zoomRef.current.scaleBy : zoomRef.current.scaleBy,
      action === 'in' ? 1.25 : 0.8
    )
  }

  const toggleType = (type: GraphType) => {
    setEnabledTypes(current =>
      current.includes(type)
        ? current.filter(entry => entry !== type)
        : [...current, type]
    )
  }

  const nodeById = new Map(nodes.map(node => [node.id, node]))

  return (
    <div className="h-full p-8 max-w-7xl mx-auto flex flex-col overflow-hidden">
      <div className="flex flex-col gap-4 mb-6 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link2 size={22} className="text-gold" />
            <div>
              <h1 className="font-display text-2xl text-parchment">Gráfico de Relacionamentos</h1>
              <p className="text-sm text-parchment/35">{nodes.length} Entidades, {edges.length} Relacionamentos</p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded border border-stone-300 bg-stone-100 p-1">
            <button type="button" onClick={() => transformGraph('out')} className="h-8 w-8 rounded text-parchment/45 hover:text-parchment hover:bg-stone-200 transition-colors" title="Afastar zoom" aria-label="Afastar zoom">
              <ZoomOut size={15} className="mx-auto" />
            </button>
            <button type="button" onClick={() => transformGraph('fit')} className="h-8 w-8 rounded text-parchment/45 hover:text-gold hover:bg-stone-200 transition-colors" title="Centralizar grafo" aria-label="Centralizar grafo">
              <Crosshair size={15} className="mx-auto" />
            </button>
            <button type="button" onClick={() => transformGraph('in')} className="h-8 w-8 rounded text-parchment/45 hover:text-parchment hover:bg-stone-200 transition-colors" title="Aproximar zoom" aria-label="Aproximar zoom">
              <ZoomIn size={15} className="mx-auto" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {GRAPH_TYPES.map(type => {
            const meta = TYPE_META[type]!
            const Icon = meta.icon
            const active = enabledTypes.includes(type)
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={clsx(
                  'h-9 px-3 rounded border text-xs inline-flex items-center gap-2 transition-colors',
                  active
                    ? 'border-gold/40 bg-gold/10 text-gold'
                    : 'border-stone-300 bg-stone-100 text-parchment/35 hover:text-parchment/65'
                )}
              >
                <Icon size={13} className={active ? meta.accentClass : undefined} />
                {meta.labelPlural}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-lg border border-stone-300 bg-stone-100 overflow-hidden">
        {isLoading ? (
          <div className="h-full min-h-[360px] flex items-center justify-center text-sm text-parchment/30">Carregando grafo...</div>
        ) : nodes.length === 0 ? (
          <div className="h-full min-h-[360px] flex items-center justify-center text-sm text-parchment/30">
            Nenhuma conexão encontrada com os filtros atuais.
          </div>
        ) : (
          <svg ref={svgRef} viewBox={`0 0 ${size.width} ${size.height}`} className="block h-full w-full bg-stone-200">
            <g className="graph-stage">
              {/* Camada 1: Linhas/Edges */}
              <g className="edges-layer">
                {edges.map(edge => {
                  const source = typeof edge.source === 'string' ? nodeById.get(edge.source) : edge.source
                  const target = typeof edge.target === 'string' ? nodeById.get(edge.target) : edge.target
                  if (!source || !target) return null
                  const sx = source.x ?? size.width / 2
                  const sy = source.y ?? size.height / 2
                  const tx = target.x ?? size.width / 2
                  const ty = target.y ?? size.height / 2
                  const style = edgeStyle(edge)
                  const title = edge.label ? `${edge.label}${edge.relation_type ? ` (${edge.relation_type})` : ''}` : edge.relation_type
                  return (
                    <g key={`${edge.id}-${version}`}>
                      <line
                        x1={sx}
                        y1={sy}
                        x2={tx}
                        y2={ty}
                        stroke={style.stroke}
                        strokeWidth={style.strokeWidth}
                        opacity={style.opacity}
                      />
                      {title && <title>{title}</title>}
                    </g>
                  )
                })}
              </g>

              {/* Camada 2: Nós (círculos e ícones) */}
              <g className="nodes-layer">
                {nodes.map(node => {
                  const Icon = node.icon
                  const x = node.x ?? size.width / 2
                  const y = node.y ?? size.height / 2
                  return (
                    <g
                      key={node.id}
                      data-node-id={node.id}
                      className="graph-node cursor-grab active:cursor-grabbing"
                      transform={`translate(${x}, ${y})`}
                      onClick={() => {
                        if (didDragRef.current) {
                          didDragRef.current = false
                          return
                        }
                        navigate(node.path)
                      }}
                    >
                      <circle className="graph-node-circle" r={15} fill={`${node.color}22`} stroke={node.color} strokeWidth={1.4} />
                      <foreignObject x={-8} y={-8} width={16} height={16} className="pointer-events-none">
                        <Icon size={16} color={node.color} />
                      </foreignObject>
                    </g>
                  )
                })}
              </g>

              {/* Camada 3: Labels de nós (nomes) - sempre no topo */}
              <g className="node-labels-layer" style={{ pointerEvents: 'none' }}>
                {nodes.map(node => {
                  const x = node.x ?? size.width / 2
                  const y = node.y ?? size.height / 2
                  const opacity = zoomFade(zoomScale, 0.7, 1.35)
                  if (opacity <= 0.02) return null

                  return (
                    <g
                      key={`labels-${node.id}`}
                      transform={`translate(${x}, ${y})`}
                      style={{ pointerEvents: 'none' }}
                    >
                      <text
                        y={36}
                        textAnchor="middle"
                        className="fill-parchment text-[12px] font-medium"
                        paintOrder="stroke"
                        stroke="#26221a"
                        strokeWidth={4}
                        style={{ opacity, pointerEvents: 'none', transition: 'opacity 140ms ease-out' }}
                      >
                        {node.label.length > 24 ? `${node.label.slice(0, 23)}...` : node.label}
                      </text>
                    </g>
                  )
                })}
              </g>
            </g>
          </svg>
        )}
      </div>
    </div>
  )
}
