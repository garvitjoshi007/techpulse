# TechPulse

A Cloudflare Worker that runs every day at 8 AM, fetches the top stories from Hacker News, uses Claude to curate and summarize the 10 most relevant tech stories, and emails them to you via Resend.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Anthropic API key](https://console.anthropic.com/settings/keys) (with credits added)
- [Resend account](https://resend.com) with a verified domain

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Set secrets on Cloudflare

Run each command and paste the value when prompted:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TO_EMAIL
npx wrangler secret put FROM_EMAIL
```

| Secret | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `RESEND_API_KEY` | Your Resend API key |
| `TO_EMAIL` | Email address to receive the newsletter |
| `FROM_EMAIL` | Sender address (must be verified in Resend, e.g. `newsletter@yourdomain.com`) |

### 4. Deploy

```bash
npm run deploy
```

The cron trigger (`30 2 * * *` — 8 AM IST daily) is registered automatically.

Verify it's active: Cloudflare Dashboard → Workers & Pages → `techpulse` → **Triggers**.

### 5. Test immediately

```bash
curl https://techpulse.<your-subdomain>.workers.dev/trigger
```

You should get a `202 Newsletter triggered` response and receive an email within ~30 seconds.

To watch logs in real-time:

```bash
npx wrangler tail
```

## Local development

Create a `.dev.vars` file (gitignored) with your secrets:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
RESEND_API_KEY=your_resend_api_key_here
TO_EMAIL=your@email.com
FROM_EMAIL=newsletter@yourdomain.com
```

Then run:

```bash
npm run dev
```

## Updating the worker

Edit [src/index.ts](src/index.ts) and redeploy:

```bash
npm run deploy
```

## Cost

- **Cloudflare Workers** — free tier (100k requests/day)
- **Resend** — free tier (3,000 emails/month)
- **Anthropic (Claude Haiku)** — ~$0.001 per run, $5 credit lasts ~5,000 runs
