import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import AppHeader from "../components/AppHeader";
import hbfaLogo from "../assets/hbfa-logo.png";
import HealthMini from "../components/HealthMini";


export default function LandingPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  // Groups/roles may be present under different claim keys depending on IdP mapping
  const prof = auth?.user?.profile || {};
  const rawCandidates = [
    prof?.["cognito:groups"],
    prof?.groups,
    prof?.roles,
    prof?.permissions,
  ].filter(Boolean);
  let groups = [];
  for (const c of rawCandidates) {
    if (Array.isArray(c)) { groups = c; break; }
    if (typeof c === "string") { groups = c.split(/[\s,]+/).filter(Boolean); break; }
  }
  console.log("User groups (detected):", groups);

  // Backward compatible role checks:
  // - Legacy: sales_user, sales_sudo, admin
  // - New: SA (Sales Associate), EC (Escrow Coordinator), VP, ADMIN
  const inGroup = (name) => {
    if (!name) return false;
    return (
      groups.includes(name) ||
      groups.includes(name.toUpperCase()) ||
      groups.includes(name.toLowerCase())
    );
  };

  const isAdmin = inGroup("admin") || inGroup("ADMIN");
  const canSales = isAdmin || inGroup("sales_user") || inGroup("SA") || inGroup("EC");
  const canApprove = isAdmin || inGroup("sales_sudo") || inGroup("VP");
  const canReports = isAdmin || inGroup("VP");
  const opsEnabled = import.meta.env.VITE_ENABLE_OPS === "true";
  const canOps = opsEnabled && (isAdmin || inGroup("OP"));



  return (
    
    <div className="p-8">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <img src={hbfaLogo} alt="HBFA Logo" className="mb-4 landing-logo" />
        {/* Health mini visible to all users; shows amber for unauthorized */}
        <HealthMini />
      </div>
      <h3 className="text-xl font-bold mb-4">Homes Built For America Sales Portal</h3>

      {/* Sales access: SA, EC, ADMIN (and legacy sales_user) */}
      {canSales && !isAdmin && (
        <>
          <button
            className="block bg-blue-500 text-white px-4 py-2 rounded mb-2"
            onClick={() => navigate("/offerform")}
          >
            New Offer
          </button>
          <button
            className="block bg-purple-500 text-white px-4 py-2 rounded mb-2"
            onClick={() => navigate("/tracking")}
          >
            Sales Tracking
          </button>
        </>
      )}

      {/* Approvals: VP, ADMIN (and legacy sales_sudo) */}
      {canApprove && !isAdmin && (
        <>
          <button
            className="block bg-green-500 text-white px-4 py-2 rounded mb-2"
            onClick={() => navigate("/approvals")}
          >
            Pending Approvals
          </button>
          {canReports && (
            <button
              className="block bg-amber-600 text-white px-4 py-2 rounded mb-2"
              onClick={() => navigate("/reports")}
            >
              Reports
            </button>
          )}
        </>
      )}

      {/* Admin (ADMIN/admin) gets all three */}
      {isAdmin && (
        <>
          <button
            className="block bg-blue-500 text-white px-4 py-2 rounded mb-2"
            onClick={() => navigate("/offerform")}
          >
            New Offer (Admin)
          </button>
          <button
            className="block bg-green-500 text-white px-4 py-2 rounded mb-2"
            onClick={() => navigate("/approvals")}
          >
            Pending Approvals (Admin)
          </button>
          <button
            className="block bg-purple-500 text-white px-4 py-2 rounded mb-2"
            onClick={() => navigate("/tracking")}
          >
            Sales Tracking (Admin)
          </button>
          <button
            className="block bg-amber-600 text-white px-4 py-2 rounded mb-2"
            onClick={() => navigate("/reports")}
          >
            Reports (Admin)
          </button>
          <button
            className="block bg-gray-700 text-white px-4 py-2 rounded mb-2"
            onClick={() => navigate("/health")}
          >
            Health (Admin)
          </button>
          {opsEnabled && (
            <button
              className="block bg-slate-700 text-white px-4 py-2 rounded mb-2"
              onClick={() => navigate("/ops/schedule")}
            >
              Construction Schedule (OPS)
            </button>
          )}
        </>
      )}

      {/* No group fallback */}
      {groups.length === 0 && (
        <p className="text-gray-600">
          No groups detected. Contact admin.
        </p>
      )}

      {/* OPS access: OP or ADMIN via separate button when not admin */}
      {!isAdmin && canOps && (
        <button
          className="block bg-slate-700 text-white px-4 py-2 rounded mt-4"
          onClick={() => navigate("/ops/schedule")}
        >
          Construction Schedule (OPS)
        </button>
      )}
    </div>
  );
}
