// src/App.jsx
import { useAuth } from "react-oidc-context";
import OfferForm from "./pages/OfferForm.jsx";

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

  // ✅ Once authenticated, go straight to OfferForm
  return (
    <div style={{ padding: 16 }}>
      <div style={{ float: "right" }}>
        <button onClick={signOutRedirect}>Logout</button>
      </div>
      <OfferForm />
    </div>
  );
}
