import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, open, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveDelivery } from './delivery.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, 'public');
const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

function safeName(header) {
  let name;
  try { name = decodeURIComponent(header || ''); }
  catch { throw new ApiError(400, 'The filename is not valid.'); }
  name = name.replaceAll('\\', '/').split('/').pop().normalize('NFC').replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (!name || name === '.' || name === '..' || Buffer.byteLength(name) > 240) {
    throw new ApiError(400, 'Choose a valid filename (up to 240 bytes).');
  }
  return name;
}

export async function createApp({ dataDir = resolve(process.env.UPLOAD_DIR || join(root, '.local', 'uploads')), maxFileSize = MAX_FILE_SIZE } = {}) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const files = new Map();
  for (const entry of await readdir(dataDir)) {
    if (!entry.endsWith('.json') || !validId.test(entry.slice(0, -5))) continue;
    const id = entry.slice(0, -5);
    try {
      const metadata = JSON.parse(await readFile(join(dataDir, entry), 'utf8'));
      const blob = await stat(join(dataDir, `${id}.blob`));
      if (metadata.id === id && typeof metadata.name === 'string' && typeof metadata.type === 'string' &&
          typeof metadata.createdAt === 'string' && Number.isFinite(Date.parse(metadata.createdAt)) &&
          blob.isFile() && metadata.size === blob.size) files.set(id, metadata);
      else console.warn(`Metadati non validi per il file ${id}; file escluso dall'elenco.`);
    } catch (error) {
      console.warn(`Impossibile leggere il file ${id}: ${error.code || error.name}`);
    }
  }

  let activeUploads = 0;
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");

    try {
      const url = new URL(request.url, 'http://localhost');
      const path = url.pathname;
      if (['POST', 'DELETE'].includes(request.method)) {
        const origin = request.headers.origin;
        if ((origin && new URL(origin).host !== request.headers.host) || request.headers['sec-fetch-site'] === 'cross-site') {
          throw new ApiError(403, 'Requests from another site are not allowed.');
        }
      }

      if (path === '/api/delivery-requests' && request.method === 'POST') {
        const record = await saveDelivery(request, join(dataDir, 'delivery-requests'));
        return json(response, 201, { request: record, message: 'Demo brief saved. No carrier has been contacted and no delivery has been booked.' });
      }

      if (path === '/api/files' && request.method === 'GET') {
        return json(response, 200, { files: [...files.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), maxFileSize });
      }

      if (path === '/api/files' && request.method === 'POST') {
        const name = safeName(request.headers['x-file-name']);
        if (request.headers['content-type']?.split(';')[0].trim() !== 'application/octet-stream') {
          throw new ApiError(415, 'Submit the file as application/octet-stream.');
        }
        if (Number(request.headers['content-length']) > maxFileSize) throw new ApiError(413, 'The file exceeds the permitted size.');
        if (activeUploads >= 6) throw new ApiError(429, 'Too many uploads are in progress. Try again shortly.');
        activeUploads++;
        const id = randomUUID();
        const temp = join(dataDir, `${id}.part`);
        const blobPath = join(dataDir, `${id}.blob`);
        const metadataTemp = join(dataDir, `${id}.json.part`);
        let handle;
        try {
          handle = await open(temp, 'wx', 0o600);
          let size = 0;
          for await (const chunk of request.iterator({ destroyOnReturn: false })) {
            size += chunk.length;
            if (size > maxFileSize) throw new ApiError(413, 'The file exceeds the permitted size.');
            await handle.writeFile(chunk);
          }
          await handle.close();
          handle = undefined;
          if (!size) throw new ApiError(400, 'The file is empty. Choose another file.');
          const rawType = request.headers['x-file-type'] || 'application/octet-stream';
          const type = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(rawType) && rawType.length <= 127 ? rawType.toLowerCase() : 'application/octet-stream';
          const metadata = { id, name, size, type, createdAt: new Date().toISOString() };
          await rename(temp, blobPath);
          const metadataHandle = await open(metadataTemp, 'wx', 0o600);
          try { await metadataHandle.writeFile(JSON.stringify(metadata)); }
          finally { await metadataHandle.close(); }
          await rename(metadataTemp, join(dataDir, `${id}.json`));
          files.set(id, metadata);
          return json(response, 201, { file: metadata });
        } catch (error) {
          await handle?.close().catch(() => {});
          await Promise.all([temp, blobPath, metadataTemp].map(file => rm(file, { force: true })));
          throw error;
        } finally { activeUploads--; }
      }

      const match = path.match(/^\/api\/files\/([^/]+)(\/download)?$/);
      if (match && validId.test(match[1])) {
        const id = match[1];
        const file = files.get(id);
        if (!file) throw new ApiError(404, 'This file is no longer available.');
        if (request.method === 'GET' && match[2]) {
          const handle = await open(join(dataDir, `${id}.blob`), 'r');
          response.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': file.size,
            'Content-Disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`,
            'Cache-Control': 'no-store',
          });
          const stream = handle.createReadStream();
          stream.on('error', () => response.destroy());
          response.on('close', () => stream.destroy());
          stream.pipe(response);
          return;
        }
        if (request.method === 'DELETE' && !match[2]) {
          // Remove the index entry on disk first: a failed delete never reports success.
          await rm(join(dataDir, `${id}.json`), { force: true });
          files.delete(id);
          await rm(join(dataDir, `${id}.blob`), { force: true });
          return json(response, 200, { deleted: id });
        }
      }

      if (path.startsWith('/api/')) throw new ApiError(404, 'Resource not found.');
      if (!['GET', 'HEAD'].includes(request.method)) throw new ApiError(405, 'Method not allowed.');
      const assets = {
        '/': 'index.html', '/index.html': 'index.html',
        '/pricing': 'pricing.html', '/pricing/': 'pricing.html', '/pricing.html': 'pricing.html',
        '/upload': 'upload.html', '/upload/': 'upload.html', '/upload.html': 'upload.html',
        '/styles.css': 'styles.css', '/app.js': 'app.js', '/preview.js': 'preview.js', '/icons.svg': 'icons.svg',
        '/delivery-options.js': 'delivery-options.js', '/partner.js': 'partner.js',
        '/pdf-report.js': 'pdf-report.js', '/vendor/jspdf.umd.min.js': 'vendor/jspdf.umd.min.js', '/vendor/LICENSE-jsPDF.txt': 'vendor/LICENSE-jsPDF.txt',
        '/assets/fonts/DejaVuSans.ttf': 'assets/fonts/DejaVuSans.ttf', '/assets/fonts/DejaVuSans-Bold.ttf': 'assets/fonts/DejaVuSans-Bold.ttf',
        '/assets/fonts/LICENSE-DejaVu.txt': 'assets/fonts/LICENSE-DejaVu.txt',
        '/upload.css': 'upload.css', '/upload.js': 'upload.js', '/favicon.svg': 'favicon.svg',
        '/assets/workflow.png': 'assets/workflow.png', '/assets/report.png': 'assets/report.png',
        '/assets/marketplace.png': 'assets/marketplace.png', '/assets/building-context.png': 'assets/building-context.png',
        '/assets/team-daria.png': 'assets/team-daria.png', '/assets/team-tomas.jpeg': 'assets/team-tomas.jpeg',
        '/assets/team-reazul.png': 'assets/team-reazul.png', '/assets/team-ivo.png': 'assets/team-ivo.png',
        '/assets/team-domenico.png': 'assets/team-domenico.png',
        '/assets/sdg-08.jpg': 'assets/sdg-08.jpg', '/assets/sdg-09.jpg': 'assets/sdg-09.jpg',
        '/assets/sdg-11.jpg': 'assets/sdg-11.jpg', '/assets/sdg-12.jpg': 'assets/sdg-12.jpg',
        '/assets/sdg-13.jpg': 'assets/sdg-13.jpg',
      };
      const asset = assets[path];
      if (!asset) throw new ApiError(404, 'Page not found.');
      const assetPath = join(publicDir, asset);
      const info = await stat(assetPath);
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
      response.writeHead(200, { 'Content-Type': types[extname(asset)], 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
      if (request.method === 'HEAD') return response.end();
      const stream = createReadStream(assetPath);
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch (error) {
      request.resume();
      if (response.destroyed || response.headersSent) return;
      const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
      if (status === 500) console.error(error);
      json(response, status, { error: error.status ? error.message : status === 404 ? 'File not found.' : 'The request could not be completed. Try again.' });
    }
  });
  server.requestTimeout = 300_000;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const server = await createApp();
  server.on('error', error => { console.error(`Avvio non riuscito: ${error.message}`); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Scan4Reuse in ascolto su ${host}:${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
}
