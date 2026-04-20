import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import axios from 'axios';
import input from 'input';
import { parseTokenAlert } from './parser.js';

const POLL_MS = 5000;

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

  const targetEntity = await client.getEntity(process.env.TARGET_CHANNEL);
  console.log('Resolved target channel:', targetEntity.username, '| id:', targetEntity.id.toString());

  // Anchor to current latest message so we don't replay history on startup
  const [latest] = await client.getMessages(targetEntity, { limit: 1 });
  let lastId = latest?.id ?? 0;
  console.log(`Polling every ${POLL_MS / 1000}s from message ID ${lastId}...`);

  setInterval(async () => {
    try {
      // minId is exclusive — returns only messages with id > lastId
      const messages = await client.getMessages(targetEntity, { limit: 10, minId: lastId });
      if (!messages.length) return;

      // getMessages returns newest-first; reverse to process in chronological order
      for (const msg of [...messages].reverse()) {
        if (msg.id > lastId) lastId = msg.id;

        const text = msg.message; // MTProto Message.message holds the text content
        // Real channel messages carry URLs as entity objects, not inline text
        const entityUrls = (msg.entities || [])
          .filter(e => e.className === 'MessageEntityTextUrl')
          .map(e => e.url);
        const parsed = parseTokenAlert(text, entityUrls);
        if (!parsed) {
          console.log('Unparseable message skipped');
          continue;
        }

        try {
          await axios.post(process.env.N8N_WEBHOOK_URL, { ...parsed, raw: text });
          console.log(`Posted: ${parsed.tokenName} | MC: $${parsed.marketCap}`);
        } catch (err) {
          console.error('Webhook POST failed:', err.message);
        }
      }
    } catch (err) {
      console.error('Poll error:', err.message);
    }
  }, POLL_MS);
}
