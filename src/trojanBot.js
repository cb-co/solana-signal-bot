import { NewMessage } from 'telegram/events/index.js';
import { getClient } from './client.js';

const CONFIGURED_AMOUNTS = [0.03, 0.2, 0.5, 1, 10];
const pendingBuys = [];

function snapToButton(amount) {
  return CONFIGURED_AMOUNTS.reduce((a, b) =>
    Math.abs(b - amount) < Math.abs(a - amount) ? b : a
  );
}

export async function initTrojanBot() {
  const client = getClient();
  const username = process.env.TROJAN_BOT_USERNAME;
  const botEntity = await client.getEntity(username);

  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      const btns = await msg.getButtons();
      if (!btns?.length) return;

      const flat = btns.flat();
      const isBuyMenu = flat.some(b => b.text?.includes('SOL'));
      if (!isBuyMenu) return;

      const pending = pendingBuys.shift();
      if (!pending) {
        console.log('[trojan] Buy menu received but no pending buy');
        return;
      }

      const target = String(snapToButton(pending.amount_sol));
      const button = flat.find(b => b.text?.includes(target));
      if (!button) {
        console.error('[trojan] No matching button for amount:', pending.amount_sol);
        return;
      }

      console.log(`[trojan] Buying ${pending.tokenAddress} — clicking "${button.text}"`);
      await button.click({});
    } catch (err) {
      console.error('[trojan] Handler error:', err.message);
    }
  }, new NewMessage({ incoming: true, fromUsers: [username] }));

  console.log('Trojan bot listener ready');

  return async ({ tokenAddress, amount_sol }) => {
    pendingBuys.push({ tokenAddress, amount_sol });
    await client.sendMessage(botEntity, { message: tokenAddress });
    console.log(`[trojan] Sent ${tokenAddress} (target: ${amount_sol} SOL)`);
  };
}
