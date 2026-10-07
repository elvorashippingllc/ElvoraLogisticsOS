import { AR } from './ar'

export type Lang = 'en' | 'ar'
export const lang: Lang = (() => { try { return localStorage.getItem('elvora_lang') === 'ar' ? 'ar' : 'en' } catch { return 'en' } })()
export const isRtl = lang === 'ar'
export const tr = (s: string | undefined | null): string => (s && lang === 'ar' ? (AR[s] ?? s) : (s ?? ''))
export function setLang(l: Lang) { try { localStorage.setItem('elvora_lang', l) } catch { /* ignore */ } window.location.reload() }
export function applyLangToDocument() { document.documentElement.lang = lang; document.documentElement.dir = isRtl ? 'rtl' : 'ltr' }

/** Arabic mode: translate any rendered text node whose whole text matches the dictionary (buttons, headings, statuses, table headers). */
export function startDomTranslator() {
  if (lang !== 'ar') return
  const skip = (n: Node) => { const p = n.parentElement; return !p || /^(SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE)$/.test(p.tagName) || !!p.closest('.print-sheet,[data-notr]') }
  const fix = (n: Node) => {
    if (n.nodeType === 3) { const t = n.nodeValue ?? ''; const k = t.trim(); const v = k && AR[k]; if (v && v !== k && !skip(n)) n.nodeValue = t.replace(k, v); return }
    if (n.nodeType === 1) { const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let c: Node | null; while ((c = w.nextNode())) fix(c) }
  }
  const root = document.getElementById('root')!
  fix(root)
  new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') fix(m.target); else m.addedNodes.forEach(fix) } }).observe(root, { childList: true, subtree: true, characterData: true })
}
