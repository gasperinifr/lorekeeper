import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBlocker } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

interface Options {
  when: boolean
  onSave?: () => Promise<boolean | void>
  saving?: boolean
  title?: string
  message?: string
}

export function useUnsavedChangesPrompt({
  when,
  onSave,
  saving = false,
  title = 'Alterações não salvas',
  message = 'Você alterou informações que ainda não foram salvas. O que deseja fazer?',
}: Options) {
  const bypassRef = useRef(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!when || bypassRef.current) return false
    return (
      currentLocation.pathname !== nextLocation.pathname ||
      currentLocation.search !== nextLocation.search ||
      currentLocation.hash !== nextLocation.hash
    )
  })

  useEffect(() => {
    if (!when) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [when])

  useEffect(() => {
    if (blocker.state !== 'blocked') setError('')
  }, [blocker.state])

  const runWithoutPrompt = useCallback((action: () => void) => {
    bypassRef.current = true
    action()
    window.setTimeout(() => {
      bypassRef.current = false
    }, 0)
  }, [])

  const discard = () => {
    blocker.proceed?.()
  }

  const stay = () => {
    blocker.reset?.()
  }

  const saveAndLeave = async () => {
    if (!onSave) return
    setIsSaving(true)
    setError('')
    try {
      const result = await onSave()
      if (result === false) return
      blocker.proceed?.()
    } catch (err: any) {
      setError(err.message ?? 'Não foi possível salvar as alterações.')
    } finally {
      setIsSaving(false)
    }
  }

  const dialog = typeof document !== 'undefined' && blocker.state === 'blocked'
    ? createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-stone-300 bg-stone-100 p-5 shadow-2xl">
            <h2 className="font-display text-lg text-parchment">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-parchment/60">{message}</p>
            {error && <p className="mt-3 text-xs text-crimson-light">{error}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={stay} disabled={saving || isSaving}>
                Continuar editando
              </Button>
              <Button type="button" size="sm" variant="danger" onClick={discard} disabled={saving || isSaving}>
                Sair sem salvar
              </Button>
              {onSave && (
                <Button type="button" size="sm" onClick={saveAndLeave} loading={saving || isSaving}>
                  Salvar alterações
                </Button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  return { dialog, runWithoutPrompt }
}
