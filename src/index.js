import 'dotenv/config';
import { startListener } from './listener.js';

startListener().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
