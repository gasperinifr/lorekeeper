import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from './Button'

type CropMode = 'original' | 'square' | 'wide' | 'photo' | 'portrait'

const CROP_MODES: Record<CropMode, { label: string; aspect?: number; width: number; height: number }> = {
  original: { label: 'Original', width: 1200, height: 800 },
  square: { label: '1:1', aspect: 1, width: 1000, height: 1000 },
  wide: { label: '16:9', aspect: 16 / 9, width: 1280, height: 720 },
  photo: { label: '3:2', aspect: 3 / 2, width: 1200, height: 800 },
  portrait: { label: '4:5', aspect: 4 / 5, width: 960, height: 1200 },
}

interface Props {
  src: string
  onCrop: (blob: Blob) => void
  onUseOriginal: (blob: Blob) => void
  onCancel: () => void
  loading?: boolean
  defaultMode?: CropMode
}

export function ImageCropEditor({ src, onCrop, onUseOriginal, onCancel, loading, defaultMode = 'original' }: Props) {
  const [cropMode, setCropMode] = useState<CropMode>(defaultMode)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [naturalAspect, setNaturalAspect] = useState(3 / 2)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let mounted = true
    const img = new Image()
    img.onload = () => {
      if (!mounted) return
      imgRef.current = img
      setNaturalAspect(img.naturalWidth / img.naturalHeight)
    }
    img.src = src
    return () => {
      mounted = false
      img.onload = null
      imgRef.current = null
    }
  }, [src])

  const cropAspect = CROP_MODES[cropMode].aspect ?? naturalAspect
  const cropPreviewStyle = {
    aspectRatio: `${cropAspect}`,
    maxWidth: cropAspect < 1 ? `min(100%, ${Math.round(54 * cropAspect)}vh)` : '100%',
  } as React.CSSProperties

  const getBaseSource = (img: HTMLImageElement) => {
    const mode = CROP_MODES[cropMode]
    const aspect = mode.aspect ?? (img.naturalWidth / img.naturalHeight)

    let width = img.naturalWidth
    let height = width / aspect
    if (height > img.naturalHeight) {
      height = img.naturalHeight
      width = height * aspect
    }

    return { width, height }
  }

  // Sliders move the crop window across only the real available image area,
  // so the preview and exported crop never expose blank space outside the file.
  const computeSource = (img: HTMLImageElement) => {
    const base = getBaseSource(img)
    const sourceWidth = Math.min(img.naturalWidth, base.width / zoom)
    const sourceHeight = Math.min(img.naturalHeight, base.height / zoom)

    const availableX = Math.max(0, img.naturalWidth - sourceWidth)
    const availableY = Math.max(0, img.naturalHeight - sourceHeight)
    const positionX = (offsetX + 100) / 200
    const positionY = (offsetY + 100) / 200

    let sourceX = availableX * positionX
    let sourceY = availableY * positionY

    sourceX = Math.max(0, Math.min(sourceX, img.naturalWidth - sourceWidth))
    sourceY = Math.max(0, Math.min(sourceY, img.naturalHeight - sourceHeight))

    return { sourceX, sourceY, sourceWidth, sourceHeight }
  }

  const movement = useMemo(() => {
    const img = imgRef.current
    if (!img) return { horizontal: false, vertical: false }
    const { sourceWidth, sourceHeight } = computeSource(img)
    return {
      horizontal: img.naturalWidth - sourceWidth > 1,
      vertical: img.naturalHeight - sourceHeight > 1,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropMode, zoom, naturalAspect])

  const drawPreview = () => {
    const img = imgRef.current
    const canvas = canvasRef.current
    const container = previewRef.current
    if (!img || !canvas || !container) return

    const rect = container.getBoundingClientRect()
    const cssWidth = rect.width
    const cssHeight = rect.height || rect.width / cropAspect

    const dpr = window.devicePixelRatio || 1
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`
    canvas.width = Math.max(1, Math.round(cssWidth * dpr))
    canvas.height = Math.max(1, Math.round(cssHeight * dpr))

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    const { sourceX, sourceY, sourceWidth, sourceHeight } = computeSource(img)
    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, cssWidth, cssHeight)
  }

  useLayoutEffect(() => {
    drawPreview()
    const handle = () => drawPreview()
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropMode, zoom, offsetX, offsetY, naturalAspect, src])

  const setMode = (mode: CropMode) => {
    setCropMode(mode)
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
  }

  const applyCrop = async () => {
    const img = imgRef.current
    if (!img) return
    const mode = CROP_MODES[cropMode]
    const aspect = mode.aspect ?? img.naturalWidth / img.naturalHeight
    const outputWidth = mode.aspect ? mode.width : Math.min(1600, img.naturalWidth)
    const outputHeight = mode.aspect ? mode.height : Math.round(outputWidth / aspect)

    const { sourceX, sourceY, sourceWidth, sourceHeight } = computeSource(img)

    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight)
    canvas.toBlob(blob => { if (blob) onCrop(blob) }, 'image/webp', 0.9)
  }

  const useOriginal = async () => {
    const blob = await fetch(src).then(r => r.blob())
    onUseOriginal(blob)
  }

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <div className="rounded-xl border border-stone-300 bg-stone-100 p-6 flex flex-col gap-4 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-parchment">Ajustar imagem</h3>
          <button onClick={onCancel} className="text-parchment/35 hover:text-parchment transition-colors">
            <X size={20} />
          </button>
        </div>

        <div
          ref={previewRef}
          className="relative mx-auto w-full rounded-lg overflow-hidden bg-stone-200 border border-stone-300"
          style={cropPreviewStyle}
        >
          <canvas ref={canvasRef} className="block h-full w-full" />
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {(Object.keys(CROP_MODES) as CropMode[]).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setMode(mode)}
              className={clsx(
                'text-xs rounded border px-3 py-2 transition-colors font-medium',
                cropMode === mode ? 'border-gold bg-gold/15 text-gold' : 'border-stone-300 bg-stone-200 text-parchment/60 hover:text-parchment'
              )}
            >
              {CROP_MODES[mode].label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-parchment/70">Zoom: <span className="text-parchment">{zoom.toFixed(2)}x</span></label>
            <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-full accent-gold" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-parchment/70">Horizontal</label>
              <input
                type="range"
                min={-100}
                max={100}
                value={movement.horizontal ? offsetX : 0}
                disabled={!movement.horizontal}
                onChange={e => setOffsetX(Number(e.target.value))}
                className="w-full accent-gold disabled:opacity-35"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-parchment/70">Vertical</label>
              <input
                type="range"
                min={-100}
                max={100}
                value={movement.vertical ? offsetY : 0}
                disabled={!movement.vertical}
                onChange={e => setOffsetY(Number(e.target.value))}
                className="w-full accent-gold disabled:opacity-35"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" size="sm" onClick={applyCrop} loading={loading} className="flex-1"><Check size={13} /> Aplicar</Button>
          <Button type="button" size="sm" variant="ghost" onClick={useOriginal}>Original</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
