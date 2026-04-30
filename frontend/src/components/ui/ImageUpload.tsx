import { useEffect, useRef, useState } from 'react'
import { Check, Image as ImageIcon, Upload, X } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from './Button'

interface Props {
  currentUrl?: string
  context: string
  onUpload: (url: string) => void
  className?: string
  compact?: boolean
  enableCrop?: boolean
}

type CropMode = 'original' | 'square' | 'wide' | 'classic' | 'photo' | 'portrait' | 'story' | 'banner'

const CROP_MODES: Record<CropMode, { label: string; aspect?: number; width: number; height: number }> = {
  original: { label: 'Original', width: 1200, height: 800 },
  square: { label: '1:1', aspect: 1, width: 1000, height: 1000 },
  wide: { label: '16:9', aspect: 16 / 9, width: 1280, height: 720 },
  classic: { label: '4:3', aspect: 4 / 3, width: 1200, height: 900 },
  photo: { label: '3:2', aspect: 3 / 2, width: 1200, height: 800 },
  portrait: { label: '4:5', aspect: 4 / 5, width: 960, height: 1200 },
  story: { label: '9:16', aspect: 9 / 16, width: 900, height: 1600 },
  banner: { label: '3:1', aspect: 3, width: 1500, height: 500 },
}

export function ImageUpload({ currentUrl, context, onUpload, className, compact = false, enableCrop = true }: Props) {
  const [preview, setPreview] = useState(currentUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cropSrc, setCropSrc] = useState('')
  const [cropMode, setCropMode] = useState<CropMode>('original')
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [naturalAspect, setNaturalAspect] = useState(3 / 2)
  const inputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

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
    setCropMode('original')
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
    setCropSrc(URL.createObjectURL(file))
  }

  const applyCrop = async () => {
    const image = imageRef.current
    if (!image) return
    const mode = CROP_MODES[cropMode]
    const aspect = mode.aspect ?? image.naturalWidth / image.naturalHeight
    const outputWidth = mode.aspect ? mode.width : Math.min(1600, image.naturalWidth)
    const outputHeight = mode.aspect ? mode.height : Math.round(outputWidth / aspect)

    const sourceAspect = aspect
    let sourceWidth = image.naturalWidth
    let sourceHeight = sourceWidth / sourceAspect
    if (sourceHeight > image.naturalHeight) {
      sourceHeight = image.naturalHeight
      sourceWidth = sourceHeight * sourceAspect
    }
    sourceWidth = sourceWidth / zoom
    sourceHeight = sourceHeight / zoom

    const maxX = Math.max(0, (image.naturalWidth - sourceWidth) / 2)
    const maxY = Math.max(0, (image.naturalHeight - sourceHeight) / 2)
    const sourceX = (image.naturalWidth - sourceWidth) / 2 + (offsetX / 100) * maxX
    const sourceY = (image.naturalHeight - sourceHeight) / 2 + (offsetY / 100) * maxY

    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight)
    canvas.toBlob(async blob => {
      if (!blob) return
      await uploadBlob(blob, 'cropped.webp')
      setCropSrc('')
    }, 'image/webp', 0.9)
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

  const cropAspect = CROP_MODES[cropMode].aspect ?? naturalAspect
  const cropPreviewStyle = {
    aspectRatio: `${cropAspect}`,
  } as React.CSSProperties
  const cropImageStyle = {
    transform: `translate(${offsetX / 4}%, ${offsetY / 4}%) scale(${zoom})`,
  } as React.CSSProperties

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        className={clsx(
          'relative border border-dashed cursor-pointer transition-colors overflow-hidden',
          preview && !compact ? 'w-fit max-w-full' : 'w-full',
          compact ? 'rounded-md min-h-0' : 'rounded-xl',
          loading ? 'border-gold/50 bg-gold/5' : 'border-stone-300 hover:border-gold/40 bg-stone-200',
        )}
        style={{ minHeight: preview && !compact ? undefined : compact ? '44px' : '120px' }}
      >
        {preview ? (
          <div className={clsx(compact ? 'flex items-center gap-2 px-3 py-2' : 'relative inline-flex max-w-full p-2')}>
            {compact ? (
              <>
                <ImageIcon size={15} className="text-gold" />
                <span className="text-xs text-parchment/55 flex-1 truncate">Imagem anexada</span>
              </>
            ) : (
              <img src={preview} alt="Preview" className="block max-h-64 max-w-full w-auto h-auto object-contain rounded bg-stone-300" />
            )}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); clear() }}
              className={clsx(
                'text-parchment hover:text-crimson transition-colors',
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

      {cropSrc && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl border border-stone-300 bg-stone-100 p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg text-parchment">Ajustar imagem</p>
              <button onClick={() => setCropSrc('')} className="text-parchment/35 hover:text-parchment">
                <X size={18} />
              </button>
            </div>
            <div
              className="relative mx-auto w-full max-w-lg max-h-[55vh] bg-stone-300 rounded-lg overflow-hidden"
              style={cropPreviewStyle}
            >
              <img
                ref={imageRef}
                src={cropSrc}
                alt="Corte"
                onLoad={e => setNaturalAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-100 ease-out will-change-transform"
                style={cropImageStyle}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CROP_MODES) as CropMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCropMode(mode)}
                  className={clsx(
                    'text-xs rounded border px-3 py-1.5 transition-colors',
                    cropMode === mode ? 'border-gold text-gold bg-gold/10' : 'border-stone-300 text-parchment/55'
                  )}
                >
                  {CROP_MODES[mode].label}
                </button>
              ))}
            </div>
            <label className="text-xs text-parchment/45 flex flex-col gap-1">
              Zoom
              <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-parchment/45 flex flex-col gap-1">
                Horizontal
                <input type="range" min="-100" max="100" value={offsetX} onChange={e => setOffsetX(Number(e.target.value))} />
              </label>
              <label className="text-xs text-parchment/45 flex flex-col gap-1">
                Vertical
                <input type="range" min="-100" max="100" value={offsetY} onChange={e => setOffsetY(Number(e.target.value))} />
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={applyCrop} loading={loading} className="flex-1">
                <Check size={13} /> Aplicar corte
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { const img = imageRef.current; if (img) fetch(cropSrc).then(r => r.blob()).then(blob => uploadBlob(blob, 'original.webp')).then(() => setCropSrc('')) }}>
                Usar original
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
