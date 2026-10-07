import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import { post } from '../lib/api'
import { useMeta } from '../lib/meta'

export function Login() {
  const { reload } = useMeta(); const nav = useNavigate()
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [totp, setTotp] = useState(''); const [needTotp, setNeedTotp] = useState(false)
  const [show, setShow] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const r = await post<any>('/api/auth/login', { email, password: pw, totp: needTotp ? totp : undefined })
      if (r.needsTotp) { setNeedTotp(true); return }
      await reload(); nav('/', { replace: true })
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="min-h-full grid lg:grid-cols-[1.05fr_1fr]">
      <div className="hidden lg:flex flex-col justify-between text-white p-12 relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#025e3d 0%,#007b52 55%,#0b6e4c 100%)' }}>
        <img src="/brand/route-pattern.svg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" aria-hidden />
        <img src="/brand/logo-reverse.png" alt="Elvora Shipping LLC" className="relative w-[280px]" />
        <div className="relative max-w-[460px]">
          <h1 className="text-white text-[38px] font-extrabold leading-[1.1] m-0">One system for every shipment.</h1>
          <p className="text-[17px] text-white/85 mt-4 leading-relaxed">Track and manage sales, shipments, jobs, accounts and warehouse — from enquiry to cash — in a single workspace built for Elvora Shipping.</p>
          <div className="grid grid-cols-2 gap-3 mt-8 text-sm">{['Master jobs & sub-jobs', 'Quotations & rate cards', 'Customs SB / BOE', 'Ledger, VAT & banking', 'Warehouse & transport', 'Track & trace + EDI'].map(x => <div key={x} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#7ce3b6]" />{x}</div>)}</div>
        </div>
        <div className="relative text-xs text-white/70">© {new Date().getFullYear()} Elvora Shipping L.L.C. · Dubai, United Arab Emirates</div>
      </div>
      <div className="flex items-center justify-center p-6 bg-pearl">
        <form onSubmit={submit} className="w-full max-w-[400px]" aria-labelledby="signin-h">
          <img src="/brand/logo-primary.png" alt="Elvora Shipping LLC" className="w-[210px] mb-8 lg:hidden" />
          <img src="/brand/icon-primary.png" alt="" aria-hidden width="46" className="mb-5 hidden lg:block" />
          <h2 id="signin-h" className="text-[28px] font-extrabold m-0">Sign in</h2>
          <p className="text-muted mt-1 mb-6">Welcome back to Elvora Logistics OS.</p>
          {err && <div role="alert" className="mb-4 px-3 py-2.5 rounded-lg bg-blush border border-[#f2bcc3] text-[#8f1325] text-sm font-medium">{err}</div>}
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" className="input mb-4" style={{ minHeight: 44 }} type="email" autoComplete="username" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@elvorashipping.com" />
          <label className="label" htmlFor="pw">Password</label>
          <div className="relative mb-4"><input id="pw" className="input pr-11" style={{ minHeight: 44 }} type={show ? 'text' : 'password'} autoComplete="current-password" required value={pw} onChange={e => setPw(e.target.value)} /><button type="button" className="absolute right-1 top-1 btn ghost icon" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff /> : <Eye />}</button></div>
          {needTotp && <><label className="label" htmlFor="totp">Authenticator code</label><input id="totp" className="input mb-4 tracking-[.4em] text-center text-lg" style={{ minHeight: 44 }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus required value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, ''))} /></>}
          <button className="btn green w-full" style={{ minHeight: 46, fontSize: 15 }} disabled={busy}><LogIn /> {busy ? 'Signing in…' : needTotp ? 'Verify & sign in' : 'Sign in'}</button>
          <p className="text-xs text-muted mt-6 leading-relaxed">Access is limited to authorised Elvora staff and customers. Activity is logged. After five failed attempts the account is locked for 15 minutes.</p>
        </form>
      </div>
    </div>
  )
}
