// App.jsx
import { useAuth } from "react-oidc-context";
import UnitsList from "./components/UnitsList.jsx";

export default function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const logoutUri = window.location.origin; // e.g., http://localhost:5173
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Error: {auth.error.message}</div>;
  }

  if (!auth.isAuthenticated) {
    return (
      <div>
        <button onClick={() => auth.signinRedirect()}>Sign in</button>
      </div>
    );
  }

  return (
    <div>
      <button
        style={{ float: "right", margin: "10px" }}
        onClick={signOutRedirect}
      >
        Logout
      </button>

      {/* Pass the access token to your API calls */}
      <UnitsList token={auth.user?.access_token} />
    </div>
  );
}
