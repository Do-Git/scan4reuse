import { browserPreview, configurePreview, listPreviewFiles, addPreviewFile, previewDownloadUrl, deletePreviewFile } from './preview.js';

configurePreview('upload');
const $ = selector => document.querySelector(selector);
const state = { files: [], queue: [], filter: 'all', query: '', sort: 'newest', view: 'grid', maxFileSize: 50 * 1024 * 1024, loaded: false, loadFailed: false };
const input = $('#file-input');
const list = $('#file-list');
const svgNS = 'http://www.w3.org/2000/svg';
let deleteTarget = null;
let dragDepth = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name, className = '') {
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  const use = document.createElementNS(svgNS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

function bytes(value) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const order = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: order ? 1 : 0 }).format(value / 1024 ** order)} ${units[order]}`;
}

function category(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'heic', 'heif', 'bmp', 'tif', 'tiff'].includes(ext)) return 'images';
  if (file.type.startsWith('text/') || file.type === 'application/pdf' || ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'csv', 'xls', 'xlsx', 'ods', 'ppt', 'pptx', 'odp'].includes(ext)) return 'documents';
  return 'other';
}

function toast(message, error = false) {
  const node = element('div', `toast${error ? ' error' : ''}`);
  node.append(icon(error ? 'info' : 'check'), element('span', '', message));
  $('#toast-region').append(node);
  setTimeout(() => node.remove(), error ? 7500 : 4500);
}

async function api(url, options) {
  if (browserPreview) {
    if (url === '/api/files' && !options?.method) return listPreviewFiles();
    const match = url.match(/^\/api\/files\/([^/]+)$/);
    if (match && options?.method === 'DELETE') return deletePreviewFile(match[1]);
    throw new Error('Questa operazione non è disponibile nell’anteprima.');
  }
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'La richiesta non è riuscita. Riprova.');
  return data;
}

async function loadFiles() {
  $('#loading-state').hidden = false;
  $('#load-error').hidden = true;
  try {
    const data = await api('/api/files');
    state.files = data.files;
    state.maxFileSize = data.maxFileSize;
    state.loaded = true;
    state.loadFailed = false;
    $('#size-hint').textContent = `Fino a ${bytes(state.maxFileSize)} per file`;
  } catch {
    state.loadFailed = true;
  } finally {
    $('#loading-state').hidden = true;
    renderFiles();
  }
}

function renderFiles() {
  const total = state.files.length;
  $('#nav-count').textContent = total;
  $('#file-count').textContent = total;
  $('#storage-summary').textContent = `${total} file · ${bytes(state.files.reduce((sum, file) => sum + file.size, 0))} utilizzati`;
  $('#archive-status').textContent = state.loadFailed ? 'Archivio non raggiungibile' : total ? (browserPreview ? 'File in memoria in questo browser' : 'Tutti i file salvati sul server') : 'Pronto per il tuo primo file';
  $('#empty-state').hidden = state.loadFailed || !state.loaded || total > 0;
  $('#load-error').hidden = !state.loadFailed;
  const filtered = state.files.filter(file => (state.filter === 'all' || category(file) === state.filter) && file.name.toLocaleLowerCase('it').includes(state.query.toLocaleLowerCase('it')));
  filtered.sort((a, b) => state.sort === 'name' ? a.name.localeCompare(b.name, 'it') : state.sort === 'size' ? b.size - a.size : state.sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
  $('#no-results').hidden = state.loadFailed || !total || filtered.length > 0;
  list.hidden = state.loadFailed || !filtered.length;
  list.classList.toggle('file-list-layout', state.view === 'list');
  list.replaceChildren(...filtered.map(fileCard));
}

function fileCard(file) {
  const type = category(file);
  const li = element('li', 'file-card');
  li.dataset.category = type;
  const preview = element('div', 'file-preview');
  preview.setAttribute('aria-hidden', 'true');
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'FILE';
  preview.append(icon(type === 'images' ? 'image' : type === 'documents' ? 'file' : 'box'), element('span', 'file-ext', ext.slice(0, 12)));
  const details = element('div', 'file-details');
  const name = element('h3', 'file-name', file.name);
  name.title = file.name;
  const meta = element('div', 'file-meta');
  const date = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(new Date(file.createdAt));
  meta.append(element('span', '', bytes(file.size)), element('span', '', '·'), element('span', '', date));
  details.append(name, meta);
  const actions = element('div', 'file-actions');
  const download = element('a', 'icon-button');
  download.href = browserPreview ? previewDownloadUrl(file.id) : `/api/files/${file.id}/download`;
  download.setAttribute('download', file.name);
  download.setAttribute('aria-label', `Scarica ${file.name}`);
  download.title = 'Scarica file';
  download.append(icon('download'));
  const remove = element('button', 'icon-button delete-button');
  remove.type = 'button';
  remove.setAttribute('aria-label', `Elimina ${file.name}`);
  remove.title = 'Elimina file';
  remove.append(icon('trash'));
  remove.addEventListener('click', () => {
    deleteTarget = file;
    $('#delete-file-name').textContent = file.name;
    $('#delete-error').hidden = true;
    $('#confirm-delete').disabled = false;
    $('#confirm-delete').textContent = 'Elimina file';
    $('#delete-dialog').showModal();
  });
  actions.append(download, remove);
  li.append(preview, details, actions);
  return li;
}

function addFiles(files) {
  if (!files.length) return;
  for (const file of files) {
    const item = { id: crypto.randomUUID(), file, name: file.name, size: file.size, status: 'waiting', progress: 0, error: '', retryable: true };
    if (file.size > state.maxFileSize || !file.size) {
      item.status = 'error';
      item.error = file.size ? `Supera il limite di ${bytes(state.maxFileSize)} per file.` : 'Il file è vuoto. Scegli un altro file.';
      item.retryable = false;
      item.file = null;
    }
    state.queue.push(item);
  }
  renderQueue();
  pumpQueue();
}

function queueStatus(item) {
  switch (item.status) {
    case 'waiting': return `${bytes(item.size)} · In attesa…`;
    case 'uploading': return `${bytes(item.size)} · ${item.progress >= 100 ? 'Salvataggio…' : `${item.progress}% caricato`}`;
    case 'done': return `${bytes(item.size)} · Caricato`;
    case 'cancelled': return 'Caricamento annullato';
    default: return item.error;
  }
}

function renderQueue() {
  $('#queue-section').hidden = state.queue.length === 0;
  const done = state.queue.filter(item => item.status === 'done').length;
  const pending = state.queue.filter(item => ['waiting', 'uploading'].includes(item.status)).length;
  $('#queue-summary').textContent = pending ? `${done} di ${state.queue.length} completati` : done ? `${done} completati` : '';
  $('#clear-queue').hidden = !state.queue.some(item => ['done', 'cancelled', 'error'].includes(item.status));
  $('#upload-queue').replaceChildren(...state.queue.map(item => {
    const li = element('li', 'queue-item');
    li.dataset.status = item.status;
    const fileIcon = element('span', 'queue-file-icon');
    fileIcon.append(icon(item.status === 'done' ? 'check' : 'file'));
    const info = element('div', 'queue-item-info');
    const name = element('span', 'queue-file-name', item.name);
    name.title = item.name;
    const status = element('span', 'queue-item-status', queueStatus(item));
    info.append(name, status);
    item.statusNode = status;
    if (['waiting', 'uploading'].includes(item.status)) {
      const progress = element('progress', 'queue-progress');
      progress.max = 100;
      progress.value = item.progress;
      progress.setAttribute('aria-label', `Avanzamento ${item.name}`);
      info.append(progress);
      item.progressNode = progress;
    }
    li.append(fileIcon, info);
    if (['waiting', 'uploading'].includes(item.status)) {
      const cancel = element('button', 'icon-button queue-action');
      cancel.type = 'button';
      cancel.setAttribute('aria-label', `Annulla caricamento di ${item.name}`);
      cancel.title = 'Annulla caricamento';
      cancel.append(icon('close'));
      cancel.addEventListener('click', () => {
        if (item.xhr) item.xhr.abort();
        else { item.status = 'cancelled'; item.file = null; renderQueue(); pumpQueue(); }
      });
      li.append(cancel);
    } else if (item.status === 'error' && item.retryable) {
      const retry = element('button', 'text-button queue-action', 'Riprova');
      retry.type = 'button';
      retry.setAttribute('aria-label', `Riprova caricamento di ${item.name}`);
      retry.addEventListener('click', () => { item.status = 'waiting'; item.progress = 0; renderQueue(); pumpQueue(); });
      li.append(retry);
    } else if (item.status === 'done') li.append(icon('check', 'queue-done'));
    return li;
  }));
}

function pumpQueue() {
  const active = state.queue.filter(item => item.status === 'uploading').length;
  for (const item of state.queue.filter(item => item.status === 'waiting').slice(0, Math.max(0, 2 - active))) upload(item);
}

function upload(item) {
  item.status = 'uploading';
  renderQueue();
  if (browserPreview) {
    addPreviewFile(item.file).then(file => {
      if (item.status !== 'uploading') { deletePreviewFile(file.id); return; }
      finishUpload(item, 'done', '', file);
    }).catch(error => finishUpload(item, 'error', error.message));
    return;
  }
  const xhr = new XMLHttpRequest();
  item.xhr = xhr;
  xhr.open('POST', '/api/files');
  xhr.timeout = 300_000;
  xhr.setRequestHeader('Content-Type', 'application/octet-stream');
  xhr.setRequestHeader('X-File-Name', encodeURIComponent(item.name));
  xhr.setRequestHeader('X-File-Type', item.file.type || 'application/octet-stream');
  xhr.upload.addEventListener('progress', event => {
    if (event.lengthComputable) {
      item.progress = Math.round(event.loaded / event.total * 100);
      if (item.progressNode) item.progressNode.value = item.progress;
      if (item.statusNode) item.statusNode.textContent = queueStatus(item);
    }
  });
  const finish = (status, error = '', file) => finishUpload(item, status, error, file);
  xhr.addEventListener('load', () => {
    let data;
    try { data = JSON.parse(xhr.responseText); }
    catch { return finish('error', 'Risposta del server non valida. Riprova.'); }
    if (xhr.status === 201 && data.file) finish('done', '', data.file);
    else finish('error', data.error || 'Il caricamento non è riuscito. Riprova.');
  });
  xhr.addEventListener('error', () => finish('error', 'Connessione interrotta. Controlla la rete e riprova.'));
  xhr.addEventListener('timeout', () => finish('error', 'Il server impiega troppo tempo. Riprova.'));
  xhr.addEventListener('abort', () => finish('cancelled'));
  xhr.send(item.file);
}

function finishUpload(item, status, error = '', file) {
    if (item.status !== 'uploading') return;
    item.status = status;
    item.error = error;
    item.xhr = null;
    if (status === 'done') {
      item.file = null;
      state.files = [file, ...state.files.filter(existing => existing.id !== file.id)];
      state.loaded = true;
      state.loadFailed = false;
      $('#loading-state').hidden = true;
      renderFiles();
      toast(browserPreview ? `“${file.name}” è pronto in questa anteprima.` : `“${file.name}” è nel tuo archivio.`);
    } else if (status === 'cancelled') { item.file = null; loadFiles(); }
    renderQueue();
    pumpQueue();
}

for (const id of ['top-upload', 'sidebar-upload', 'browse-files', 'empty-upload']) {
  $(`#${id}`).addEventListener('click', () => input.click());
}
input.addEventListener('change', () => { addFiles([...input.files]); input.value = ''; });
$('#clear-queue').addEventListener('click', () => {
  state.queue = state.queue.filter(item => ['waiting', 'uploading'].includes(item.status));
  renderQueue();
});

