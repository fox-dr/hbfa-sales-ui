Routes and Functions Map

- `/.netlify/functions/tracking-search`
  - Methods: GET
  - Uses: DynamoDB (scan/GSI)
  - Consumers: `src/pages/TrackingForm.jsx`, `src/pages/ApprovalsPage.jsx`

- `/.netlify/functions/offers`
  - Methods: POST, GET, PUT, DELETE
  - Uses: DynamoDB + S3 vault
  - Consumers: `src/pages/TrackingForm.jsx` (PUT)

- `/.netlify/functions/offer-read`
  - Methods: GET
  - Uses: DynamoDB
  - Consumers: `src/pages/ApprovalsPage.jsx`

- `/.netlify/functions/offer-details`
  - Methods: GET
  - Uses: S3 vault
  - Consumers: `src/pages/TrackingForm.jsx`, `src/pages/ApprovalsPage.jsx`

- `/.netlify/functions/offers-approve`
  - Methods: POST
  - Uses: DynamoDB (UpdateItem)
  - Consumers: `src/pages/ApprovalsPage.jsx`

- `/.netlify/functions/report-status-coe`
  - Methods: GET (csv/json)
  - Uses: DynamoDB (Scan)
  - Consumers: reporting tools

- `/.netlify/functions/proxy-units`
  - Methods: GET, POST
  - Uses: Upstream HTTP proxy
  - Consumers: unit-related UI (if configured)

- Helper modules (not routes):
  - `netlify/functions/docusign-auth.js`: DocuSign token helper
  - `netlify/functions/utils/{auth,fieldMap,splitPayload,audit}.js`

Notes
- Each function now logs a structured JSON audit record to logs with `type=audit`, `fn`, `stage`, `user`, and `roles`.
- Search code for the function name (e.g., `tracking-search`) to find consumers.
