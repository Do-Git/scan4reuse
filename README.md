# Scan4Reuse

An English-language landing page for a circular-logistics startup, built with Node.js and plain HTML, CSS and JavaScript. The main journey connects buyers and logistics partners; the slide deck supplies the supporting scanning, marketplace, reporting and ESG content. No web framework or external application packages are used.

## Run

Use **Node.js 22 or later** (validated with Node.js 24):

```bash
cd /workspace/scan4reuse
npm start
```

The server listens on `127.0.0.1:3000`. `npm run dev` enables automatic server restarts during development. `HOST`, `PORT` and `UPLOAD_DIR` are optional overrides.

## Pages

- `/` — logistics-first startup landing page with the delivery planner near the core service; supporting iPhone, marketplace and report concepts; mission, vision, ESG, the five-person team and the Basel hackathon origin. Deck statistics and early interviews are integrated as expandable background context.
- `/pricing` — the pitch-deck model: **CHF 5/m² for a professional reuse report** and **8% of total marketplace sales**, plus separately quoted logistics. Live calculators illustrate report costs, commissions and seller remainder. No subscription, payment or transaction is created.
- `/upload` — the existing shared file-upload workspace, with uploads, search, filters, downloads and deletion. This earlier workspace currently uses Italian UI copy.

The origin story links to [Startup Weekend Basel](https://startupweekendbasel.ch/).

## Branding and content source

The user-supplied **Scan4Resources.pdf** supplies the brand accents, building-material use case, app mockups, sample reuse report and pricing model. These are integrated into the original logistics-startup concept, rather than presented as a sequence of pitch slides. The interface uses a calm green palette, clear service descriptions and a working delivery brief.

Product, construction-context and team images in `public/assets/` are extracted from that deck. The five founder photographs are the original embedded photos, not AI-generated replacements. The unused generated artwork from the initial concept is not included in the site.

The impact section connects Sustainable Development Goals 8, 9, 11, 12 and 13 to logistics through short descriptions and the official [United Nations goal icons](https://sdgs.un.org/goals). The five `sdg-*.jpg` assets are hosted locally; their originals are available at `https://sdgs.un.org/sites/default/files/goals/E_SDG_Icons-NN.jpg`, with `NN` matching the two-digit goal number.

Team profiles preserve the user-confirmed photograph order and titles:

1. Daria Horica — AI & Software Engineering
2. Tomas Strnadel — Architecture & Idea
3. Reazul Islam — AI & Machine Learning
4. Ivo Bosshard — Sustainability
5. Domenico Dongiovanni — Business

Construction-context figures and early interview feedback are attributed to the founding deck; they are not independently verified live metrics. The reuse report is visibly marked SAMPLE DATA. ESG content states goals, not verified carbon savings or certifications. No partner affiliations or endorsements are implied by the deck's references to other businesses.

## Client and logistics partner workflow

The client customizes the delivery for a particular good. The three-step form collects dimensions, weight, handling service, collection readiness, packaging, site access, dates and time windows, equipment, final placement and contact details. Optional services cover assembly, temporary storage/phased delivery, unpacking, building protection, condition photos, signed handover and cover clarification. Architect and facility-manager roles are supported alongside buyers, sellers and businesses.

The logistics partner view uses the same request. A partner accepts it for review, then submits an itemised quote or explicitly proposes adjusted timing, a different service or another approach. The client can accept the example proposal or ask for a revision. Superseded and expired proposals cannot be accepted, and editing the request resets the quotation state. Both the request and proposal can be downloaded. Research informing the options is recorded in [LOGISTICS_RESEARCH.md](LOGISTICS_RESEARCH.md).

`POST /api/delivery-requests` validates and saves a demo brief as a private-mode JSON file under `.local/uploads/delivery-requests/`. The browser receives a reference and can download the complete brief as text. Requests are not exposed through a public list/read API.

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
- `public/upload.html`, `public/upload.css`, `public/upload.js` — existing upload workspace.
- `public/assets/`, `public/icons.svg` — deck images and locally served icons.
- `test/server.test.mjs` — integration tests.

## Browser preview and deployment

Run `npm run build:preview` to generate `.local/preview/site` for Vercel or Netlify. The script copies only an explicit allowlist of public files; development uploads, saved contact data, environment files and the Git repository are excluded.

The public preview keeps requests and files only in browser memory and clears them on reload. It supports the complete interactive site, brief downloads and file download/deletion without publishing the development archive. The Node application continues to use its persistent filesystem storage.

Open the verified interactive preview at **https://scan4reuse-preview.vercel.app**. See [DEPLOYMENT.md](DEPLOYMENT.md) for the exact login, deployment and URL-opening steps. Building a preview does not publish the Codex environment.
