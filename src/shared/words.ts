// Amount in words for printed invoices and vouchers (US-style: "Eighty-six thousand two hundred fifty-eight").

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES = ['', ' thousand', ' million', ' billion', ' trillion']

function below1000(n: number): string {
  const parts: string[] = []
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} hundred`); n %= 100 }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')) } else if (n > 0) parts.push(ONES[n])
  return parts.join(' ')
}

/** Whole number in lower-case words. Supports up to 999 trillion. */
export function integerInWords(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return 'zero'
  const groups: string[] = []
  for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
    const g = n % 1000
    if (g) groups.unshift(below1000(g) + SCALES[i])
  }
  return groups.join(' ')
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export interface CurrencyWords { major: string; minor: string }
const CURRENCY_WORDS: Record<string, CurrencyWords> = {
  AED: { major: 'dirhams', minor: 'fils' }, USD: { major: 'US dollars', minor: 'cents' }, EUR: { major: 'euros', minor: 'cents' }, GBP: { major: 'pounds sterling', minor: 'pence' },
  SAR: { major: 'riyals', minor: 'halalas' }, INR: { major: 'rupees', minor: 'paise' }, CNY: { major: 'yuan', minor: 'fen' }, ZAR: { major: 'rand', minor: 'cents' }, KES: { major: 'shillings', minor: 'cents' }, PKR: { major: 'rupees', minor: 'paisas' },
}

/** "AED Six thousand eighty dirhams and twenty-five fils only." */
export function amountInWords(amount: number, currency = 'AED'): string {
  const value = Math.round((Math.abs(Number(amount) || 0) + 1e-9) * 100)
  const major = Math.floor(value / 100), minor = value % 100
  const w = CURRENCY_WORDS[currency] ?? { major: currency, minor: 'cents' }
  const majorWords = major === 1 && w.major.endsWith('s') && currency !== 'AED' ? w.major.slice(0, -1) : (major === 1 && currency === 'AED' ? 'dirham' : w.major)
  let out = `${currency} ${cap(integerInWords(major))} ${majorWords}`
  if (minor) out += ` and ${integerInWords(minor)} ${minor === 1 && currency === 'AED' ? 'fils' : w.minor}`
  return `${out} only.`.replace(/\s+/g, ' ')
}
