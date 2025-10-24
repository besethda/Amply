import { API_URL } from "./general.js"; // ✅ use shared API endpoint

// === CONFIGURATION ===
const region = "eu-north-1";
const clientId = "2a031n3pf59i2grgkqcd2m6jrj";
const url = `https://cognito-idp.${region}.amazonaws.com/`;

// === SITE PATH CONFIG (works locally + GitHub Pages) ===
const BASE_PATH =
  window.location.origin +
  (window.location.pathname.includes("Amply-main") ? "/Amply-main" : "");

// ✅ Helper for navigation
function goTo(path) {
  window.location.href = `${BASE_PATH}${path}`;
}

// ✅ JWT decoding helper
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT decode failed:", e);
    return {};
  }
}

// === FORM ELEMENTS ===
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const container = document.getElementById("loginBox");

// === LOGIN ===
const loginBtn = document.getElementById("loginBtn");
const message = document.getElementById("message");

loginBtn?.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    message.textContent = "Please enter your email and password.";
    return;
  }

  message.style.color = "rgb(255, 117, 31)";
  message.textContent = "Signing in...";

  const payload = {
    AuthParameters: { USERNAME: email, PASSWORD: password },
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId,
  };

  try {
    console.log("🧩 Cognito request payload:", payload);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      body: JSON.stringify(payload),
    });

    console.log("🧩 Cognito response status:", res.status);
    const data = await res.json();
    console.log("🔹 Login response:", data);

    if (data.AuthenticationResult) {
      const { AccessToken, IdToken, RefreshToken } = data.AuthenticationResult;
      localStorage.setItem("amplyAccessToken", AccessToken);
      localStorage.setItem("amplyIdToken", IdToken);
      localStorage.setItem("amplyRefreshToken", RefreshToken);

      message.style.color = "green";
      message.textContent = "✅ Login successful! Loading account data...";

      const userInfo = parseJwt(IdToken);
      console.log("🧠 Decoded user info:", userInfo);

      const emailDecoded = (userInfo.email || email).toLowerCase();
      const artistId =
        (userInfo["custom:artistId"] ||
          userInfo["cognito:username"] ||
          emailDecoded.split("@")[0]).toLowerCase();
      const role = userInfo["custom:role"] || "listener";

      localStorage.setItem("email", emailDecoded);
      localStorage.setItem("artistId", artistId);
      localStorage.setItem("role", role);

      // === 🎵 Try to fetch artist config (by artist ID, fallback to email) ===
      try {
        console.log("🧩 Using API_URL:", API_URL);
        console.log("🧩 Fetching artist config for:", artistId);

        const fullUrl1 = `${API_URL}/get-artist-config?artist=${encodeURIComponent(artistId)}`;
        console.log("➡️ Fetching:", fullUrl1);

        let res = await fetch(fullUrl1);
        console.log("🔍 Status for ID fetch:", res.status);
        const text1 = await res.text();
        console.log("📦 Raw response (ID):", text1);
        let artistConfig = null;

        try {
          artistConfig = JSON.parse(text1);
        } catch (e) {
          console.error("❌ JSON parse error for ID:", e);
        }

        if (!artistConfig || !artistConfig.bucketName) {
          console.warn(`⚠️ No config found for artistId: ${artistId}, trying email...`);

          const fullUrl2 = `${API_URL}/get-artist-config?artist=${encodeURIComponent(emailDecoded)}`;
          console.log("➡️ Fetching fallback:", fullUrl2);

          const resEmail = await fetch(fullUrl2);
          console.log("🔍 Status for email fetch:", resEmail.status);
          const text2 = await resEmail.text();
          console.log("📦 Raw response (email):", text2);

          try {
            artistConfig = JSON.parse(text2);
          } catch (e) {
            console.error("❌ JSON parse error (email):", e);
          }
        }

        if (artistConfig && artistConfig.bucketName) {
          localStorage.setItem("amplyArtistConfig", JSON.stringify(artistConfig));
          console.log("✅ Artist config loaded:", artistConfig);
        } else {
          console.warn("⚠️ No artist config found for:", emailDecoded);
        }
      } catch (err) {
        console.error("❌ Failed to load artist config:", err);
      }

      // === 🎯 Redirect based on role ===
      const groups = userInfo["cognito:groups"] || [];
      if (role === "artist" || groups.includes("artist") || groups.includes("admin")) {
        setTimeout(() => goTo("/artist/dashboard.html"), 1000);
      } else {
        setTimeout(() => goTo("/listener/listener.html"), 1000);
      }

      return;
    }

    if (data.__type?.includes("UserNotConfirmedException")) {
      message.style.color = "orange";
      message.textContent = "⚠️ Account not verified. Please check your email.";
      showVerifyForm(email, true);
      return;
    }

    throw new Error(data.message || "Login failed");
  } catch (err) {
    console.error("❌ Login error (outer):", err);
    message.style.color = "red";
    message.textContent = "❌ " + (err.message || "Login failed.");
  }
});