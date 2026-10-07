# AI team (Jarvis & employees)

Open **AI Team → Jarvis & Employees**. Connect a provider first (Integrations → AI).

## Cost: near zero
* Use a free tier (Groq, Gemini, OpenRouter models ending in `:free`, Cloudflare Workers AI) or run **Ollama** on your own PC/VPS (llama3.1 / qwen2.5 support tools).
* Add a fallback provider – free tiers rate-limit; the app switches automatically.
* Daily/weekly schedules keep usage to a handful of calls; each run is capped at 8 tool-using steps.

## Employees (all ship switched off)
Jarvis (chief of staff, daily brief) · Collections · Sales · Operations Coordinator · Customer Care · Finance Controller · HR & Compliance. Each has editable instructions, schedule, allowed tools, and an **autonomy level**:

1. *Ask first* – every action that changes data or contacts someone is queued for your approval.
2. *Acts internally, asks before sending* (default) – tasks, notes, leads happen automatically; e-mail/WhatsApp wait in **Approvals**.
3. *Autopilot* – acts, then reports.

Reports arrive as notifications, on the dashboard, and optionally by WhatsApp/e-mail. Ask Jarvis anything in the web chat or by WhatsApp from an owner number.

## Safety
Agents can read company data and use only the listed tools; they cannot post invoices, move money, void documents or change users. Every run, tool result and approval is logged (AI Activity). Small free models make mistakes – keep new employees on level 1 or 2 until you trust their output, and treat their numbers as a starting point (the tools return real data; the wording is the model's).
