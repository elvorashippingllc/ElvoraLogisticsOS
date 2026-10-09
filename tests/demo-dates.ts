import assert from 'node:assert/strict'
import { demoSickLeaveDates } from '../src/server/seed/dates'
import { addDays } from '../src/server/util'

for (const start of ['2026-10-05', '2027-01-01', '2028-03-01']) {
  for (let offset = 0; offset < 7; offset++) {
    const today = addDays(start, offset)
    const { from_date, to_date } = demoSickLeaveDates(today)
    assert.ok(from_date < to_date && to_date < today)
    let workingDays = 0
    for (let date = from_date; date <= to_date; date = addDays(date, 1)) {
      if (![0, 6].includes(new Date(date + 'T00:00:00Z').getUTCDay())) workingDays++
    }
    assert.equal(workingDays, 2, `two working days for demo seeded on ${today}`)
  }
}
assert.deepEqual(demoSickLeaveDates('2026-10-09'), { from_date: '2026-10-01', to_date: '2026-10-02' })
console.log('Demo dates passed: every weekday, year boundary and leap-year month boundary; exactly two past working days.')
