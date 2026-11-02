import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryExchange, describeDimensions, estimateDelivery, partnerTransactionAmounts, readDeliveryOptions, readDimensions, validatePartnerQuote } from '../public/delivery-options.js';
import { deliveryBriefSections, partnerProposalSections } from '../public/pdf-report.js';

const request = { id: 'request-one', pickupDate: '2099-11-10', deliveryDate: '2099-11-11', service: 'room', deliveryWindow: '17:00–19:00', pickupAccess: 'Bay B' };
const currentDay = '2099-11-01';
const quote = { partnerName: 'Example logistics partner', mode: 'as-requested', transport: '180.10', handling: '50.20', extras: '20', taxBasis: 'included', validUntil: '2099-11-09', requirementsReviewed: true, scope: 'Two-person handling, protection and final placement.' };

test('optional measurements are explicit in summaries and PDF reports', () => {
  const empty = readDimensions({ length: '', width: null });
  assert.deepEqual(empty, { length: null, width: null, height: null });
  assert.equal(describeDimensions(empty), 'Not provided; partner to assess');
  assert.equal(describeDimensions(readDimensions({ length: '12', width: 100, height: '140' })), '12 × 100 × 140 cm');
  assert.match(describeDimensions(readDimensions({ width: '90' })), /Width: 90 cm; other measurements not provided/);
  for (const length of [0, -1, 1001, Infinity, 'NaN', ' ', {}]) assert.throws(() => readDimensions({ length }));
  const sections = deliveryBriefSections({ ...request, ...empty, weight: 18, quantity: 1 });
  const dimensions = sections.find(section => section.title === 'Your item').rows.find(([label]) => label === 'Dimensions per item')[1];
  assert.equal(dimensions, 'Not provided; partner to assess');
  const estimate = sections.find(section => section.title === 'Mock planning estimate');
  assert.match(estimate.rows.find(([label]) => label === 'Status')[1], /not a partner quote/);
  assert(estimate.rows.some(([label]) => label === 'TODO'));
});

test('planning estimates are explicitly mock ranges and reflect requested handling', () => {
  const basic = estimateDelivery({ quantity: 1, weight: 18, service: 'doorstep' });
  const handling = estimateDelivery({ quantity: 1, weight: 18, service: 'two-person', packaging: true });
  assert(Number.isFinite(basic.low) && basic.low > 0 && basic.high > basic.low);
  assert(handling.low > basic.low);
  assert.match(basic.label, /Mock.*not a partner quote/);
  assert.match(basic.timeline, /working days after agreement/);
});

