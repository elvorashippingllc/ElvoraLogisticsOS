export type Tone = 'green' | 'blue' | 'amber' | 'red' | 'grey' | 'violet' | 'teal'
const T: [RegExp, Tone][] = [
  [/^(paid|active|done|delivered|cleared|approved|accepted|completed|released|resolved|verified|converted|won|received|confirmed|issued|pod received|reconciled|available|present|good|passed|ok|yes|settled|running|running|in use|connected|sent)$/i, 'green'],
  [/^(rejected|void|cancelled|overdue|expired|failed|blocked|lost|terminated|urgent|absent|damaged|exception|bad|past sla|terminated|disposed|not configured)$/i, 'red'],
  [/^(pending|pending approval|partially paid|on hold|query raised|waiting on customer|under assessment|expiring|rolled|amended|duty payable|probation|high|late|short|quarantine|on leave|unreconciled|queued|requested|under investigation|submitted to insurer|low stock)$/i, 'amber'],
  [/^(draft|inactive|closed|not required|no|none|planned|n\/a|prospect|reported|not started|unbilled|to do)$/i, 'grey'],
  [/^(posted|submitted|opened|open|new|contacted|qualified|booked|in progress|in transit|dispatched|loaded|departed|arrived|medium|invoiced|billed|ordered|approved)$/i, 'blue'],
]
export function statusTone(v: string | null | undefined): Tone {
  if (!v) return 'grey'
  const s = String(v).trim()
  for (const [re, tone] of T) if (re.test(s)) return tone
  if (/paid|clear|deliver|complet|approv|accept|releas|resolv/i.test(s)) return 'green'
  if (/reject|cancel|void|fail|block|lost|overdue|expire/i.test(s)) return 'red'
  if (/pend|hold|query|wait|partial/i.test(s)) return 'amber'
  if (/draft|inactive|closed/i.test(s)) return 'grey'
  return 'blue'
}
