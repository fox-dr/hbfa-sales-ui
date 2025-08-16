// src/App.jsx
import { useAuth } from "react-oidc-context";
// import OfferForm from "./pages/OfferForm.jsx";
import UnitsList from "./components/UnitsList.jsx";

export default function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const logoutUri = window.location.origin; // works on Netlify too
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  if (auth.isLoading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (auth.error)     return <div style={{ padding: 24, color: "crimson" }}>Error: {auth.error.message}</div>;

  if (!auth.isAuthenticated) {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={() => auth.signinRedirect()}>Sign in</button>
      </div>
    );
  }

  return (
    <div>
      <button style={{ float: "right", margin: 10 }} onClick={signOutRedirect}>
        Logout
      </button>
      <OfferForm />
    </div>
  );
}
