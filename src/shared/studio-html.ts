// Helpers shared by the Document Studio server and web app. Pure string functions – no DOM needed.

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface CompanyTokens {
  company_name?: string; company_name_ar?: string; company_address?: string; company_phone?: string; company_email?: string; company_info_email?: string
  company_website?: string; company_trn?: string; company_trade_license?: string
  company_address_ar?: string; dcci_no?: string; commercial_register_no?: string; company_legal_form?: string; licence_issue_date?: string; licence_expiry_date?: string; establishment_card_no?: string; establishment_card_expiry?: string; ct_application_reference?: string; ct_application_date?: string; ct_application_status?: string
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** 2026-10-15 → 15 Oct 2026 */
export const longDate = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso }

/** Replace {{company.*}}, {{today}} and {{year}} with the company's own details. Unknown tokens are left alone. */
export function mergeCompanyTokens(html: string, s: CompanyTokens, todayIso: string): string {
  const map: Record<string, string> = {
    'company.name': s.company_name ?? '', 'company.name_ar': s.company_name_ar ?? '', 'company.address': s.company_address ?? '', 'company.phone': s.company_phone ?? '',
    'company.email': s.company_email ?? '', 'company.info_email': s.company_info_email ?? '', 'company.website': (s.company_website ?? '').replace(/^https?:\/\//, ''),
    'company.trn': s.company_trn ?? '', 'company.trade_license': s.company_trade_license ?? '', today: longDate(todayIso), year: todayIso.slice(0, 4),
  }
  for (const key of ['company_address_ar', 'dcci_no', 'commercial_register_no', 'company_legal_form', 'licence_issue_date', 'licence_expiry_date', 'establishment_card_no', 'establishment_card_expiry', 'ct_application_reference', 'ct_application_date', 'ct_application_status'] as const) map[`company.${key.replace(/^company_/, '')}`] = s[key] ?? ''
  return html.replace(/\{\{\s*([a-z_.]+)\s*\}\}/g, (m, k) => (k in map ? (map[k] ? escapeHtml(map[k]).replace(/\n/g, '<br>') : '') : m))
}

/** Highlight [placeholders] so unfilled fields stand out. Existing highlights are rebuilt, so the function is safe to call repeatedly. */
export function markPlaceholders(html: string): string {
  const plain = html.replace(/<span class="ph">([\s\S]*?)<\/span>/g, '$1')
  return plain.split(/(<[^>]*>)/).map(part => (part.startsWith('<') ? part : part.replace(/\[([^\[\]\n<>]{1,90})\]/g, '<span class="ph">[$1]</span>'))).join('')
}

/** Distinct [placeholders] in order of first appearance. */
export function listPlaceholders(html: string): string[] {
  const out: string[] = []
  for (const part of html.split(/(<[^>]*>)/)) {
    if (part.startsWith('<')) continue
    for (const m of part.matchAll(/\[([^\[\]\n<>]{1,90})\]/g)) if (!out.includes(m[0])) out.push(m[0])
  }
  return out
}

/** Replace every occurrence of one placeholder (e.g. "[Customer]") by plain text. */
export function fillPlaceholder(html: string, placeholder: string, value: string): string {
  const safe = escapeHtml(value).replace(/\n/g, '<br>')
  const withSpan = `<span class="ph">${escapeHtml(placeholder)}</span>`
  return html.split(withSpan).join(safe).split(escapeHtml(placeholder)).join(safe)
}

/** Very small Markdown subset → HTML, for pasted text and for AI answers that ignore the HTML instruction. */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  const inline = (t: string) => escapeHtml(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/`([^`]+)`/g, '$1')
  let list: 'ul' | 'ol' | null = null, para: string[] = [], table: string[][] | null = null
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = [] } }
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null } }
  const flushTable = () => {
    if (!table) return
    const [head, ...body] = table
    out.push(`<table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
    table = null
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara(); flushList()
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue
      ;(table ??= []).push(cells); continue
    }
    flushTable()
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) { flushPara(); flushList(); out.push(`<h${Math.min(h[1].length + 1, 4)}>${inline(h[2])}</h${Math.min(h[1].length + 1, 4)}>`); continue }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); continue }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line), ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (ul || ol) { flushPara(); const kind = ul ? 'ul' : 'ol'; if (list !== kind) { flushList(); out.push(`<${kind}>`); list = kind } out.push(`<li>${inline((ul ?? ol)![1])}</li>`); continue }
    if (!line.trim()) { flushPara(); flushList(); continue }
    flushList(); para.push(line.trim())
  }
  flushPara(); flushList(); flushTable()
  return out.join('\n')
}

/** True when text looks like HTML (the editor/AI produced tags) rather than plain text or Markdown. */
export const looksLikeHtml = (s: string) => /<\/?(p|div|h[1-6]|ul|ol|li|table|tr|td|br|span|strong|em)\b/i.test(s)
