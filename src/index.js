import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import input from 'input';
import { getClient } from './client.js';
import { startChannelPoller } from './channelPoller.js';
import { initScannerBot } from './scannerBot.js';
import { parseScannerReply } from './parser.js';
import { postToWebhook } from './webhook.js';
import { initTrojanBot } from './trojanBot.js';
import { startBuyServer } from './buyServer.js';

const client = getClient();

await client.start({
  phoneNumber: () => process.env.TELEGRAM_PHONE,
  phoneCode: () => input.text('Telegram code: '),
  password: () => input.text('2FA password: '),
  onError: (err) => { console.error('Auth error:', err); throw err; },
});

writeFileSync(process.env.SESSION_PATH || './session.json', client.session.save(), 'utf8');
console.log('Connected.');

const sendToScanner = await initScannerBot(async ({ text, address, imageBase64 }) => {
  const parsed = parseScannerReply(text, address);
  try {
    await postToWebhook({ ...parsed, imageBase64, raw: text });
  } catch (err) {
    console.error('Webhook POST failed:', err.message);
  }
});

await startChannelPoller((address) => {
  sendToScanner(address).catch(err => console.error('Scanner send failed:', err.message));
});

const executeBuy = await initTrojanBot();
startBuyServer(executeBuy);
