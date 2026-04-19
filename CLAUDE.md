# solana-signal-bot

## Purpose
A Node.js service that listens to a Telegram channel (solearlytrending),
parses incoming token alerts, and POSTs structured data to an n8n webhook
for AI scoring and automated buying via Trojan bot.

## Architecture
- `src/listener.js` — gramjs Telegram user client. Connects with phone auth,
  subscribes to the target channel, fires a POST to N8N_WEBHOOK_URL on each message.
- `src/parser.js` — pure functions that extract structured fields from the raw
  Telegram message text (MC, liquidity, bundle %, dev holding, fake vol, age, etc.)
- `src/index.js` — entry point, wires listener + parser together.

## Key constraints
- Auth session must persist to disk (session.json) so the service doesn't
  re-authenticate on every restart.
- The parser must be resilient — fields are sometimes missing or formatted
  differently. Always return nulls instead of throwing.
- Never hardcode API keys or phone numbers — use .env only.
- Keep the POST payload flat JSON: all parsed fields at the top level.

## Environment variables (.env)
- TELEGRAM_API_ID
- TELEGRAM_API_HASH
- TELEGRAM_PHONE
- TARGET_CHANNEL=solearlytrending
- N8N_WEBHOOK_URL
- SESSION_PATH=./session.json

## Commands
- `npm start` — runs the listener
- `npm run parse:test` — runs parser unit tests against fixture messages

## What NOT to build here
- Scoring logic (that lives in n8n + Claude API)
- Trojan buy execution (that's an n8n Telegram send node)
- Any database or persistence beyond the session file

## Notes
## gramjs import style
Use named imports from the 'telegram' package:
  import { TelegramClient, events } from 'telegram';
  import { StringSession } from 'telegram/sessions/index.js';
Do not use require() or default imports.

