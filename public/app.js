import { browserPreview, configurePreview, preparePreviewBrief } from './preview.js';
import { describeDeliveryOptions, readDeliveryOptions } from './delivery-options.js';
import { createPartnerWorkspace, exampleDeliveryRequest } from './partner.js';
import { downloadDeliveryBriefPdf } from './pdf-report.js';

configurePreview('site');
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const menu = $('#mobile-menu');
const toggle = $('.menu-toggle');

function closeMenu() {
  menu.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open navigation');
}

toggle.addEventListener('click', () => {
  menu.hidden = !menu.hidden;
  toggle.setAttribute('aria-expanded', String(!menu.hidden));
  toggle.setAttribute('aria-label', menu.hidden ? 'Open navigation' : 'Close navigation');
});
$$('#mobile-menu a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
$$('[data-year]').forEach(node => { node.textContent = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Zurich' }).format(new Date()); });

$$('[data-open]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.open}`).showModal()));
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  const box = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
}));

const currency = value => new Intl.NumberFormat('en-CH', { style: 'currency', currency: 'CHF' }).format(value);
for (const id of ['report-area', 'sale-value']) {
  const input = $(`#${id}`);
  if (!input) continue;
  const calculate = () => {
    const valid = input.value !== '' && input.checkValidity();
    const value = valid ? Number(input.value) : null;
    if (id === 'report-area') $('#report-estimate').textContent = value === null ? 'Enter a valid area' : currency(value * 5);
    else {
      // Work in cents so the displayed fee and remainder always add up.
      const total = value === null ? 0 : Math.round(value * 100);
      const commission = Math.round(total * 0.08);
      $('#commission-estimate').textContent = value === null ? 'Enter a valid sale value' : currency(commission / 100);
      $('#seller-estimate').textContent = value === null ? '—' : currency((total - commission) / 100);
    }
  };
  input.addEventListener('input', calculate);
  calculate();
}

const form = $('#delivery-form');
const labels = { doorstep: 'Doorstep delivery', room: 'Room-of-choice delivery', 'two-person': 'Two-person handling' };
const planLabels = { logistics: 'Connected logistics', report: 'Professional report', marketplace: 'Reuse marketplace' };
const legacyPlans = { starter: 'marketplace', pro: 'report', partner: 'logistics' };
let step = 0;
let savedBrief = null;
let selectedPlan = 'none';
let selectedBilling = 'monthly';
const exchange = form ? createPartnerWorkspace({ describeBrief, onExample: loadExampleRequest }) : null;

function loadExampleRequest(request) {
  for (const field of form.elements) {
    if (!field.name || !Object.hasOwn(request, field.name)) continue;
    if (field.type === 'checkbox') field.checked = request[field.name] === true;
    else field.value = request[field.name] ?? '';
  }
  updateCategory();
  $('#access-fields').hidden = request.service === 'doorstep';
  completeRequest(request);
}

function fillExample(focus = true) {
  if (!form) {
    window.location.href = '/?item=basel-zurich-window#delivery';
    return;
  }
  if (focus) exchange.showSide('client');
  if (form.hidden) resetPlanner();
  const example = exampleDeliveryRequest();
  for (const field of form.elements) {
    if (!field.name || ['contactName', 'email', 'consent'].includes(field.name) || !Object.hasOwn(example, field.name)) continue;
    if (field.type === 'checkbox') field.checked = example[field.name] === true;
    else field.value = example[field.name] ?? '';
  }
  if (selectedPlan === 'none') selectedPlan = 'logistics';
  $('#selected-plan').hidden = false;
  $('#selected-plan').textContent = planLabels[selectedPlan];
  $('#access-fields').hidden = example.service === 'doorstep';
  form.elements.namedItem('deliveryDate').min = example.pickupDate;
  updateCategory();
  goToStep(0);
  if (focus) form.elements.namedItem('itemName').focus({ preventScroll: true });
}

$('#use-demo-listing').addEventListener('click', () => {
  $('#marketplace-dialog').close();
  fillExample();
  if (form) $('#delivery').scrollIntoView({ behavior: 'smooth' });
});

$$('[data-use-example]').forEach(button => button.addEventListener('click', () => {
  fillExample();
  if (form) $('#delivery').scrollIntoView({ behavior: 'smooth' });
}));

function node(tag, text) {
  const result = document.createElement(tag);
  result.textContent = text;
  return result;
}

function values() {
  const data = { plan: selectedPlan, billing: selectedBilling };
  for (const field of form.elements) {
    if (!field.name || !['INPUT', 'SELECT', 'TEXTAREA'].includes(field.tagName)) continue;
    data[field.name] = field.type === 'checkbox' ? field.checked : field.value.trim();
  }
  return data;
}

function describeBrief(data) {
  const extras = [];
  if (data.fragile) extras.push('Extra care / fragile');
  if (data.packaging) extras.push('Protective packaging requested');
  if (data.category === 'pallet' && data.forklift) extras.push('Forklift at pickup');
  const parts = [
    `${data.quantity} × ${data.itemName}`,
    `${data.length} × ${data.width} × ${data.height} cm · ${data.weight} kg per item`,
    `${data.pickup} → ${data.destination}`,
    `Preferred pickup: ${data.pickupDate} · ${labels[data.service]}`,
  ];
  if (data.service !== 'doorstep') {
    parts.push(`Pickup floor: ${data.pickupFloor} (${data.pickupLift ? 'lift available' : 'no lift'}). Delivery floor: ${data.deliveryFloor} (${data.deliveryLift ? 'lift available' : 'no lift'}).`);
  }
  if (extras.length) parts.push(extras.join(' · '));
  parts.push(...describeDeliveryOptions(data));
  if (data.plan !== 'none' && (planLabels[data.plan] || legacyPlans[data.plan])) parts.push(`Service interest: ${planLabels[data.plan] || planLabels[legacyPlans[data.plan]]}`);
  if (data.notes) parts.push(`Notes: ${data.notes}`);
  return parts;
}

function renderBrief(target, data) {
  target.replaceChildren(...describeBrief(data).map((line, index) => node(index ? 'div' : 'strong', line)));
}

function completeRequest(request) {
  savedBrief = request;
  $('#request-reference').textContent = request.reference;
  renderBrief($('#success-summary'), request);
  form.hidden = true;
  $('.form-progress').hidden = true;
  $('#form-success').hidden = false;
  exchange.setRequest(request);
}

function validateStep() {
  const fields = [...form.querySelectorAll(`[data-step="${step}"] input, [data-step="${step}"] select, [data-step="${step}"] textarea`)];
  for (const field of fields) {
    if (!field.disabled && !field.closest('[hidden]') && !field.checkValidity()) {
      const details = field.closest('details');
      if (details) details.open = true;
      field.reportValidity(); return false;
    }
  }
  if (step === 1) {
    try { readDeliveryOptions(values()); }
    catch (error) { $('#form-error').textContent = error.message; $('#form-error').hidden = false; return false; }
  }
  return true;
}

function goToStep(next, focus = false) {
  step = next;
  $$('#delivery-form [data-step]').forEach(fieldset => {
    const active = Number(fieldset.dataset.step) === step;
    fieldset.hidden = !active;
    fieldset.disabled = !active;
  });
  $$('[data-step-indicator]').forEach(indicator => {
    const index = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle('current', index === step);
    indicator.classList.toggle('complete', index < step);
    if (index === step) indicator.setAttribute('aria-current', 'step');
    else indicator.removeAttribute('aria-current');
  });
  $('#form-back').hidden = step === 0;
  $('#form-next').hidden = step === 2;
  $('#form-submit').hidden = step !== 2;
  $('#step-caption').textContent = `STEP 0${step + 1} OF 03`;
  $('#form-next').firstChild.textContent = step === 0 ? 'The journey ' : 'Your details ';
  $('#form-error').hidden = true;
  if (step === 2) renderBrief($('#brief-preview'), values());
  if (focus) {
    const legend = form.querySelector(`[data-step="${step}"] legend`);
    legend.tabIndex = -1;
    legend.focus({ preventScroll: true });
    if (window.innerWidth < 721) $('.delivery-planner').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateCategory() {
  const category = form.elements.namedItem('category').value;
  const hints = {
    'building-materials': 'For building components, confirm dimensions, condition and whether dismantling or special lifting is required.',
    furniture: 'For furniture, include its widest points and any parts that cannot be removed.',
    homeware: 'Measure the packaged item if possible. Flag glass, ceramics or delicate finishes as fragile.',
    electronics: 'Protect screens and remove loose accessories. Tell the partner about batteries or other transport restrictions.',
    pallet: 'Include the pallet in the total dimensions and weight. You can specify forklift access in the next step.',
    other: 'Measure the widest points and explain any unusual handling needs in your journey notes.',
  };
  $('#category-hint').textContent = hints[category];
  $('#forklift-field').hidden = category !== 'pallet';
}

function resetPlanner() {
  form.reset();
  exchange.clear();
  savedBrief = null;
  form.hidden = false;
  $('#form-success').hidden = true;
  $('.form-progress').hidden = false;
  updateCategory();
  $('#access-fields').hidden = true;
  goToStep(0);
  fillExample(false);
}

if (form) {
  const params = new URLSearchParams(window.location.search);
  const plan = legacyPlans[params.get('plan')] || params.get('plan');
  selectedPlan = Object.hasOwn(planLabels, plan) ? plan : 'none';
  selectedBilling = params.get('billing') === 'annual' ? 'annual' : 'monthly';
  if (selectedPlan !== 'none') { $('#selected-plan').hidden = false; $('#selected-plan').textContent = planLabels[selectedPlan]; }
  form.elements.namedItem('pickupDate').min = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  form.elements.namedItem('deliveryDate').min = form.elements.namedItem('pickupDate').min;
  form.elements.namedItem('pickupDate').addEventListener('change', event => { form.elements.namedItem('deliveryDate').min = event.target.value || form.elements.namedItem('pickupDate').min; });
  $('#fill-example').addEventListener('click', fillExample);
  $('#form-next').addEventListener('click', () => { if (validateStep()) goToStep(step + 1, true); });
  $('#form-back').addEventListener('click', () => goToStep(step - 1, true));
  form.elements.namedItem('category').addEventListener('change', event => {
    if (event.target.value === 'electronics') form.elements.namedItem('fragile').checked = true;
    updateCategory();
  });
  form.elements.namedItem('service').addEventListener('change', event => { $('#access-fields').hidden = event.target.value === 'doorstep'; });
  if (['demo-window', 'demo-chair', 'basel-zurich-window'].includes(params.get('item'))) fillExample(false);
  else if (!params.get('item')) fillExample(false);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validateStep()) return;
    if (step < 2) { goToStep(step + 1, true); return; }
    const button = $('#form-submit');
    button.disabled = true;
    button.firstChild.textContent = browserPreview ? 'Preparing your brief… ' : 'Saving your brief… ';
    $('#form-error').hidden = true;
    try {
      let data;
      if (browserPreview) data = { request: await preparePreviewBrief(values()) };
      else {
        const response = await fetch('/api/delivery-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values()) });
        data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Your brief could not be saved. Please try again.');
      }
      completeRequest(data.request);
      $('#form-success').focus({ preventScroll: true });
      $('.delivery-planner').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      $('#form-error').textContent = error instanceof TypeError ? 'We couldn’t reach the server. Your details are still here — please try again.' : error.message;
      $('#form-error').hidden = false;
    } finally {
      button.disabled = false;
      button.firstChild.textContent = browserPreview ? 'Prepare my delivery brief ' : 'Save my delivery brief ';
    }
  });

  $('#download-brief').addEventListener('click', async () => {
    if (!savedBrief) return;
    const button = $('#download-brief');
    const label = button.firstChild.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.firstChild.textContent = 'Preparing PDF… ';
    $('#brief-download-error').hidden = true;
    try { await downloadDeliveryBriefPdf(savedBrief); }
    catch {
      $('#brief-download-error').textContent = 'We couldn’t prepare the PDF report. Please try again.';
      $('#brief-download-error').hidden = false;
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.firstChild.textContent = label;
    }
  });
  $('#new-request').addEventListener('click', resetPlanner);
  $('#edit-request').addEventListener('click', () => {
    exchange.clear();
    savedBrief = null;
    form.hidden = false;
    $('#form-success').hidden = true;
    $('.form-progress').hidden = false;
    goToStep(0, true);
  });
}
