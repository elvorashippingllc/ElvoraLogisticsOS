# Elvora Logistics OS

## Product and users

Elvora Logistics OS supports the daily work of Elvora Shipping L.L.C., a logistics company in Dubai. DigitalBurj Business OS is the product owner and must remain credited in the interface. Daily use should remain practical for a small team.

Staff manage enquiries and quotations, bookings and shipment jobs, shipment documents and clearance, transport and delivery, customer invoices, supplier costs and payments. Existing warehouse, people, compliance, reporting and administrative features remain available according to permissions. Customers have a separate portal view of their own shipments and balances.

## Current requirements

- Vendor services and hired containers, trucks and trailers are linked to customer jobs, with separate buying/selling terms, job charges and return tracking. The operational workflow is documented in `docs/VENDOR_SERVICES.md`.

- Sign-in opens the dashboard after any required account setup.
- The dashboard should help staff identify urgent work and move a shipment from enquiry through payment and job closure. Figures, charts and detailed records must describe their time periods honestly.
- Sidebar shortcuts explain each workspace and expose its permitted tasks.
- Content uses simple English, clear action labels and readable professional typography.
- The existing Elvora website logo/icon and the white circular favicon background remain the identity assets. DigitalBurj attribution remains visible.
- Staff can send email from the OS using Sales, Accounts, Info, Contact or Support at `elvorashipping.com`. Sales and Accounts are GoDaddy mailboxes; the other addresses are configured through Cloudflare and are already added to Gmail.
- Adding addresses to Gmail does not supply the OS with sending credentials. Administrators configure authenticated sending connections; outgoing history and retries remain visible. Replies continue to arrive in the existing Gmail setup.

## Execution boundaries

Use existing module permissions and protect customer portal isolation. Credentials are encrypted and excluded from API responses. Demo workspaces cannot send external messages. Provider acceptance is distinct from recipient delivery. No live mail activation or delivery should be claimed before credentials and provider authorisation are configured and a delivery test succeeds.

The incumbent application supplies the visual authority; the dashboard and email changes extend that identity. Dashboard operation is documented in `docs/DASHBOARD.md`; sender setup is documented in `docs/EMAIL.md`.
