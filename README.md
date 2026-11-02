# Scan4Reuse

An English-language delivery demo for reusable building materials in Switzerland. A client specifies an item, route and handling needs; a logistics partner reviews the request and proposes a price or adjustments. One labelled example and a short related-tools block support the flow. The site uses Node.js and plain HTML, CSS and JavaScript, with a self-hosted PDF renderer and embedded fonts. No web framework or package installation is required to run the application.

## Run

Use **Node.js 22 or later** (validated with Node.js 24):

```bash
cd /workspace/scan4reuse
npm start
```

The server listens on `127.0.0.1:3000`. `npm run dev` enables automatic server restarts during development. `HOST`, `PORT` and `UPLOAD_DIR` are optional overrides.

## Pages

- `/` — the requested headline, one supporting sentence and primary action, then **How it works → Pricing → Delivery request → FAQ**. A single example card, a compact Related tools block and one ESG paragraph replace repeated promotional sections. The team remains in an optional FAQ. The mobile header keeps the delivery action visible. This user brief supersedes the earlier structure in `STRUCTURE_RESEARCH.md`.
- `/pricing` — the same concise fee visual and calculators as the homepage. The item sale starts at **CHF 1,000**, delivery at **CHF 250**, and reports at **100 m²**. A sold item and the partner’s final adjusted delivery price each have their own 8% fee; reports remain **CHF 5/m²**. No subscription, payment or transaction is created.
- `/upload` — an English-language delivery-document workspace for briefs, condition photographs and site-access documents, with uploads, search, filters, downloads and deletion.

The origin story links to [Startup Weekend Basel](https://startupweekendbasel.ch/).

## Branding and content source

The user-supplied **Scan4Resources.pdf** supplies the brand accents, building-material use case, app mockups, sample reuse report and report rate. The interface uses a calm green palette, Switzerland-wide service descriptions and a working delivery brief. Basel-to-Zürich listing illustrations remain explicitly labelled examples. The two 8% transaction fees follow the user's business-model instructions.

Product, construction-context and team images in `public/assets/` are extracted from the supplied PDF. The five founder photographs are the original embedded photos. The case listing is rendered with HTML and the existing window icon so that its item and route match the planner.

The ESG content is one short paragraph about material reuse, handling responsibilities and transparent decisions; it makes no verified savings claim. The SDG image grid is no longer rendered. Its original assets remain in the repository for provenance and reversibility.

Team profiles preserve the user-confirmed photograph order and titles:

1. Daria Horica — AI & Software Engineering
2. Tomas Strnadel — Architecture & Idea
3. Reazul Islam — AI & Machine Learning
4. Ivo Bosshard — Sustainability
5. Domenico Dongiovanni — Business

The Basel-to-Zürich journey, item specifications and CHF 120 value are illustrative. No route distance, transit guarantee or transport fare is invented. The reuse report is visibly marked SAMPLE DATA. ESG content states goals, not measured carbon savings or certifications. No partner affiliations or endorsements are implied.

## Client and logistics partner workflow

The client customizes the delivery for an item. The three-step form collects its name, quantity, weight, route, handling and contact details. Dimensions and declared value are optional and progressively disclosed; missing measurements are stored as `null` and described as not provided, rather than converted to zero. Access, packaging, dates/windows, equipment and final placement remain available. Architect and facility-manager roles are supported alongside buyers, sellers and businesses.

The role switcher uses tab/tablist/tabpanel semantics, arrow keys, Home/End and visible focus. Wizard steps have consistent names, a dynamic current/completed tracker and buttons for returning to completed steps. Inline errors use `aria-describedby` and `aria-invalid`, an alert summarizes failures, and focus moves to the first invalid control or new step heading. Disabled, inert hidden steps reserve layout space, and the short fade respects reduced motion.

The review step shows a **mock planning estimate** and timeline. These use an illustrative local formula, are not a partner quote and are also labelled in the PDF brief. Visible TODOs cover real pricing, capacity, lead times and response times. Confirmation explains what happens next. A visible banner asks users to use sample data; the upload page warns about the shared workspace.

`exampleDeliveryRequest()` in `public/partner.js` provides an optional Basel-to-Zürich case: one fragile reclaimed window, 12 × 100 × 140 cm and 18 kg, with a Basel loading bay and an occupied Zürich office. The client form starts empty for the user's own item and route. Explicit example buttons fill the case while leaving client contact details empty and consent unchecked. The partner example uses clearly labelled example contacts. Resetting the planner clears the item, route, personal data and previous quote.

The logistics partner view uses the same request. A partner accepts it for review, then submits an itemised quote or explicitly proposes adjusted timing, a different service or another approach. The client can accept the example proposal or ask for a revision. Superseded and expired proposals cannot be accepted, and editing the request resets the quotation state. Both the request and proposal can be downloaded. Research informing the options is recorded in [LOGISTICS_RESEARCH.md](LOGISTICS_RESEARCH.md).

The partner quote form shows the proposed delivery price, platform fee and partner amount. The fee uses the final agreed delivery price, including client-approved adjustments. Pricing explains the independent item-sale and delivery fee bases once; contextual links replace repeated explanations. The declared goods value for insurance is not treated as a completed sale. Proposals and PDF reports retain their itemised breakdown. These are pricing illustrations with no payment processing.

`POST /api/delivery-requests` validates and saves a demo brief as a private-mode JSON file under `.local/uploads/delivery-requests/`. The browser receives a reference and downloads the complete brief as a branded A4 PDF report. Requests are not exposed through a public list/read API.

Both brief and partner-proposal downloads produce actual PDF files, including selectable text, embedded fonts, section headings, automatic page breaks and page numbers. Proposal reports include the quoted scope, price, changes, acceptance status and original client requirements. Generation happens in the browser; the library and fonts load from the site's own assets when a report is downloaded. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the pinned library and font licenses.

Partner quotes and example agreements run in memory in the browser, including when the Node application is used. No carrier is contacted and no shipment or payment is created. Real partner accounts, request distribution and shared quotation storage require a backend integration. The scanner, report generator and sales marketplace remain supporting product concepts.

## Tests

```bash
npm test
```

The 24 tests cover upload/download integrity, persistence, deletion, size limits, interrupted uploads, static pages, data protection, professional requirements, optional measurements, mock estimates, consent and invalid submissions. Quotation tests cover review before quoting, requested versus adjusted scope, exact-cent totals, partner-fee rounding and PDF breakdown, price adjustments, revisions, acceptance, request edits, stale offers and expiry.

Browser validation covers the Node dev server and static preview at 375px and 1280px: client and partner flows, optional measurements, PDFs, revisions/approval, uploads, keyboard Tab/Shift+Tab/arrows/Enter, wizard focus and progress, contrast, 44px controls and horizontal overflow. Verification assets stay outside Git. There is no configured lint command; syntax is checked with `node --check`. This is targeted verification, not a screen-reader or WCAG certification audit.

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
