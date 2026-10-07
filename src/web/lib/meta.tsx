import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { EntityDef, FieldDef, NavGroup, Action } from '@shared/types'
import { get } from './api'

export interface MetaEntity extends EntityDef { customFieldDefs: FieldDef[] }
export interface Me { id: number; name: string; email: string; role: string; permissions: '*' | Record<string, string[]>; branch_id: number | null; party_id: number | null; totp: boolean; mustChangePassword: boolean; defaultPassword: boolean; lastLogin?: string }
export interface Meta { entities: MetaEntity[]; nav: NavGroup[]; modules: { key: string; label: string }[]; perms: Record<string, string[]>; settings: Record<string, any> }
interface Ctx { me: Me | null; meta: Meta | null; loading: boolean; def: (k: string) => MetaEntity; can: (module: string, a?: Action) => boolean; reload: () => Promise<void>; setMe: (m: Me | null) => void }
const C = createContext<Ctx>(null as any)
export const useMeta = () => useContext(C)

export function MetaProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    try {
      const m = await get<Me>('/api/auth/me')
      const mt = await get<Meta>('/api/meta')
      setMe(m); setMeta(mt)
    } catch { setMe(null); setMeta(null) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [reload])
  useEffect(() => { const h = () => { setMe(null); setMeta(null) }; window.addEventListener('elvora:unauthorized', h); return () => window.removeEventListener('elvora:unauthorized', h) }, [])
  const byKey = useMemo(() => new Map((meta?.entities ?? []).map(e => [e.key, e])), [meta])
  const def = useCallback((k: string) => { const e = byKey.get(k); if (!e) throw new Error('Unknown entity ' + k); return e }, [byKey])
  const can = useCallback((module: string, a: Action = 'view') => {
    if (!me) return false
    if (me.permissions === '*') return true
    const p = me.permissions[module]; return !!p && (p.includes('*') || p.includes(a))
  }, [me])
  return <C.Provider value={{ me, meta, loading, def, can, reload, setMe }}>{children}</C.Provider>
}
