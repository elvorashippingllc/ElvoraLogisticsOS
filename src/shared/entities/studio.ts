import type { EntityDef } from '../types'
import { T, TA, B, S, R, DT, D } from '../dsl'

export const STUDIO_CATEGORIES = [
  'Corporate', 'Sales & Customers', 'Finance & Procurement', 'Shipping & Warehouse', 'Customs & Compliance', 'HR & Administration', 'Control & Guidance',
  'Legal & Contracts', 'Letters & Notices', 'Marketing & Brochures', 'E-mail templates', 'Other',
]
export const STUDIO_KINDS = ['Document', 'Letter', 'Form', 'Contract', 'Certificate', 'Policy', 'Report', 'Marketing', 'E-mail']
export const STUDIO_STATUS = ['Draft', 'Final', 'Issued', 'Cancelled']

export const studio: EntityDef[] = [
  {
    key: 'doc_templates', label: 'Document template', plural: 'Template library', module: 'documents', icon: 'FilePenLine', title: ['code', 'title'], titleSep: ' – ', description: 'Ready-made company documents. Open one in the Document Studio to fill, edit, generate text with AI and print.',
    fields: [
      T('code', 'Code', { required: true, unique: true, list: true, search: true, section: 'Template' }), T('title', 'Title', { required: true, list: true, search: true, span: 2 }),
      S('category', 'Category', STUDIO_CATEGORIES, { required: true, list: true }), S('kind', 'Type', STUDIO_KINDS, { default: 'Document', list: true }),
      S('orientation', 'Page', ['Portrait', 'Landscape'], { default: 'Portrait' }), B('letterhead', 'Company letterhead', { default: true }), B('active', 'Available', { default: true, list: true }),
      B('is_system', 'Built-in', { readonly: true, list: true }), T('tags', 'Tags (search words)', { span: 2 }), TA('description', 'What it is for'),
      TA('content', 'Content', { hidden: true, heavy: true, maxLength: 4_000_000 }),
    ],
    defaultSort: { field: 'code', dir: 'asc' },
  },
  {
    key: 'studio_documents', label: 'Studio document', plural: 'Saved documents', module: 'documents', icon: 'FileText', title: ['doc_no', 'title'], titleSep: ' – ', panel: true, statusField: 'status', print: 'studio',
    numbering: { field: 'doc_no', pattern: 'DOC{YY}{seq:5}' },
    description: 'Documents written in the Document Studio from a template or from scratch.',
    fields: [
      T('doc_no', 'Document no.', { readonly: true, list: true, search: true, section: 'Document' }), T('title', 'Title', { required: true, list: true, search: true, span: 2 }),
      S('category', 'Category', STUDIO_CATEGORIES, { list: true }), S('status', 'Status', STUDIO_STATUS, { default: 'Draft', list: true }),
      R('template_id', 'Template', 'doc_templates', { hidden: true }), R('party_id', 'Customer / party', 'parties', { list: true }), R('job_id', 'Job', 'jobs'),
      S('orientation', 'Page', ['Portrait', 'Landscape'], { default: 'Portrait' }), B('letterhead', 'Company letterhead', { default: true }), B('page_numbers', 'Page numbers in PDF', { default: true }),
      T('footer_text', 'Footer line', { span: 2, help: 'Printed at the bottom of every page, for example “Confidential”.' }), B('ai_assisted', 'AI-assisted', { hidden: true }),
      DT('issued_at', 'Issued at', { readonly: true }), D('doc_date', 'Document date'), TA('notes', 'Internal notes (not printed)'),
      TA('content', 'Content', { hidden: true, heavy: true, maxLength: 4_000_000 }),
    ],
    defaultSort: { field: 'id', dir: 'desc' },
  },
]
