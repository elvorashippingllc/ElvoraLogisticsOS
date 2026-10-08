# Elvora integrations: admin setup

Checked against the application on 8 October 2026. Use your real workspace and an administrator account. Enter credentials in the OS; do not put them in GitHub issues, screenshots or chat. A configured badge is not proof of successful delivery, restore, bank reconciliation or regulatory acceptance.

## Suggested order for a two-person team

1. Sales and Accounts email.
2. Cloudflare R2 backups, then file storage.
3. WhatsApp inbox, then individual automations.
4. AI assistant, starting with read-only/manual tasks.
5. Bank statement import; add a feed only if needed.
6. Carrier tracking when shipment volume justifies it.
7. Payroll/WPS when applicable to your employees.
8. E-invoicing with your service provider.
9. EDI/customs with your broker or carrier.
10. Optional Supabase reporting mirror.

Open Administration → Integrations (or `/admin/integrations`). Save each section separately and use Save & test connection where available. Tests for tracking, bank, EDI, e-invoicing and WPS are operational checks described below; those sections do not have a generic connection-test button.

## 1. Email

For the five independent senders use Email → Sender settings. The Admin E-mail section configures the legacy/default automation sender. If a legacy sender is configured, automated messages continue to use it; otherwise the first enabled company sender is used. The compose screen and document email dialog let you choose a sender explicitly.

### Sales and Accounts: GoDaddy Professional Email

| OS field | Value |
| --- | --- |
| Sender | `sales@elvorashipping.com`, then repeat for `accounts@elvorashipping.com` |
| Provider | SMTP |
| Host | `smtpout.secureserver.net` |
| Port | `465` |
| SSL/TLS | On |
| Username | Full address of that mailbox |
| Password | That mailbox's password, not the GoDaddy account password |
| Enabled | On |

1. Confirm each mailbox can sign in to GoDaddy webmail.
2. Enter its own credentials in Sender settings.
3. Select Save & check connection. This checks authentication/TLS without sending a message.
4. In Write email, send to your own Gmail address; verify the From address and actual receipt.
5. Email a sample quotation from Sales and invoice from Accounts; check PDF attachments.

