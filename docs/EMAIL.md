# Sending company email from Elvora Logistics OS

Open **Email** from the header or dashboard. Use **Write email** to choose a connected company address, enter recipients, a subject and a message, then send. **Sent & queued** shows your outgoing messages and lets you retry a failed message. “Sent” means the provider accepted it; check the provider for delivery or bounce details. Replies arrive in the existing company mailboxes in Gmail. This release does not synchronise the Gmail inbox or Sent folder.

To send a quotation or invoice as a PDF, open the record and choose **Email**. The OS attaches the generated PDF. Invoices prefer the connected Accounts sender; other documents prefer Sales. You can change the sender before sending.

## Connect the five company addresses

An administrator opens **Email → Sender settings**. Each address has its own connection, encrypted password/key and enable switch:

| Address | Connection |
| --- | --- |
| sales@elvorashipping.com | GoDaddy Professional Email SMTP or the provider used for this mailbox |
| accounts@elvorashipping.com | Its own GoDaddy mailbox connection |
| info@elvorashipping.com | An authorised sending service; Gmail forwarding alone is insufficient |
| contact@elvorashipping.com | An authorised sending service |
| support@elvorashipping.com | An authorised sending service |

GoDaddy Professional Email uses `smtpout.secureserver.net`, port **465**, SSL/TLS, the full mailbox address as username and that mailbox’s password. Confirm your actual GoDaddy product; Microsoft 365 mailboxes use their own connection requirements. [GoDaddy’s SMTP instructions](https://www.godaddy.com/en-au/help/set-up-third-party-plugins-or-websites-using-smtp-settings-42788).

For Gmail SMTP, use the provider’s authenticated SMTP settings and an app password where available. The company address must already be authorised in **Send mail as**. Adding a forwarding address to Gmail does not authorise the OS to send from it.

If your Cloudflare account has **Email Sending** enabled and `elvorashipping.com` onboarded for sending, Cloudflare SMTP uses `smtp.mx.cloudflare.net`, port **465**, SSL/TLS, username `api_token` and an API token with **Email Sending: Edit** as its password. Receiving/routing rules alone are not a sending connection. [Cloudflare SMTP requirements](https://developers.cloudflare.com/email-service/api/send-emails/smtp/).

Resend is also supported: verify `elvorashipping.com` and supply an API key for each sender you enable. DNS authentication and provider sender authorisation must be correct before live use. Do not change existing inbound MX records simply to connect outbound email.

Click **Save & check connection**. SMTP checks TLS and login without sending a message. Resend checks the API and verified domain where the key allows domain reads; sending-only keys still need a delivery test. Then send a message to your own address and confirm receipt and the From address.

## Access, security and operation

- Only administrators can change connections. Credentials are encrypted at rest, never returned by settings APIs and never included in audit entries.
- Staff need create access to CRM, Finance or Administration to compose messages. The outgoing history contains only their own messages. Customer portal users cannot use the email workspace.
- Only the five configured company addresses may be selected. Disabled or unconnected senders cannot be queued manually.
- SMTP requires SSL/TLS on 465 or STARTTLS on 587. Certificate verification remains enabled.
- Demo workspaces cannot send email or check external connections.
- Existing automation and integration mail settings continue to work. If no legacy service is configured, automation uses the first enabled company sender. Explicitly selected messages retain their sender through retries.
- Sending is queued. A failed message stays visible; retry after correcting its connection or sender authorisation. A sent message cannot be retried from the email screen.
- Back up the configured encryption secret along with the database. Existing encrypted settings use the same application encryption mechanism.

The schema adds `from_addr` to the existing outbox automatically at startup for both SQLite and PostgreSQL. No destructive migration is required.
