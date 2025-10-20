import { UserManager } from "oidc-client-ts";

// === Cognito Config ===
const cognitoAuthConfig = {
  authority: "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_pL55dqPRc",
  client_id: "2a031n3pf59i2grgkqcd2m6jrj",
  redirect_uri: "http://localhost:5500/callback.html", // For local testing
  response_type: "code",
  scope: "openid email profile",
};

export const userManager = new UserManager({ ...cognitoAuthConfig });

export async function signOutRedirect() {
  const clientId = cognitoAuthConfig.client_id;
  const logoutUri = "http://localhost:5500"; // Local redirect after logout
  const cognitoDomain = "https://amplyartistwebapp.auth.eu-north-1.amazoncognito.com"; // Your Cognito hosted domain
  window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
}