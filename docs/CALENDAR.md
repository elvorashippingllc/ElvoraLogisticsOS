# Company calendar

Open Calendar from the dashboard schedule button or Workspaces. Dates and times use the application's company timezone (Asia/Dubai by default), not the browser's timezone.

- **Month:** 42-day overview. Select a day to see its entire schedule. “More” opens that day's detail; mobile cells show event counts with full details below.
- **Week:** Monday–Sunday overview, with selected-day details.
- **Day:** full event details for a single date.
- **Agenda:** chronological schedule for 30 days starting on the chosen date.

Use Today, Previous/Next or Go to date. Search matches titles, owners, statuses and locations. Activity-group filters and the color legend distinguish shipments, meetings/calls, work, transport, finance, sales, people, compliance, assets and warehouse records. Assigned to me matches user assignments. Completed items are hidden until Include completed is selected. Cancelled/voided/rejected items are excluded.

The calendar aggregates non-secret, visible date/datetime fields from records available through the normal permission and customer-scope engine. This includes shipment movements and container free-time dates, meetings and follow-ups, tasks/projects, financial dates, contract/rate/quotation expiries, leave and employee document expiries, vehicle registration/insurance/service, purchase orders, warehouse/lot expiry, compliance and qualification deadlines. Child-record links open their parent record. Multi-day meetings, leave and projects appear on every covered day, including when their start precedes the visible date range.

Overdue, Due today and Due soon labels apply to unfinished deadline records; Due soon covers the next three calendar days. Counts refer to the current filtered date range, not all historical overdue records. Your alerts lists existing unread notifications for the signed-in account across all dates, with Open record and Mark read actions. Events and notifications refresh every minute while the page is open. This view does not add background browser push, SMS or email reminders; existing OS notification/automation settings still control those channels.

Schedule activity creates a planned Meeting, Call, Video call or Visit in Calls & Activities, or a Task in Tasks & follow-ups. It requires create permission for that module. Enter a title, start/due date, optional end, location and details; tasks also have priority. New items are assigned to the current user. Open the linked record to edit, assign another owner or change status. Customer portal users see only their permitted customer-scoped records.

Validation: npm run typecheck; npm run build; TEST_SUITES=calendar npm run test:all; CHROME_PATH=/usr/bin/chromium node tests/calendar-ui.mjs. Browser captures default to /tmp/elvora-calendar-review (override CALENDAR_CAPTURE_DIR).
