import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import input from 'input';
import { getClient } from './client.js';

const client = getClient();

await client.start({
  phoneNumber: () => process.env.TELEGRAM_PHONE,
  phoneCode: () => input.text('Telegram code: '),
  password: () => input.text('2FA password (leave blank if none): '),
  onError: (err) => { console.error('Auth error:', err); throw err; },
});

writeFileSync(process.env.SESSION_PATH || './session.json', client.session.save(), 'utf8');
console.log('Session saved to', process.env.SESSION_PATH || './session.json');
await client.disconnect();
process.exit(0);
