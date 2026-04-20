# TechPulse — Agent Context

## What this project is

A Cloudflare Worker that runs daily at 8 AM IST. It fetches the top 50 Hacker News front-page stories, uses Claude to curate and summarize the 10 most relevant ones for a software engineer audience, and sends the result as an HTML email via Resend.

## Tech stack

- **Runtime**: Cloudflare Workers (TypeScript, no Node.js APIs)
- **AI**: Anthropic Claude — currently `claude-haiku-4-5-20251001` via direct HTTP (not the SDK)
- **Email**: Resend API (`https://api.resend.com/emails`)
- **HN data**: Algolia HN search API
- **Deploy**: `wrangler` — `npm run deploy`
- **Cron**: `30 2 * * *` defined in `wrangler.toml`

## Project structure

```
src/index.ts        — entire worker (entry point, all logic)
wrangler.toml       — worker name, cron trigger, compat date
.dev.vars           — local secrets (gitignored)
```

There is no database, no frontend, no build step beyond TypeScript compilation.

## Environment variables / secrets

| Name | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `RESEND_API_KEY` | Resend API key |
| `TO_EMAIL` | Recipient(s) — single address OR comma-separated list (e.g. `a@x.com,b@x.com`) |
| `FROM_EMAIL` | Verified sender address in Resend (e.g. `newsletter@yourdomain.com`) |

In production, these are Cloudflare Worker secrets set via `npx wrangler secret put <NAME>`.
Locally, they live in `.dev.vars`.

## Key logic in src/index.ts

- `fetchHNStories()` — fetches top 50 HN stories from Algolia, filters to those with a URL
- `generateNewsletter(apiKey, stories)` — calls Claude API directly via `fetch`, returns raw HTML string
- `sendEmail(resendApiKey, to, from, html, date)` — posts to Resend; `to` accepts `string | string[]`
- `scheduled` handler — runs on cron, orchestrates the three functions above
- `fetch` handler — HTTP trigger at `/trigger` for manual runs; `/` returns a health string

## TO_EMAIL multi-recipient handling

`TO_EMAIL` is split on commas at runtime before being passed to `sendEmail`. A single address also works unchanged.

```ts
const to = env.TO_EMAIL.includes(",")
  ? env.TO_EMAIL.split(",").map((e) => e.trim())
  : env.TO_EMAIL;
```

## Newsletter content rules (from prompt)

Audience cares about: AI/LLM, dev tools, open-source, startups, security, programming languages, cloud/infra.
Audience does NOT care about: politics, sports, general finance, general business news.

Output is clean HTML (no `<html>`/`<head>`/`<body>` tags) injected directly into the Resend email body.

## How to test locally

```bash
cp .dev.vars.example .dev.vars   # fill in secrets
npm run dev
curl http://localhost:8787/trigger
```

## How to deploy

```bash
npm run deploy
```

Cron trigger is registered automatically from `wrangler.toml`.

## Common tasks

- **Change the model**: edit the `model` field in `generateNewsletter()` in `src/index.ts`
- **Change the schedule**: edit `crons` in `wrangler.toml`, then redeploy
- **Add/change recipients**: update the `TO_EMAIL` secret (`npx wrangler secret put TO_EMAIL`)
- **Change curation criteria**: edit the prompt string in `generateNewsletter()`
