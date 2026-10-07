const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
/** 2026-10-12 → 12-OCT-26 (the style used on the job screens) */
export function fmtDate(v?: string | null): string {
  if (!v) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (!m) return v
  return `${m[3]}-${MON[Number(m[2]) - 1] ?? m[2]}-${m[1].slice(2)}`
}
/** 2026-10-02T14:27 → 02-OCT-26 02:27PM */
export function fmtDateTime(v?: string | null): string {
  if (!v) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(v)
  if (!m) return fmtDate(v)
  const h = Number(m[4]); const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 === 0 ? 12 : h % 12
  return `${m[3]}-${MON[Number(m[2]) - 1]}-${m[1].slice(2)} ${String(h12).padStart(2, '0')}:${m[5]}${ap}`
}
export function fmtIsoStamp(v?: string | null): string { // UTC ISO from the server → local readable
  if (!v) return ''
  const d = new Date(v); if (isNaN(+d)) return v
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
export const fmtMoney = (n: number | null | undefined, dp = 2) => (n === null || n === undefined || n === ('' as any) ? '' : Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }))
export const fmtNum = (n: number | null | undefined, dp = 2) => (n === null || n === undefined ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: dp }))
export const fmtCompact = (n: number) => Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n))
export const todayIso = () => new Date().toLocaleDateString('sv-SE')
export const nowIsoLocal = () => new Date().toLocaleString('sv-SE').slice(0, 16).replace(' ', 'T')
export const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
export function download(blob: Blob, name: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }
