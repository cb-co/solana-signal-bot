# n8n Workflow — Solana Token AI Scorer

This workflow sits between the Telegram listener service and the Trojan buy bot. It receives a parsed token scan, runs it through a Gemini AI agent to decide whether to buy or skip, and — on a buy decision — calls back to the listener service to execute the trade.

## Workflow overview

```
Webhook trigger  (POST from solana-signal-bot)
        │
        ▼
Gemini AI agent  (analyze token fields + chart image)
        │  returns { decision: "buy"|"skip", amount_sol, reason }
        ▼
IF decision === "buy"
        │
        ▼
HTTP Request  (POST /execute-buy → solana-signal-bot)
```

## Nodes

### 1. Webhook

- **Method**: POST
- **Path**: configured in `N8N_WEBHOOK_URL` on the listener side
- **Authentication**: none (restrict by network/IP if needed)
- **Body**: flat JSON — see [Payload fields](#payload-fields) below

### 2. Gemini AI Agent

Sends the token data to Gemini (Google AI) for scoring.

**System prompt** (configure in the node):

> You are a Solana memecoin trading analyst. You will receive structured data from a token scanner and a chart image. Evaluate the token and return a JSON object with three keys:
> - `decision` — either `"buy"` or `"skip"`
> - `amount_sol` — SOL amount to spend (one of: `0.03`, `0.2`, `0.5`, `1`, `10`) — omit or set to `0` on skip
> - `reason` — one sentence explaining the decision

**Inputs passed to the model**:
- All numeric/boolean fields from the payload (see below)
- `imageBase64` — the soul_scanner_bot chart image, passed as an inline image part

**Buy criteria to encode in the prompt** (adjust to taste):
- Market cap in a viable range (e.g. $20K–$2M)
- Liquidity sufficient relative to MC
- Low fake volume %
- Low bundle % current
- Dev holding % not alarming
- No security flag (`securityFlag: false`)
- Token age not too old (opportunity window still open)
- Strong price momentum (`priceChange1h` positive)

### 3. IF (decision check)

- **Condition**: `{{ $json.decision }}` equals `buy`
- True branch → HTTP Request node
- False branch → (no-op, workflow ends)

### 4. HTTP Request — Execute Buy

- **Method**: POST
- **URL**: `{{ $env.BUY_ENDPOINT }}` (e.g. `https://solearly-telegram-listener.fly.dev/execute-buy`)
- **Authentication**: Header Auth — `Authorization: Bearer <BUY_SECRET>`
- **Body** (JSON):

```json
{
  "tokenAddress": "{{ $('Webhook').item.json.tokenAddress }}",
  "amount_sol": "{{ $json.amount_sol }}"
}
```

## Payload fields

The listener POSTs a flat JSON object. All fields except `tokenAddress` and `raw` may be `null` if the scanner did not include them.

| Field | Type | Description |
|---|---|---|
| `tokenAddress` | string | Solana base58 address |
| `tokenName` | string \| null | Token name from scanner header |
| `isPumpFun` | boolean | Still on pump.fun bonding curve |
| `ageMinutes` | number \| null | Token age in minutes |
| `priceChange1h` | number \| null | % price change in last hour |
| `marketCap` | number \| null | USD market cap |
| `athMarketCap` | number \| null | USD all-time-high market cap |
| `liquidity` | number \| null | USD liquidity |
| `volume1h` | number \| null | USD volume last hour |
| `fakeVolUSD` | number \| null | USD fake/wash volume |
| `fakeVolPct` | number \| null | % fake volume |
| `holderCount` | number \| null | Total holder count |
| `topHolderPct` | number \| null | % held by top holder |
| `fakeHolderCount` | number \| null | Estimated fake holder count |
| `fakeHolderPct` | number \| null | % fake holders |
| `ilpPct` | number \| null | iLP % |
| `ilpBurntPct` | number \| null | iLP burnt % |
| `bundleCount` | number \| null | Number of bundle transactions |
| `bundlePctInitial` | number \| null | % bundled at launch |
| `bundlePctCurrent` | number \| null | % still held by bundlers |
| `sniperCount` | number \| null | Number of snipers |
| `first20HoldingPct` | number \| null | % held by first 20 buyers |
| `devSolAmount` | number \| null | SOL spent by dev |
| `devHoldingPct` | number \| null | % dev still holds |
| `devBundledPct` | number \| null | % dev bundled |
| `devSoldPct` | number \| null | % dev has sold |
| `airdropPct` | number \| null | % airdropped |
| `dexPaid` | boolean \| null | DEX screener paid listing |
| `scanCount` | number \| null | Times scanned by soul_scanner_bot |
| `securityFlag` | boolean | `true` if 🚨 present in scanner reply |
| `imageBase64` | string \| null | Chart image as base64 PNG |
| `raw` | string | Original scanner reply text |

Dollar values with K/M/B suffixes are already expanded to raw numbers (`$17.4K` → `17400`).

## Environment variables (n8n)

Set these in n8n Settings → Environment Variables or directly in node expressions:

| Variable | Description |
|---|---|
| `BUY_ENDPOINT` | Full URL to the listener's `/execute-buy` endpoint |
| `BUY_SECRET` | Bearer token matching the listener's `BUY_SECRET` |
| `GEMINI_API_KEY` | Google AI API key for the Gemini node credential |

## Credentials

- **Google Gemini** — add a "Google Gemini(PaLM) Api" credential in n8n with your `GEMINI_API_KEY`

## Error handling

- If the AI agent returns malformed JSON, add a Code node after Gemini to parse `$json.output` and default to `{ decision: "skip" }`.
- The listener's `/execute-buy` responds `{ ok: true }` on success and a 4xx body on error — wire an error branch off the HTTP Request node if you want Slack/email alerts on failures.
- The listener processes buys fire-and-forget; the `200 OK` from `/execute-buy` only confirms the request was received, not that the Trojan buy succeeded.
