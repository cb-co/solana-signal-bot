import { getClient } from './client.js';

const POLL_MS = 5000;

function extractAddress(msg) {
  const entityUrls = (msg.entities || [])
    .filter(e => e.className === 'MessageEntityTextUrl')
    .map(e => e.url);

  for (const url of entityUrls) {
    const m =
      url.match(/geckoterminal\.com\/solana\/tokens\/([A-Za-z0-9]{32,44})/) ||
      url.match(/[?&]start=(?:[^_&]*_)*([A-Za-z0-9]{32,44})/) ||
      url.match(/solscan\.io\/(?:token|account)\/([A-Za-z0-9]{32,44})/);
    if (m) return m[1];
  }

  // Text fallback — Solana base58 address (43-44 chars)
  const m = msg.message?.match(/\b([A-HJ-NP-Za-km-z1-9]{43,44})\b/);
  return m ? m[1] : null;
}

export async function startChannelPoller(onAddress) {
  const client = getClient();
  const entity = await client.getEntity(process.env.TARGET_CHANNEL);
  console.log('Channel resolved:', entity.username, '| id:', entity.id.toString());

  const [latest] = await client.getMessages(entity, { limit: 1 });
  let lastId = latest?.id ?? 0;
  console.log(`Polling every ${POLL_MS / 1000}s from message ID ${lastId}...`);

  setInterval(async () => {
    try {
      const messages = await client.getMessages(entity, { limit: 10, minId: lastId });
      if (!messages.length) return;

      for (const msg of [...messages].reverse()) {
        if (msg.id > lastId) lastId = msg.id;

        if (!msg.message?.startsWith('🔥')) {
          console.log('Not a whale alert, skipping');
          continue;
        }

        const address = extractAddress(msg);
        if (!address) {
          console.log('No address found in whale message, skipping');
          continue;
        }
        console.log('Whale alert — address:', address);
        onAddress(address);
      }
    } catch (err) {
      console.error('Poll error:', err.message);
    }
  }, POLL_MS);
}
