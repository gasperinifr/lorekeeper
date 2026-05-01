import { KeyboardEvent, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { clsx } from 'clsx'
import type { FieldDef, SectionDef } from '@/config/entityConfig'

interface Props {
  section: SectionDef
  formValues: Record<string, any>
  onChange: (key: string, value: any) => void
}

const inputClass = 'bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/40 focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-colors'

function TagsInput({ field, value, onChange }: { field: FieldDef; value: string[]; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState('')

  const addDraft = () => {
    const tags = draft
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)
      .filter(tag => !value.includes(tag))
    if (!tags.length) return
    onChange([...value, ...tags])
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addDraft()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={addDraft}
        placeholder={field.placeholder}
        className={inputClass}
      />
      {!!value.length && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(value.filter(item => item !== tag))}
              className="text-xs rounded-full border border-gold/25 bg-gold/10 text-gold px-2 py-1 inline-flex items-center gap-1"
            >
              {tag} <X size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EntitySectionField({ field, value, onChange }: { field: FieldDef; value: any; onChange: (value: any) => void }) {
  if (field.type === 'text' || field.type === 'number') {
    return (
      <input
        type={field.type}
        value={value ?? ''}
        onChange={event => onChange(field.type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)}
        required={field.required}
        placeholder={field.placeholder}
        className={inputClass}
      />
    )
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
        rows={field.rows ?? 4}
        required={field.required}
        placeholder={field.placeholder}
        className={clsx(inputClass, 'resize-y')}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <select value={value ?? ''} onChange={event => onChange(event.target.value)} className={inputClass}>
        <option value="">Selecionar...</option>
        {field.options?.map(option => (
          <option key={option} value={option}>{field.optionLabels?.[option] ?? option}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'toggle') {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={clsx('w-10 h-5 rounded-full transition-colors relative', value ? 'bg-gold' : 'bg-stone-300')}
      >
        <span className={clsx(
          'absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
          value ? 'translate-x-5' : 'translate-x-0.5'
        )} />
      </button>
    )
  }

  if (field.type === 'slider') {
    const min = field.sliderMin ?? 1
    const max = field.sliderMax ?? 5
    const current = value ?? Math.round((min + max) / 2)
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={min}
            max={max}
            value={current}
            onChange={event => onChange(Number(event.target.value))}
            className="w-full accent-gold"
          />
          <span className="text-xs text-gold w-6 text-right">{current}</span>
        </div>
        {field.sliderLabels && (
          <div className="flex justify-between text-[11px] text-parchment/35">
            <span>{field.sliderLabels[0]}</span>
            <span>{field.sliderLabels[1]}</span>
          </div>
        )}
      </div>
    )
  }

  if (field.type === 'tags-input') {
    return <TagsInput field={field} value={Array.isArray(value) ? value : []} onChange={onChange} />
  }

  return null
}

export function EntitySection({ section, formValues, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(!!section.defaultCollapsed)

  return (
    <section className="rounded-xl border border-stone-300 bg-stone-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(value => !value)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-200 transition-colors"
      >
        <span className="font-display text-base text-parchment">{section.label}</span>
        <ChevronDown size={16} className={clsx('text-parchment/45 transition-transform', collapsed && '-rotate-90')} />
      </button>

      <div className={clsx('grid transition-[grid-template-rows] duration-200', collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
        <div className="min-h-0 overflow-hidden">
          <div className="p-4 pt-1 flex flex-col gap-4">
            {section.fields.map(field => (
              <label key={field.key} className="flex flex-col gap-1">
                <span className="text-sm text-parchment/70 font-medium">
                  {field.label}
                  {field.hint && <span className="text-parchment/30 font-normal ml-2 text-xs">{field.hint}</span>}
                </span>
                <EntitySectionField
                  field={field}
                  value={formValues[field.key]}
                  onChange={value => onChange(field.key, value)}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
