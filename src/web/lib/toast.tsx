import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
interface T { id: number; text: string; kind: 'ok' | 'error' }
const Ctx = createContext<{ ok: (t: string) => void; error: (t: string) => void }>({ ok: () => {}, error: () => {} })
export const useToast = () => useContext(Ctx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([])
  const push = useCallback((text: string, kind: T['kind']) => { const id = Date.now() + Math.random(); setItems(x => [...x, { id, text, kind }]); setTimeout(() => setItems(x => x.filter(i => i.id !== id)), kind === 'error' ? 7000 : 3500) }, [])
  return (
    <Ctx.Provider value={{ ok: t => push(t, 'ok'), error: t => push(t, 'error') }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map(i => <div key={i.id} className={`toast ${i.kind === 'error' ? 'error' : ''}`}>{i.kind === 'error' ? <XCircle size={18} color="#ff5a6e" /> : <CheckCircle2 size={18} color="#1fcf90" />}<span>{i.text}</span></div>)}
      </div>
    </Ctx.Provider>
  )
}
