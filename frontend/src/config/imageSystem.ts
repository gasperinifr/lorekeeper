export type ImageRole = 'banner' | 'image' | 'portrait' | 'icon'

export interface ImageSpec {
  label: string
  hint: string
  cropMode: 'original' | 'square' | 'wide' | 'photo' | 'portrait'
  previewClass: string
  previewImageClass: string
}

export const IMAGE_SPECS: Record<ImageRole, ImageSpec> = {
  banner: {
    label: 'Banner',
    hint: 'Horizontal, recomendado 16:9 ou 3:2. O sistema mostra a imagem inteira sem cortar.',
    cropMode: 'wide',
    previewClass: 'w-fit max-w-full',
    previewImageClass: 'max-h-72 max-w-full w-auto h-auto',
  },
  image: {
    label: 'Imagem',
    hint: 'Imagem geral. Use 3:2 para lugares e cenas; o sistema preserva a proporcao.',
    cropMode: 'photo',
    previewClass: 'w-fit max-w-full',
    previewImageClass: 'max-h-72 max-w-full w-auto h-auto',
  },
  portrait: {
    label: 'Retrato',
    hint: 'Vertical, recomendado 4:5 para personagens e NPCs.',
    cropMode: 'portrait',
    previewClass: 'w-fit max-w-full',
    previewImageClass: 'max-h-80 max-w-full w-auto h-auto',
  },
  icon: {
    label: 'Icone',
    hint: 'Quadrado, recomendado 1:1.',
    cropMode: 'square',
    previewClass: 'w-fit max-w-full',
    previewImageClass: 'max-h-40 max-w-full w-auto h-auto',
  },
}

export function inferImageRole(context: string, fieldKey?: string): ImageRole {
  if (fieldKey === 'hub_banner_url' || context === 'campaign-banners') return 'banner'
  if (fieldKey === 'cover_image_url' || context === 'campaigns') return 'image'
  if (fieldKey === 'portrait_url' || context === 'characters' || context === 'npcs') return 'portrait'
  if (fieldKey?.includes('icon')) return 'icon'
  return 'image'
}
