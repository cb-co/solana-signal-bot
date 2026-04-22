import axios from 'axios';

export async function postToWebhook(data) {
  await axios.post(process.env.N8N_WEBHOOK_URL, data);
  console.log('Posted to webhook:', data.address);
}
