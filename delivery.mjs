import { mkdir, open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export class DeliveryError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function text(data, name, max, required = true) {
  const value = data[name];
  if ((!required && (value === undefined || value === ''))) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) {
    throw new DeliveryError(400, `Please provide a valid ${name.replace(/([A-Z])/g, ' $1').toLowerCase()}.`);
  }
  return value.trim();
}

function choice(data, name, values) {
  if (!values.includes(data[name])) throw new DeliveryError(400, `Please choose a valid ${name}.`);
  return data[name];
}

function number(data, name, min, max, integer = false) {
  const input = data[name];
  const value = typeof input === 'number' || (typeof input === 'string' && input.trim()) ? Number(input) : NaN;
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new DeliveryError(400, `Please provide a valid ${name.replace(/([A-Z])/g, ' $1').toLowerCase()} between ${min} and ${max}.`);
  }
  return value;
}

export function validateDelivery(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new DeliveryError(400, 'Please provide a delivery brief.');
  if (data.consent !== true) throw new DeliveryError(400, 'Your consent is required to save this demo brief.');
  const email = text(data, 'email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DeliveryError(400, 'Please provide a valid email address.');
  const pickupDate = text(data, 'pickupDate', 10);
  const date = new Date(`${pickupDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== pickupDate || pickupDate < new Date().toISOString().slice(0, 10)) {
    throw new DeliveryError(400, 'Please choose a valid pickup date, today or later.');
  }
  const category = choice(data, 'category', ['building-materials', 'furniture', 'homeware', 'electronics', 'pallet', 'other']);
  const service = choice(data, 'service', ['doorstep', 'room', 'two-person']);
  const brief = {
    itemName: text(data, 'itemName', 120),
    category,
    quantity: number(data, 'quantity', 1, 100, true),
    length: number(data, 'length', 0.1, 1000),
    width: number(data, 'width', 0.1, 1000),
    height: number(data, 'height', 0.1, 1000),
    weight: number(data, 'weight', 0.1, 10000),
    fragile: data.fragile === true,
    pickup: text(data, 'pickup', 200),
    destination: text(data, 'destination', 200),
    pickupDate,
    service,
    packaging: data.packaging === true,
    forklift: category === 'pallet' && data.forklift === true,
    notes: text(data, 'notes', 1000, false),
    contactName: text(data, 'contactName', 100),
    email,
    requesterRole: choice(data, 'requesterRole', ['buyer', 'seller', 'business']),
    consent: true,
    listingId: text(data, 'listingId', 80, false),
    plan: choice({ plan: data.plan || 'none' }, 'plan', ['none', 'logistics', 'report', 'marketplace', 'starter', 'pro', 'partner']),
    billing: choice({ billing: data.billing || 'monthly' }, 'billing', ['monthly', 'annual']),
  };
  if (service !== 'doorstep') {
    brief.pickupFloor = number(data, 'pickupFloor', 0, 99, true);
    brief.deliveryFloor = number(data, 'deliveryFloor', 0, 99, true);
    brief.pickupLift = data.pickupLift === true;
    brief.deliveryLift = data.deliveryLift === true;
  }
  return brief;
}

export async function saveDelivery(request, directory) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new DeliveryError(415, 'Please submit a JSON delivery brief.');
  const maxSize = 16 * 1024;
  if (Number(request.headers['content-length']) > maxSize) throw new DeliveryError(413, 'The delivery brief is too large.');
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxSize) throw new DeliveryError(413, 'The delivery brief is too large.');
    chunks.push(chunk);
  }
  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new DeliveryError(400, 'The delivery brief could not be read. Please try again.'); }
  const brief = validateDelivery(data);
  const id = randomUUID();
  const record = { id, reference: `S4R-${id.slice(0, 8).toUpperCase()}`, createdAt: new Date().toISOString(), status: 'demo_brief_saved', ...brief };
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temp = join(directory, `${id}.json.part`);
  try {
    const handle = await open(temp, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(record, null, 2)); }
    finally { await handle.close(); }
    await rename(temp, join(directory, `${id}.json`));
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    throw error;
  }
  return record;
}
