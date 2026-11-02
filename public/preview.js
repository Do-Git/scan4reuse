import { readDeliveryOptions } from './delivery-options.js';

// Public previews use browser memory, keeping development data off the deployment.
export const browserPreview = document.documentElement.dataset.storage === 'browser';
const files = new Map();
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_SESSION_SIZE = 200 * 1024 * 1024;

export function configurePreview(page) {
  if (!browserPreview) return;
  const note = document.createElement('aside');
  note.className = 'preview-notice';
  note.setAttribute('role', 'note');
  note.textContent = page === 'upload'
    ? 'Example delivery documents stay in this browser until reload. Use sample files to explore the workspace.'
    : '';
  if (note.textContent) document.body.prepend(note);

  if (page === 'upload') {
    const storageStatus = document.querySelector('.space-profile .online-dot');
    if (storageStatus) storageStatus.setAttribute('aria-label', 'Files in this browser session');
    const footnote = document.querySelector('.upload-footnote>span:first-child');
    if (footnote) footnote.textContent = 'Files stay in this browser · up to 200 MB per session.';
    const help = document.querySelector('.help-notice p');
    if (help) help.textContent = 'Delivery documents in this preview stay in browser memory. You can add, download and remove them; reloading clears the files. Total limit: 200 MB per session.';
    const saved = document.querySelector('.help-steps li:nth-child(2) p');
    if (saved) saved.textContent = 'Selected files are kept in this browser session. Reloading clears this preview workspace; download the files you need before leaving.';
    const deletion = document.querySelector('#delete-dialog>p');
    if (deletion?.lastChild) deletion.lastChild.textContent = ' will be removed from this preview.';
    return;
  }

  const description = document.querySelector('.demo-note p');
  if (description) description.textContent = 'Customize the Basel-to-Zürich request, switch to the partner view to prepare a quote, then return to the client view to review it.';
  const consent = document.querySelector('.consent-label>span');
  if (consent) {
    consent.replaceChildren(document.createTextNode('I understand this brief is prepared in my browser. No partner will be contacted automatically. '));
    const info = document.createElement('button');
    info.type = 'button';
    info.className = 'inline-link';
    info.dataset.open = 'privacy-dialog';
    info.textContent = 'About your data';
    consent.append(info);
  }
  const success = document.querySelector('.form-success>p');
  if (success?.firstChild) success.firstChild.textContent = 'Prepared with reference ';
  const button = document.querySelector('#form-submit');
  if (button?.firstChild) button.firstChild.textContent = 'Prepare my delivery brief ';
  const privacy = document.querySelectorAll('#privacy-dialog>p');
  if (privacy[1]) privacy[1].textContent = 'Delivery requests, partner proposals and example agreements in this public preview stay in this browser session and can be downloaded. Reloading clears the example. No contact information is sent to a carrier, no shipment is booked and no payment is taken.';
  if (privacy[2]) privacy[2].textContent = 'The upload workspace in this preview also keeps files only in browser memory, up to 200 MB per session. Reloading or closing the page clears this demo state. No analytics or third-party tracking is used.';
}

export async function preparePreviewBrief(data) {
  if (data.consent !== true) throw new Error('Your confirmation is required to prepare this demo brief.');
  const id = crypto.randomUUID();
  const record = { ...data, ...readDeliveryOptions(data), id, reference: `S4R-PREVIEW-${id.slice(0, 8).toUpperCase()}`, createdAt: new Date().toISOString(), status: 'browser_preview' };
  for (const key of ['quantity', 'length', 'width', 'height', 'weight', 'pickupFloor', 'deliveryFloor']) {
    if (record[key] !== undefined) record[key] = Number(record[key]);
  }
  if (record.service === 'doorstep') {
    for (const key of ['pickupFloor', 'deliveryFloor', 'pickupLift', 'deliveryLift']) delete record[key];
  }
  if (record.category !== 'pallet') record.forklift = false;
  return record;
}

export function listPreviewFiles() {
  return { files: [...files.values()].map(entry => entry.metadata), maxFileSize: MAX_FILE_SIZE };
}

export async function addPreviewFile(file) {
  if (!file || !file.size) throw new Error('The file is empty. Choose another file.');
  if (file.size > MAX_FILE_SIZE) throw new Error('The file exceeds the 50 MB limit.');
  const buffer = await file.arrayBuffer();
  // Check after reading as well, so simultaneous files cannot exceed the limit.
  const used = [...files.values()].reduce((sum, entry) => sum + entry.metadata.size, 0);
  if (used + buffer.byteLength > MAX_SESSION_SIZE) throw new Error('This preview can hold up to 200 MB. Remove a file and try again.');
  const metadata = { id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type || 'application/octet-stream', createdAt: new Date().toISOString() };
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  files.set(metadata.id, { metadata, url: URL.createObjectURL(blob) });
  return metadata;
}

export function previewDownloadUrl(id) {
  return files.get(id)?.url || '';
}

export function deletePreviewFile(id) {
  const entry = files.get(id);
  if (!entry) throw new Error('This file is no longer available.');
  URL.revokeObjectURL(entry.url);
  files.delete(id);
  return { deleted: id };
}
