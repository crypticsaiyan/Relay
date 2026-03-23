import { RealtimeImagePreview } from './RealtimeImagePreview'

export interface ScreenThumbnailProps {
  src?: string | null
  alt?: string
  label?: string
  caption?: string
}

export function ScreenThumbnail({
  src,
  alt = 'Agent screenshot',
  label = 'Waiting for screen...',
  caption,
}: ScreenThumbnailProps) {
  return (
    <RealtimeImagePreview
      src={src}
      alt={alt}
      emptyLabel={label}
      kicker="Current Screen"
      caption={caption}
      previewHeightClassName="h-[140px]"
      previewImageClassName="w-full object-cover"
      modalImageClassName="max-h-[82vh] w-full object-contain"
      liveLabel="Live preview"
    />
  )
}
