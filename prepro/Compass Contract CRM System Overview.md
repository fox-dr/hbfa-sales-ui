Briefing Document: Compass Contract CRM System Overview
I. Executive Summary
The Compass Contract CRM is a cloud-native web application designed to manage home sales contracts, built entirely on Amazon Web Services (AWS). Developed rapidly in a nine-day sprint, the project moved from zero AWS experience to a "secure, production-style CRM backend," demonstrating a "professional engineering mindset" in a new domain. The system leverages AWS Lambda for serverless compute, DynamoDB for sensitive client PII and contract data, S3 for secure file storage (floorplans, contract attachments), and Cognito for robust identity management and role-based access control (RBAC).

As of August 15, 2025, the core system is live with end-to-end integration, including dynamic loading of unit information, successful form submissions, and functional presigned floorplan links. Future roadmap items focus on DocuSign integration, comprehensive logout fixes, UI polish, reporting, multi-project expansion, and advanced features like workflow automation and enhanced RBAC.

II. Core Architecture and AWS Services
The Compass Contract CRM is architected around a serverless paradigm using key AWS services:

Frontend: React Single Page Application (SPA) using Vite.
Backend: AWS Lambda functions exposed via API Gateway.
Database: Amazon DynamoDB for structured data, specifically client PII and contract details.
File Storage: Amazon S3 for documents like floorplans and contract uploads.
Authentication & Authorization: AWS Cognito for user identity, authentication, and role management.
This architecture was chosen to ensure "high scalability, data availability, security, and performance," while minimizing operational overhead due to the serverless nature of Lambda and DynamoDB.

III. Key Themes and Important Ideas
1. Security-First Design and PII Protection
A paramount theme throughout the project has been the rigorous focus on security and the protection of Personally Identifiable Information (PII).

Cognito for Identity & AuthN/AuthZ:A single Cognito User Pool manages application users (sales agents, escrow coordinators, VPs, admins).
It uses "Email-first sign-up with admin approval," "MFA optional-to-required," and "Password policy" with account lockout.
"Minimal user attributes stored in Cognito (name, email, role); no client PII stored in the pool." This is a crucial design decision to centralize PII in DynamoDB.
Roles are defined in Cognito Groups (sales_agent, escrow_coord, vp_sales, admin) and "mapped into ID/Access token claims."
Data Layer Protections (DynamoDB):"All client PII (buyers, addresses, contact info) lives only in DynamoDB."
The table is "encrypted at rest (AWS-managed KMS)."
Lambdas use "least-privilege IAM roles scoped to specific table actions" and "condition keys limiting access by partition key namespaces."
"Application-level row filtering enforces tenant/role scoping," e.g., "Sales agents restricted to their assigned community/project partitions."
Secure File Handling (S3):"No public buckets. Bucket-level encryption enabled (SSE-S3 or SSE-KMS)."
"Users never upload directly. Backend issues time-limited pre-signed URLs after JWT authorization checks, with content-type and object-key constraints."
"Object keys avoid PII in the path; PII stays in DynamoDB, linked by opaque IDs."
IAM policies for S3 presigning enforce "StringEqualsIfExists" on s3:RequestObjectTag/pii": "false" to prevent PII in object tags.
Frontend PII Handling:SPA stores tokens "in memory (not localStorage) to reduce exfil risk."
"PII is redacted in lists (e.g., initials or last-4); full details only on detail views after recheck of role."
"Client-side logs scrub PII; no PII in analytics events."
Logging and Auditing:"CloudWatch logs on all Lambdas with request IDs and user IDs (no PII values in logs)."
"CloudTrail for IAM and Cognito admin actions."
"Optional DynamoDB streams to an audit trail (who changed what, when, old/new images with sensitive fields masked)."
The project specifically "explicitly avoided... Logging PII values in Lambda or client console."
2. Serverless Paradigm and Operational Efficiency
The project extensively utilizes AWS's serverless offerings, emphasizing operational efficiency and scalability.

