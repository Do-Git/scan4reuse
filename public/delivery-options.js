export const serviceNames = { doorstep: 'Kerbside / doorstep', room: 'Room-of-choice placement', 'two-person': 'Two-person handling' };
export const equipmentNames = { standard: 'Standard loading', 'tail-lift': 'Tail lift', forklift: 'Forklift', crane: 'Crane / specialist lifting', survey: 'Partner to assess equipment' };

export function partnerTransactionAmounts(totalCents) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new Error('Please provide a valid delivery transaction value in cents.');
  const feeCents = Math.round(totalCents * 0.08);
  return { feeCents, partnerAmountCents: totalCents - feeCents };
}

export function today() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function text(value, label, max, required = false) {
  if (!required && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error(`Please provide a valid ${label} (up to ${max} characters).`);
  return value.trim();
}

function choice(value, values, fallback, label) {
  if (value === undefined || value === '') return fallback;
  if (!values.includes(value)) throw new Error(`Please choose a valid ${label}.`);
  return value;
}

function date(value, label, minimum = '', required = false) {
  if (!required && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Please choose a valid ${label}.`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || (minimum && value < minimum)) throw new Error(`Please choose a valid ${label}${minimum ? ` on or after ${minimum}` : ''}.`);
  return value;
}

function cents(value, label) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d{1,7}(?:\.\d{1,2})?$/.test(String(value))) throw new Error(`Please enter a valid ${label} with at most two decimal places.`);
  return Math.round(Number(value) * 100);
}

export function readDeliveryOptions(data) {
  const result = {
    handlingUnit: choice(data.handlingUnit, ['loose', 'pallet', 'crate'], data.category === 'pallet' ? 'pallet' : 'loose', 'handling unit'),
    readiness: choice(data.readiness, ['ready', 'dismantling', 'confirm'], 'confirm', 'collection readiness'),
    equipment: choice(data.equipment, Object.keys(equipmentNames), 'standard', 'unloading equipment'),
    scheduleFlexibility: choice(data.scheduleFlexibility, ['fixed', 'flexible'], 'flexible', 'schedule flexibility'),
    deliveryDate: date(data.deliveryDate, 'delivery date', data.pickupDate),
    declaredValue: data.declaredValue === undefined || data.declaredValue === '' || data.declaredValue === null ? null : cents(data.declaredValue, 'declared goods value') / 100,
  };
  for (const [key, label, max] of [
    ['pickupWindow', 'pickup time window', 80], ['deliveryWindow', 'delivery time window', 80],
    ['pickupAccess', 'pickup access instructions', 400], ['deliveryAccess', 'delivery access instructions', 400],
    ['accessMeasurements', 'door and lift measurements', 300], ['placement', 'final placement', 150],
    ['siteReference', 'site contact or booking reference', 150],
  ]) result[key] = text(data[key], label, max);
  for (const key of ['assembly', 'storage', 'packagingRemoval', 'siteProtection', 'conditionRecord', 'insuranceQuote']) result[key] = data[key] === true;
  return result;
}

export function describeDeliveryOptions(data) {
  const parts = [];
  const unit = { loose: 'Loose / individually wrapped', pallet: 'Palletised', crate: 'Crated' }[data.handlingUnit];
  if (unit) parts.push(`Load format: ${unit}`);
  if (data.readiness) parts.push(`Collection readiness: ${{ ready: 'Ready for collection', dismantling: 'Dismantling assistance requested', confirm: 'To be confirmed with the partner' }[data.readiness]}`);
  if (data.declaredValue !== null && data.declaredValue !== undefined && data.declaredValue !== '') parts.push(`Declared goods value: CHF ${Number(data.declaredValue).toFixed(2)}; cover to be agreed`);
  if (data.deliveryDate) parts.push(`Requested delivery date: ${data.deliveryDate}`);
  if (data.pickupWindow) parts.push(`Pickup window: ${data.pickupWindow}`);
  if (data.deliveryWindow) parts.push(`Delivery window: ${data.deliveryWindow}`);
  if (data.scheduleFlexibility) parts.push(`Schedule: ${data.scheduleFlexibility === 'fixed' ? 'Fixed dates / access slots' : 'Alternatives can be proposed'}`);
  if (data.equipment && data.equipment !== 'standard') parts.push(`Equipment to quote: ${equipmentNames[data.equipment]}`);
  for (const [key, label] of [['pickupAccess', 'Pickup access'], ['deliveryAccess', 'Delivery access'], ['accessMeasurements', 'Door / lift clearances'], ['placement', 'Final placement'], ['siteReference', 'Site contact / access reference']]) {
    if (data[key]) parts.push(`${label}: ${data[key]}`);
  }
  const extras = [['assembly', 'Assembly'], ['storage', 'Temporary storage / staged release'], ['packagingRemoval', 'Unpacking / packaging removal'], ['siteProtection', 'Floor / wall protection'], ['conditionRecord', 'Condition photos and signed handover'], ['insuranceQuote', 'Insurance / cover clarification']].filter(([key]) => data[key]).map(([, label]) => label);
  if (extras.length) parts.push(`Additional services requested: ${extras.join(' · ')}`);
  return parts;
}

export function validatePartnerQuote(data, request, currentDay = today()) {
  if (data.requirementsReviewed !== true) throw new Error('Please confirm you reviewed the delivery requirements.');
  const mode = choice(data.mode, ['as-requested', 'adjusted'], '', 'quote type');
  if (!mode) throw new Error('Please choose a quote type.');
  const transportCents = cents(data.transport, 'transport price');
  const handlingCents = cents(data.handling, 'handling price');
  const extrasCents = cents(data.extras, 'additional services price');
  const totalCents = transportCents + handlingCents + extrasCents;
  if (totalCents <= 0) throw new Error('Please enter a quote total greater than zero.');
  const adjusted = mode === 'adjusted';
  const pickupDate = date(adjusted ? data.proposedPickupDate || request.pickupDate : request.pickupDate, 'proposed pickup date', currentDay, true);
  const deliveryDate = adjusted ? date(data.proposedDeliveryDate || request.deliveryDate, 'proposed delivery date', pickupDate) : request.deliveryDate || '';
  return {
    requestId: request.id, partnerName: text(data.partnerName, 'partner name', 120, true), mode,
    transportCents, handlingCents, extrasCents, totalCents,
    taxBasis: choice(data.taxBasis, ['included', 'excluded', 'confirm'], 'confirm', 'VAT basis'),
    validUntil: date(data.validUntil, 'quote expiry date', currentDay, true), pickupDate, deliveryDate,
    service: adjusted ? choice(data.proposedService, Object.keys(serviceNames), request.service, 'proposed delivery service') : request.service,
    deliveryWindow: adjusted ? text(data.proposedWindow, 'proposed delivery window', 80) || request.deliveryWindow || '' : request.deliveryWindow || '',
    changes: adjusted ? text(data.changes, 'proposed changes and reason', 1000, true) : '',
    scope: text(data.scope, 'included services and conditions', 1200, true),
    crewEquipment: text(data.crewEquipment, 'crew and equipment', 200),
  };
}

export class DeliveryExchange {
  constructor() { this.clear(); }
  clear() { this.request = null; this.proposal = null; this.stage = 'empty'; this.revisionReason = ''; }
  setRequest(request) {
    if (!request?.id || !request.pickupDate || !serviceNames[request.service]) throw new Error('Please prepare a delivery request first.');
    date(request.pickupDate, 'pickup date', '', true);
    this.request = structuredClone(request);
    this.proposal = null;
    this.stage = 'open';
    this.revisionReason = '';
  }
  take() {
    if (this.stage !== 'open') throw new Error('This request is already under review.');
    this.stage = 'reviewing';
  }
  propose(data, currentDay = today()) {
    if (!['reviewing', 'revision'].includes(this.stage)) throw new Error('Accept the request for review before quoting.');
    const proposal = validatePartnerQuote(data, this.request, currentDay);
    this.proposal = { ...proposal, id: crypto.randomUUID() };
    this.stage = 'quoted';
    this.revisionReason = '';
    return this.proposal;
  }
  revise(reason) {
    if (this.stage !== 'quoted') throw new Error('There is no current quote to revise.');
    this.revisionReason = text(reason, 'revision request', 600, true);
    this.proposal = null;
    this.stage = 'revision';
  }
  accept(proposalId, currentDay = today()) {
    if (this.stage !== 'quoted' || this.proposal?.id !== proposalId || this.proposal.requestId !== this.request.id) throw new Error('This quote is no longer current. Please review the latest proposal.');
    if (this.proposal.validUntil < currentDay) throw new Error('This quote has expired. Ask the partner for an updated proposal.');
    this.stage = 'agreed';
  }
}
