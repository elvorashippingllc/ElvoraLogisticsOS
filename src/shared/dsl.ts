import type { FieldDef, Option } from './types'

type O = Partial<Omit<FieldDef, 'name' | 'label' | 'type'>>

const mk = (type: FieldDef['type']) => (name: string, label: string, o: O = {}): FieldDef => ({ name, label, type, ...o })

export const T = mk('text')
export const TA = (name: string, label: string, o: O = {}): FieldDef => ({ name, label, type: 'textarea', span: 3, ...o })
export const I = mk('int')
export const N = mk('number')
export const M = mk('money')
export const P = mk('percent')
export const D = mk('date')
export const DT = mk('datetime')
export const B = mk('bool')
export const E = mk('email')
export const PH = mk('phone')
export const U = mk('url')
export const J = (name: string, label: string, o: O = {}): FieldDef => ({ name, label, type: 'json', hidden: true, ...o })
export const S = (name: string, label: string, options: (string | Option)[], o: O = {}): FieldDef => ({ name, label, type: 'select', options, ...o })
export const R = (name: string, label: string, ref: string, o: O = {}): FieldDef => ({ name, label, type: 'ref', ref, ...o })

export const YES_NO = ['No', 'Yes']
export const CURRENCIES_COMMON = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR', 'CNY', 'ZAR', 'KES', 'PKR']
