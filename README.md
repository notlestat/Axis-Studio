# Axis Studio Backend

Backend automation system for Axis Studio: lead capture, AI-generated replies, scheduled follow-ups, Cal.com bookings, Google Calendar events, and post-call nurture — all backed by an Airtable CRM.

## Stack

- **Node.js** (ESM, plain JavaScript)
- **Express** — HTTP server
- **Resend** — transactional email
- **Anthropic Claude** (`claude-sonnet-4-6`) — AI email copy
- **Airtable** — CRM
- **Cal.com** — booking webhooks
- **Google Calendar API** — event creation
- **node-cron** — daily follow-up job

## Project layout

```
axis-studio/
├── index.js              Express server entry point
├── routes/
│   ├── leadWebhook.js    Landing page form submissions
│   └── bookingWebhook.js Cal.com booking confirmations
├── services/
│   ├── crm.js            Airtable read/write
│   ├── email.js          Resend send helpers
│   ├── ai.js             Claude API prompts
│   └── calendar.js       Google Calendar events
├── jobs/
│   └── followUp.js       Daily follow-up cron sweep
├── .env.example
└── package.json
```

## Setup

### 1. Install dependencies

```bash
cd axis-studio
npm install
```

### 2. Create your `.env`

Copy the example and fill in every value:

```bash
cp .env.example .env
```

You will need:

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |
| `RESEND_API_KEY` | https://resend.com → API Keys |
| `RESEND_FROM_EMAIL` | A verified sender on your Resend domain |
| `AIRTABLE_TOKEN` | https://airtable.com/create/tokens (needs `data.records:read/write` + `schema.bases:read` on your base) |
| `AIRTABLE_BASE_ID` | Airtable API docs → your base → starts with `app...` |
| `AIRTABLE_TABLE_NAME` | Default: `Leads` |
| `CAL_WEBHOOK_SECRET` | Cal.com → Settings → Developer → Webhooks → add secret |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth 2.0 Client |
| `GOOGLE_REFRESH_TOKEN` | Generate once via the OAuth Playground with Calendar scope |
| `GOOGLE_CALENDAR_ID` | Usually your Google account email, or a dedicated calendar's ID |

### 3. Create the Airtable `Leads` table

Create a table named `Leads` with these fields (exact names matter):

- **Name** — Single line text
- **Email** — Email
- **Phone** — Phone number
- **Business** — Single line text
- **Source** — Single select: `Landing page`, `Cold call`, `Referral`
- **Service interest** — Single select: `Starter`, `Growth`, `Pro`
- **Status** — Single select: `New`, `Contacted`, `Replied`, `Booked`, `Proposal sent`, `Won`, `Lost`, `Cold`
- **Last contacted** — Date
- **Follow-up count** — Number
- **Notes** — Long text
- **Created** — Created time (auto)

### 4. Run it

```bash
npm start         # production
npm run dev       # auto-restart on file changes
```

The server listens on `PORT` (default `3000`). You should see:

```
[followUp] scheduled daily at 09:00
Axis Studio backend listening on port 3000
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/` | Health check |
| `POST` | `/webhook/lead` | Landing page form submission |
| `POST` | `/webhook/booking` | Cal.com booking confirmation (HMAC verified) |
| `POST` | `/trigger/post-call` | Manually send post-call email (body: `{ recordId, outcome }`) |
| `POST` | `/trigger/follow-up` | Dev helper: run the follow-up sweep now |

### Landing page POST shape

```json
POST /webhook/lead
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+44 7000 000000",
  "business": "Doe Plumbing",
  "message": "I'd like a landing page.",
  "serviceInterest": "Growth"
}
```

### Post-call trigger

```json
POST /trigger/post-call
{ "recordId": "recXXXXXXXXXXXXXX", "outcome": "won" }
```

`outcome` must be one of `won`, `lost`, `proposal`.

## Deploying to Railway

1. Push this folder to a GitHub repo.
2. On [railway.app](https://railway.app), **New Project → Deploy from GitHub repo** and select it.
3. Railway auto-detects Node and runs `npm start`.
4. Under **Variables**, paste every key from your `.env` (do not commit the real `.env`).
5. Once deployed, Railway gives you a public URL like `https://axis-studio.up.railway.app`.
6. Point your webhooks at it:
   - Landing page form → `https://<your-url>/webhook/lead`
   - Cal.com webhook → `https://<your-url>/webhook/booking` (HMAC SHA-256, same secret as `CAL_WEBHOOK_SECRET`)
7. Check the deploy logs to confirm `Axis Studio backend listening on port …` appears.

### Notes

- The daily follow-up cron runs at 09:00 **server time**. Railway containers run in UTC — adjust the cron expression in `jobs/followUp.js` if you want 09:00 UK time.
- Resend will only send from a domain you've verified. Until you verify `axisstudio.co`, use Resend's test sender.
- Cal.com webhook signature verification requires the raw request body — this is already handled in `index.js` via `express.raw()` on the `/webhook/booking` route only.
