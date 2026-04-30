import { clsx } from 'clsx'
import { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded font-body font-medium transition-all focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-gold text-ink hover:bg-gold-light active:scale-95':          variant === 'primary',
          'bg-transparent text-parchment hover:bg-stone-200':              variant === 'ghost',
          'bg-crimson text-parchment hover:bg-crimson-light active:scale-95': variant === 'danger',
        },
        {
          'text-xs px-3 py-1.5': size === 'sm',
          'text-sm px-4 py-2':   size === 'md',
          'text-base px-6 py-3': size === 'lg',
        },
        className
      )}
    >
      {loading ? <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" /> : null}
      {children}
    </button>
  )
}