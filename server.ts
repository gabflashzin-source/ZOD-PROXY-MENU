import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const WORKER_TARGET = 'https://dashboard-proxy-api.gabrieldacechen6.workers.dev';

// Enable raw/json body parsing for proxy forwarding
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// Forward all /api/worker requests directly to the Cloudflare Worker v4.0
app.all('/api/worker*', async (req, res) => {
  try {
    const subPath = req.url.replace(/^\/api\/worker/, '') || '/';
    const targetUrl = `${WORKER_TARGET}${subPath}`;

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (
        k.toLowerCase() !== 'host' &&
        k.toLowerCase() !== 'content-length' &&
        k.toLowerCase() !== 'connection'
      ) {
        if (typeof v === 'string') headers[k] = v;
        else if (Array.isArray(v)) headers[k] = v.join(', ');
      }
    }

    const init: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Buffer.isBuffer(req.body) && req.body.length > 0) {
      init.body = new Uint8Array(req.body);
    }

    const workerResponse = await fetch(targetUrl, init);

    res.status(workerResponse.status);
    workerResponse.headers.forEach((val, key) => {
      if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, val);
      }
    });

    const buffer = await workerResponse.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Proxy dispatch failure';
    console.error('Server proxy error:', err);
    res.status(502).json({
      success: false,
      error: `Proxy error forwarding to Cloudflare Worker: ${msg}`,
    });
  }
});

// Serve static frontend assets in production
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

if (process.env.NODE_ENV === 'production' || process.argv.includes('--standalone')) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} with Worker proxy target: ${WORKER_TARGET}`);
  });
}

export default app;
