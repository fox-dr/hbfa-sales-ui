// main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "react-oidc-context";

const redirectUri = window.location.origin; // ✅ Netlify origin in prod


const cognitoAuthConfig = {
  authority: `https://cognito-idp.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  // redirect_uri: "http://localhost:5173", // must match your Cognito callback URL
  redirect_uri: redirectUri,           // ⬅️ use the dynamic origin, not localhost
  response_type: "code",
  scope: "openid email phone",
};

// Optional: after Cognito returns, strip the code/state from the URL
const onSigninCallback = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig} onSigninCallback={onSigninCallback}>
      <App />
    </AuthProvider>
  </StrictMode>
);

