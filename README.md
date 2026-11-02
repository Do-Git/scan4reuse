# Scan4Reuse

An English-language circular-logistics website built around an illustrative delivery of a reclaimed window from Basel to a Zürich office. A client specifies collection, handling and placement requirements; a logistics partner reviews the request and proposes a price or changes. Scanning, marketplace, reporting and ESG content follow the same example. The site uses Node.js and plain HTML, CSS and JavaScript, with a self-hosted PDF renderer and embedded fonts. No web framework or package installation is required to run the application.

## Run

Use **Node.js 22 or later** (validated with Node.js 24):

```bash
cd /workspace/scan4reuse
npm start
```

The server listens on `127.0.0.1:3000`. `npm run dev` enables automatic server restarts during development. `HOST`, `PORT` and `UPLOAD_DIR` are optional overrides.

## Pages

- `/` — the Basel-to-Zürich delivery journey, client planner and partner quote workflow; supporting scanning, listing and report concepts; mission, ESG, the five-person team and the Basel hackathon origin.
- `/pricing` — **CHF 5/m² for a professional reuse report** and **8% of total marketplace sales**, plus separately quoted logistics. The marketplace calculator starts with the example window's illustrative CHF 120 value. No subscription, payment or transaction is created.
- `/upload` — an English-language delivery-document workspace for briefs, condition photographs and site-access documents, with uploads, search, filters, downloads and deletion.

The origin story links to [Startup Weekend Basel](https://startupweekendbasel.ch/).

## Branding and content source

The user-supplied **Scan4Resources.pdf** supplies the brand accents, building-material use case, app mockups, sample reuse report and pricing model. The interface uses a calm green palette, clear service descriptions and a working delivery brief, with copy and listing illustrations following the Basel-to-Zürich example.

Product, construction-context and team images in `public/assets/` are extracted from the supplied PDF. The five founder photographs are the original embedded photos. The case listing is rendered with HTML and the existing window icon so that its item and route match the planner.

The impact section connects Sustainable Development Goals 8, 9, 11, 12 and 13 to logistics through short descriptions and the official [United Nations goal icons](https://sdgs.un.org/goals). The five `sdg-*.jpg` assets are hosted locally; their originals are available at `https://sdgs.un.org/sites/default/files/goals/E_SDG_Icons-NN.jpg`, with `NN` matching the two-digit goal number.

Team profiles preserve the user-confirmed photograph order and titles:

1. Daria Horica — AI & Software Engineering
2. Tomas Strnadel — Architecture & Idea
3. Reazul Islam — AI & Machine Learning
4. Ivo Bosshard — Sustainability
5. Domenico Dongiovanni — Business

The Basel-to-Zürich journey, item specifications and CHF 120 value are illustrative. No route distance, transit guarantee or transport fare is invented. The reuse report is visibly marked SAMPLE DATA. ESG content states goals, not measured carbon savings or certifications. No partner affiliations or endorsements are implied.

## Client and logistics partner workflow

The client customizes the delivery for a particular good. The three-step form collects dimensions, weight, handling service, collection readiness, packaging, site access, dates and time windows, equipment, final placement and contact details. Optional services cover assembly, temporary storage/phased delivery, unpacking, building protection, condition photos, signed handover and cover clarification. Architect and facility-manager roles are supported alongside buyers, sellers and businesses.

`exampleDeliveryRequest()` in `public/partner.js` provides the shared Basel-to-Zürich case: one fragile reclaimed window, 12 × 100 × 140 cm and 18 kg, with a Basel loading bay and an occupied Zürich office. The client form preloads those requirements while leaving contact details empty and consent unchecked. The explicit partner example uses clearly labelled example contacts. Resetting the planner restores the case without retaining personal data or a previous quote.

The logistics partner view uses the same request. A partner accepts it for review, then submits an itemised quote or explicitly proposes adjusted timing, a different service or another approach. The client can accept the example proposal or ask for a revision. Superseded and expired proposals cannot be accepted, and editing the request resets the quotation state. Both the request and proposal can be downloaded. Research informing the options is recorded in [LOGISTICS_RESEARCH.md](LOGISTICS_RESEARCH.md).

`POST /api/delivery-requests` validates and saves a demo brief as a private-mode JSON file under `.local/uploads/delivery-requests/`. The browser receives a reference and downloads the complete brief as a branded A4 PDF report. Requests are not exposed through a public list/read API.

Both brief and partner-proposal downloads produce actual PDF files, including selectable text, embedded fonts, section headings, automatic page breaks and page numbers. Proposal reports include the quoted scope, price, changes, acceptance status and original client requirements. Generation happens in the browser; the library and fonts load from the site's own assets when a report is downloaded. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the pinned library and font licenses.

Partner quotes and example agreements run in memory in the browser, including when the Node application is used. No carrier is contacted and no shipment or payment is created. Real partner accounts, request distribution and shared quotation storage require a backend integration. The scanner, report generator and sales marketplace remain supporting product concepts.

## Tests

```bash
npm test
```

The 19 tests cover upload/download integrity, persistence, deletion, size limits, interrupted uploads, static pages, data protection, professional delivery requirements, consent and invalid submissions. Quotation tests cover review before quoting, requested versus adjusted scope, exact-cent totals, revisions, explicit client acceptance, request edits, stale offers and expiry.

Browser validation covers the client-to-partner request, quote, adjustment, revision, approval and download flow; request edits; keyboard tabs; calculators; uploads and mobile layouts at 320–1440px. The static preview makes no API mutations while using its example data. Verification assets are kept outside Git.

## Data and deployment

Uploaded files and request data are excluded from Git. Files use UUIDs on disk, preserving original names in metadata; identical names do not overwrite one another. Uploads are limited to 50 MiB per file and served as attachments.

Use a single server instance per data directory. Preserve and back up the data directory when replacing a machine. This prototype has no authentication: the upload archive is shared, and the server operator can access stored delivery briefs. A public production deployment with private data needs authentication, access control, HTTPS, retention/deletion rules and storage quotas.

## Source layout

- `server.mjs` — HTTP routing, static pages and file storage.
- `delivery.mjs` — validation and persistence of delivery requests.
- `public/index.html`, `public/pricing.html`, `public/styles.css`, `public/app.js` — startup website and delivery planner.
- `public/partner.js`, `public/delivery-options.js` — shared case, professional requirements and quotation workflow.
- `public/pdf-report.js`, `public/vendor/` — PDF report rendering and its pinned library.
- `public/upload.html`, `public/upload.css`, `public/upload.js` — delivery-document workspace.
- `public/assets/`, `public/icons.svg` — product and team images, SDG logos, fonts and locally served icons.
- `test/server.test.mjs`, `test/logistics.test.mjs` — integration and quotation tests.

## Browser preview and deployment

Run `npm run build:preview` to generate `.local/preview/site` for Vercel or Netlify. The script copies only an explicit allowlist of public files; development uploads, saved contact data, environment files and the Git repository are excluded.

The public preview keeps requests and files only in browser memory and clears them on reload. It supports the complete interactive site, brief downloads and file download/deletion without publishing the development archive. The Node application continues to use its persistent filesystem storage.

Open the verified interactive preview at **https://scan4reuse-preview.vercel.app**. See [DEPLOYMENT.md](DEPLOYMENT.md) for the exact login, deployment and URL-opening steps. Building a preview does not publish the Codex environment.
