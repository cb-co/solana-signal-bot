import 'dotenv/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import input from 'input';

const sessionPath = process.env.SESSION_PATH || './session.json';
const sessionStr = existsSync(sessionPath) ? readFileSync(sessionPath, 'utf8').trim() : '';

const client = new TelegramClient(
  new StringSession(sessionStr),
  Number(process.env.TELEGRAM_API_ID),
  process.env.TELEGRAM_API_HASH,
  { connectionRetries: 5 },
);

await client.start({
  phoneNumber: () => process.env.TELEGRAM_PHONE,
  phoneCode: () => input.text('Telegram code: '),
  password: () => input.text('2FA password (leave blank if none): '),
  onError: (err) => { console.error('Auth error:', err); throw err; },
});

writeFileSync(sessionPath, client.session.save(), 'utf8');
console.log('Session saved to', sessionPath);
await client.disconnect();
process.exit(0);
