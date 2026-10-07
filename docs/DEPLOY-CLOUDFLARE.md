# Deploy Elvora Logistics OS on Cloudflare (step by step)

You will run a handful of commands on your own computer. Nothing here needs coding. Allow about **1–1½ hours the first time** (most of it waiting for builds and DNS).

## 0. What you are building

```
Browser ──► Cloudflare Worker "elvora-os" ──► Container (the app, Node + Chromium) ──► Supabase PostgreSQL (your data)
                 (HTTPS, your domain)            runs in the Asia-Pacific region              Singapore
```

* The **database is Supabase** – your records are safe even if the container is replaced.
* The **container disk is temporary**. Anything the app writes to disk (uploaded documents, local backups) disappears on restart, so **Step 8 (R2 file storage) is not optional** for real use.
* The app runs as **one instance, always on** (a 5-minute schedule keeps it awake so reminders, e-mail and backups keep working).

### What it costs (estimate from Cloudflare's published rates, 7 Oct 2026)
| Item | About |
|---|---|
| Workers Paid plan (required for Containers) | $5 / month |
| Container `standard-1` (½ vCPU, 4 GiB, 8 GB disk) running 24/7 | ~$27–30 / month |
| R2 file storage | free up to 10 GB, then ~$0.015 / GB-month |
| **Total** | **≈ $33–36 / month** |

A smaller `basic` (1 GiB) instance is cheaper but too small for the PDF engine. A VPS in Singapore (Option B, end of this guide) costs about $5–10.

### The one thing that can go wrong: distance to the database
The app asks the database one question at a time and waits for each answer. If the container runs far from Singapore, every page becomes slow. The config pins the container to the **Asia-Pacific** region, but Cloudflare chooses the exact city. **Step 6 measures it** – if the result is "slow" or "too slow", use Option B.

---

## 1. Before you start – checklist

| You need | How to check / get it |
|---|---|
| A computer with **Node.js 22** | `node -v` should print `v22…`. Install the LTS from nodejs.org |
| **Git** | `git --version` |
| **Docker Desktop**, running | Install from docker.com, open it, then `docker info` must not show an error. Wrangler builds the app image on your machine |
| A **Cloudflare account** | You have one (shippingelvora@gmail.com) |
| **Workers Paid plan** ($5) | Dashboard → *Workers & Pages* → *Plans* → choose **Workers Paid** |
| Your **Supabase connection string** | See below |

**Supabase connection string.** In Supabase: *Project Settings → Database → Connection string → Session pooler*. It looks like
`postgresql://postgres.odejxqdftnbhtuvxqiwx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`.
Use **port 5432 (Session pooler)**, not 6543. **First reset the database password** (same page → *Reset database password*), because the old one was pasted into a chat; use the new one in the string. Keep it private.

---

## 2. Get the code

```bash
git clone https://github.com/elvorashippingllc/ElvoraLogisticsOS.git
cd ElvoraLogisticsOS
git checkout claude/sharp-thompson-9y53sg      # skip this once pull request #3 is merged
cd deploy/cloudflare
npm install
```

## 3. Log in to Cloudflare

```bash
npx wrangler login
```
A browser tab opens – click **Allow**. Check with `npx wrangler whoami` (it should list your account).

## 4. Store your secrets

Secrets are encrypted by Cloudflare and never go into the code or Git. Run each command, then paste the value when asked (nothing is shown as you type). If it says the Worker doesn't exist yet and offers to create it, answer **Yes**.

```bash
npx wrangler secret put DATABASE_URL        # the Session-pooler string from Step 1, with the NEW password
npx wrangler secret put APP_SECRET          # a long random text – make one with:  openssl rand -hex 32
npx wrangler secret put ADMIN_PASSWORD      # first-login password for admin@elvorashipping.com
npx wrangler secret put MANAGER_PASSWORD    # first-login password for manager@elvorashipping.com
```

* **Write `APP_SECRET` in your password manager.** It encrypts the integration keys you save inside the app; if you lose it you must re-enter them. Never change it casually.
* Passwords: at least 10 characters, mixed case, a digit and a symbol. The app forces each person to choose a new one at first sign-in anyway.

## 5. Deploy

Make sure Docker Desktop is running, then:

```bash
npx wrangler deploy
```
The first run takes **5–15 minutes**: it builds the app image, uploads it to Cloudflare, creates the Worker and the container. It prints your address, like `https://elvora-os.<your-subdomain>.workers.dev`.

> After the *first* deploy, Cloudflare needs **several more minutes** to prepare the container in the region. Until then you may see a "starting" message – just wait and refresh.

## 6. Check that it works (and how fast)

```bash
curl https://elvora-os.<your-subdomain>.workers.dev/api/health
curl https://elvora-os.<your-subdomain>.workers.dev/api/health/db
```
The second one answers like `{"driver":"postgresql","avg_query_ms":4.1,"verdict":"excellent"}`.

