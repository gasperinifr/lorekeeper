import { useEffect, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { clsx } from 'clsx'
import { ImageCropEditor } from './ImageCropEditor'
import { IMAGE_SPECS, ImageRole, inferImageRole } from '@/config/imageSystem'

interface Props {
  currentUrl?: string
  context: string
  onUpload: (url: string) => void
  className?: string
  compact?: boolean
  enableCrop?: boolean
  role?: ImageRole
  fieldKey?: string
}

export function ImageUpload({ currentUrl, context, onUpload, className, compact = false, enableCrop = true, role, fieldKey }: Props) {
  const [preview, setPreview] = useState(currentUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cropSrc, setCropSrc] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const imageRole = role ?? inferImageRole(context, fieldKey)
  const spec = IMAGE_SPECS[imageRole]

  useEffect(() => {
    setPreview(currentUrl || undefined)
  }, [currentUrl])

  useEffect(() => {
    return () => {
      if (cropSrc.startsWith('blob:')) URL.revokeObjectURL(cropSrc)
    }
  }, [cropSrc])

  const uploadBlob = async (blob: Blob, filename = 'image.webp') => {
    setError('')
    setLoading(true)
    try {
      const form = new FormData()
      form.append('file', blob, filename)

      const res = await fetch(`/api/uploads/image?context=${context}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('lk_token')}` },
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Erro ${res.status} ao enviar imagem.` }))
        throw new Error(err.error ?? `Erro ${res.status} ao enviar imagem.`)
      }
      const { url } = await res.json()
      setPreview(url)
      onUpload(url)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFile = async (file: File) => {
    if (!enableCrop) {
      await uploadBlob(file, file.name)
      return
    }
    setError('')
    setCropSrc(URL.createObjectURL(file))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const clear = () => {
    setPreview(undefined)
    onUpload('')
  }

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        className={clsx(
          'relative border border-dashed cursor-pointer transition-colors overflow-hidden',
          preview && !compact ? 'mx-auto' : 'w-full',
          preview && !compact ? spec.previewClass : '',
          compact ? 'rounded-md min-h-0' : 'rounded-xl',
          loading ? 'border-gold/50 bg-gold/5' : 'border-stone-300 hover:border-gold/40 bg-stone-200',
        )}
        style={{ minHeight: preview && !compact ? undefined : compact ? '44px' : '120px' }}
      >
        {preview ? (
          <div className={clsx(compact ? 'flex items-center gap-2 px-3 py-2 h-11' : 'relative flex w-full justify-center p-2')}>
            {compact ? (
              <>
                <img src={preview} alt="Preview" className="h-full w-auto object-cover rounded" />
                <span className="text-xs text-parchment/55 flex-1 truncate">Imagem anexada</span>
              </>
            ) : (
              <img src={preview} alt="Preview" className={clsx('block object-contain rounded bg-stone-300', spec.previewImageClass)} />
            )}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); clear() }}
              className={clsx(
                'text-parchment hover:text-crimson transition-colors shrink-0',
                compact ? 'p-1' : 'absolute top-2 right-2 bg-ink/70 rounded-full p-1'
              )}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className={clsx('flex items-center justify-center gap-2', compact ? 'h-11 px-3' : 'h-full py-8 flex-col')}>
            {loading
              ? <div className="animate-spin h-5 w-5 border-2 border-gold border-t-transparent rounded-full" />
              : <>
                  <Upload size={compact ? 15 : 20} className="text-parchment/30" />
                  <p className="text-xs text-parchment/40">Clique ou arraste uma imagem</p>
                  {!compact && <p className="text-xs text-parchment/25">{spec.hint}</p>}
                  {!compact && <p className="text-xs text-parchment/25">JPEG, PNG ou WebP - max. 5MB</p>}
                </>
            }
          </div>
        )}
      </div>
      {error && <p className="text-xs text-crimson-light">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {/* Editor de corte integrado */}
      {cropSrc && (
        <ImageCropEditor
          src={cropSrc}
          onCrop={blob => uploadBlob(blob, 'cropped.webp').then(() => setCropSrc(''))}
          onUseOriginal={blob => uploadBlob(blob, 'original.webp').then(() => setCropSrc(''))}
          onCancel={() => setCropSrc('')}
          loading={loading}
          defaultMode="original"
        />
      )}
    </div>
  )
}