AWS Lambda:Functions as the "serverless compute service" for the backend API.
Benefits include automatic scaling, "built-in fault tolerance," and "security measures."
Adheres to a "pay-per-use" model, "cutting your overall costs as AWS Lambda responds to real-time demands."
No "provisioning or managing infrastructure."
Amazon API Gateway:Acts as the "front door" for the Lambda functions, managing traffic, throttling, and authorization.
"Commonly used with AWS Lambda to create serverless APIs."
Amazon DynamoDB:A "fully managed NoSQL key-value and document database" that is "serverless and scalable."
Provides "single-digit millisecond performance for reads and writes at any scale."
Its "schemaless nature" offers flexibility for evolving data models.
Amazon S3:An "object storage service" designed for "high scalability, data availability, security, and performance."
Used for storing static files like floorplans and contract PDFs.
3. Role-Based Access Control (RBAC) Implementation
RBAC is central to the system's authorization model, ensuring users only access permitted resources and actions.

Roles are defined in Cognito Groups: sales_agent, escrow_coord, vp_sales, admin.
Group membership is "mapped into ID/Access token claims."
"Frontend reads role from the ID token to gate UI controls."
API calls include the JWT access token, which is then verified server-side by the "Netlify Functions/AWS Lambda layer."
A "central requireRole() helper enforces per-endpoint access," e.g., "only escrow_coord can finalize COE, only admin can manage users."
DynamoDB access further scopes permissions through IAM "Condition" keys, limiting access by "dynamodb:LeadingKeys" for specific projects/tenants and potentially user-namespaced items.
4. Rapid Development and Professional Engineering Mindset
The project highlights an accelerated development approach while maintaining high engineering standards.

The entire backend was designed and implemented in a "nine-day sprint," moving "from zero knowledge to tackling some of the same architectural issues that seasoned engineers face daily."
Emphasis on a "professional mindset: document the requirements, identify the right AWS services for each need, and avoid over-engineering."
Key principles applied: "least privilege and role-based access control," "clean separation of authentication, authorization, and data access," and "discipline" in security and maintainability.
The use of ChatGPT as a "collaborator" is noted for amplifying the journey, allowing the developer to "ask precise questions, test solutions, and refine architecture quickly."
Focus on creating a "cohesive, professional repository" with clear documentation and structure for future developers.
IV. Project Status and Future Roadmap
Current Status (as of Aug 15, 2025):
Core Data Flow: "DynamoDB backend (fusion_units_v2)" is seeded and serving home data. "Lambda API" supports queries by project, building, plan type, and unit.
Frontend Integration: "Frontend form" retrieves and submits home details (including address).
File Integration: "Floorplan PDFs" are "presigned via S3 and integrated."
Submission Workflow: "End-to-end form submission tested successfully; 'Submitted Successfully' feedback added."
Known Issues: "Logout flow needs cleanup (clear tokens/session)" and "UI needs minor cleanup (field order, labels, spacing)."
Future Roadmap:
The project roadmap outlines several phases of enhancements:

Phase 5 (Immediate Next Steps - Aug–Sep 2025):DocuSign Integration: Dynamically generate contract PDFs with signature/date fields and send for e-signature.
Authentication Cleanup: Fix logout issues (JWT/session invalidation, expired session feedback).
UI Polish: Refine form labels, alignment, and validation.
Phase 6 (Enhancements - Sep–Oct 2025):Reporting & Export: Create downloadable reports and an admin dashboard.
Multi-Project Expansion: Support additional projects beyond "Fusion" by dynamically loading project_id options.
Error Handling: Implement user-friendly error messages and API logging/alerts.
Phase 7 (Advanced Features - Oct–Dec 2025):Workflow Automation: Auto-route completed contracts and send notifications.
Search & Filter: Agent dashboard to search contracts.
Permissions / RBAC: Further implement "Role-based access (sales_agent, escrow_coord, vp_sales, admin)" to "Restrict views & actions based on role."
Phase 8 (Long-Term Vision - 2026+):Analytics & Forecasting: Contract velocity reporting, Power BI/in-app charts.
Mobile Optimization: Streamlined form entry and offline caching.
Third-Party Integrations: CRM sync with Salesforce/HubSpot, direct feeds to finance/ERP.
The roadmap items are "subject to reprioritization" and each milestone is designed to deliver a "working increment that can be demoed internally."

