import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import AppHeader from "../components/AppHeader";


export default function LandingPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  // Groups come from Cognito claims in the ID token
  const groups = auth?.user?.profile?.["cognito:groups"] || [];
  console.log("User groups:", groups);

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



  return (
    
    <div className="p-8">
      <img src="/assets/hbfa-logo.png" alt="HBFA Logo" className="mb-4" />
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
        <button
          className="block bg-green-500 text-white px-4 py-2 rounded mb-2"
          onClick={() => navigate("/approvals")}
        >
          Pending Approvals
        </button>
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
        </>
      )}

      {/* No group fallback */}
      {groups.length === 0 && (
        <p className="text-gray-600">
          No groups detected. Contact admin.
        </p>
      )}
    </div>
  );
}
