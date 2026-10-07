import { AccountCard } from './ui/account-card'
import { useMemo } from 'react'
import { useMeta, type MetaEntity } from '../lib/meta'
import { CellValue } from './Fields'
import { sectionsOf } from './EntityForm'
import { cls } from '../lib/format'

export function RecordView({ def, rec }: { def: MetaEntity; rec: Record<string, any> }) {
  const sections = useMemo(() => sectionsOf(def.fields.filter(f => !f.hidden && !f.secret && !f.virtual && f.type !== 'json')), [def])
  const custom = def.customFieldDefs ?? []
  return (
    <div>
      {def.key === 'bank_accounts' && <div className="mb-6 max-w-xl"><AccountCard def={def} rec={rec} /></div>}
      {sections.map((s, i) => {
        const shown = s.fields.filter(f => rec[f.name] !== null && rec[f.name] !== undefined && rec[f.name] !== '' && rec[f.name] !== false)
        if (!shown.length) return null
        return (
          <section key={s.name} className={cls(i > 0 && 'mt-5')}>
            {(sections.length > 1 || s.name !== 'Details') && <h3 className="font-display font-extrabold text-[12.5px] uppercase tracking-wider text-fold border-b border-line pb-1 mb-2.5 mt-0">{s.name}</h3>}
            <dl className="grid gap-x-6 gap-y-2.5 m-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {shown.map(f => <div key={f.name} className={cls('min-w-0', f.type === 'textarea' && 'md:col-span-2 xl:col-span-3')}><dt className="text-[11.5px] font-semibold text-muted">{f.label}</dt><dd className="m-0 text-[14px] text-ink font-medium break-words"><CellValue f={f} rec={rec} statusField={def.statusField} /></dd></div>)}
            </dl>
          </section>
        )
      })}
      {custom.some(f => rec.custom?.[f.name] !== undefined) && (
        <section className="mt-5"><h3 className="font-display font-extrabold text-[12.5px] uppercase tracking-wider text-fold border-b border-line pb-1 mb-2.5 mt-0">Custom fields</h3>
          <dl className="grid gap-x-6 gap-y-2.5 m-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">{custom.filter(f => rec.custom?.[f.name] !== undefined).map(f => <div key={f.name}><dt className="text-[11.5px] font-semibold text-muted">{f.label}</dt><dd className="m-0 font-medium text-ink"><CellValue f={f} rec={rec.custom} /></dd></div>)}</dl></section>)}
    </div>
  )
}
export { useMeta }

