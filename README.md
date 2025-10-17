# HBFA Sales UI

This project is the front-end for the HBFA sales tools. It is built with React and Vite and provides internal teams with a streamlined workflow for preparing preliminary offer packets, previewing inventory, and pushing documentation to prospects.

## Offer Form Enhancements

The preliminary offer form now provides friendlier output for lender review and PDF delivery:

- **Lender notes** are mirrored into the template's `offer_notes_1` field so the PDF shows the plain text headline instead of the raw merge key.
- **Price formatting** preserves the unformatted numeric value for storage while supplying a `priceFmt` string to the PDF generator that includes comma separators (for example, `$1,250,000.00`).
- **Phone numbers** are normalized on blur to `(###) ###-####` (or `###-####` for 7-digit entries) across buyer, lender, and broker contact fields to avoid raw string output.

These updates keep all other form behavior intact while improving readability for both the browser view and generated PDFs.

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
