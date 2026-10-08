import { useEffect, useState, type ReactNode } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

// Card rail follows the Embla/shadcn carousel pattern published on 21st.dev.
// https://21st.dev/@larsen66/components/carousel/carousel-with-spacing
export function WorkspaceCarousel({ children, count, label }: { children: ReactNode; count: number; label: string }) {
  const rtl = document.documentElement.dir === 'rtl'
  const [ref, api] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', direction: rtl ? 'rtl' : 'ltr' })
  const [position, setPosition] = useState({ prev: false, next: false, index: 0 })
  useEffect(() => {
    if (!api) return
    const update = () => setPosition({ prev: api.canScrollPrev(), next: api.canScrollNext(), index: api.selectedScrollSnap() })
    update(); api.on('select', update).on('reInit', update)
    return () => { api.off('select', update).off('reInit', update) }
  }, [api])
  return <section className="workspace-carousel" aria-label={label} aria-roledescription="carousel">
    <div className="workspace-carousel-viewport" ref={ref} onKeyDown={e => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight') ? api?.scrollNext : api?.scrollPrev)?.() }
    }} tabIndex={0} aria-label={`${label}, use arrow keys to browse`}><div className="workspace-carousel-track">{children}</div></div>
    <div className="workspace-carousel-footer"><span aria-live="polite">{count ? position.index + 1 : 0} / {count}</span><div className="flex gap-2"><button className="btn outline icon" disabled={!position.prev} aria-label="Previous workspaces" onClick={() => api?.scrollPrev()}>{rtl ? <ArrowRight /> : <ArrowLeft />}</button><button className="btn outline icon" disabled={!position.next} aria-label="Next workspaces" onClick={() => api?.scrollNext()}>{rtl ? <ArrowLeft /> : <ArrowRight />}</button></div></div>
  </section>
}
