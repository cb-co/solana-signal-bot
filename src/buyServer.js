import { createServer } from 'node:http';

export function startBuyServer(onBuy) {
  const port = process.env.BUY_SERVER_PORT || 3001;
  const secret = process.env.BUY_SECRET;

  const server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/execute-buy') {
      res.writeHead(404);
      res.end();
      return;
    }

    if (secret) {
      const auth = req.headers['authorization'] ?? '';
      if (auth !== `Bearer ${secret}`) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { tokenAddress, amount_sol } = JSON.parse(body);
        if (!tokenAddress || !amount_sol) throw new Error('tokenAddress and amount_sol required');
        onBuy({ tokenAddress, amount_sol }).catch(err =>
          console.error('[buyServer] Execution failed:', err.message)
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  });

  server.listen(port, () => console.log(`Buy server listening on :${port}`));
}
