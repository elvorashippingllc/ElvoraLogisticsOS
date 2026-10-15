import type { Hooks } from '../hooks'
import { bad, nowIso } from '../util'
import { cleanStudioHtml } from '../studio/sanitize'

/** Built-in templates keep their text; companies copy them to make their own versions. */
export const docTemplateHooks: Hooks = {
  beforeSave({ rec, old, ctx }) {
    if (old?.is_system && !ctx.system) {
      for (const f of ['code', 'title', 'category', 'kind', 'content', 'description', 'orientation', 'letterhead']) {
        if (JSON.stringify(rec[f] ?? null) !== JSON.stringify(old[f] ?? null)) throw bad('Built-in templates cannot be changed. Use “Duplicate” in the Document Studio to make your own copy, or switch this one off.')
      }
    }
    if (rec.content !== undefined && rec.content !== null) rec.content = cleanStudioHtml(rec.content)
    if (!ctx.system) rec.is_system = old?.is_system ?? false
  },
  beforeDelete({ rec, ctx }) {
    if (rec.is_system && !ctx.system) throw bad('Built-in templates cannot be deleted. Switch it off instead.')
  },
}

const LOCKED_AFTER_ISSUE = ['title', 'content', 'category', 'party_id', 'job_id', 'doc_date', 'orientation', 'letterhead', 'footer_text', 'page_numbers']
export const studioDocumentHooks: Hooks = {
  beforeSave({ rec, old, isNew, ctx }) {
    if (rec.content !== undefined && rec.content !== null) rec.content = cleanStudioHtml(rec.content)
    if (isNew) { rec.status = rec.status && ['Draft', 'Final'].includes(rec.status) ? rec.status : 'Draft'; return }
    if (old?.status === 'Issued' && !ctx.system) {
      for (const f of LOCKED_AFTER_ISSUE) if (JSON.stringify(rec[f] ?? null) !== JSON.stringify(old[f] ?? null)) throw bad('An issued document cannot be changed. Use “Duplicate” to write a new version, or mark this one Cancelled.')
      if (rec.status !== 'Issued' && rec.status !== 'Cancelled') throw bad('An issued document can only be cancelled')
    }
    if (old?.status === 'Cancelled' && rec.status !== 'Cancelled' && !ctx.system) throw bad('A cancelled document cannot be reopened. Duplicate it instead.')
    if (rec.status === 'Issued' && old?.status !== 'Issued') rec.issued_at = nowIso().slice(0, 16)
  },
  beforeDelete({ rec, ctx }) {
    if (rec.status === 'Issued' && !ctx.system) throw bad('An issued document cannot be deleted. Mark it Cancelled instead.')
  },
}
