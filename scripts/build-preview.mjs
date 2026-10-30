import { copyFile, lstat, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public');
const output = join(root, '.local', 'preview', 'site');
const marker = '.scan4reuse-preview';
const files = [
  'index.html', 'pricing.html', 'upload.html',
  'styles.css', 'upload.css', 'app.js', 'upload.js', 'preview.js', 'icons.svg', 'favicon.svg',
  'assets/building-context.png', 'assets/workflow.png', 'assets/marketplace.png', 'assets/report.png',
  'assets/team-daria.png', 'assets/team-tomas.jpeg', 'assets/team-reazul.png', 'assets/team-ivo.png', 'assets/team-domenico.png',
];

// Copy only the reviewed public files. Never copy the checkout, environment,
// .git directory, local archive, contacts, credentials or development outputs.
await mkdir(dirname(output), { recursive: true });
try {
  const entries = await readdir(output);
  if (entries.length && !entries.includes(marker)) throw new Error(`Refusing to replace a directory not created by this script: ${output}`);
  if (entries.length) await rm(output, { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(output, { recursive: true });
await writeFile(join(output, marker), 'Generated public preview. Safe to rebuild.\n');

const manifest = [];
for (const file of files) {
  const input = join(source, file);
  if (!(await lstat(input)).isFile()) throw new Error(`Expected a regular public file: ${file}`);
  const target = join(output, file);
  await mkdir(dirname(target), { recursive: true });
  if (file.endsWith('.html')) {
    const original = await readFile(input, 'utf8');
    const html = original.replace(/<html\b([^>]*)>/i, '<html$1 data-storage="browser">');
    if (html === original) throw new Error(`Could not enable browser preview mode in ${file}`);
    await writeFile(target, html);
  } else await copyFile(input, target);
  const content = await readFile(target);
  manifest.push({ path: file, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
}

// Directory aliases also make the output work with simple static web servers.
for (const page of ['pricing', 'upload']) {
  await mkdir(join(output, page), { recursive: true });
  await copyFile(join(output, `${page}.html`), join(output, page, 'index.html'));
}

const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const headers = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];
await writeFile(join(output, 'vercel.json'), JSON.stringify({ cleanUrls: true, headers: [{ source: '/(.*)', headers }] }, null, 2));
await writeFile(join(output, '_headers'), `/*\n${headers.map(({ key, value }) => `  ${key}: ${value}`).join('\n')}\n`);
await writeFile(join(output, '_redirects'), '/pricing /pricing.html 200\n/upload /upload.html 200\n/api/* /preview-api-unavailable.json 410\n');
await writeFile(join(output, 'preview-api-unavailable.json'), JSON.stringify({ error: 'This public preview keeps demo data in browser memory. No server archive is deployed.' }));
await writeFile(join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
await writeFile(join(dirname(output), 'manifest.json'), JSON.stringify({ storage: 'browser-memory', source: 'explicit public-file allowlist', files: manifest }, null, 2));
console.log(`Preview built: ${output}`);
console.log(`${files.length} reviewed public files. No saved uploads, requests, environment files or credentials included.`);