test('the 8% partner transaction fee rounds to cents and leaves the client quote total unchanged', () => {
  for (const [totalCents, feeCents, partnerAmountCents] of [[0, 0, 0], [1, 0, 1], [6, 0, 6], [7, 1, 6], [30, 2, 28], [100000, 8000, 92000], [25030, 2002, 23028], [2999999997, 240000000, 2759999997]]) {
    assert.deepEqual(partnerTransactionAmounts(totalCents), { feeCents, partnerAmountCents });
    assert.equal(feeCents + partnerAmountCents, totalCents);
  }
  for (const invalid of [-1, 1.5, NaN, Infinity, '1000', null]) assert.throws(() => partnerTransactionAmounts(invalid));
  const proposal = validatePartnerQuote({ ...quote, transport: '800', handling: '150', extras: '50' }, request, currentDay);
  assert.equal(proposal.totalCents, 100000);
  const sections = partnerProposalSections(request, proposal, 'quoted');
  const price = sections.find(section => section.title === 'Itemised price');
  const fee = sections.find(section => section.title === 'Logistics partner transaction fee');
  assert.match(price.rows.find(([label]) => label === 'Total')[1], /1[’',\s]?000\.00/);
  assert.match(fee.rows.find(([label]) => label === 'Scan4Reuse fee · 8%')[1], /80\.00/);
  assert.match(fee.rows.find(([label]) => label === 'Partner amount after fee')[1], /920\.00/);
  assert.match(fee.rows.find(([label]) => label === 'Fee paid by')[1], /logistics partner/);
});

test('professional delivery options retain access and handling instructions and reject malformed requests', () => {
  const options = readDeliveryOptions({ ...request, handlingUnit: 'crate', readiness: 'dismantling', declaredValue: '2500.50', pickupAccess: '  Bay B  ', deliveryAccess: 'Reserved lift', accessMeasurements: 'Lift 140 × 220 × 210 cm', placement: 'Room 204', siteReference: 'Gate booking ABC', equipment: 'tail-lift', assembly: true, insuranceQuote: true, status: 'booked' });
  assert.equal(options.pickupAccess, 'Bay B');
  assert.equal(options.declaredValue, 2500.5);
  assert.equal(options.insuranceQuote, true);
  assert.equal(options.status, undefined);
  for (const invalid of [{ deliveryDate: '2099-11-09' }, { deliveryDate: '2099-02-31' }, { handlingUnit: 'unknown' }, { equipment: 'teleport' }, { readiness: 'unknown' }, { pickupAccess: 123 }, { placement: 'x'.repeat(151) }, { declaredValue: '-1' }, { declaredValue: '1.001' }]) {
    assert.throws(() => readDeliveryOptions({ ...request, ...invalid }), JSON.stringify(invalid));
  }
});

test('the delivery fee follows the accepted adjusted price independently of the item value', () => {
  const exchange = new DeliveryExchange();
  exchange.setRequest({ ...request, declaredValue: 120 });
  exchange.take();
  const original = exchange.propose({ ...quote, transport: '800', handling: '150', extras: '50' }, currentDay);
  assert.deepEqual(partnerTransactionAmounts(original.totalCents), { feeCents: 8000, partnerAmountCents: 92000 });
  exchange.revise('Adjust the handling price and include packaging removal.');
  const adjusted = exchange.propose({ ...quote, mode: 'adjusted', transport: '650', handling: '100', extras: '50', changes: 'Updated handling and transport price with packaging removal.' }, currentDay);
  exchange.accept(adjusted.id, currentDay);
  assert.equal(adjusted.totalCents, 80000);
  assert.deepEqual(partnerTransactionAmounts(adjusted.totalCents), { feeCents: 6400, partnerAmountCents: 73600 });
  assert.equal(exchange.request.declaredValue, 120);
  const rows = partnerProposalSections(exchange.request, adjusted, exchange.stage).find(section => section.title === 'Logistics partner transaction fee').rows;
  assert.match(rows.find(([label]) => label === 'Fee basis')[1], /after any client-approved adjustments/);
  assert.match(rows.find(([label]) => label === 'Scan4Reuse fee · 8%')[1], /64\.00/);
  assert.match(rows.find(([label]) => label === 'Separate item-sale fee')[1], /sold item transaction value/);
});

test('a partner must take a request for review before quoting and cannot silently change an as-requested quote', () => {
  const exchange = new DeliveryExchange();
  exchange.setRequest(request);
  assert.throws(() => exchange.propose(quote, currentDay), /Accept the request/);
  exchange.take();
  const result = exchange.propose({ ...quote, proposedService: 'doorstep', proposedPickupDate: '2099-11-15', proposedWindow: '08:00–09:00' }, currentDay);
  assert.equal(result.service, request.service);
  assert.equal(result.pickupDate, request.pickupDate);
  assert.equal(result.deliveryWindow, request.deliveryWindow);
  assert.equal(result.totalCents, 25030);
  assert.equal(exchange.stage, 'quoted');
  assert.equal(exchange.request.pickupAccess, 'Bay B');
  assert.throws(() => exchange.accept('another-proposal', currentDay), /no longer current/);
  exchange.accept(result.id, currentDay);
  assert.equal(exchange.stage, 'agreed');
  assert.throws(() => exchange.propose(quote, currentDay));
});

test('adjusted proposals show a different scope without changing the original client request', () => {
  const exchange = new DeliveryExchange();
  const original = structuredClone(request);
  exchange.setRequest(original);
  original.service = 'doorstep';
  exchange.take();
  assert.throws(() => exchange.propose({ ...quote, mode: 'adjusted', changes: '' }, currentDay), /changes/);
  const result = exchange.propose({ ...quote, mode: 'adjusted', proposedPickupDate: '2099-11-12', proposedDeliveryDate: '2099-11-13', proposedService: 'two-person', proposedWindow: '09:00–11:00', changes: 'Move to an available freight-lift slot with a two-person crew.' }, currentDay);
  assert.equal(result.pickupDate, '2099-11-12');
  assert.equal(result.service, 'two-person');
  assert.equal(exchange.request.service, 'room');
  assert.equal(exchange.request.pickupDate, '2099-11-10');
  assert.equal(exchange.stage, 'quoted');
});

test('client feedback invalidates the previous offer and requires a fresh proposal before acceptance', () => {
  const exchange = new DeliveryExchange();
  exchange.setRequest(request); exchange.take();
  const first = exchange.propose(quote, currentDay);
  assert.throws(() => exchange.revise('  '), /revision request/);
  exchange.revise('Include unpacking and packaging removal.');
  assert.equal(exchange.stage, 'revision');
  assert.equal(exchange.proposal, null);
  assert.throws(() => exchange.accept(first.id, currentDay));
  const revised = exchange.propose({ ...quote, extras: '40', scope: 'Two-person handling, unpacking and packaging removal.' }, currentDay);
  assert.notEqual(revised.id, first.id);
  assert.throws(() => exchange.accept(first.id, currentDay));
  exchange.accept(revised.id, currentDay);
  assert.equal(exchange.stage, 'agreed');
});

test('editing a client request resets review, quote and agreement state', () => {
  const exchange = new DeliveryExchange();
  exchange.setRequest(request); exchange.take();
  const first = exchange.propose(quote, currentDay);
  exchange.accept(first.id, currentDay);
  exchange.setRequest({ ...request, id: 'request-two', pickupAccess: 'Different gate' });
  assert.equal(exchange.stage, 'open');
  assert.equal(exchange.proposal, null);
  assert.throws(() => exchange.accept(first.id, currentDay));
  exchange.clear();
  assert.equal(exchange.stage, 'empty');
  assert.equal(exchange.request, null);
});

test('quotes reject invalid money, missing consent, impossible dates and expired offers', () => {
  for (const invalid of [{ transport: '-1' }, { transport: 'NaN' }, { transport: '1.001' }, { transport: '0', handling: '0', extras: '0' }, { requirementsReviewed: false }, { validUntil: '2099-10-31' }, { validUntil: '2099-02-31' }, { mode: 'adjusted', proposedPickupDate: '2099-11-14', proposedDeliveryDate: '2099-11-13', changes: 'Reschedule.' }]) {
    assert.throws(() => validatePartnerQuote({ ...quote, ...invalid }, request, currentDay), JSON.stringify(invalid));
  }
  const exact = validatePartnerQuote({ ...quote, transport: '0.10', handling: '0.20', extras: '0' }, request, currentDay);
  assert.equal(exact.totalCents, 30);
  const exchange = new DeliveryExchange(); exchange.setRequest(request); exchange.take();
  const offer = exchange.propose(quote, currentDay);
  assert.throws(() => exchange.accept(offer.id, '2099-11-10'), /expired/);
  assert.throws(() => validatePartnerQuote(quote, { ...request, pickupDate: '2099-10-31' }, currentDay), /pickup date/);
});
