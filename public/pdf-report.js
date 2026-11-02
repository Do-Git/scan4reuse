import { equipmentNames, serviceNames } from './delivery-options.js';

const roleNames = { buyer: 'Buyer', seller: 'Seller', business: 'Business', architect: 'Architect / project team', 'facility-manager': 'Facility manager' };
const categoryNames = { 'building-materials': 'Building components & materials', furniture: 'Furniture', homeware: 'Homeware & decor', electronics: 'Electronics', pallet: 'Pallet / business surplus', other: 'Other' };
const money = amount => new Intl.NumberFormat('en-CH', { style: 'currency', currency: 'CHF' }).format(amount);
const provided = value => value !== null && value !== undefined && String(value).trim() !== '';
const text = value => provided(value) ? String(value) : 'Not specified';
const date = value => provided(value) ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Zurich' }).format(new Date(`${value}T12:00:00Z`)) : 'To be agreed';
const fields = pairs => pairs.filter(([, value]) => provided(value));

export function deliveryBriefSections(request) {
  const extras = [['assembly', 'Assembly assistance'], ['storage', 'Temporary storage / phased delivery'], ['packagingRemoval', 'Unpacking / packaging removal'], ['siteProtection', 'Floor and wall protection'], ['conditionRecord', 'Condition photos and signed handover'], ['insuranceQuote', 'Insurance / goods cover clarification']].filter(([key]) => request[key]).map(([, label]) => label);
  const sections = [
    { title: 'Request and client', rows: fields([
      ['Request reference', request.reference],
      ['Created (Zurich time)', request.createdAt ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich', timeZoneName: 'short' }).format(new Date(request.createdAt)) : ''],
      ['Requested by', request.contactName], ['Email', request.email],
      ['Client role', roleNames[request.requesterRole] || request.requesterRole], ['Listing reference', request.listingId],
      ['Service interest', { logistics: 'Connected logistics', report: 'Professional reuse report', marketplace: 'Reuse marketplace', starter: 'Reuse marketplace', pro: 'Professional reuse report', partner: 'Connected logistics' }[request.plan]],
    ]) },
    { title: 'The good', rows: fields([
      ['Item', request.itemName], ['Category', categoryNames[request.category] || request.category], ['Number of items', request.quantity],
      ['Dimensions per item', `${request.length} × ${request.width} × ${request.height} cm`], ['Weight per item', `${request.weight} kg`],
      ['Load format', { loose: 'Loose / individually wrapped', pallet: 'Palletised', crate: 'Crated' }[request.handlingUnit]],
      ['Collection readiness', { ready: 'Dismantled and ready', dismantling: 'Dismantling assistance requested', confirm: 'Confirm with the partner' }[request.readiness]],
      ['Fragile handling', request.fragile ? 'Extra care requested' : 'No additional fragility declared'],
      ['Declared goods value', request.declaredValue !== null && provided(request.declaredValue) ? `${money(Number(request.declaredValue))} — cover to be agreed` : 'Not specified'],
    ]) },
    { title: 'Route and requested schedule', rows: [
      ['Pickup location', text(request.pickup)], ['Pickup date', date(request.pickupDate)], ['Pickup time window', text(request.pickupWindow)],
      ['Delivery location', text(request.destination)], ['Delivery date', date(request.deliveryDate)], ['Delivery time window', text(request.deliveryWindow)],
      ['Schedule flexibility', request.scheduleFlexibility === 'fixed' ? 'Fixed dates / reserved access slots' : 'Partner may propose alternatives'],
    ] },
    { title: 'Handling and site access', rows: fields([
      ['Delivery service', serviceNames[request.service] || request.service],
      ['Protective packaging', request.packaging ? 'Requested' : 'No additional packaging requested'],
      ['Equipment to quote', equipmentNames[request.equipment] || 'Standard loading'],
      ['Forklift at pickup', request.category === 'pallet' ? request.forklift ? 'Available' : 'Not confirmed' : ''],
      ['Pickup floor / lift', request.service !== 'doorstep' ? `Floor ${request.pickupFloor ?? 0} · ${request.pickupLift ? 'lift available' : 'no lift declared'}` : ''],
      ['Delivery floor / lift', request.service !== 'doorstep' ? `Floor ${request.deliveryFloor ?? 0} · ${request.deliveryLift ? 'lift available' : 'no lift declared'}` : ''],
      ['Pickup access', request.pickupAccess], ['Delivery access', request.deliveryAccess], ['Door / lift clearances', request.accessMeasurements],
      ['Final placement', request.placement], ['Site contact / access reference', request.siteReference],
    ]) },
    { title: 'Additional requirements', rows: [
      ['Additional services', extras.length ? extras.join('\n') : 'No additional services selected'],
      ['Client notes', text(request.notes)],
    ] },
  ];
  return sections;
}

export function partnerProposalSections(request, proposal, stage) {
  const quoteSections = [
    { title: 'Partner proposal', rows: [
      ['Partner / company', proposal.partnerName], ['Request reference', request.reference], ['Proposal reference', proposal.id],
      ['Status', stage === 'agreed' ? 'Accepted in this example' : 'Awaiting client review'],
      ['Response', proposal.mode === 'adjusted' ? 'Adjusted delivery proposed' : 'Quoted as requested'], ['Quote valid until', date(proposal.validUntil)],
    ] },
    { title: 'Proposed scope and schedule', rows: fields([
      ['Pickup date', `${date(request.pickupDate)} → ${date(proposal.pickupDate)}`],
      ['Delivery date', `${date(request.deliveryDate)} → ${date(proposal.deliveryDate)}`],
      ['Delivery time window', `${text(request.deliveryWindow)} → ${text(proposal.deliveryWindow)}`],
      ['Delivery service', `${serviceNames[request.service]} → ${serviceNames[proposal.service]}`],
      ['Proposed changes / reason', proposal.changes || 'No changes to the requested scope'],
      ['Crew and equipment', proposal.crewEquipment], ['Included services and conditions', proposal.scope],
    ]) },
    { title: 'Itemised price', rows: [
      ['Transport', money(proposal.transportCents / 100)], ['Handling', money(proposal.handlingCents / 100)],
      ['Added services', money(proposal.extrasCents / 100)], ['Total', money(proposal.totalCents / 100)],
      ['VAT basis', { included: 'VAT included', excluded: 'VAT excluded', confirm: 'To be confirmed' }[proposal.taxBasis]],
    ] },
  ];
  return [...quoteSections, ...deliveryBriefSections(request).map(section => ({ ...section, title: `Client requirements · ${section.title}` }))];
}

let resources;
async function loadResources() {
  if (!resources) resources = (async () => {
    await import('./vendor/jspdf.umd.min.js');
    const jsPDF = globalThis.jspdf?.jsPDF;
    if (!jsPDF) throw new Error('The PDF renderer could not be loaded.');
    const fonts = await Promise.all(['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].map(async name => {
      const response = await fetch(new URL(`./assets/fonts/${name}`, import.meta.url));
      if (!response.ok) throw new Error('The report fonts could not be loaded.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return { name, data: btoa(binary) };
    }));
    return { jsPDF, fonts };
  })().catch(error => { resources = null; throw error; });
  return resources;
}

export async function createPdfReport({ title, subtitle, reference, sections, footer }) {
  const { jsPDF, fonts } = await loadResources();
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  for (const [index, font] of fonts.entries()) {
    pdf.addFileToVFS(font.name, font.data);
    pdf.addFont(font.name, 'Report', index ? 'bold' : 'normal');
  }
  pdf.setProperties({ title: `${title} · ${reference}`, subject: subtitle, author: 'Scan4Reuse', creator: 'Scan4Reuse' });
  pdf.setLanguage('en-GB');
  pdf.setCreationDate(new Date());
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 42;
  const labelWidth = 132;
  const valueX = margin + labelWidth + 16;
  const valueWidth = width - margin - valueX;
  const bottom = height - 65;
  const lineHeight = 17;
  let y;
  let currentSection = '';
  const font = (size, bold = false, color = [39, 62, 45]) => { pdf.setFont('Report', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color); };
  const wrap = (value, space, size, bold = false) => {
    font(size, bold);
    return pdf.splitTextToSize(String(value).replace(/\r\n?/g, '\n').replace(/\t/g, '    '), space);
  };
  function header(first) {
    font(17, true, [35, 76, 53]); pdf.text('SCAN4REUSE', margin, 35);
    font(9, false, [90, 112, 75]); pdf.text('CONNECTED LOGISTICS', width - margin, 34, { align: 'right' });
    font(first ? 27 : 20, true); pdf.text(`${title}${first ? '' : ' / continued'}`, margin, first ? 75 : 66);
    font(10.5, false, [83, 105, 70]); pdf.text(subtitle, margin, first ? 97 : 86);
    pdf.setDrawColor(199, 215, 187); pdf.setLineWidth(.7); pdf.line(margin, first ? 111 : 99, width - margin, first ? 111 : 99);
    y = first ? 129 : 117;
  }
  function heading(name) {
    font(12.5, true, [45, 88, 56]);
    pdf.setFillColor(237, 244, 229); pdf.rect(margin, y, width - 2 * margin, 27, 'F');
    pdf.text(name, margin + 9, y + 18); y += 40;
  }
  function nextPage() {
    pdf.addPage(); header(false);
    if (currentSection) heading(`${currentSection} / continued`);
  }
  header(true);
  for (const section of sections) {
    currentSection = '';
    if (bottom - y < 96) nextPage();
    currentSection = section.title;
    heading(section.title);
    for (const [label, value] of section.rows) {
      let remaining = wrap(text(value), valueWidth, 12);
      let continued = false;
      do {
        const labels = wrap(`${label}${continued ? ' (continued)' : ''}`, labelWidth, 10.5, true);
        let available = Math.floor((bottom - y - 6) / lineHeight);
        if (available < Math.max(2, labels.length)) { nextPage(); available = Math.floor((bottom - y - 6) / lineHeight); }
        const chunk = remaining.splice(0, available);
        font(10.5, true, [74, 95, 63]); labels.forEach((line, index) => pdf.text(line, margin + 2, y + 12 + index * lineHeight));
        font(12, label === 'Total'); chunk.forEach((line, index) => pdf.text(line, valueX, y + 12 + index * lineHeight));
        y += Math.max(labels.length, chunk.length) * lineHeight + 6;
        pdf.setDrawColor(225, 233, 216); pdf.setLineWidth(.35); pdf.line(margin, y - 5, width - margin, y - 5);
        if (remaining.length) { continued = true; nextPage(); }
      } while (remaining.length);
    }
    y += 8;
  }
  const count = pdf.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(199, 215, 187); pdf.setLineWidth(.7); pdf.line(margin, height - 49, width - margin, height - 49);
    font(8.5, false, [92, 109, 80]); pdf.text(`${reference} · ${footer}`, margin, height - 33);
    pdf.text(`${page} / ${count}`, width - margin, height - 17, { align: 'right' });
    pdf.text('Scan4Reuse · Prepared for delivery planning', margin, height - 17);
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}

async function download(report, suffix) {
  const bytes = await createPdfReport(report);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(report.reference).replace(/[^a-z\d_-]/gi, '-').slice(0, 80)}-${suffix}.pdf`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function downloadDeliveryBriefPdf(request) {
  return download({ title: 'Delivery brief', subtitle: 'Client requirements for a logistics partner', reference: request.reference, sections: deliveryBriefSections(request), footer: 'Delivery request · Scope and price to be agreed' }, 'delivery-brief');
}

export function downloadPartnerProposalPdf(request, proposal, stage) {
  return download({ title: 'Partner proposal', subtitle: 'Quoted scope, price and original client requirements', reference: request.reference, sections: partnerProposalSections(request, proposal, stage), footer: 'Interactive example · No shipment is booked' }, 'proposal');
}
