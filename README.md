# solana-signal-bot

Listens to the **solearlytrending** Telegram channel, parses incoming token alert messages, and POSTs structured JSON to an n8n webhook. The webhook feeds an AI scoring pipeline that decides whether to buy via Trojan bot.

## How it works

```
Telegram (solearlytrending)
        │  gramjs user client
        ▼
  src/listener.js  ──►  src/parser.js  ──►  n8n webhook  ──►  Claude scoring  ──►  Trojan buy
```

1. On startup, the listener connects to Telegram using your phone account (not a bot token).
2. Every new message in the target channel is passed to `parseTokenAlert()`.
3. If parsing succeeds, the extracted fields plus the raw message text are POSTed flat to `N8N_WEBHOOK_URL`.
4. Scoring logic and buy execution live entirely in n8n — nothing here decides whether to trade.

## Setup

### 1. Get Telegram API credentials

Go to https://my.telegram.org → "API development tools" → create an app.  
You need **API ID** (a number) and **API Hash** (a hex string).

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
TELEGRAM_API_ID=        # from my.telegram.org
TELEGRAM_API_HASH=      # from my.telegram.org
TELEGRAM_PHONE=         # your phone number in international format, e.g. +12025551234
TARGET_CHANNEL=solearlytrending
N8N_WEBHOOK_URL=        # your n8n webhook URL
SESSION_PATH=./session.json
```

### 3. Install dependencies

```bash
npm install
```

### 4. First run (phone auth)

```bash
npm start
```

On the first run, Telegram will send a login code to your phone (or Telegram app). The CLI will prompt for it. If your account has 2FA enabled it will also prompt for your password.

After authentication the session is saved to `SESSION_PATH`. Subsequent starts skip the auth prompt entirely.

## Commands

| Command | Description |
|---|---|
| `npm start` | Start the listener |
| `npm run parse:test` | Run parser unit tests against fixture messages |

## Parsed fields

`parseTokenAlert(text)` returns a flat object (or `null` if the message isn't a token alert):

| Field | Type | Example | Notes |
|---|---|---|---|
| `tokenName` | string | `"MOOMOO THE BULL"` | |
| `tokenAddress` | string | `"2Ae1YRe...pump"` | Solana base58 address |
| `ageMinutes` | number | `9` | |
| `marketCap` | number | `49758` | USD |
| `athMarketCap` | number | `51400` | USD |
| `liquidity` | number | `17400` | USD |
| `volume1h` | number | `23400` | USD |
| `fakeVolUSD` | number | `23` | USD; `0` when shown as `$0` |
| `fakeVolPct` | number \| null | `0.1` | null when bot omits the bracket |
| `holderCount` | number | `357` | |
| `bundleCount` | number | `13` | |
| `bundlePctInitial` | number | `82` | % of supply bundled at launch |
| `bundlePctCurrent` | number | `5.8` | % still held by bundlers |
| `devHoldingPct` | number \| null | `0` | null when dev section absent |
| `devSoldPct` | number \| null | `59` | null when dev section absent |
| `airdropPct` | number \| null | `8` | null when absent |
| `burntPct` | number \| null | `1` | null when absent |
| `first20HoldingPct` | number | `62` | % held by first 20 buyers |
| `securityFlag` | boolean | `false` | `true` when 🚨 appears in message |

Dollar values with K/M/B suffixes are expanded to raw numbers (`$17.4K` → `17400`).  
Fields not present in a given message are `null` — the parser never throws.

The webhook payload is all of the above plus `raw` (the original message text).

## File structure

```
src/
  index.js        — entry point, loads .env and calls startListener()
  listener.js     — gramjs TelegramClient, session management, event handler
  parser.js       — parseTokenAlert() pure function, no external deps
test/
  fixtures/       — sample Telegram messages used as test inputs
  parser.test.js  — node:test suite; auto-discovers all .txt fixtures
n8n/              — n8n workflow exports (see n8n/README.md)
session.json      — created on first run, gitignored
.env              — gitignored, copy from .env.example
```

## Session persistence

The gramjs session string is written to `SESSION_PATH` after every successful connect. Keep this file safe — it is equivalent to a logged-in Telegram session. It is gitignored by default.

To force re-authentication, delete `session.json` and restart.

## What lives elsewhere

- **Scoring logic** — n8n workflow calling Claude API
- **Buy execution** — n8n Telegram send node targeting Trojan bot
- **Database** — none; this service is stateless beyond the session file
