# CHANGELOG

All notable changes to this project are documented here.
This project log serves as a **timeline of technical milestones, architecture decisions, and key integrations**.

---

## Executive Summary (as of Aug 15, 2025)

The Compass Contract Data Entry system is live with end-to-end integration:

* **DynamoDB backend (`fusion_units_v2`)** seeded and serving home data.
* **Lambda API** supports queries by project, building, plan type, and unit.
* **Frontend form** retrieves and submits home details (including address).
* **Floorplan PDFs** presigned via S3 and integrated.
* Submission flow completes successfully. Next milestone: DocuSign PDF workflow.

---

## Milestones

### Phase 1 — Planning & Foundation

* **Aug 5, 2025** – Defined project goal: digitize Compass sales contracts into a secure, cloud-native CRM with DynamoDB backend.
* **Aug 6, 2025** – Drafted high-level architecture (SPA frontend + AWS Lambda + DynamoDB + S3).
* **Aug 7, 2025** – Repo created, Vite/React SPA initialized.

### Phase 2 — Backend Setup

* **Aug 8, 2025** – DynamoDB table `fusion_units_v2` created and seeded with home/plan data.
* **Aug 9, 2025** – Lambda handler written to scan table with filters (project\_id, building\_id, plan\_type, unit\_number).
* **Aug 10, 2025** – Floorplan presigning implemented; S3 integration tested.

### Phase 3 — Frontend & API Integration

* **Aug 11, 2025** – Frontend form connected to Lambda API Gateway.
* **Aug 12, 2025** – Floorplan PDF viewer integrated; users can view floorplans directly.
* **Aug 13, 2025** – Authentication/login implemented; JWT verified.
* **Aug 14, 2025** – End-to-end form submission tested successfully; “Submitted Successfully” feedback added.

### Phase 4 — Data Expansion & Refinement

* **Aug 15, 2025** – Address field added from `fusion_units_v2` table. Full home details now load into form.
* **Aug 15, 2025** – Logout bug noted (session not fully cleared).

---

## Upcoming

* **DocuSign PDF Workflow**: Auto-generate sales contracts with signature/date fields.
* **Logout Fix**: Ensure JWT/session fully invalidates.
* **UI Polish**: Minor frontend cleanup (labels, formatting, error handling).

---

## Notes

* All progress aligns with original architecture plan.
* Project log doubles as onboarding guide for new developers.
