import { NewMessage } from 'telegram/events/index.js';
import { getClient } from './client.js';

const pendingAddresses = [];

export async function initScannerBot(onResult) {
  const client = getClient();
  const botEntity = await client.getEntity('soul_scanner_bot');

  client.addEventHandler(async (event) => {
    try {
      const text = event.message.message;

      const address = pendingAddresses.shift();
      if (!address) {
        console.log('[warn] Bot reply received but no pending address');
        return;
      }

      onResult({ text, address });
    } catch (err) {
      console.error('Scanner bot handler error:', err.message);
    }
  }, new NewMessage({ incoming: true, fromUsers: ['soul_scanner_bot'] }));

  console.log('Scanner bot listener ready');

  return async (address) => {
    pendingAddresses.push(address);
    await client.sendMessage(botEntity, { message: address });
    console.log('Sent to scanner bot:', address);
  };
}
