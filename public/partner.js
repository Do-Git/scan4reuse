import { DeliveryExchange, readDeliveryOptions, serviceNames, today } from './delivery-options.js';
import { downloadPartnerProposalPdf } from './pdf-report.js';

const money = amount => new Intl.NumberFormat('en-CH', { style: 'currency', currency: 'CHF' }).format(amount);
const afterDays = days => {
  const date = new Date(`${today()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function exampleDeliveryRequest() {
  const request = {
    id: crypto.randomUUID(), reference: 'S4R-EXAMPLE-BASEL-ZURICH', createdAt: new Date().toISOString(), status: 'example_request',
    itemName: 'Reclaimed window frame', category: 'building-materials', quantity: 1, length: 12, width: 100, height: 140, weight: 18,
    fragile: true, pickup: 'Basel, Switzerland', destination: 'Zürich, Switzerland', pickupDate: afterDays(7), deliveryDate: afterDays(8),
    service: 'two-person', pickupFloor: 0, deliveryFloor: 2, pickupLift: false, deliveryLift: true, packaging: true, forklift: false,
    handlingUnit: 'loose', readiness: 'ready', scheduleFlexibility: 'fixed', pickupWindow: '09:00–11:00', deliveryWindow: '17:00–19:00',
    pickupAccess: 'Basel materials depot: use the loading bay and call the site contact before arriving.', deliveryAccess: 'Occupied office in Zürich: reserve the freight lift and protect the access route.',
    accessMeasurements: 'Freight lift: 140 × 220 × 210 cm; 1,000 kg capacity.', placement: 'Second-floor meeting room',
    equipment: 'tail-lift', declaredValue: 120, siteReference: 'Example Zürich facility team · receiving bay B', siteProtection: true, conditionRecord: true, packagingRemoval: true,
    notes: 'Protect the frame and glazing. The site contact signs the handover after checking condition.',
    contactName: 'Example Zürich facility team', email: 'facility@example.com', requesterRole: 'facility-manager', consent: true, plan: 'logistics', listingId: 'example-basel-zurich-window',
  };
  return { ...request, ...readDeliveryOptions(request) };
}

function element(tag, text, className = '') {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}

function quoteSummary(quote, request) {
  const container = element('div', undefined, 'proposal-summary');
  container.append(element('h4', quote.partnerName), element('p', quote.mode === 'adjusted' ? 'Adjusted delivery proposed — review the changes below.' : 'Quoted to the requested delivery requirements.'));
  if (quote.mode === 'adjusted') {
    const changes = element('div', undefined, 'proposal-changes');
    changes.append(element('strong', 'Requested → proposed'));
    for (const [label, original, proposed] of [
      ['Pickup date', request.pickupDate, quote.pickupDate], ['Delivery date', request.deliveryDate || 'To agree', quote.deliveryDate || 'To agree'],
      ['Service', serviceNames[request.service], serviceNames[quote.service]], ['Delivery window', request.deliveryWindow || 'To agree', quote.deliveryWindow || 'To agree'],
    ]) if (original !== proposed) changes.append(element('p', `${label}: ${original} → ${proposed}`));
    changes.append(element('p', quote.changes));
    container.append(changes);
  }
  const prices = element('dl', undefined, 'proposal-prices');
  for (const [label, amount] of [['Transport', quote.transportCents], ['Handling', quote.handlingCents], ['Added services', quote.extrasCents], ['Total', quote.totalCents]]) {
    prices.append(element('dt', label), element('dd', money(amount / 100)));
  }
  container.append(prices);
  container.append(element('p', `VAT: ${{ included: 'included', excluded: 'excluded', confirm: 'to be confirmed' }[quote.taxBasis]}. Quote valid until ${quote.validUntil}.`));
  if (quote.crewEquipment) container.append(element('p', `Crew and equipment: ${quote.crewEquipment}`));
  container.append(element('strong', 'Included services and conditions'), element('p', quote.scope, 'proposal-scope'));
  return container;
}

export function createPartnerWorkspace({ describeBrief, onExample }) {
  const $ = selector => document.querySelector(selector);
  const form = $('#partner-quote-form');
  const exchange = new DeliveryExchange();
  const tabs = [...document.querySelectorAll('[data-delivery-side]')];
  const statusNames = { open: 'Open request', reviewing: 'Partner reviewing', quoted: 'Quote awaiting review', revision: 'Revision requested', agreed: 'Agreed in this example' };

  function showSide(side, focus = false) {
    for (const tab of tabs) {
      const selected = tab.dataset.deliverySide === side;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $(`#${tab.getAttribute('aria-controls')}`).hidden = !selected;
      if (selected && focus) tab.focus({ preventScroll: true });
    }
    if (focus) $('#delivery').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetQuoteForm() {
    form.reset();
    form.elements.validUntil.min = today();
    form.elements.validUntil.value = afterDays(7);
    form.elements.proposedPickupDate.min = today();
    form.elements.proposedPickupDate.value = exchange.request.pickupDate;
    form.elements.proposedDeliveryDate.min = exchange.request.pickupDate;
    form.elements.proposedDeliveryDate.value = exchange.request.deliveryDate || '';
    form.elements.proposedService.value = exchange.request.service;
    form.elements.proposedWindow.value = exchange.request.deliveryWindow || '';
    $('#quote-total').textContent = '—';
    $('#quote-adjustments').hidden = true;
    $('#quote-adjustments').disabled = true;
    $('#partner-quote-error').hidden = true;
    $('#revision-reason').value = '';
  }

  function render() {
    const { request, stage, proposal, revisionReason } = exchange;
    $('#partner-empty').hidden = Boolean(request);
    $('#partner-request').hidden = !request;
    $('#client-response').hidden = !request;
    $('#client-exchange-error').hidden = true;
    if (!request) {
      $('#client-proposal-summary').replaceChildren();
      $('#client-quote-actions').hidden = true;
      $('#download-quote').hidden = true;
      return;
    }
    $('#partner-status').textContent = statusNames[stage];
    const summary = $('#partner-request-summary');
    summary.replaceChildren(element('strong', request.reference), ...describeBrief(request).map(line => element('div', line)));
    $('#take-request').hidden = stage !== 'open';
    form.hidden = !['reviewing', 'revision'].includes(stage);
    $('#partner-revision').hidden = !revisionReason;
    $('#partner-revision').textContent = revisionReason ? `Client requests: ${revisionReason}` : '';
    $('#partner-submitted').hidden = !['quoted', 'agreed'].includes(stage);
    $('#partner-submitted h3').textContent = stage === 'agreed' ? 'Scope and price agreed.' : 'Proposal ready for client review.';
    $('#partner-proposal-status').textContent = stage === 'agreed' ? 'The client has accepted the scope and price in this example.' : 'The client can accept the proposal or ask for a revision.';
    $('#client-exchange-status').textContent = {
      open: 'Your requirements are ready. Continue in partner view to review and quote this request.',
      reviewing: 'The partner is reviewing your delivery requirements and preparing a proposal.',
      quoted: 'Review the price, scope and any proposed changes before accepting.',
      revision: 'Your feedback has returned to the partner. A revised proposal is needed before agreement.',
      agreed: 'You accepted the partner’s scope and price in this example.',
    }[stage];
    $('#client-proposal-summary').replaceChildren(...(proposal ? [quoteSummary(proposal, request)] : []));
    $('#client-quote-actions').hidden = stage !== 'quoted';
    $('#client-agreement-note').hidden = stage !== 'agreed';
    $('#download-quote').hidden = !proposal;
    $('#accept-quote').dataset.proposalId = proposal?.id || '';
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => showSide(tab.dataset.deliverySide));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      showSide(tabs[index].dataset.deliverySide);
      tabs[index].focus();
    });
  }
  document.querySelectorAll('[data-partner-view]').forEach(button => button.addEventListener('click', () => showSide('partner', true)));
  document.querySelectorAll('[data-client-view]').forEach(button => button.addEventListener('click', () => showSide('client', true)));
  document.querySelectorAll('a[href="#delivery"], a[href="/#delivery"]').forEach(link => link.addEventListener('click', () => showSide('client')));
  $('#view-partner-request').addEventListener('click', () => showSide('partner', true));
  $('#view-client-proposal').addEventListener('click', () => showSide('client', true));
  $('#load-example-request').addEventListener('click', () => { onExample(exampleDeliveryRequest()); showSide('partner', true); });
  $('#take-request').addEventListener('click', () => { exchange.take(); render(); form.elements.partnerName.focus({ preventScroll: true }); });
  $('#quote-mode').addEventListener('change', () => {
    const adjusted = form.elements.mode.value === 'adjusted';
    $('#quote-adjustments').hidden = !adjusted;
    $('#quote-adjustments').disabled = !adjusted;
  });
  form.elements.proposedPickupDate.addEventListener('change', () => { form.elements.proposedDeliveryDate.min = form.elements.proposedPickupDate.value || today(); });
  for (const name of ['transport', 'handling', 'extras']) form.elements.namedItem(name).addEventListener('input', () => {
    const fields = ['transport', 'handling', 'extras'].map(key => form.elements.namedItem(key));
    const valid = fields.every(field => field.value !== '' && field.checkValidity());
    $('#quote-total').textContent = valid ? money(fields.reduce((sum, field) => sum + Math.round(Number(field.value) * 100), 0) / 100) : '—';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = {};
    for (const field of form.elements) if (field.name && !field.disabled) values[field.name] = field.type === 'checkbox' ? field.checked : field.value;
    try {
      exchange.propose(values);
      $('#partner-quote-error').hidden = true;
      render();
      showSide('client', true);
    } catch (error) {
      $('#partner-quote-error').textContent = error.message;
      $('#partner-quote-error').hidden = false;
    }
  });
  $('#request-revision').addEventListener('click', () => {
    try {
      exchange.revise($('#revision-reason').value);
      form.elements.requirementsReviewed.checked = false;
      $('#revision-reason').value = '';
      render();
      showSide('partner', true);
    } catch (error) {
      $('#client-exchange-error').textContent = error.message;
      $('#client-exchange-error').hidden = false;
    }
  });
  $('#accept-quote').addEventListener('click', () => {
    try { exchange.accept($('#accept-quote').dataset.proposalId); render(); }
    catch (error) { $('#client-exchange-error').textContent = error.message; $('#client-exchange-error').hidden = false; }
  });
  $('#download-quote').addEventListener('click', async () => {
    if (!exchange.proposal) return;
    const { request, proposal: quote, stage } = exchange;
    const button = $('#download-quote');
    const label = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Preparing PDF…';
    $('#client-exchange-error').hidden = true;
    try { await downloadPartnerProposalPdf(request, quote, stage); }
    catch {
      $('#client-exchange-error').textContent = 'We couldn’t prepare the proposal PDF. Please try again.';
      $('#client-exchange-error').hidden = false;
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = label;
    }
  });
  render();
  if (new URLSearchParams(location.search).get('side') === 'partner') showSide('partner');
  return {
    setRequest(request) { exchange.setRequest(request); resetQuoteForm(); render(); },
    clear() { exchange.clear(); render(); },
    showSide,
  };
}
