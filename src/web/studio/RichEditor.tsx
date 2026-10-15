import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Eraser, Heading1, Heading2, Italic, Link2, List, ListOrdered, Minus, Redo2, SeparatorHorizontal, Table2, Underline, Undo2, IndentIncrease, IndentDecrease, PenLine, Plus, Trash2, BookmarkPlus } from 'lucide-react'
import { looksLikeHtml, markPlaceholders, markdownToHtml } from '@shared/studio-html'
import { pasteHtml, safeHtml } from './safe-html'

export interface RichEditorHandle {
  /** HTML of the current text selection (empty when nothing is selected). */
  selectionHtml(): string
  selectionText(): string
  /** Replace the selection, or the whole document when nothing is selected and `whole` is set. */
  replaceSelection(html: string): void
  replaceAll(html: string): void
  getHtml(): string
  focus(): void
  /** Replace every occurrence of a [placeholder] by text. */
  fillPlaceholder(placeholder: string, value: string): number
  selectPlaceholder(placeholder: string): void
}

const clean = (root: HTMLElement) => {
  // placeholders whose text no longer looks like [something] have been edited by the user: drop the highlight
  root.querySelectorAll('span.ph').forEach(el => { if (!/^\[[^\[\]]+\]$/.test(el.textContent ?? '')) el.replaceWith(...Array.from(el.childNodes)) })
}
const plainToHtml = (t: string) => t.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(p => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`).join('')
const looksMarkdown = (t: string) => /(^|\n)\s{0,3}(#{1,4}\s|[-*]\s|\d+[.)]\s|\|.+\|)/.test(t) || /\*\*[^*]+\*\*/.test(t)

function cellOf(): HTMLTableCellElement | null {
  const n = window.getSelection()?.anchorNode
  const el = n instanceof Element ? n : n?.parentElement
  return (el?.closest('td,th') as HTMLTableCellElement | null) ?? null
}

export const RichEditor = forwardRef<RichEditorHandle, { value: string; onChange: (html: string) => void; readOnly?: boolean; landscape?: boolean; label?: string; paperTop?: React.ReactNode; paperBottom?: React.ReactNode; onSelection?: (chars: number) => void }>(function RichEditor({ value, onChange, readOnly, landscape, label = 'Document text', paperTop, paperBottom, onSelection }, ref) {
  const box = useRef<HTMLDivElement>(null), last = useRef<string>(''), saved = useRef<Range | null>(null)
  const [inTable, setInTable] = useState(false), [block, setBlock] = useState('p'), [fmt, setFmt] = useState({ b: false, i: false, u: false })

  const emit = useCallback(() => {
    const el = box.current; if (!el) return
    clean(el)
    const html = el.innerHTML; last.current = html; onChange(html)
  }, [onChange])

  // load content from outside only when it differs from what the editor itself last produced
  useEffect(() => {
    const el = box.current; if (!el) return
    if (value !== last.current) { el.innerHTML = safeHtml(value); last.current = el.innerHTML }
  }, [value])

  const cmd = (name: string, arg?: string) => { box.current?.focus(); document.execCommand(name, false, arg); emit(); refresh() }
  const refresh = () => {
    const sel = window.getSelection(); if (!sel?.rangeCount || !box.current?.contains(sel.anchorNode)) return
    saved.current = sel.getRangeAt(0).cloneRange(); onSelection?.(sel.isCollapsed ? 0 : sel.toString().length)
    setInTable(!!cellOf())
    const n = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement
    const h = n?.closest('h1,h2,h3,h4'); setBlock(h ? h.tagName.toLowerCase() : 'p')
    setFmt({ b: document.queryCommandState('bold'), i: document.queryCommandState('italic'), u: document.queryCommandState('underline') })
  }
  useEffect(() => { const f = () => refresh(); document.addEventListener('selectionchange', f); return () => document.removeEventListener('selectionchange', f) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const restore = () => { const sel = window.getSelection(); if (saved.current && sel) { sel.removeAllRanges(); sel.addRange(saved.current) } }
  const insertHtml = (html: string) => { box.current?.focus(); restore(); document.execCommand('insertHTML', false, safeHtml(html)); emit() }

  useImperativeHandle(ref, () => ({
    selectionHtml() { const r = saved.current; if (!r || r.collapsed || !box.current?.contains(r.commonAncestorContainer)) return ''; const d = document.createElement('div'); d.append(r.cloneContents()); return d.innerHTML },
    selectionText() { const r = saved.current; return r && !r.collapsed && box.current?.contains(r.commonAncestorContainer) ? r.toString() : '' },
    replaceSelection(html) { insertHtml(html) },
    replaceAll(html) { const el = box.current; if (!el) return; el.innerHTML = safeHtml(markPlaceholders(html)); emit() },
    getHtml() { return box.current?.innerHTML ?? '' },
    focus() { box.current?.focus() },
    fillPlaceholder(placeholder, value) {
      const el = box.current; if (!el) return 0
      let n = 0
      el.querySelectorAll('span.ph').forEach(s => { if (s.textContent === placeholder) { s.replaceWith(document.createTextNode(value)); n++ } })
      // a placeholder typed without the highlight
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const nodes: Text[] = []
      for (let t = walker.nextNode(); t; t = walker.nextNode()) if ((t as Text).data.includes(placeholder)) nodes.push(t as Text)
      for (const t of nodes) { n += t.data.split(placeholder).length - 1; t.data = t.data.split(placeholder).join(value) }
      if (n) emit()
      return n
    },
    selectPlaceholder(placeholder) {
      const el = box.current; if (!el) return
      const target = Array.from(el.querySelectorAll('span.ph')).find(s => s.textContent === placeholder); if (!target) return
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      const r = document.createRange(); r.selectNodeContents(target); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); box.current?.focus()
    },
  }), [emit])  // eslint-disable-line react-hooks/exhaustive-deps

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html'), text = e.clipboardData.getData('text/plain')
    const out = html && looksLikeHtml(html) ? pasteHtml(html) : looksMarkdown(text) ? markdownToHtml(text) : plainToHtml(text)
    if (out) document.execCommand('insertHTML', false, safeHtml(out)); emit()
  }
  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (t.classList?.contains('ph')) { const r = document.createRange(); r.selectNodeContents(t); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r) }
  }
  const addLink = () => { const url = window.prompt('Link address (https://…)', 'https://'); if (url && /^(https?:\/\/|mailto:|tel:)/i.test(url)) cmd('createLink', url) }
  const addTable = () => {
    const rows = Math.min(30, Math.max(1, Number(window.prompt('Number of rows (including the header row)', '4')) || 0)), cols = Math.min(10, Math.max(1, Number(window.prompt('Number of columns', '3')) || 0))
    if (!rows || !cols) return
    const th = `<tr>${Array.from({ length: cols }, (_, i) => `<th>Heading ${i + 1}</th>`).join('')}</tr>`, tr = `<tr>${Array.from({ length: cols }, () => '<td><br></td>').join('')}</tr>`
    insertHtml(`<table><thead>${th}</thead><tbody>${Array.from({ length: rows - 1 }, () => tr).join('')}</tbody></table><p><br></p>`)
  }
  const tableOp = (op: 'row+' | 'col+' | 'row-' | 'col-' | 'del') => {
    const cell = cellOf(); if (!cell) return
    const row = cell.parentElement as HTMLTableRowElement, table = cell.closest('table') as HTMLTableElement
    const idx = Array.from(row.children).indexOf(cell)
    if (op === 'row+') { const nr = row.cloneNode(true) as HTMLTableRowElement; nr.querySelectorAll('th,td').forEach(c => { const td = document.createElement('td'); td.innerHTML = '<br>'; c.replaceWith(td) }); row.after(nr) }
    if (op === 'row-') { if (table.rows.length > 1) row.remove(); else table.remove() }
    if (op === 'col+') Array.from(table.rows).forEach(r => { const c = r.cells[idx]; if (!c) return; const n = document.createElement(c.tagName.toLowerCase()); n.innerHTML = c.tagName === 'TH' ? 'Heading' : '<br>'; c.after(n) })
    if (op === 'col-') { if (row.cells.length > 1) Array.from(table.rows).forEach(r => r.cells[idx]?.remove()); else table.remove() }
    if (op === 'del') table.remove()
    emit(); refresh()
  }
  const T = ({ title, onClick, pressed, disabled, children }: { title: string; onClick: () => void; pressed?: boolean; disabled?: boolean; children: React.ReactNode }) =>
    <button type="button" className="tbtn" title={title} aria-label={title} aria-pressed={pressed} disabled={disabled || readOnly} onMouseDown={e => e.preventDefault()} onClick={onClick}>{children}</button>

  return (
    <div>
      <div className="studio-toolbar" role="toolbar" aria-label="Formatting">
        <T title="Undo" onClick={() => cmd('undo')}><Undo2 size={16} /></T><T title="Redo" onClick={() => cmd('redo')}><Redo2 size={16} /></T><span className="tsep" />
        <select aria-label="Text style" value={block} disabled={readOnly} onChange={e => cmd('formatBlock', e.target.value)}><option value="p">Paragraph</option><option value="h1">Title</option><option value="h2">Heading</option><option value="h3">Sub-heading</option></select><span className="tsep" />
        <T title="Bold (Ctrl+B)" pressed={fmt.b} onClick={() => cmd('bold')}><Bold size={16} /></T><T title="Italic (Ctrl+I)" pressed={fmt.i} onClick={() => cmd('italic')}><Italic size={16} /></T><T title="Underline (Ctrl+U)" pressed={fmt.u} onClick={() => cmd('underline')}><Underline size={16} /></T><span className="tsep" />
        <T title="Bullet list" onClick={() => cmd('insertUnorderedList')}><List size={16} /></T><T title="Numbered list" onClick={() => cmd('insertOrderedList')}><ListOrdered size={16} /></T><T title="Indent" onClick={() => cmd('indent')}><IndentIncrease size={16} /></T><T title="Outdent" onClick={() => cmd('outdent')}><IndentDecrease size={16} /></T><span className="tsep" />
        <T title="Align left" onClick={() => cmd('justifyLeft')}><AlignLeft size={16} /></T><T title="Centre" onClick={() => cmd('justifyCenter')}><AlignCenter size={16} /></T><T title="Align right" onClick={() => cmd('justifyRight')}><AlignRight size={16} /></T><T title="Justify" onClick={() => cmd('justifyFull')}><AlignJustify size={16} /></T><span className="tsep" />
        <T title="Insert table" onClick={addTable}><Table2 size={16} /></T><T title="Link" onClick={addLink}><Link2 size={16} /></T><T title="Horizontal line" onClick={() => cmd('insertHorizontalRule')}><Minus size={16} /></T>
        <T title="Page break" onClick={() => insertHtml('<div class="page-break"></div><p><br></p>')}><SeparatorHorizontal size={16} /></T>
        <T title="Signature block" onClick={() => insertHtml('<table class="sig"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><tbody><tr><td><strong>For the company</strong></td><td><strong>[Counter-party]</strong></td></tr><tr><td><div class="sig-line"></div>Signature</td><td><div class="sig-line"></div>Signature</td></tr><tr><td>Name: [Full name]<br>Title: [Position]<br>Date: [DD MMM YYYY]</td><td>Name: [Full name]<br>Title: [Position]<br>Date: [DD MMM YYYY]</td></tr></tbody></table><p><br></p>')}><PenLine size={16} /></T>
        <T title="Insert a [field] to fill later" onClick={() => insertHtml(markPlaceholders('[Field name]'))}><BookmarkPlus size={16} /></T>
        <T title="Clear formatting" onClick={() => cmd('removeFormat')}><Eraser size={16} /></T>
        {inTable && <><span className="tsep" /><T title="Add row below" onClick={() => tableOp('row+')}><Plus size={14} />Row</T><T title="Add column after" onClick={() => tableOp('col+')}><Plus size={14} />Col</T><T title="Delete row" onClick={() => tableOp('row-')}><Trash2 size={14} />Row</T><T title="Delete column" onClick={() => tableOp('col-')}><Trash2 size={14} />Col</T><T title="Delete table" onClick={() => tableOp('del')}><Trash2 size={14} />Table</T></>}
      </div>
      <div className="studio-stage" style={{ marginTop: 8 }}><div className={`studio-paper${landscape ? ' landscape' : ''}`}>{paperTop}
        <div ref={box} className="studio-content studio-editable" contentEditable={!readOnly} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label} spellCheck onInput={emit} onPaste={onPaste} onClick={onClick} onBlur={refresh} onKeyUp={refresh} />
        {paperBottom}</div></div>
    </div>
  )
})
