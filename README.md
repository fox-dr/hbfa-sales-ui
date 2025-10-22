# HBFA Sales UI

This project is the front-end for the HBFA sales tools. It is built with React and Vite and provides internal teams with a streamlined workflow for preparing preliminary offer packets, previewing inventory, and pushing documentation to prospects.

## Offer Form Enhancements

The preliminary offer form now provides friendlier output for lender review and PDF delivery:

- **Lender notes** are mirrored into the template's `offer_notes_1` field so the PDF shows the plain text headline instead of the raw merge key.
- **Price formatting** preserves the unformatted numeric value for storage while supplying a `priceFmt` string to the PDF generator that includes comma separators (for example, `$1,250,000.00`).
- **Phone numbers** are normalized on blur to `(###) ###-####` (or `###-####` for 7-digit entries) across buyer, lender, and broker contact fields to avoid raw string output.

These updates keep all other form behavior intact while improving readability for both the browser view and generated PDFs.

## Netlify Functions CommonJS Migration

Netlify/AWS Lambda continues to execute each handler as CommonJS, even when the file extension is `.mjs`. To prevent `Cannot use import statement outside a module` runtime errors we converted every Netlify function entry point back to CommonJS:

- Each handler now uses `require(...)` instead of `import` and exposes the Lambda handler with `module.exports`.
- Shared helpers under `netlify/functions/utils/` stayed CommonJS and are required via relative paths (for example, `./utils/offerKey.js` and `./utils/normalizedOffer.js`).
- DocuSign helpers (`docusign-auth`, `send-for-signature`) now rely on the runtime Fetch API so they continue working without the ESM-only `node-fetch` v3 dependency.
- No changes were required for the React front end; only the serverless code path was touched, preserving API request/response shapes.

After pulling these updates you must redeploy the Netlify site (or trigger the AWS Lambda deploy) so the CommonJS handlers replace the previously uploaded ESM bundles. This resolves the intermittent “Fail to Load” / `Cannot use import statement outside a module` errors reported by offer detail and tracking views.

## Reports CSV Safeguards

The status/COE report download now mirrors the on-screen table when the API returns an unexpected empty CSV. If you run a report and fetch the CSV with the same filters, the UI will:

1. Request the CSV from the Netlify function with the active filters.
2. Detect header-only responses.
3. Fall back to the locally rendered dataset so the downloaded file matches what was shown (e.g., the expected three rows).

The "Last 30 days CSV" shortcut also injects explicit `from`/`to` dates to avoid stale filter states when exporting.

## Tracking Form Hydration

Selecting a buyer/unit from the tracking search immediately hydrates the full form:

- Pulls the non-PII offer record via `offer-read` and normalizes dates/numbers into input-safe formats.
- Auto-fills all milestone dates, financial figures, DocuSign IDs, and notes so edits start from the current state.
- Keeps the live total credits in sync as individual credit fields change.

This keeps the tracking view consistent with what has already been recorded and prevents starting from a blank slate.

## Development Notes

- Install dependencies with `npm install`, then run `npm run dev` for local development.
- Netlify functions in `netlify/functions/` handle persistence, PDF generation, and proxy requests.
- Build the production bundle with `npm run build`; preview it locally with `npm run preview`.
- Data pipeline overview:
  * `hbfa_sales_offers` is the primary DynamoDB table (PK `project_id`, SK `contract_unit_number`). All Netlify functions and the React app now create/update rows here using the composite key encoded as `offerId = "<project>::<unit>"`.
  * `polaris_raw_weekly` stores the unmodified weekly Polaris CSV rows for auditing (PK `report_date`, SK `${project_name}#${unit_name}`).
  * `scripts/backfill-hbfa-sales-offers.mjs` seeds `hbfa_sales_offers` from the legacy `fusion_offers` table. Run with `npm run backfill:sales` if you need to rehydrate historic data.
  * `scripts/import-polaris-report.mjs` loads raw Polaris rows and upserts non-Fusion units into `hbfa_sales_offers` while respecting `is_immutable` on closed units. Run with `npm run polaris:import -- --file=<csv> --report-date=YYYY-MM-DD`.
  * Skip Fusion rows in the weekly Polaris import (either by editing the CSV first or letting the script filter them) so in-house data for Fusion stays authoritative. Closed units can be frozen permanently by setting `is_immutable = 1` in `hbfa_sales_offers`.

## Main-only Push Guard (training wheels)
To avoid accidental branch deploys, this repo is configured to allow pushes only to `main` via a Git pre-push hook.

What's in place
- Hook path: `.githooks/pre-push`
- Behavior: blocks `git push` to any branch except `main`.
- Override (if truly intended): `git push --no-verify`

Managing the hook
- Disable temporarily: run with `--no-verify` on a single push.
- Remove permanently: `git config --unset core.hooksPath` (or delete `.githooks/`).
- Re-enable: `git config core.hooksPath .githooks`

Netlify deploys
- Current config is unchanged (builds from repo according to Netlify site settings).
- If desired, disable Branch Deploys/Deploy Previews in Netlify UI to enforce main-only deploys at the platform level.
