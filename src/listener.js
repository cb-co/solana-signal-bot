import { TelegramClient } from 'telegram';
import { NewMessage } from 'telegram/events/index.js';
import { StringSession } from 'telegram/sessions/index.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import axios from 'axios';
import input from 'input';
import { parseTokenAlert } from './parser.js';

export async function startListener() {
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
    password: () => input.text('2FA password: '),
    onError: (err) => { console.error('Auth error:', err); throw err; },
  });

  writeFileSync(sessionPath, client.session.save(), 'utf8');
  console.log('Connected. Session saved to', sessionPath);

  const targetChannel = (process.env.TARGET_CHANNEL || 'solearlytrending').toLowerCase();

  client.addEventHandler(async (event) => {
    const chat = await event.message.getChat();
    if ((chat?.username || '').toLowerCase() !== targetChannel) return;

    const text = event.message.text;
    const parsed = parseTokenAlert(text);
    if (!parsed) {
      console.log('Unparseable message skipped');
      return;
    }

    try {
      await axios.post(process.env.N8N_WEBHOOK_URL, { ...parsed, raw: text });
      console.log(`Posted: ${parsed.tokenName} | MC: $${parsed.marketCap}`);
    } catch (err) {
      console.error('Webhook POST failed:', err.message);
    }
  }, new NewMessage({}));
}
