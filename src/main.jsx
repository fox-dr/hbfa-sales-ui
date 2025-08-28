// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "react-oidc-context";
import App from "./App.jsx";

//const redirectUri = window.location.origin;
const baseUri = window.location.origin;

const cognitoAuthConfig = {
// authority: `https://cognito-idp.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`,
  authority: import.meta.env.VITE_COGNITO_DOMAIN, // <-- use Hosted UI domain
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  //redirect_uri: redirectUri,
  redirect_uri: `${baseUri}/callback`, // must include callback
  //post_logout_redirect_uri: redirectUri,  
  post_logout_redirect_uri: baseUri, //safe to leave at root
  response_type: "code",
  scope: "openid email phone",
  // Seed Cognito Hosted UI endpoints for logout (discovery often omits end_session)
 
};


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
