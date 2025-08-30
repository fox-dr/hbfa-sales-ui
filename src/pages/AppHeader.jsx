import React from "react";

export default function AppHeader({ title = "HBFA Sales Portal", logo = "/assets/hbfa_logo.png" }) {
  const signOutRedirect = () => {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const logoutUri = window.location.origin;
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;

    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;
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
        <h2 style={{ margin: 0 }}>{title}</h2>
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
