import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EntityConfig } from '@/config/entityConfig'

interface Props {
  entity: any
  config: EntityConfig
  subtitle?: string
  meta?: string
  tags?: ReactNode
}

export function EntityListItem({ entity, config, subtitle, meta, tags }: Props) {
  const imageUrl = entity.image_url ?? entity.portrait_url
  const name = config.displayName(entity)
  const displaySubtitle = subtitle ?? config.displaySub(entity)
  const MetaIcon = config.icon

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-100 px-3.5 py-3 transition-colors hover:border-gold/35 hover:bg-stone-200/70 group flex items-center gap-3">
      <div className="h-11 w-11 rounded-full border border-stone-300 bg-stone-200 overflow-hidden flex items-center justify-center text-sm text-gold font-medium shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
            onError={event => { event.currentTarget.style.display = 'none' }}
          />
        ) : (
          <MetaIcon size={18} className={config.accentClass} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium text-parchment group-hover:text-gold transition-colors truncate">
            {name}
            {entity.visibility === 'private' && <Lock size={12} className="inline ml-2 text-parchment/30" />}
          </p>
          {meta && (
            <span className="text-[11px] text-parchment/30 shrink-0 truncate max-w-[12rem]">
              {meta}
            </span>
          )}
        </div>

        {displaySubtitle && (
          <p className="text-xs text-parchment/35 truncate mt-0.5">
            {displaySubtitle}
          </p>
        )}

        {tags && <div className="flex flex-wrap gap-1 mt-2">{tags}</div>}
      </div>
    </div>
  )
}
