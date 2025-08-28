// src/main.jsx
console.log(">>> MAIN.JSX LOADED <<<");

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "react-oidc-context";
import App from "./App.jsx";

//const redirectUri = window.location.origin;
const baseUri = window.location.origin;

const cognitoAuthConfig = {
  authority: `https://cognito-idp.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: `${baseUri}/callback`,
  post_logout_redirect_uri: baseUri,
  response_type: "code",
  scope: "openid email phone",
};

console.log("cognitoAuthConfig", cognitoAuthConfig);

const onSigninCallback = () => {
  // strip ?code=...&state=... from the URL
  window.history.replaceState({}, document.title, window.location.pathname);
};
console.log("cognitoAuthConfig", cognitoAuthConfig);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig} onSigninCallback={onSigninCallback}>
      <App />
    </AuthProvider>
  </StrictMode>
);
