# Integrations guide

Everything is configured in the app: **Administration → Integrations** (admin only). Secrets are encrypted (AES-256-GCM) before they are stored; set `APP_SECRET` in `.env` for production and keep it out of backups.

| Integration | What you need | What it does |
|---|---|---|
| **Resend** (e-mail) | Resend API key + verified domain | All outgoing mail; invoices/quotations are sent with a server-rendered **PDF attached**. SMTP remains available as fallback. |
| **Cloudflare R2** | Account id, bucket, access key/secret | Attachments are stored in R2; nightly database backup (02:00 Dubai) uploaded to R2, 14 local copies kept. |
| **Supabase** | Project URL + service_role key; run the generated schema once | Every table is mirrored to Supabase Postgres every 15 min (incremental by `updated_at`). Secret columns are never sent. Use it for Metabase/SQL/BI or as an off-site copy. |
| **WhatsApp Cloud API** | Phone number ID, permanent token, verify token | Lead capture + auto-reply, staff bot, customer bot (`track …`, `statement`), milestone alerts, overdue reminders, owner daily report, two-way inbox. |
| **AI provider** | Any OpenAI-compatible endpoint | Powers Jarvis and the AI employees. Presets: Groq, OpenRouter (:free models), Ollama, OpenCode Zen, xAI Grok, Gemini, Cloudflare Workers AI, OpenAI, custom. A fallback provider is tried automatically. |
| **Live tracking** | Terminal49 API key *or* any tool that can POST JSON | Events land on the job timeline (and trigger WhatsApp milestone alerts). |
| **E-invoicing** | Accredited service provider (ASP) URL + token | Generates UBL 2.1 **PINT AE** XML; downloads or submits it to the ASP. |
| **EDI / customs** | HTTP endpoint, e-mail address or SFTP; customs gateway/broker API | Transmits IFTMIN / FWB / JSON; submits customs declarations as JSON. |
| **Bank** | CSV / MT940 file, or a webhook from an aggregator | Imports statements, de-duplicates, auto-matches receipts & payments. |
| **WPS** | Employer MOHRE id + bank routing code; employee IBAN / routing / person ID | Generates the UAE WPS **SIF** salary file from approved payslips. |

## Why Supabase is a replica, not the primary database
The application engine is built around a synchronous embedded SQLite database (fast, transactional, zero-ops, ideal for one company). Supabase is connected as a continuously updated **Postgres replica** for reporting, BI and disaster recovery. MongoDB is not used. If you later need multi-server/HA operation, the data layer can be moved to Postgres – the schema is already generated for it – but that is a separate migration project.

## WhatsApp setup notes
1. Meta developer app → WhatsApp → note the **Phone number ID**; create a System User and a permanent token.
2. Callback URL = `https://<your-domain>/api/public/whatsapp`, verify token = what you typed; subscribe to **messages**.
3. WhatsApp only permits free-text replies within 24 h of the customer's last message. For automations that start a conversation (reminders, milestone alerts, reports), create **approved templates with one body variable `{{1}}`** and enter their names under *Template: …*.
4. Add your own number(s) to *Owner / manager numbers* to unlock the staff bot: `report`, `overdue`, `leads`, `track <job>`, `task <text>`, or ask Jarvis anything.

## Universal webhooks (secret URLs generated in the app)
* Tracking: `POST /api/public/tracking/<secret>` `{"job_no":"DXB…","event":"Vessel departed","location":"Jebel Ali","at":"2026-10-01T14:30"}` (also accepts `mbl_no` / `container_no`; arrays allowed).
* Bank feed: `POST /api/public/bank/<secret>` `{"iban":"AE…","transactions":[{"date":"2026-10-01","description":"…","amount":-120.5}]}`.

## Verification status (be aware)
All integrations are covered by automated tests against **mock providers** (`npm run test:integrations`): request shapes, authentication headers, idempotency, incremental sync, secret filtering, PDF rendering, SIF/UBL output. They have **not** been exercised against live Meta, Resend, Cloudflare, Supabase, Terminal49, an ASP, a bank or MOHRE from this build environment. Run each *Test connection* button after entering credentials, and validate sample WPS and e-invoice files with your bank / ASP before the first live submission.
