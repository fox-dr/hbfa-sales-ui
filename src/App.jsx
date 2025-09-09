// src/App.jsx
import { useAuth } from "react-oidc-context";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import TrackingForm from "./pages/TrackingForm.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import OfferForm from "./pages/OfferForm.jsx";
import ApprovalsPage from "./pages/ApprovalsPage.jsx"; // stub
import ReportsPage from "./pages/ReportsPage.jsx";
import Healthcheck from "./pages/Healthcheck.jsx";
import ConstructionSchedule from "./pages/ops/ConstructionSchedule.jsx";


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
        
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/callback" element={<Navigate to="/" replace />} /> {/* 👈 one line fix */}
          <Route path="/offerform" element={<OfferForm />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/tracking" element={<TrackingForm />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/health" element={<Healthcheck />} />
          {/* Direct link only; not linked from UI */}
          <Route path="/ops/schedule" element={<ConstructionSchedule />} />
        </Routes>
      </div>
    </Router>
  );
}