[GoDaddy SMTP setup](https://www.godaddy.com/en-au/help/set-up-third-party-plugins-or-websites-using-smtp-settings-42788).

### Info, Contact and Support: Cloudflare addresses

Receiving/routing rules do not supply an SMTP password. Choose an authenticated sender:

- If Cloudflare Email Sending is enabled and the domain is onboarded: SMTP host `smtp.mx.cloudflare.net`, port `465`, SSL/TLS on, username `api_token`, password = Cloudflare token with **Email Sending: Edit**. Configure each sender address separately.
- Alternatively use Resend: verify `elvorashipping.com`, create a sending API key restricted to that domain where possible, select Resend and enter the key for each sender.
- Another mailbox provider can be used with its authenticated SMTP credentials and permission to send as the selected address.

Check the DNS records requested by the sending provider without replacing existing receiving MX records casually. Perform an actual delivery test for all five senders. Inbox and Gmail Sent folders are not synchronised by this feature; replies remain in your mailbox.

[Cloudflare SMTP](https://developers.cloudflare.com/email-service/api/send-emails/smtp/) · [Resend keys](https://resend.com/docs/dashboard/api-keys/introduction).

If using Admin → E-mail for the default sender: choose SMTP, fill host/port/user/password/from and enable TLS for port 465; or choose Resend and fill API key and verified From address. Avoid configuring a conflicting default without deciding which address automated messages should use.

## 2. Cloudflare R2 files and backups

Credentials: Cloudflare Account ID, bucket name, S3 Access Key ID and Secret Access Key. The S3 credentials are different from an ordinary Cloudflare API bearer token.

1. Cloudflare → R2 object storage → create a private bucket, such as `elvora-private`.
2. Create R2 S3 credentials with **Object Read & Write**, restricted to this bucket.
3. In File storage & backups, enter all four values; initially keep uploads on Server disk.
4. Save & test connection. The test checks bucket access; it does not prove successful writes or a restorable backup.
5. Click Backup to R2 now. Confirm the backup appears in the bucket's `backups/` folder.
6. Enable nightly uploads. The scheduler attempts them between 02:00 and 05:00 Dubai while the application is running.
7. To use R2 for new attachments, select Cloudflare R2 as the upload store. Upload, download and reopen one test document.
8. Confirm a backup can be restored into an isolated instance before relying on it.

Existing local uploads stay local; changing the upload setting does not migrate old files. Preserve your existing APP_SECRET, or the generated encryption-key file in the persistent data directory, together with your recovery material. Database copies alone cannot decrypt settings without the same key. A database backup is separate from attachment storage.

[Cloudflare R2 S3 credentials](https://developers.cloudflare.com/r2/get-started/s3/).

## 3. WhatsApp Cloud API

| OS field | Credential or value |
| --- | --- |
| Phone number ID | Meta's numeric phone-number ID, not the phone number or WABA ID |
| Access token | Production system-user token authorised for the WhatsApp assets |
| Webhook verify token | A private value you choose; enter the same value in Meta |
| App secret | Secret of the Meta app providing this WhatsApp integration |
| Owner / manager numbers | Your authorised staff numbers, e.g. `9715XXXXXXXX` |
| Default country code | `971` |
| Template language | Exact approved language code |
| Template names | Exact approved notification, reminder and owner-report names |

1. In Meta's app dashboard, configure WhatsApp for your business account and business number. Test-number setup is suitable only for authorised test recipients.
2. Obtain a production system-user token for the correct app and WhatsApp assets. Sending requires `whatsapp_business_messaging`; management operations can require `whatsapp_business_management`.
3. Save phone ID, token, verify token and app secret in the OS; enable WhatsApp.
4. Copy the actual Callback URL displayed in Admin. It ends with `/api/public/whatsapp` and must use the public OS HTTPS hostname.
5. In Meta's webhook configuration, paste the callback and matching verify token; subscribe to `messages`. Ensure Cloudflare access rules allow this public webhook while keeping staff pages protected.
6. Save & test connection, then send an inbound message from your own phone. Confirm it appears in the OS WhatsApp inbox and that an OS reply reaches your phone.
7. Begin with the inbox and owner numbers. Turn on staff bot, lead capture, milestone alerts and reminders one at a time, testing each on your own records.
8. Before messages outside the customer-service window, approve templates containing exactly one body variable `{{1}}`, as required by this implementation. Enter the exact names and language. The template mechanism inserts the notification text into that variable.

The owner daily-report scheduler starts at 07:30 Dubai. Do not enable automatic customer reminders before checking customer contacts, balances and approved template content. App secret and verify token are different values.

## 4. AI assistant and employees

Credentials: provider API key, a currently available model ID, and optional base URL/fallback credentials. A ChatGPT subscription is not an API key.

### Free starting setup: OpenRouter

1. Sign up at https://openrouter.ai and open https://openrouter.ai/keys. Create an API key named `Elvora OS`.
2. In the real OS workspace, open Admin → Integrations → AI employees and enable AI.
3. Select OpenRouter. Replace the API key with your OpenRouter key, set Base URL to `https://openrouter.ai/api/v1`, and Model to `openrouter/free`. Explicitly replace any old model/address left from another provider.
4. Leave fallback provider empty for the first test. Click Save & test connection; expect a successful connection and a short reply.
5. Open Jarvis & Employees and ask for a business briefing. This checks the assistant's business tools as well as a simple connection.
6. Optional free fallback: create a separate key at https://console.groq.com/keys; choose Groq as fallback, URL `https://api.groq.com/openai/v1`, model `openai/gpt-oss-20b`, and its own key.

OpenRouter's `openrouter/free` selects an available free model compatible with the requested features, including tools. Free usage has limits and variable availability; Groq also applies free-plan limits. A briefing may involve several requests. Current limits are shown in each provider's account. Do not enable a paid fallback if you want this setup to stay free.

A 404 means the address/model could not be found: check both fields above. A 401/403 means the key or permissions need attention; a 429 means the allowance is exhausted. Updating the OS defaults does not overwrite a model you previously saved. Keep keys in the OS, not in chat or GitHub.

[OpenRouter free router](https://openrouter.ai/docs/guides/routing/routers/free-router) · [Groq free-plan limits](https://console.groq.com/docs/rate-limits).

1. Choose a provider supported in the OS. Groq is one possible starting point; confirm its current usage allowance in your account.
2. Generate a project/API key in that provider's console. Enter it under AI employees.
3. Choose a current tool-capable model from the provider's own model list. Defaults are conveniences; providers can retire models.
4. For Groq, the base URL is `https://api.groq.com/openai/v1`; blank uses the preset. For Cloudflare Workers AI, replace `ACCOUNT_ID` in its URL and supply the account ID and Workers AI token.
5. Enable AI and Save & test connection. The test calls the model and may consume quota.
6. Enter practical company context: lanes, services, currency, approval policy and writing tone.
7. Open Jarvis & Employees, start with a manual/read-only task, inspect the result, and only then enable scheduled employees. Keep approvals for financial or customer-facing actions.
8. Optional fallback: its provider, URL, API key and model must be configured separately.

Ollama needs a running model server reachable from the app container, a pulled tool-capable model and the correct base URL. `localhost` inside Docker refers to the container; do not assume it reaches the Oracle host.

[Groq models](https://console.groq.com/docs/models) · [Groq API compatibility](https://console.groq.com/docs/openai).

## 5. Bank reconciliation / feed

No bank password or banking PIN belongs in this integration. Manual CSV/MT940 import is the simplest starting point.

1. Create the bank-account record in Accounts and enter the correct IBAN.
2. Import a statement and inspect matches before adding automation.
3. For a feed, arrange a bank/open-banking provider or automation that can deliver the app's JSON format.
4. In Bank feed webhook, Generate URL; copy it immediately. This secret URL authenticates incoming transactions. Regenerating it invalidates the old URL.
5. Configure the provider/adapter to POST to that URL:

```json
{"iban":"AE...","transactions":[{"date":"2026-10-08","description":"Test receipt","reference":"TEST-001","amount":100}]}
```

Positive amounts are receipts; negative amounts are withdrawals. Check a controlled test import in an isolated workspace and confirm it maps to the intended account and reconciliation lines. This is a transaction-import webhook, not automatic bank login or payment initiation. Provider consent/token setup happens with the provider, not in this empty-fields card.

## 6. Live carrier tracking

Credentials: Terminal49 API key, generated OS tracking webhook URL, and shipment identifiers.

1. Obtain API access in your Terminal49 account, select Terminal49 in Admin and enter its API key.
2. Generate the universal tracking webhook URL and register it with the provider or your adapter.
3. In Master Data → Carriers, set the correct SCAC code. On the job select that carrier and enter an MBL or container number.
4. Use Start live tracking on one job. Verify the request is accepted and a real provider event appears on the correct job timeline.
5. If provider payloads differ, have the adapter send the documented universal format, e.g. `{"job_no":"...","event":"Vessel departed","location":"Jebel Ali","at":"2026-10-08T14:30"}`.

Do not assume every provider's native webhook is compatible without a sample-payload test. Manual milestones remain available without an API subscription.

## 7. Payroll / WPS

Values: MOHRE employer establishment ID, employer bank routing code (9 digits), optional employer reference. These are business identifiers, not API passwords.

1. Obtain employer ID from your establishment records and routing/reference details from your payroll bank/WPS agent.
2. Enter them in Payroll / WPS and save.
3. Complete employee/payroll records required by the WPS generator, including the identifiers and bank details it validates.
4. Generate a sample salary period, fix reported validation problems, and have your bank/WPS agent confirm file acceptance.
5. Upload the approved salary file through the bank/WPS agent's process. The current OS generates/downloads the SIF; it does not automatically execute salary payments.

## 8. UAE e-invoicing

Credentials/details from your accredited service provider: submission URL, API token, seller Peppol endpoint ID and scheme ID; also complete legal supplier/buyer and tax data in the OS.

1. Select a provider using the [Ministry of Finance's current ASP information](https://mof.gov.ae/en/about-us/initiatives/einvoicing/einvoicing-accredited-service-providers-asps/).
2. Request sandbox access and the exact submission contract: payload format, authentication, endpoint and response/status handling.
3. The current adapter sends raw XML with Bearer authentication. A provider expecting a JSON envelope, OAuth, certificates or asynchronous callbacks needs an adapter change; credentials alone will not fix this.
4. Enter endpoint/token/IDs, complete company and customer data, download a sample XML and validate it with the provider.
5. Only enable submission after the sandbox confirms valid files and the provider has accepted your production setup.

An HTTP success records submission; it is not proof of final tax-system acceptance. Generic XML generation is not independently certified compliance. Use your ASP's validation and acceptance workflow.

## 9. EDI and customs

Choose only the transport your partner actually supports:

| Transport | Required fields |
| --- | --- |
| HTTP | Partner endpoint; complete Authorization header value such as `Bearer ...` |
| Email | Partner recipient address; a working OS email sender |
| SFTP | Host, port (usually 22), username, password, destination folder |
| Customs gateway | Broker/gateway JSON endpoint and Bearer token |

Obtain the partner's message format and sample files, then transmit a test job and have the partner confirm receipt and interpretation. The current SFTP form supports password authentication; SSH private-key authentication is not exposed. Confirm the partner's server identity through your agreed connection setup before live use.

The customs adapter submits the OS's JSON structure to a compatible broker/gateway. It does not automatically authenticate to Dubai Trade, Mirsal or every customs portal. If the partner's API differs, implement/test the adapter; otherwise use exports and your broker's existing portal process.

## 10. Optional Supabase mirror

This is an application-level reporting mirror, not the primary database setting or a complete disaster-recovery backup.

Credentials: project URL (`https://PROJECT.supabase.co`) and **legacy service_role JWT**. The current adapter sends the same key in both apikey and Bearer headers; new `sb_secret_...` keys must not be assumed compatible. Supabase is moving toward newer key types, so plan an adapter update rather than committing to the legacy path for the long term.

1. Use a separate Supabase project intended for the mirror.
2. Download Schema SQL from the OS, review it and run it in the project's SQL Editor.
3. Under project Settings → API Keys, obtain the legacy service_role key if available, and the project URL.
4. Enter them in Admin → Supabase; Save & test connection.
5. Sync now; confirm expected records in the mirrored tables.
6. Enable 15-minute sync only after verifying a small data change arrives correctly.

Never use an anon/publishable key here or expose this service credential in frontend code. The mirror excludes secret entity fields and mirrors selected system tables; it does not mirror all settings, sessions or attachments. Keep R2/database backups independently.

[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## Server settings are separate

`DATABASE_URL`, `PG_CA_CERT`, `APP_SECRET` and the public `BASE_URL` are server configuration, not Admin integration credentials. Preserve the encryption secret. Private PostgreSQL certificates use the provider's trusted CA PEM through `PG_CA_CERT`; certificate verification remains enabled. Changing the primary database requires its own migration/backup process and is not achieved by filling the Supabase card.
