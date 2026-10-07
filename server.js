// server.js – Zero-Dependency-Server: statische Dateien + /api/quote + /api/data
// Start: npm start  (→ http://localhost:8080)

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeQuote, ASSUMPTIONS } from './src/engine.js';
import { F } from './src/fares.js';
import { ROUTE } from './src/route.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = resolve(join(__dirname, 'public'));
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...CORS });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }

    // ----- API: Quote berechnen -----
    if (req.method === 'POST' && url.pathname === '/api/quote') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 1e6) break; // Schutz
      }
      let params;
      try {
        params = JSON.parse(body || '{}');
      } catch {
        return json(res, 400, { error: 'Ungültiges JSON' });
      }
      const result = computeQuote(params);
      return json(res, 200, result);
    }

    // ----- API: Tarifdaten & Route (für UI/Demo) -----
    if (req.method === 'GET' && url.pathname === '/api/data') {
      return json(res, 200, { fares: F, route: ROUTE, assumptions: ASSUMPTIONS });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', ...CORS });
      return res.end('Methode nicht erlaubt');
    }

    // ----- Statische Dateien -----
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = normalize(join(PUBLIC_DIR, path));
    if (!file.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Forbidden');
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    console.error(`Fehler bei ${req.method} ${req.url}:`, e);
    if (!res.headersSent) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...CORS });
    }
    res.end('404 – nicht gefunden');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`DBApp läuft: http://localhost:${PORT}  (0.0.0.0)`);
});