document.addEventListener('dragover', event => {
  if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
});
document.addEventListener('drop', event => {
  if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  dragDepth = 0;
  $('#drop-zone').classList.remove('dragover');
});
const dropZone = $('#drop-zone');
dropZone.addEventListener('dragenter', event => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  dragDepth++;
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', event => {
  event.preventDefault();
  addFiles([...event.dataTransfer.files]);
});

function setFilter(filter) {
  state.filter = filter;
  for (const tab of document.querySelectorAll('[data-filter]')) {
    tab.classList.toggle('selected', tab.dataset.filter === filter);
    tab.setAttribute('aria-pressed', String(tab.dataset.filter === filter));
  }
  renderFiles();
}
for (const tab of document.querySelectorAll('[data-filter]')) tab.addEventListener('click', () => setFilter(tab.dataset.filter));
$('#search').addEventListener('input', event => { state.query = event.target.value.trim(); renderFiles(); });
$('#sort').addEventListener('change', event => { state.sort = event.target.value; renderFiles(); });
for (const view of ['grid', 'list']) $(`#${view}-view`).addEventListener('click', () => {
  state.view = view;
  for (const name of ['grid', 'list']) {
    $(`#${name}-view`).classList.toggle('selected', view === name);
    $(`#${name}-view`).setAttribute('aria-pressed', String(view === name));
  }
  renderFiles();
});
$('#reset-filters').addEventListener('click', () => { state.query = ''; $('#search').value = ''; setFilter('all'); });
$('#retry-load').addEventListener('click', loadFiles);
document.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
    event.preventDefault(); $('#search').focus();
  }
});

$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
for (const button of document.querySelectorAll('[data-close-dialog]')) button.addEventListener('click', () => button.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
}
$('#confirm-delete').addEventListener('click', async () => {
  if (!deleteTarget) return;
  const file = deleteTarget;
  $('#confirm-delete').disabled = true;
  $('#confirm-delete').textContent = 'Eliminazione…';
  $('#delete-error').hidden = true;
  try {
    await api(`/api/files/${file.id}`, { method: 'DELETE' });
    state.files = state.files.filter(item => item.id !== file.id);
    $('#delete-dialog').close();
    renderFiles();
    toast('File eliminato. Spazio a nuove idee.');
    deleteTarget = null;
  } catch (error) {
    $('#delete-error').textContent = error.message;
    $('#delete-error').hidden = false;
  } finally {
    $('#confirm-delete').disabled = false;
    $('#confirm-delete').textContent = 'Elimina file';
  }
});

window.addEventListener('beforeunload', event => {
  if (state.queue.some(item => ['waiting', 'uploading'].includes(item.status))) { event.preventDefault(); event.returnValue = ''; }
});
loadFiles();
