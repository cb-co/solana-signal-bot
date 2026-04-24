# solana-signal-bot

Monitors the **solwhaletrending** Telegram channel for whale buy alerts, enriches each token via **soul_scanner_bot**, scores the opportunity with an AI agent in n8n, and executes buys through **Trojan bot** — fully automated.

## How it works

```
solwhaletrending channel  (poll every 5s, 🔥 messages only)
        │  extract token address
        ▼
soul_scanner_bot  (DM — send address, receive scan reply + image)
        │  parse reply
        ▼
n8n webhook  (flat JSON + base64 image)
        │  Gemini AI agent — buy / skip decision
        ▼
/execute-buy endpoint  (HTTP POST from n8n)
        │
Trojan bot  (send address → select amount → click BUY)
```

1. The channel poller fetches new messages every 5 seconds. Only messages starting with 🔥 (whale alerts) are processed.
2. The token address is extracted from message entity URLs (GeckoTerminal, Solscan, Soul Sniper deep-links) or raw text.
3. The address is sent to `soul_scanner_bot` via DM. The reply — including the chart image — is parsed into structured fields.
4. The parsed payload is POSTed to n8n. A Gemini AI agent scores the token and returns a `buy` / `skip` decision with a SOL amount.
5. If the decision is `buy`, n8n POSTs to the service's `/execute-buy` endpoint. The service sends the address to Trojan bot, selects the matching amount button, and confirms the buy.

## Setup

### 1. Telegram API credentials

Go to [my.telegram.org](https://my.telegram.org) → "API development tools" → create an app.
Copy the **API ID** (number) and **API Hash** (hex string).

### 2. Configure environment

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `TELEGRAM_API_ID` | From my.telegram.org |
| `TELEGRAM_API_HASH` | From my.telegram.org |
| `TELEGRAM_PHONE` | Your phone in international format, e.g. `+12025551234` |
| `TARGET_CHANNEL` | `solwhaletrending` |
| `N8N_WEBHOOK_URL` | Your n8n webhook URL |
| `SESSION_PATH` | Path to session file (default: `./session.json`) |
| `TROJAN_BOT_USERNAME` | Trojan bot's Telegram username (no @) |
| `BUY_SERVER_PORT` | Port for the buy endpoint (default: `3001`) |
| `BUY_SECRET` | Bearer token n8n sends to authorize buys |

### 3. Install and run

```bash
npm install
npm start
```

On first run, Telegram sends a login code to your phone or Telegram app. Enter it at the prompt. 2FA password will also be prompted if enabled.

The session is saved to `SESSION_PATH` after auth. Subsequent starts skip the prompt entirely.

## Commands

| Command | Description |
|---|---|
| `npm start` | Start the service |
| `npm run parse:test` | Run parser unit tests |

## Webhook payload

All fields from `parseScannerReply()` plus `imageBase64` and `raw`:

| Field | Type | Notes |
|---|---|---|
| `tokenName` | string \| null | Token name from scanner header |
| `tokenAddress` | string | Solana base58 address |
| `isPumpFun` | boolean | `true` if still on pump.fun bonding curve (💊) |
| `ageMinutes` | number \| null | Supports m / h / d / mo / y and compound formats |
| `priceChange1h` | number \| null | % change in last hour |
| `marketCap` | number \| null | USD |
| `athMarketCap` | number \| null | USD |
| `liquidity` | number \| null | USD (handles both `Liq` and `vLiq`) |
| `volume1h` | number \| null | USD |
| `fakeVolUSD` | number \| null | USD |
| `fakeVolPct` | number \| null | % |
| `holderCount` | number \| null | |
| `topHolderPct` | number \| null | % held by top holder |
| `fakeHolderCount` | number \| null | |
| `fakeHolderPct` | number \| null | % |
| `ilpPct` | number \| null | iLP % |
| `ilpBurntPct` | number \| null | iLP burnt % |
| `bundleCount` | number \| null | |
| `bundlePctInitial` | number \| null | % bundled at launch |
| `bundlePctCurrent` | number \| null | % still held by bundlers |
| `sniperCount` | number \| null | |
| `first20HoldingPct` | number \| null | % held by first 20 buyers |
| `devSolAmount` | number \| null | SOL |
| `devHoldingPct` | number \| null | % |
| `devBundledPct` | number \| null | % |
| `devSoldPct` | number \| null | % |
| `airdropPct` | number \| null | % |
| `dexPaid` | boolean \| null | `true` = ✅, `false` = ❌ |
| `scanCount` | number \| null | Times this token has been scanned |
| `securityFlag` | boolean | `true` if 🚨 appears in the reply |
| `imageBase64` | string \| null | Chart image as base64 (for Claude vision) |
| `raw` | string | Original scanner reply text |

Dollar values with K/M/B suffixes are expanded to raw numbers (`$17.4K` → `17400`). Fields absent from a given reply are `null` — the parser never throws.

## Buy endpoint

The service exposes a single HTTP endpoint for n8n to trigger buys:

```
POST /execute-buy
Authorization: Bearer <BUY_SECRET>
Content-Type: application/json

{ "tokenAddress": "...", "amount_sol": 0.2 }
```

`amount_sol` is snapped to the nearest configured Trojan button: `0.03 / 0.2 / 0.5 / 1 / 10`.

## Deployment (Fly.io)

```bash
fly deploy
```

The app runs on `solearly-telegram-listener.fly.dev`. The session file is stored on a persistent volume at `/data/session.json`.

To set secrets:

```bash
fly secrets set TELEGRAM_API_ID=... TELEGRAM_API_HASH=... TELEGRAM_PHONE=... \
  N8N_WEBHOOK_URL=... TROJAN_BOT_USERNAME=... BUY_SECRET=...
```

## File structure

```
src/
  index.js          — entry point, wires all modules, starts HTTP server
  client.js         — singleton TelegramClient factory
  channelPoller.js  — polls solwhaletrending, extracts token addresses
  scannerBot.js     — DMs soul_scanner_bot, receives reply + image
  parser.js         — parseScannerReply() pure function
  webhook.js        — POSTs parsed payload to n8n
  trojanBot.js      — sends address to Trojan, selects amount, confirms buy
  buyServer.js      — HTTP server receiving buy signals from n8n
test/
  parser.test.js    — node:test suite
session.json        — created on first run, gitignored
.env                — gitignored, copy from .env.example
```

## Session security

The gramjs session string is equivalent to a logged-in Telegram session. Keep `session.json` safe and never commit it — it is gitignored by default.

To force re-authentication, delete `session.json` and restart.
