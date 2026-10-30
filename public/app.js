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

function fillExample() {
  if (!form) {
    window.location.href = '/?item=demo-window#delivery';
    return;
  }
  if (form.hidden) resetPlanner();
  const example = { listingId: 'demo-window', itemName: 'Reclaimed window frame', category: 'building-materials', quantity: 1, length: 12, width: 100, height: 140, weight: 18 };
  for (const [name, value] of Object.entries(example)) form.elements.namedItem(name).value = value;
  updateCategory();
  goToStep(0);
  form.elements.namedItem('itemName').focus({ preventScroll: true });
}

$('#use-demo-listing').addEventListener('click', () => {
  $('#marketplace-dialog').close();
  fillExample();
  if (form) $('#delivery').scrollIntoView({ behavior: 'smooth' });
});

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
  if (data.plan !== 'none' && (planLabels[data.plan] || legacyPlans[data.plan])) parts.push(`Service interest: ${planLabels[data.plan] || planLabels[legacyPlans[data.plan]]}`);
  if (data.notes) parts.push(`Notes: ${data.notes}`);
  return parts;
}

function renderBrief(target, data) {
  target.replaceChildren(...describeBrief(data).map((line, index) => node(index ? 'div' : 'strong', line)));
}

function validateStep() {
  const fields = [...form.querySelectorAll(`[data-step="${step}"] input, [data-step="${step}"] select, [data-step="${step}"] textarea`)];
  for (const field of fields) {
    if (!field.disabled && !field.closest('[hidden]') && !field.checkValidity()) { field.reportValidity(); return false; }
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
  savedBrief = null;
  form.hidden = false;
  $('#form-success').hidden = true;
  $('.form-progress').hidden = false;
  updateCategory();
  $('#access-fields').hidden = true;
  goToStep(0);
}

if (form) {
  const params = new URLSearchParams(window.location.search);
  const plan = legacyPlans[params.get('plan')] || params.get('plan');
  selectedPlan = Object.hasOwn(planLabels, plan) ? plan : 'none';
  selectedBilling = params.get('billing') === 'annual' ? 'annual' : 'monthly';
  if (selectedPlan !== 'none') { $('#selected-plan').hidden = false; $('#selected-plan').textContent = planLabels[selectedPlan]; }
  form.elements.namedItem('pickupDate').min = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  $('#fill-example').addEventListener('click', fillExample);
  $('#form-next').addEventListener('click', () => { if (validateStep()) goToStep(step + 1, true); });
  $('#form-back').addEventListener('click', () => goToStep(step - 1, true));
  form.elements.namedItem('category').addEventListener('change', event => {
    if (event.target.value === 'electronics') form.elements.namedItem('fragile').checked = true;
    updateCategory();
  });
  form.elements.namedItem('service').addEventListener('change', event => { $('#access-fields').hidden = event.target.value === 'doorstep'; });
  if (['demo-window', 'demo-chair'].includes(params.get('item'))) fillExample();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validateStep()) return;
    if (step < 2) { goToStep(step + 1, true); return; }
    const button = $('#form-submit');
    button.disabled = true;
    button.firstChild.textContent = 'Saving your brief… ';
    $('#form-error').hidden = true;
    try {
      const response = await fetch('/api/delivery-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values()) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your brief could not be saved. Please try again.');
      savedBrief = data.request;
      $('#request-reference').textContent = savedBrief.reference;
      renderBrief($('#success-summary'), savedBrief);
      form.hidden = true;
      $('.form-progress').hidden = true;
      $('#form-success').hidden = false;
      $('#form-success').focus({ preventScroll: true });
      $('.delivery-planner').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      $('#form-error').textContent = error instanceof TypeError ? 'We couldn’t reach the server. Your details are still here — please try again.' : error.message;
      $('#form-error').hidden = false;
    } finally {
      button.disabled = false;
      button.firstChild.textContent = 'Save my delivery brief ';
    }
  });

  $('#download-brief').addEventListener('click', () => {
    if (!savedBrief) return;
    const lines = [
      'SCAN4REUSE — DEMO DELIVERY BRIEF', `Reference: ${savedBrief.reference}`, `Created: ${savedBrief.createdAt}`, '',
      ...describeBrief(savedBrief), '', `Requested by: ${savedBrief.contactName} (${savedBrief.requesterRole})`, `Email: ${savedBrief.email}`, '',
      'This brief is not a booking or quote. No carrier has been contacted. Share it with a logistics partner to discuss availability, handling, insurance and pricing.',
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${savedBrief.reference}-delivery-brief.txt`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
  $('#new-request').addEventListener('click', resetPlanner);
}
