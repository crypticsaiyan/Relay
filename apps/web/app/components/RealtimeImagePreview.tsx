import { useEffect, useState } from 'react'

export interface RealtimeImagePreviewProps {
  src?: string | null
  alt: string
  emptyLabel?: string
  kicker?: string | null
  caption?: string | null
  previewHeightClassName?: string
  previewImageClassName?: string
  modalImageClassName?: string
  wrapperClassName?: string
  imageWrapperClassName?: string
  liveLabel?: string | null
}

export function RealtimeImagePreview({
  src,
  alt,
  emptyLabel = 'Waiting for screen...',
  kicker = null,
  caption = null,
  previewHeightClassName = 'h-[140px]',
  previewImageClassName = 'w-full object-cover',
  modalImageClassName = 'max-h-[82vh] w-full object-contain',
  wrapperClassName = '',
  imageWrapperClassName = '',
  liveLabel = 'Live preview',
}: RealtimeImagePreviewProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  return (
    <>
      <div className={wrapperClassName}>
        {kicker ? <p className="island-kicker mb-3">{kicker}</p> : null}
        <div className={`group relative overflow-hidden rounded-md border border-[var(--line)] bg-[var(--bg-base)] ${imageWrapperClassName}`}>
          {src ? (
            <button
              type="button"
              className="block w-full cursor-zoom-in text-left"
              onClick={() => {
                setIsOpen(true)
              }}
            >
              <img
                src={src}
                alt={alt}
                className={`${previewHeightClassName} ${previewImageClassName} transition-transform duration-300 group-hover:scale-[1.02]`}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
                <span>Click to enlarge</span>
                {liveLabel ? (
                  <span className="inline-flex items-center gap-1.5 text-cyan-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    {liveLabel}
                  </span>
                ) : null}
              </div>
            </button>
          ) : (
            <div className={`flex ${previewHeightClassName} items-center justify-center bg-[var(--bg-base)] text-center text-xs font-medium uppercase tracking-widest text-zinc-600`}>
              {emptyLabel}
            </div>
          )}
        </div>
        {caption ? (
          <p className="m-0 mt-3 text-center text-xs text-zinc-500">
            {caption}
          </p>
        ) : null}
      </div>

      {isOpen && src ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => {
            setIsOpen(false)
          }}
        >
          <div
            className="relative w-full max-w-6xl rounded-xl border border-zinc-700 bg-zinc-950/95 p-3 shadow-2xl"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="m-0 text-sm font-semibold text-zinc-100">{alt}</p>
                <p className="m-0 mt-1 text-xs text-zinc-500">
                  {liveLabel ? `${liveLabel} updates automatically while this view is open.` : 'Preview image'}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
                onClick={() => {
                  setIsOpen(false)
                }}
              >
                Close
              </button>
            </div>
            <div className="custom-scrollbar max-h-[84vh] overflow-auto rounded-lg border border-zinc-800 bg-black p-2">
              <img
                src={src}
                alt={alt}
                className={`mx-auto block ${modalImageClassName}`}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
