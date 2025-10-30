import React from "react";
import { useAuth } from "react-oidc-context";
import logoUrl from "../assets/hbfa-logo.png";

export default function AppHeader({ title = "HBFA Sales Portal", logo = logoUrl }) {
  const auth = useAuth();
  const signOutRedirect = async () => {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const logoutUri = window.location.origin;
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
    await auth?.removeUser?.();
    if (clientId && cognitoDomain) {
      window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
    } else {
      window.location.assign("/");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #ddd",
        padding: "12px 16px",
        background: "white",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <h2
          style={{ margin: 0, cursor: "pointer" }}
          title="Go to landing page"
          onClick={() => {
            try { window.location.assign("/"); } catch { window.location.href = "/"; }
          }}
        >
          {title}
        </h2>
        <img src={logo} alt="Logo" style={{ height: 48 }} />
      </div>
      <button
        onClick={signOutRedirect}
        style={{
          background: "#dc2626", // Tailwind red-600
          color: "white",
          padding: "6px 12px",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
        }}
      >
        Logout
      </button>
    </div>
  );
}
