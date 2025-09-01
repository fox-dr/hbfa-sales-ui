import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import AppHeader from "../components/AppHeader";
import "../styles/form.css"; // shared austere styles

export default function LandingPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  // Groups come from Cognito claims in the ID token
  const groups = auth?.user?.profile?.["cognito:groups"] || [];
  const hasGroup = (g) => groups.includes(g);

  // Define available modules
  const modules = [
    {
      id: "offer",
      title: "New Offer",
      desc: "Create a new buyer offer",
      path: "/offerform",
      roles: ["sales_user", "admin"],
    },
    {
      id: "tracking",
      title: "Sales Tracking",
      desc: "Track contract status and closings",
      path: "/tracking",
      roles: ["sales_user", "admin"],
    },
    {
      id: "approvals",
      title: "Pending Approvals",
      desc: "Review and approve offers",
      path: "/approvals",
      roles: ["sales_sudo", "admin"],
    },
    // Future ERP modules can go here
    {
      id: "reporting",
      title: "Reporting",
      desc: "Dashboards and exports (Coming Soon)",
      path: null,
      roles: ["admin"],
    },
  ];

  // Filter modules by role
  const visibleModules = modules.filter((m) =>
    m.roles.some((role) => hasGroup(role))
  );

  return (
    <div className="app-form">
      <AppHeader title="HBFA Sales Portal" logo="/assets/hbfa_logo.png" />

      <h1>Welcome to the Sales Portal</h1>

      <div className="app-grid">
        {visibleModules.map((m) => (
          <div
            key={m.id}
            className={`app-card ${!m.path ? "disabled" : ""}`}
            onClick={() => m.path && navigate(m.path)}
          >
            <h2>{m.title}</h2>
            <p>{m.desc}</p>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <p style={{ marginTop: 24, color: "#666" }}>
          No groups detected. Contact admin.
        </p>
      )}

      <footer>
        <img src="/assets/hbfa_logo.png" alt="HBFA Logo" />
      </footer>
    </div>
  );
}
