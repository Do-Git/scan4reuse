import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import http from 'node:http';
import { createApp } from '../server.mjs';

async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'scan4reuse-test-'));
  const servers = [];
  async function start() {
    const server = await createApp({ dataDir, maxFileSize: 1024 });
    servers.push(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return { server, base: `http://127.0.0.1:${server.address().port}` };
  }
  t.after(async () => {
    for (const server of servers) if (server.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await rm(dataDir, { recursive: true, force: true });
  });
  return { ...await start(), start, dataDir };
}

function upload(base, name, content, type = 'text/plain', headers = {}) {
  return fetch(`${base}/api/files`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(name), 'X-File-Type': type, ...headers }, body: content });
}

test('upload, byte-for-byte download, restart persistence, and permanent deletion', async t => {
  const { base, server, start, dataDir } = await fixture(t);
  const content = Buffer.from([0, 255, 1, 42, 128, 13, 10]);
  const response = await upload(base, 'La mia città 📎.bin', content, 'application/octet-stream');
  assert.equal(response.status, 201);
  const { file } = await response.json();
  assert.equal(file.name, 'La mia città 📎.bin');
  assert.equal(file.size, content.length);
  assert.deepEqual(await readFile(join(dataDir, `${file.id}.blob`)), content);
  const listing = await (await fetch(`${base}/api/files`)).json();
  assert.deepEqual(listing.files, [file]);
  assert.equal(listing.maxFileSize, 1024);

  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  const restarted = await start();
  assert.deepEqual((await (await fetch(`${restarted.base}/api/files`)).json()).files, [file]);
  const download = await fetch(`${restarted.base}/api/files/${file.id}/download`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'application/octet-stream');
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  assert.ok(download.headers.get('content-disposition').includes(encodeURIComponent(file.name)));
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), content);

  assert.equal((await fetch(`${restarted.base}/api/files/${file.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual((await (await fetch(`${restarted.base}/api/files`)).json()).files, []);
  assert.equal((await fetch(`${restarted.base}/api/files/${file.id}/download`)).status, 404);
  assert.deepEqual(await readdir(dataDir), []);
});

test('identical filenames are separate files and cannot overwrite one another', async t => {
  const { base } = await fixture(t);
  const responses = await Promise.all([upload(base, 'documento.txt', 'primo'), upload(base, 'documento.txt', 'secondo')]);
  const files = await Promise.all(responses.map(async response => { assert.equal(response.status, 201); return (await response.json()).file; }));
  assert.notEqual(files[0].id, files[1].id);
  for (const [index, file] of files.entries()) {
    assert.equal(await (await fetch(`${base}/api/files/${file.id}/download`)).text(), ['primo', 'secondo'][index]);
  }
});

test('rejects empty files and oversized requests without saving them', async t => {
  const { base, dataDir } = await fixture(t);
  assert.equal((await upload(base, 'empty.txt', '')).status, 400);
  assert.equal((await upload(base, 'large.bin', Buffer.alloc(1025))).status, 413);
  assert.deepEqual(await readdir(dataDir), []);
});

test('also enforces the limit for streamed uploads without Content-Length', async t => {
  const { base, dataDir } = await fixture(t);
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(700)); controller.enqueue(new Uint8Array(700)); controller.close(); } });
  const response = await fetch(`${base}/api/files`, { method: 'POST', duplex: 'half', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'stream.bin' }, body });
  assert.equal(response.status, 413);
  assert.deepEqual(await readdir(dataDir), []);
});

test('sanitizes paths and serves active content only as an attachment', async t => {
  const { base, dataDir } = await fixture(t);
  const response = await upload(base, '../../unsafe.html', '<script>alert(1)</script>', 'text/html');
  const { file } = await response.json();
  assert.equal(file.name, 'unsafe.html');
  assert.ok((await readdir(dataDir)).every(entry => entry.startsWith(file.id)));
  const download = await fetch(`${base}/api/files/${file.id}/download`);
  assert.equal(download.headers.get('content-type'), 'application/octet-stream');
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
});

test('rejects malformed filenames, empty names, unsupported content types and cross-site mutations', async t => {
  const { base, dataDir } = await fixture(t);
  assert.equal((await upload(base, 'a.txt', 'a', 'text/plain', { 'X-File-Name': '%' })).status, 400);
  assert.equal((await upload(base, '', 'a')).status, 400);
  assert.equal((await upload(base, 'a.txt', 'a', 'text/plain', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await upload(base, 'a.txt', 'a', 'text/plain', { Origin: 'https://other.example' })).status, 403);
  assert.equal((await upload(base, 'a.txt', 'a', 'text/plain', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.deepEqual(await readdir(dataDir), []);
  assert.equal((await upload(base, 'a.txt', 'a', 'text/plain', { Origin: base })).status, 201);
});

test('interrupted upload removes partial data and never enters the file list', async t => {
  const { base, dataDir } = await fixture(t);
  const request = http.request(`${base}/api/files`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'interrupted.bin' } });
  request.on('error', () => {});
  request.write(Buffer.alloc(100));
  for (let i = 0; i < 100; i++) {
    if ((await readdir(dataDir)).some(entry => entry.endsWith('.part'))) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.ok((await readdir(dataDir)).some(entry => entry.endsWith('.part')));
  request.destroy();
  for (let i = 0; i < 100; i++) {
    if (!(await readdir(dataDir)).length) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.deepEqual(await readdir(dataDir), []);
  assert.deepEqual((await (await fetch(`${base}/api/files`)).json()).files, []);
});

test('serves the application with security headers and keeps data and source files inaccessible', async t => {
  const { base } = await fixture(t);
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<html lang="en">/);
  assert.match(home.headers.get('content-security-policy'), /object-src 'none'/);
  for (const path of ['/styles.css', '/app.js', '/partner.js', '/delivery-options.js', '/favicon.svg', '/pricing', '/upload', '/upload.css', '/upload.js', '/icons.svg']) assert.equal((await fetch(base + path)).status, 200);
  for (const path of ['/server.mjs', '/.git/config', '/.local/uploads', '/api/files/no-such-file', '/api/unknown']) assert.equal((await fetch(base + path)).status, 404);
  const head = await fetch(base, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
});

const validBrief = {
  itemName: 'Reclaimed window frame', category: 'building-materials', quantity: '1', length: '12', width: '100', height: '140', weight: '18',
  fragile: true, pickup: 'Milan, Italy', destination: 'Turin, Italy', pickupDate: '2099-11-10',
  service: 'room', pickupFloor: '1', deliveryFloor: '2', pickupLift: true, deliveryLift: false,
  packaging: true, notes: 'Please protect the oak finish.', contactName: 'Demo Buyer', email: 'buyer@example.com',
  requesterRole: 'buyer', consent: true, listingId: 'demo-window', plan: 'logistics', billing: 'monthly',
};

test('saves a validated delivery brief, preserves requirements, and does not expose customer data publicly', async t => {
  const { base, dataDir } = await fixture(t);
  const response = await fetch(`${base}/api/delivery-requests`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(validBrief),
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  const brief = result.request;
  assert.match(brief.reference, /^S4R-[A-F0-9]{8}$/);
  assert.equal(brief.status, 'demo_brief_saved');
  assert.equal(brief.length, 12);
  assert.equal(brief.pickupFloor, 1);
  assert.equal(brief.deliveryFloor, 2);
  assert.equal(brief.deliveryLift, false);
  assert.equal(brief.packaging, true);
  assert.equal(brief.plan, 'logistics');
  assert.equal(brief.billing, 'monthly');
  assert.match(result.message, /No carrier has been contacted/);
  assert.deepEqual(JSON.parse(await readFile(join(dataDir, 'delivery-requests', `${brief.id}.json`), 'utf8')), brief);
  assert.equal((await fetch(`${base}/api/delivery-requests`)).status, 404);
  assert.equal((await fetch(`${base}/api/delivery-requests/${brief.id}`)).status, 404);
  assert.equal((await fetch(`${base}/.local/uploads/delivery-requests/${brief.id}.json`)).status, 404);
  assert.deepEqual((await (await fetch(`${base}/api/files`)).json()).files, []);
});

test('delivery requirements adapt to pallets and doorstep delivery; untrusted fields are discarded', async t => {
  const { base } = await fixture(t);
  const response = await fetch(`${base}/api/delivery-requests`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validBrief, category: 'pallet', service: 'doorstep', forklift: true, status: 'booked', carrier: 'Invented carrier', pickupFloor: 'invalid' }),
  });
  assert.equal(response.status, 201);
  const { request } = await response.json();
  assert.equal(request.forklift, true);
  assert.equal(request.status, 'demo_brief_saved');
  assert.equal(request.carrier, undefined);
  assert.equal(request.pickupFloor, undefined);
});

test('architect and facility requests retain site, timing and service requirements with strict validation', async t => {
  const { base } = await fixture(t);
  for (const requesterRole of ['architect', 'facility-manager']) {
    const payload = { ...validBrief, requesterRole, deliveryDate: '2099-11-11', handlingUnit: 'crate', readiness: 'ready', declaredValue: '1200.50', scheduleFlexibility: 'fixed', pickupWindow: '09:00–11:00', deliveryWindow: '17:00–19:00', pickupAccess: 'Gate B', deliveryAccess: 'Reserved freight lift', accessMeasurements: 'Lift 140 × 220 × 210 cm', equipment: 'tail-lift', placement: 'Room 204', assembly: true, conditionRecord: true, insuranceQuote: true };
    const response = await fetch(`${base}/api/delivery-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(response.status, 201);
    const { request } = await response.json();
    assert.equal(request.requesterRole, requesterRole);
    assert.equal(request.deliveryAccess, 'Reserved freight lift');
    assert.equal(request.deliveryWindow, '17:00–19:00');
    assert.equal(request.declaredValue, 1200.5);
    assert.equal(request.conditionRecord, true);
    assert.equal(request.equipment, 'tail-lift');
    for (const invalid of [{ deliveryDate: '2099-11-09' }, { equipment: 'teleport' }, { pickupAccess: 'x'.repeat(401) }]) {
      const bad = await fetch(`${base}/api/delivery-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, ...invalid }) });
      assert.equal(bad.status, 400);
    }
  }
});

test('rejects incomplete, unconsented or invalid delivery briefs before writing data', async t => {
  const { base, dataDir } = await fixture(t);
  for (const change of [{ consent: false }, { email: 'not-an-email' }, { quantity: 1.5 }, { length: 0 }, { weight: 'NaN' }, { pickupDate: '2099-02-31' }, { pickupDate: '2020-01-01' }, { category: 'anything' }, { service: 'teleport' }, { pickupFloor: -1 }, { notes: 'x'.repeat(1001) }]) {
    const response = await fetch(`${base}/api/delivery-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...validBrief, ...change }) });
    assert.equal(response.status, 400, JSON.stringify(change));
    assert.equal(typeof (await response.json()).error, 'string');
  }
  assert.deepEqual(await readdir(dataDir), []);
});

test('bounds JSON payloads, rejects malformed JSON and cross-site delivery submissions', async t => {
  const { base, dataDir } = await fixture(t);
  for (const [headers, body, status] of [
    [{ 'Content-Type': 'text/plain' }, JSON.stringify(validBrief), 415],
    [{ 'Content-Type': 'application/json' }, '{', 400],
    [{ 'Content-Type': 'application/json' }, 'x'.repeat(17000), 413],
    [{ 'Content-Type': 'application/json', Origin: 'https://other.example' }, JSON.stringify(validBrief), 403],
  ]) {
    const response = await fetch(`${base}/api/delivery-requests`, { method: 'POST', headers, body });
    assert.equal(response.status, status);
  }
  assert.deepEqual(await readdir(dataDir), []);
});
