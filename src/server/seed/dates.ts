import { addDays } from '../util'

/** Two working days in the past, regardless of the day the demo is seeded. */
export function demoSickLeaveDates(today: string) {
  const previousWeekday = (date: string) => {
    while ([0, 6].includes(new Date(date + 'T00:00:00Z').getUTCDay())) date = addDays(date, -1)
    return date
  }
  const to_date = previousWeekday(addDays(today, -5))
  return { from_date: previousWeekday(addDays(to_date, -1)), to_date }
}