| `avg_query_ms` | Meaning |
|---|---|
| under 10 | excellent |
| 10–40 | good – fine for a team |
| 40–100 | sluggish – consider Option B |
| over 100 | too slow – use Option B |

The first start also creates all tables in Supabase (schema `elvora`) and can take a minute or two. Look at it: Supabase → *Table Editor* → choose schema **elvora**. Watch live logs any time with `npx wrangler tail`.

## 7. First sign-in

Open your address. Sign in as `admin@elvorashipping.com` with the `ADMIN_PASSWORD` you set. The app makes you choose a personal password, then:
1. *Profile → Two-step verification* → turn it on.
2. Do the same for `manager@elvorashipping.com`.
3. *Administration → Company Settings → UAE compliance*: confirm the licence details, enter your **TRN** once you have it, and read `docs/UAE-COMPLIANCE.md`.

## 8. Permanent file storage with R2 (do this before real use)

1. Cloudflare dashboard → **R2 object storage** → *Get started* (enables R2; needs a payment method, the free tier is generous).
2. *Create bucket* → name `elvora-files`.
3. R2 → *Manage API tokens* → *Create API token* → permission **Object Read & Write** → limit it to the `elvora-files` bucket → create. Copy the **Account ID**, **Access Key ID** and **Secret Access Key** (shown once).
4. In the app: *Administration → Integrations → Cloudflare R2* → paste the Account ID, key, secret and bucket → switch **Storage provider** to R2 and **nightly backup** on → *Test connection* → Save.

Now documents are stored in R2 and a database snapshot is uploaded every night.

## 9. Your own address (optional but recommended)

You need `elvorashipping.com` on Cloudflare first:
1. Dashboard → *Add a domain* → `elvorashipping.com` → Free plan.
2. Cloudflare copies your existing DNS records. **Compare them with your current provider, especially the `MX` (mail) and website records**, so nothing breaks.
3. At your registrar, change the **nameservers** to the two Cloudflare gives you. Wait until Cloudflare says *Active* (minutes to a day).
4. *Workers & Pages → elvora-os → Settings → Domains & Routes → Add → Custom domain* → `os.elvorashipping.com`.
5. Tell the app its address: `npx wrangler secret put PUBLIC_URL` → `https://os.elvorashipping.com`, then `npx wrangler deploy`.

**info@elvorashipping.com:** with the domain on Cloudflare, *Email → Email Routing* lets you forward `info@` (and `sales@`) to your inbox for free. Sending mail from the app still needs Resend or SMTP (Administration → Integrations).

## 10. Updating later

```bash
cd ElvoraLogisticsOS && git pull
cd deploy/cloudflare && npm install && npx wrangler deploy
```
Your data stays in Supabase; the app restarts with the new version.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `The Docker CLI is needed…` | Start Docker Desktop and retry |
| Page says "starting or temporarily unavailable" | Wait 3–5 min after first deploy; then `npx wrangler tail` to read the reason |
| `Missing secret(s): …` | Run the `wrangler secret put` commands in Step 4 |
| `password authentication failed` in the logs | The user must be `postgres.odejxqdftnbhtuvxqiwx` (with the project id) and the password the new one; use the **Session pooler** string |
| `DATABASE_URL is required…` | The secret is missing – Step 4 |
| `/api/health/db` says slow | Use Option B below |
| Sign-in loops back to the login page | `PUBLIC_URL` is wrong or missing after you added a custom domain – Step 9 |
| PDFs fail | The container is too small; keep `instance_type` at `standard-1` |

## Option B – Singapore server + Cloudflare Tunnel (cheaper, closest to the database)

1. Rent a small Linux server (2 GB RAM) in **Singapore** (e.g. DigitalOcean, Vultr, Hetzner) and install Docker.
2. `git clone` the repo on it, create a `.env` from `.env.example` with `DATABASE_URL`, `APP_SECRET`, `ADMIN_PASSWORD`, `MANAGER_PASSWORD`, `PUBLIC_URL`, then `docker compose up -d --build`.
3. Cloudflare → *Networking → Tunnels → Create a tunnel*, copy the install command it shows, run it on the server, and add a **published application**: hostname `os.elvorashipping.com` → service `http://localhost:8080`.
4. Add *Cloudflare Access* in front if you want only your staff to reach the login page.

Same app, same database, no sleeping container, and queries take ~2 ms.

## Security notes
* Never put the database string or `APP_SECRET` in `wrangler.jsonc` or Git; only `wrangler secret put`.
* Rotate the Supabase password if it was ever shared, and re-run Step 4 for `DATABASE_URL`.
* The demo workspace is **off** here (`DEMO_ENABLED=false`).
