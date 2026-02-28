# Internal Network Content Bot

Multi-tenant Telegram bot for Internal Network's Instagram content approval chats.
One deployment serves all pages. Adding a new page takes 30 seconds — no code changes, no redeploys.

---

## How It Works

- **One bot, added to every Content Approval chat**
- Each chat is registered as a "page" in Supabase with its own profile
- The bot reads which chat a message came from → looks up the page → applies the right context
- Org-level standards (fact-check rules, copyright rules, content quality) live in `library.js` and apply everywhere
- Page-specific guidance (niche, tone, viral topics) is stored per-row in Supabase

---

## Setup (One Time)

### 1. Create the Telegram Bot
1. Message [@BotFather](https://t.me/BotFather) → `/newbot`
2. Name it (e.g. "Internal Network Bot") and pick a username
3. Copy the `TELEGRAM_BOT_TOKEN`

### 2. Supabase
1. Create a free project at [supabase.com](https://supabase.com)
2. SQL Editor → run `supabase-schema.sql`
3. Settings → API → copy **Project URL** and **service_role key**

### 3. Deploy to Railway
1. Push this folder to a GitHub repo
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables:
```
TELEGRAM_BOT_TOKEN=
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```
4. Deploy. Check logs for `✅ Internal Network Content Bot running`

---

## Adding a New Page (No Code or Redeploy Needed)

1. Add the bot to the page's Content Approval chat as **admin**
2. In that chat, type:
```
/addpage @handle Niche content focus description
```
Examples:
```
/addpage @goal Football Greatest moments, records, comebacks, CL drama, controversies
/addpage @thefuck.tv Humor Weird news, absurd stories, Florida man, unbelievable but true
/addpage @artistswithoutautotune Music Grammy controversies, vocal ability, artist facts, feuds
```
3. Done. The bot auto-generates a tailored AI prompt for that page and starts reviewing immediately.

---

## Commands

| Command | Description |
|---|---|
| `/addpage @handle Niche [focus]` | Register this chat as a page |
| `/generate` | Generate 3 super posts (AI picks topic) |
| `/generate nostalgic` | Generate with specific tone |
| `/generate shocking greatest comebacks` | Generate with tone + seed topic |
| `/status` | Show this page's config |

**Tones:** `shocking` · `nostalgic` · `inspiring` · `funny` · `facts`

---

## Automatic Review

No commands needed. When someone posts a content submission in a registered chat, the bot:
1. Classifies whether it's a real submission (not chatter)
2. Runs fact-check, copyright check, and source validation in parallel
3. Replies in-thread with a structured verdict
4. Logs everything to Supabase

---

## Updating Org Standards

Edit `library.js` → push to GitHub → Railway auto-redeploys.
Changes apply to every page instantly.

---

## File Structure
```
index.js                  — entry point
claude.js                 — Anthropic API (Haiku + Sonnet)
library.js                — org-level content standards + buildSystemPrompt()
supabase.js               — all DB operations
supabase-schema.sql       — run once to create tables
railway.json              — Railway config
checks/
  classifier.js           — is this a content submission?
  factCheck.js            — verify claims (Sonnet)
  copyrightCheck.js       — copyright/fair use (Haiku)
  sourceCheck.js          — source credibility (Haiku)
handlers/
  messageHandler.js       — passive auto-review orchestrator
  generateHandler.js      — /generate command
  addPageHandler.js       — /addpage command
  statusHandler.js        — /status command
```

