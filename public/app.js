import { browserPreview, configurePreview, preparePreviewBrief } from './preview.js';
import { describeDeliveryOptions, describeDimensions, estimateDelivery, partnerTransactionAmounts, readDeliveryOptions, readDimensions } from './delivery-options.js';
import { createPartnerWorkspace, exampleDeliveryRequest } from './partner.js';
import { downloadDeliveryBriefPdf } from './pdf-report.js';

configurePreview('site');
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const menu = $('#mobile-menu');
const toggle = $('.menu-toggle');
const stepNames = ['The object', 'The journey', 'Your details'];
const scrollTo = element => element.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

function clearFieldError(field) {
  field.removeAttribute('aria-invalid');
  const error = document.getElementById(`${field.id}-error`);
  if (error) { error.hidden = true; error.textContent = ''; }
  const descriptions = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== `${field.id}-error`);
  if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' '));
  else field.removeAttribute('aria-describedby');
}

function showFieldError(field, message) {
  const error = document.getElementById(`${field.id}-error`);
  if (!error) return;
  error.textContent = message;
  error.hidden = false;
  field.setAttribute('aria-invalid', 'true');
  const descriptions = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  descriptions.add(error.id);
  field.setAttribute('aria-describedby', [...descriptions].join(' '));
}

function fieldMessage(field) {
  const caption = document.getElementById(field.getAttribute('aria-labelledby'))?.textContent.trim() || field.name;
  if (field.validity.valueMissing || (field.required && field.type !== 'checkbox' && !field.value.trim())) return field.type === 'checkbox' ? 'Select this confirmation to continue.' : `Please enter ${caption.toLowerCase()}.`;
  if (field.validity.typeMismatch || field.validity.patternMismatch) return 'Enter an email address such as name@example.com.';
  if (field.validity.rangeUnderflow) return field.type === 'date' ? `Choose a date on or after ${field.min}.` : `Use a value of at least ${field.min}.`;
  if (field.validity.rangeOverflow) return `Use a value no greater than ${field.max}.`;
  if (field.validity.stepMismatch) return `Use increments of ${field.step}.`;
  return field.validationMessage || `Please check ${caption.toLowerCase()}.`;
}

function setupValidation(target) {
  for (const field of target.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
    field.id ||= `${target.id}-${field.name}`;
    const label = field.closest('label');
    if (!label) continue;
    label.htmlFor = field.id;
    let caption = [...label.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
    if (caption) { const span = document.createElement('span'); span.textContent = caption.textContent; caption.replaceWith(span); caption = span; }
    else caption = [...label.children].find(child => child !== field && child.tagName === 'SPAN');
    if (caption) { caption.id ||= `${field.id}-label`; field.setAttribute('aria-labelledby', caption.id); }
    const error = document.createElement('span');
    error.id = `${field.id}-error`; error.className = 'field-error'; error.hidden = true;
    label.append(error);
    for (const event of ['input', 'change']) field.addEventListener(event, () => {
      if (field.getAttribute('aria-invalid') !== 'true') return;
      clearFieldError(field);
      if (!field.checkValidity() || (field.required && field.type !== 'checkbox' && !field.value.trim())) showFieldError(field, fieldMessage(field));
      if (!target.querySelector('[aria-invalid="true"]')) {
        const summary = target.querySelector('[role="alert"]');
        if (summary) summary.hidden = true;
      }
    });
  }
}

function clearValidation(target) {
  target.querySelectorAll('[aria-invalid]').forEach(clearFieldError);
}

function validateForm(target, summary, scope = target) {
  const fields = [...scope.querySelectorAll('input, select, textarea')].filter(field => field.willValidate && !field.closest('[hidden]'));
  const invalid = fields.filter(field => !field.checkValidity() || (field.required && field.type !== 'checkbox' && !field.value.trim()));
  fields.forEach(clearFieldError);
  invalid.forEach(field => {
    field.closest('details')?.setAttribute('open', '');
    showFieldError(field, fieldMessage(field));
  });
  summary.hidden = !invalid.length;
  if (!invalid.length) return true;
  summary.textContent = `Please check ${invalid.length === 1 ? 'the highlighted field' : `the ${invalid.length} highlighted fields`}. ${fieldMessage(invalid[0])}`;
  invalid[0].focus({ preventScroll: true });
  invalid[0].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  return false;
}

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
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !menu.hidden) { closeMenu(); toggle.focus(); }
});
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
$$('[data-year]').forEach(node => { node.textContent = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Zurich' }).format(new Date()); });

$$('[data-open]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.open}`).showModal()));
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  const box = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
}));

