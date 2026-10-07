import { useRef, useState, useEffect, type CSSProperties } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, Landmark, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MetaEntity } from '../../lib/meta'
import { CellValue } from '../Fields'
export function AccountCard({ def, rec, to }: { def: MetaEntity; rec: Record<string, any>; to?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const fields = def.fields.filter(f => !f.secret && !f.hidden && ['name', 'bank_name', 'type', 'account_no', 'iban', 'currency'].includes(f.name) && rec[f.name] !== null && rec[f.name] !== undefined && rec[f.name] !== '')
  const content = <><div className="account-card-top"><Landmark size={23} /><WalletCards size={26} strokeWidth={1.3} /></div><dl>{fields.map(f => <div key={f.name} className={f.name === 'iban' || f.name === 'account_no' ? 'account-number' : ''}><dt>{f.label}</dt><dd><CellValue f={f} rec={rec} /></dd></div>)}</dl></>
  return <div className="account-perspective" ref={ref} onPointerMove={e => { if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return; const b = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--rx', `${-(e.clientY - b.top - b.height / 2) / b.height * 8}deg`); e.currentTarget.style.setProperty('--ry', `${(e.clientX - b.left - b.width / 2) / b.width * 8}deg`) }} onPointerLeave={() => { ref.current?.style.setProperty('--rx', '0deg'); ref.current?.style.setProperty('--ry', '0deg') }} style={{ '--rx': '0deg', '--ry': '0deg' } as CSSProperties}>{to ? <Link className="account-card" to={to}>{content}</Link> : <div className="account-card">{content}</div>}</div>
}
export function AccountCarousel({ def, rows }: { def: MetaEntity; rows: Record<string, any>[] }) {
  const [ref, api] = useEmblaCarousel({ align: 'start', direction: document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr' })
  const [prev, setPrev] = useState(false), [next, setNext] = useState(false)
  useEffect(() => { if (!api) return; const update = () => { setPrev(api.canScrollPrev()); setNext(api.canScrollNext()) }; update(); api.on('select', update).on('reInit', update); return () => { api.off('select', update).off('reInit', update) } }, [api])
  if (!rows.length) return null
  return <section className="account-carousel" aria-label={def.plural} aria-roledescription="carousel"><div className="account-carousel-controls"><button className="btn outline icon" disabled={!prev} aria-label="Previous account" onClick={() => api?.scrollPrev()}><ChevronLeft /></button><button className="btn outline icon" disabled={!next} aria-label="Next account" onClick={() => api?.scrollNext()}><ChevronRight /></button></div><div className="account-viewport" ref={ref}><div className="account-track">{rows.map((rec, i) => <div key={rec.id} className="account-slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${rows.length}`}><AccountCard def={def} rec={rec} to={`/e/bank_accounts/${rec.id}`} /></div>)}</div></div></section>
}
