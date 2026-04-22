import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { existsSync, readFileSync } from 'node:fs';

let _client = null;

export function getClient() {
  if (_client) return _client;
  const sessionPath = process.env.SESSION_PATH || './session.json';
  const sessionStr = existsSync(sessionPath) ? readFileSync(sessionPath, 'utf8').trim() : '';
  _client = new TelegramClient(
    new StringSession(sessionStr),
    Number(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH,
    { connectionRetries: 5 },
  );
  return _client;
}
