import { clsx } from 'clsx'
import { InputHTMLAttributes, forwardRef } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className, ...props }, ref) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm text-parchment/70 font-medium">{label}</label>}
    <input
      ref={ref}
      {...props}
      className={clsx(
        'bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/40',
        'focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-colors',
        error && 'border-crimson',
        className
      )}
    />
    {error && <span className="text-xs text-crimson-light">{error}</span>}
  </div>
))
Input.displayName = 'Input'