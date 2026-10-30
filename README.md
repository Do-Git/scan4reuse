# Scan4Reuse

An English-language startup site for circular construction and connected logistics, built with Node.js and plain HTML, CSS and JavaScript. No external packages, build step, API keys or third-party services are required.

## Run

Use **Node.js 22 or later** (validated with Node.js 24):

```bash
cd /workspace/scan4reuse
npm start
```

The server listens on `127.0.0.1:3000`. `npm run dev` enables automatic server restarts during development. `HOST`, `PORT` and `UPLOAD_DIR` are optional overrides.

## Pages

- `/` — deck-branded landing page: material scanning, professional reuse reports, marketplace and connected delivery; target audiences; mission, vision and ESG ambitions; customer discovery; founding team and planned roadmap.
- `/pricing` — the pitch-deck model: **CHF 5/m² for a professional reuse report** and **8% of total marketplace sales**, plus separately quoted logistics. Live calculators illustrate report costs, commissions and seller remainder. No subscription, payment or transaction is created.
- `/upload` — the existing shared file-upload workspace, with uploads, search, filters, downloads and deletion. This earlier workspace currently uses Italian UI copy.

The origin story links to [Startup Weekend Basel](https://startupweekendbasel.ch/).

## Branding and content source

The user-supplied **Scan4Resources.pdf** is the source for the emerald green (`#10bb82`), coral (`#ff4937`), black and white palette; bold uppercase typography; “Scan for reuse” and “Easy / Accessible / Seamless” messaging; building-material focus; app mockups; sample reuse report; pricing model; and planned roadmap.

Images in `public/assets/` are extracted from that deck. The five founder photographs are the original embedded photos, not AI-generated replacements. The unused generated artwork from the initial concept is not included in the site.

Team profiles preserve the user-confirmed photograph order and titles:

1. Daria Horica — AI & Software Engineering
2. Tomas Strnadel — Architecture & Idea
3. Reazul Islam — AI & Machine Learning
4. Ivo Bosshard — Sustainability
5. Domenico Dongiovanni — Business

Construction-context figures and early interview feedback are attributed to the founding deck; they are not independently verified live metrics. The reuse report is visibly marked SAMPLE DATA. ESG content states goals, not verified carbon savings or certifications. The roadmap is presented as planned targets rather than completed milestones. No partner affiliations or endorsements are implied by the deck's references to other businesses.

## Delivery planner

The three-step form collects component details, dimensions and weight; origin and destination; pickup date; packaging and fragile-item needs; handling service; and contact details with consent. Room-of-choice and two-person services show floor/lift fields. Pallets show forklift availability. A sample reclaimed window can prefill the object details; its measurements and weight are illustrative and need confirmation.

`POST /api/delivery-requests` validates and saves a demo brief as a private-mode JSON file under `.local/uploads/delivery-requests/`. The browser receives a reference and can download the complete brief as text. Requests are not exposed through a public list/read API.

**No carrier is automatically contacted, no shipment is confirmed, and no payment is collected.** Live carrier-matching or messaging needs confirmed partner details and a separate integration. The scanner, report generator and sales marketplace are product concepts illustrated by the deck, not released services.

## Tests

```bash
npm test
```

The 12 integration tests use temporary directories and local HTTP servers. They cover upload/download integrity, persistence, deletion, size limits (including streamed requests), interrupted uploads, static pages and data protection, validated building-material delivery briefs, conditional requirements, consent and invalid/cross-site submissions.

Browser validation uses Chromium to exercise report/commission calculators, invalid inputs and cent rounding, report previews, marketplace prefilling, adaptive delivery fields, failed-request recovery, brief export, FAQs, mobile navigation and layouts at 320–1440px. Verification screenshots are retained locally under `.local/verification/`, outside Git.

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