const currency = value => new Intl.NumberFormat('en-CH', { style: 'currency', currency: 'CHF' }).format(value);
for (const id of ['report-area', 'sale-value', 'delivery-value']) {
  const input = $(`#${id}`);
  if (!input) continue;
  const calculate = () => {
    const valid = input.value !== '' && input.checkValidity();
    const value = valid ? Number(input.value) : null;
    if (id === 'report-area') $('#report-estimate').textContent = value === null ? 'Enter a valid area' : currency(value * 5);
    else if (id === 'delivery-value') {
      const { feeCents, partnerAmountCents } = partnerTransactionAmounts(value === null ? 0 : Math.round(value * 100));
      $('#partner-fee-estimate').textContent = value === null ? 'Enter a valid delivery value' : currency(feeCents / 100);
      $('#partner-amount-estimate').textContent = value === null ? '—' : currency(partnerAmountCents / 100);
    } else {
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
if (form) { setupValidation(form); setupValidation($('#partner-quote-form')); }
const exchange = form ? createPartnerWorkspace({ describeBrief, onExample: loadExampleRequest, validateForm, clearValidation, showFieldError }) : null;

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
  clearValidation(form);
  goToStep(0, Boolean(focus));
}

$('#use-demo-listing')?.addEventListener('click', () => {
  $('#marketplace-dialog').close();
  fillExample();
  if (form) scrollTo($('#delivery'));
});

$$('[data-use-example]').forEach(button => button.addEventListener('click', () => {
  fillExample();
  if (form) scrollTo($('#delivery'));
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
    `Dimensions: ${describeDimensions(data)} · ${data.weight} kg per item`,
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
  if (!validateForm(form, $('#form-error'), form.querySelector(`[data-step="${step}"]`))) return false;
  try {
    if (step === 0) readDimensions(values());
    if (step === 1) readDeliveryOptions(values());
  }
  catch (error) { $('#form-error').textContent = error.message; $('#form-error').hidden = false; $('#form-error').focus(); return false; }
  return true;
}

function renderEstimate() {
  const estimate = estimateDelivery(values());
  $('#estimated-price').textContent = `${currency(estimate.low)}–${currency(estimate.high)}`;
  $('#estimated-timeline').textContent = estimate.timeline;
}

function goToStep(next, focus = false) {
  step = next;
  $$('#delivery-form [data-step]').forEach(fieldset => {
    const active = Number(fieldset.dataset.step) === step;
    fieldset.hidden = !active;
    fieldset.disabled = !active;
    fieldset.inert = !active;
    fieldset.setAttribute('aria-hidden', String(!active));
  });
  $$('[data-step-indicator]').forEach(indicator => {
    const index = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle('current', index === step);
    indicator.classList.toggle('complete', index < step);
    indicator.querySelector('[data-step-icon]').textContent = index < step ? '✓' : String(index + 1);
    const button = indicator.querySelector('button');
    button.disabled = index > step;
    button.setAttribute('aria-label', index < step ? `Completed. Go back to step ${index + 1}: ${stepNames[index]}` : `Step ${index + 1} of 3: ${stepNames[index]}`);
    if (index === step) indicator.setAttribute('aria-current', 'step');
    else indicator.removeAttribute('aria-current');
  });
  $('#form-back').hidden = step === 0;
  $('#form-next').hidden = step === 2;
  $('#form-submit').hidden = step !== 2;
  $('#step-caption').textContent = `Step ${step + 1} of 3 · ${stepNames[step]}`;
  $('#form-next').firstChild.textContent = `Next: ${stepNames[step + 1] || 'Review'} `;
  $('#form-error').hidden = true;
  if (step === 2) { renderBrief($('#brief-preview'), values()); renderEstimate(); }
  if (focus) {
    const heading = form.querySelector(`[data-step="${step}"] [data-step-heading]`);
    heading.focus({ preventScroll: true });
    scrollTo($('.delivery-planner'));
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
  clearValidation(form);
  exchange.clear();
  savedBrief = null;
  form.hidden = false;
  $('#form-success').hidden = true;
  $('.form-progress').hidden = false;
  updateCategory();
  $('#access-fields').hidden = true;
  form.elements.namedItem('deliveryDate').min = form.elements.namedItem('pickupDate').min;
  goToStep(0, true);
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
  $$('[data-step-target]').forEach(button => button.addEventListener('click', () => {
    const target = Number(button.dataset.stepTarget);
    if (target <= step) goToStep(target, true);
  }));
  form.elements.namedItem('category').addEventListener('change', event => {
    if (event.target.value === 'electronics') form.elements.namedItem('fragile').checked = true;
    updateCategory();
  });
  form.elements.namedItem('service').addEventListener('change', event => { $('#access-fields').hidden = event.target.value === 'doorstep'; });
  goToStep(0);
  if (['demo-window', 'demo-chair', 'basel-zurich-window'].includes(params.get('item'))) fillExample(false);

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
      scrollTo($('.delivery-planner'));
    } catch (error) {
      $('#form-error').textContent = error instanceof TypeError ? 'We couldn’t reach the server. Your details are still here — please try again.' : error.message;
      $('#form-error').hidden = false;
      $('#form-error').focus();
    } finally {
      button.disabled = false;
      button.firstChild.textContent = browserPreview ? 'Prepare demo brief ' : 'Save demo brief ';
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
