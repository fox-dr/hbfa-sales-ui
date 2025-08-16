# ROADMAP

This roadmap outlines **future milestones, priorities, and enhancements** for the Compass Contract Data Entry system.
It is structured by **phases** to reflect upcoming focus areas.

---

## Phase 5 — Immediate Next Steps (Aug–Sep 2025)

* **DocuSign Integration**

  * Generate contract PDFs dynamically from form data.
  * Insert **signature** and **date fields** automatically at the bottom of each document.
  * Send for e-signature via DocuSign API.
* **Authentication Cleanup**

  * Fix logout issue: ensure JWT/session is invalidated on server and client.
  * Add feedback for expired sessions (redirect to login).
* **UI Polish**

  * Clean up form labels and field alignment.
  * Ensure required fields are validated before submission.

---

## Phase 6 — Enhancements (Sep–Oct 2025)

* **Reporting & Export**

  * Create downloadable reports (CSV/PDF) for submitted contracts.
  * Admin dashboard with submission counts, status tracking.
* **Multi-Project Expansion**

  * Support projects beyond Fusion (Sacramento, Bay Area, etc.).
  * Dynamically load `project_id` options from DynamoDB.
* **Error Handling**

  * Add user-friendly error messages (e.g., failed submission, missing data).
  * Implement logging + alerts for API errors.

---

## Phase 7 — Advanced Features (Oct–Dec 2025)

* **Workflow Automation**

  * Auto-route completed contracts to internal stakeholders (escrow, finance, VP Sales).
  * Optional notifications (email/SMS) when contract submitted.
* **Search & Filter**

  * Agent dashboard with ability to search contracts by buyer, address, or status.
* **Permissions / RBAC**

  * Role-based access (sales\_agent, escrow\_coord, vp\_sales, admin).
  * Restrict views & actions based on role.

---

## Phase 8 — Long-Term Vision (2026+)

* **Analytics & Forecasting**

  * Contract velocity reporting (days from contract to COE).
  * Integrations with Power BI or in-app charts.
* **Mobile Optimization**

  * Streamlined form entry for iPads and phones.
  * Offline caching for field agents.
* **Third-Party Integrations**

  * CRM sync with Salesforce or HubSpot.
  * Direct feeds to finance/ERP systems.

---

## Notes

* Roadmap items are **subject to reprioritization** as business needs evolve.
* Each milestone should result in a working increment that can be demoed internally.

