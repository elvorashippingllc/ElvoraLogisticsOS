import sanitizeHtml from 'sanitize-html'
import { bad } from '../util'

/** Classes the Document Studio layouts use. Anything else is removed so stored documents cannot restyle the application. */
export const STUDIO_CLASSES = [
  'ph', 'note', 'guidance', 'page-break', 'fields', 'totals', 'sig', 'sig-line', 'avoid-break', 'small', 'muted', 'center', 'right', 'lead', 'keep',
  // brochure / flyer layout blocks
  'hero', 'hero-title', 'hero-sub', 'band', 'band-dark', 'band-light', 'cols-2', 'cols-3', 'cols-4', 'card', 'stat', 'stat-num', 'cta', 'steps', 'step', 'kicker', 'contact-strip', 'badge', 'divider', 'cover', 'cover-title', 'cover-sub', 'toc', 'letter-head', 'ref-line', 'subject',
]

const MAX_HTML = 4_000_000

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col', 'div', 'span', 'blockquote', 'hr', 'a', 'img', 'small', 'section', 'figure', 'figcaption'],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    td: ['colspan', 'rowspan', 'style', 'class'], th: ['colspan', 'rowspan', 'style', 'class'],
    col: ['span', 'style'], table: ['class', 'style'],
    '*': ['class', 'style', 'dir', 'lang'],
  },
  allowedClasses: { '*': STUDIO_CLASSES },
  allowedStyles: {
    '*': { 'text-align': [/^(left|right|center|justify)$/], 'vertical-align': [/^(top|middle|bottom)$/], width: [/^\d{1,3}(\.\d{1,2})?%$/], 'text-decoration': [/^(underline|line-through|none)$/], 'font-weight': [/^(normal|bold|[1-9]00)$/], 'font-style': [/^(normal|italic)$/] },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['data'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed'],
  transformTags: {
    a: (tag, attribs) => ({ tagName: 'a', attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }),
    img: (tag, attribs) => {
      const src = String(attribs.src ?? '')
      // only raster images embedded as data URIs, or the company's own brand files
      const ok = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(src) || /^\/brand\/[\w./-]+$/.test(src)
      const out: Record<string, string> = ok ? { ...attribs, src } : { alt: String(attribs.alt ?? '') }
      return { tagName: 'img', attribs: out }
    },
  },
  exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src,
}

/** Clean HTML coming from the editor, pasted content or the AI. Returns the safe subset the Studio can store and print. */
export function cleanStudioHtml(html: unknown): string {
  const raw = String(html ?? '')
  if (raw.length > MAX_HTML) throw bad('This document is too large. Remove large images or split it into two documents.')
  return sanitizeHtml(raw, OPTIONS).trim()
}

/** Plain text of a fragment, for search and for the AI. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim()
}

/** Unfilled [placeholders] in a fragment, in order of first appearance. */
export function placeholdersOf(html: string): string[] {
  const out: string[] = []
  for (const m of htmlToText(html).matchAll(/\[([^\[\]]{1,90})\]/g)) if (!out.includes(m[0])) out.push(m[0])
  return out
}
