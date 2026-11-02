# PDF report dependencies

The website generates delivery briefs and partner proposals in the browser using locally hosted assets. No external PDF service or CDN is used at runtime.

## jsPDF 4.2.1

- Project: https://github.com/parallax/jsPDF
- Source package: https://registry.npmjs.org/jspdf/-/jspdf-4.2.1.tgz
- Distributed browser bundle: `public/vendor/jspdf.umd.min.js` (`dist/jspdf.umd.min.js` from the pinned package).
- License: MIT, preserved in `public/vendor/LICENSE-jsPDF.txt` and the bundle's license header.

Only text and vector drawing APIs are used. The bundle loads when a PDF is requested.

## DejaVu Sans

- Project: https://dejavu-fonts.github.io/
- Distributed font files: `public/assets/fonts/DejaVuSans.ttf` and `DejaVuSans-Bold.ttf`, unmodified.
- License and copyright notices: `public/assets/fonts/LICENSE-DejaVu.txt` (Bitstream Vera permission notice; DejaVu changes are public domain).

The regular and bold fonts are embedded in generated reports to preserve accented names, measurements and symbols in selectable PDF text.
