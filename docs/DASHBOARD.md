# Dashboard and workspace navigation

This page documents the implemented dashboard and navigation refinements. The existing Elvora identity, colors, font families and DigitalBurj attribution remain the source of truth in the application.

## Dashboard sections

The staff dashboard at `/dashboard` refreshes its business data every two minutes. Sections depend on the returned data and the signed-in user's permissions.

1. **Welcome and actions:** Email (`/email`), Schedule (`/calendar`) and New job (`/e/jobs?new=1`), where permitted.
2. **Business at a glance:** the first four available figures, normally Open jobs, In transit, Revenue this month and Receivables. Currency labels use the configured base currency. Linked figures open their relevant job lists or reports.
3. **Alerts:** up to six actionable notices, linking to the relevant records or lists.
4. **Move each shipment forward:** a manual workflow carousel, followed by shortcuts for departures, arrivals and permitted task follow-ups.
5. **AI briefing:** appears when the user has AI access and briefing output is available; opens `/ai`.
6. **Shipment activity and business results:** monthly revenue and job profit, open jobs by transport mode, cash and bank, labeled quick actions and permitted receivables access.
7. **Detailed activity:** sales by branch, recent customer calls, latest jobs and house shipments, revenue/cost/profit by job month, departures and arrivals over the next seven days, top customers over the last 90 days, receivables ageing and tasks. Individual panels appear only when their data is available.
8. **More business figures:** remaining available figures, including payables, cash and bank, unbilled work, quotations, leads, tickets, tasks and low-stock items.

Dashboard status labels stay on one line. Narrow tables scroll within their panels rather than splitting status words or widening the page.

The customer portal instead shows Your shipments, three shipment/balance figures and a recent shipments table.

## Manual workflow carousel

The carousel follows the existing logistics process. Each card describes the task, shows its available figure or next action and links to its workspace:

| Step | Destination |
| --- | --- |
| Enquiry and quotation | `/e/quotations` |
| Booking and shipment | `/e/jobs` |
| Documents and clearance | `/documents` |
| Delivery and proof | `/e/transport_orders` |
| Invoice the customer | `/reports?r=unbilled_charges` |
| Collect payment and close | `/reports?r=ar_aging` |

Cards are filtered by module view permissions; report cards also require report view access. Previous and Next buttons scroll approximately 80% of the visible carousel width. There is no automatic advance. Scroll snapping aligns cards; touch and horizontal scrolling work directly. The rail is keyboard focusable and the buttons and card links use normal Tab navigation. Previous is disabled at the start; Next is disabled at the detected end or when fewer than two cards are available. Smooth scrolling becomes immediate when reduced motion is requested. Cards are 290px wide on larger screens and 85% of the rail width below 700px.

## Sidebar explanatory popups

The workspace rail uses labeled buttons with native title hints. Activating a workspace opens a dialog containing a short explanation, its permitted task links and an Open workspace action. All workspaces opens a dialog listing the available workspaces. Quick guide opens the existing guide.

Buttons can be reached with Tab and activated with Enter or Space. The shared modal initially focuses its first available control, keeps Tab and Shift+Tab within the dialog, and closes with Escape, the Close button or a click on the backdrop. Closing restores focus to the previous element when it still exists. Selecting a task or Open workspace closes the popup and navigates. Task links use two columns, becoming one below 700px. Ctrl+K or Cmd+K opens Search.

## Typography and retained assets

Font families remain **Instrument Sans** for body text and controls and **Plus Jakarta Sans** for headings and display figures, with the existing system fallbacks. Arabic retains **Noto Sans Arabic**. The local font declarations remain in `src/web/index.css`; the final screen sizes below are applied by `src/web/reference.css`.

| Element | Implemented size |
| --- | --- |
| Body and form input text | 16px |
| Buttons, primary navigation, breadcrumbs and form labels | 14px |
| Dashboard small supporting text, table headings and KPI labels | 14px |
| Dashboard title | `clamp(26px, 2.5vw, 36px)` |
| Workflow section heading | 22px |
| Workflow card heading and step number | 18px |
| Workflow descriptions and figures | 15px |
| Dashboard KPI values | 27px |
| Chart axis labels | 14px |

Some existing compact text retains its individual size: compact buttons 12.5px. Dashboard introductions are 15px, table cells 14px, panel headings 16px and status badges 12px. The refinement does not claim that every label is 16px.

The palette continues to use the existing emerald (`#007b52`), graphite (`#161d1a`) and module chart colors defined in `index.css` and `Dashboard.tsx`. `reference.css` retains its existing neutral surface overrides. The header uses `/brand/logo-primary.png?v=elvora-website-4`; the overview uses `/brand/icon-primary.png`. The footer retains **A product of DigitalBurj Business OS**, `/brand/digitalburj-business-os.png` and its [DigitalBurj product link](https://digitalburj.com/business-os).

## Related implementation and guidance

- [Dashboard source](../src/web/pages/Dashboard.tsx)
- [Shell and workspace explanations](../src/web/components/Shell.tsx)
- [Shared dialog behavior](../src/web/ui/kit.tsx)
- [Applied screen styles](../src/web/reference.css) and [base fonts and colors](../src/web/index.css)
- [Product attribution](../src/web/components/ProductBrand.tsx)
- [Email screen](../src/web/pages/EmailPage.tsx) and [email operation guide](EMAIL.md)

The Email screen uses the same typography and controls. Write email contains explicit From, To, Cc, Subject and Message labels; Sent & queued shows outgoing status, and Sender settings is available to administrators with edit access.

## Dashboard color roles

Shipment cards use deep ocean blue and cool blue-green surfaces. The monthly ledger uses Elvora green; sales and collection work uses warm ochre. Documents and delivery have quieter neutral and green surfaces. These roles are attached to the work itself, so permission-based filtering does not change their meaning. Detailed tables and chart bodies remain calm reading surfaces. Both light and dark themes retain labeled states and readable contrast; no new assets or dashboard actions are introduced.
