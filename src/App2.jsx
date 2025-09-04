// src/App.jsx
import { useAuth } from "react-oidc-context";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TrackingForm from "./pages/TrackingForm.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import OfferForm from "./pages/OfferForm.jsx";
import ApprovalsPage from "./pages/ApprovalsPage.jsx"; // stub


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
    return (
      <div style={{ padding: 16, color: "crimson" }}>
        Auth error: {auth.error.message}
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={{ padding: 16 }}>
        <button onClick={() => auth.signinRedirect()}>Sign in</button>
      </div>
    );
  }

  // ✅ Once authenticated, show router
  return (
    <Router>
      <div style={{ padding: 16 }}>
        <div style={{ float: "right" }}>
          <button onClick={signOutRedirect}>Logout</button>
        </div>

        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/offerform" element={<OfferForm />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/tracking" element={<TrackingForm />} />
        </Routes>
      </div>
    </Router>
  );
}
