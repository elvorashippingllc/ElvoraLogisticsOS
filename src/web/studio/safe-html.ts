import DOMPurify from 'dompurify'

const TAGS = ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col', 'div', 'span', 'blockquote', 'hr', 'a', 'img', 'small', 'section', 'figure', 'figcaption']
const ATTRS = ['class', 'style', 'colspan', 'rowspan', 'span', 'href', 'src', 'alt', 'title', 'target', 'rel', 'dir', 'lang', 'width', 'height']
export const STUDIO_CLASSES = new Set(['ph', 'note', 'guidance', 'page-break', 'fields', 'totals', 'sig', 'sig-line', 'avoid-break', 'small', 'muted', 'center', 'right', 'lead', 'keep', 'hero', 'hero-title', 'hero-sub', 'band', 'band-dark', 'band-light', 'cols-2', 'cols-3', 'cols-4', 'card', 'stat', 'stat-num', 'cta', 'steps', 'step', 'kicker', 'contact-strip', 'badge', 'divider', 'cover', 'cover-title', 'cover-sub', 'toc', 'letter-head', 'ref-line', 'subject'])
const STYLE_OK: Record<string, RegExp> = { 'text-align': /^(left|right|center|justify)$/, 'vertical-align': /^(top|middle|bottom)$/, width: /^\d{1,3}(\.\d{1,2})?%$/, 'text-decoration': /^(underline|line-through|none)$/, 'font-weight': /^(normal|bold|[1-9]00)$/, 'font-style': /^(normal|italic)$/ }

let ready = false
function setup() {
  if (ready) return; ready = true
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (!(node instanceof Element)) return
    const cls = node.getAttribute('class')
    if (cls) { const keep = cls.split(/\s+/).filter(c => STUDIO_CLASSES.has(c)); keep.length ? node.setAttribute('class', keep.join(' ')) : node.removeAttribute('class') }
    const style = node.getAttribute('style')
    if (style) {
      const keep = style.split(';').map(d => d.trim()).filter(Boolean).filter(d => { const [p, ...v] = d.split(':'); return STYLE_OK[p.trim().toLowerCase()]?.test(v.join(':').trim().toLowerCase()) })
      keep.length ? node.setAttribute('style', keep.join('; ')) : node.removeAttribute('style')
    }
    if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer') }
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') ?? ''
      if (!(/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(src) || /^\/brand\/[\w./-]+$/.test(src))) node.removeAttribute('src')
    }
  })
}

/** HTML that is safe to put into the page: used for everything the editor loads, pastes or prints. */
export function safeHtml(html: string): string {
  setup()
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpe?g|gif|webp);base64,|\/brand\/)/i }) as string
}

/** Pasted content: keep structure and emphasis, drop fonts, colours, classes and Office clutter. */
export function pasteHtml(html: string): string {
  setup()
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'blockquote', 'hr'], ALLOWED_ATTR: ['href', 'colspan', 'rowspan'], ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i }) as string
  return clean.replace(/<p>\s*(<br>)?\s*<\/p>/g, '').trim()
}
