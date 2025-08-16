// src/App.jsx
import { useAuth } from "react-oidc-context";

export default function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const logoutUri = window.location.origin;
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
    window.location.href =
      `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  if (auth.isLoading) {
    return <div style={{ padding: 16 }}>Loading…</div>;
  }

  if (auth.error) {
    return <div style={{ padding: 16, color: "crimson" }}>Auth error: {auth.error.message}</div>;
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={{ padding: 16 }}>
        <button onClick={() => auth.signinRedirect()}>Sign in</button>
      </div>
    );
  }

  // prefer ID token for your API
  const jwt = auth.user?.id_token || auth.user?.access_token || "(no token)";
  <OfferForm />
  return (
    <div style={{ padding: 16, lineHeight: 1.6 }}>
      <div style={{ float: "right" }}>
        <button onClick={signOutRedirect}>Logout</button>
      </div>
      <h2>Logged in ✅</h2>
      <div><b>Subject:</b> {auth.user?.profile?.sub || "—"}</div>
      <div><b>Email:</b> {auth.user?.profile?.email || "—"}</div>
      <div style={{ wordBreak: "break-all", marginTop: 8 }}>
        <b>JWT (id_token or access_token):</b> {jwt.slice(0, 24)}…{jwt.slice(-16)}
      </div>
    </div>
  );
}
