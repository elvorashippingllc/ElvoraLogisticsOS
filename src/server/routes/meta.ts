import type { FastifyInstance } from 'fastify'
import { ENTITY_LIST, NAV, MODULE_DEFS } from '../../shared/entities'
import { can, customFieldsFor } from '../engine'
import { publicSettings } from '../settings'
import { ACTIONS } from '../../shared/types'

export default async function (app: FastifyInstance) {
  app.get('/api/meta', async (req) => {
    const user = req.user!
    const entities = ENTITY_LIST.map(e => ({ ...e, customFieldDefs: e.customFields ? customFieldsFor(e.key) : [], fields: e.fields.filter(f => !f.secret) }))
    const nav = NAV.map(g => ({ ...g, items: g.items.filter(i => !i.module || can(user, i.module, 'view')) })).filter(g => g.items.length)
    const perms: Record<string, string[]> = {}
    for (const [m] of MODULE_DEFS) perms[m] = ACTIONS.filter(a => can(user, m, a))
    const s = publicSettings()
    return {
      entities, nav, modules: MODULE_DEFS.map(([key, label]) => ({ key, label })), perms,
      settings: { company_name: s.company_name, company_address: s.company_address, company_phone: s.company_phone, company_email: s.company_email, company_website: s.company_website, company_trn: s.company_trn, base_currency: s.base_currency, quote_validity_days: s.quote_validity_days, min_margin_pct: s.min_margin_pct, weight_divisor_air: s.weight_divisor_air, bank_details: s.bank_details, invoice_footer: s.invoice_footer, quote_terms: s.quote_terms, invoice_terms: s.invoice_terms, free_days_default: s.free_days_default },
    }
  })
}
