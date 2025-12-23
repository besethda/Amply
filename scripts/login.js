// =============================
// Amply Login / Signup / Confirm Script
// =============================

import { API_URL, loadAmplyIndex, isArtistProfileComplete } from "./general.js";

const region = "eu-north-1";
const clientId = "2a031n3pf59i2grgkqcd2m6jrj";
const url = `https://cognito-idp.${region}.amazonaws.com/`;

// ---------- HELPERS ----------
function goTo(path) {
  if (path.startsWith("/")) path = path.slice(1);
  window.location.href = `${window.location.origin}/${path}`;
}

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

// ---------- DOM ELEMENTS ----------
const loginBtn = document.getElementById("loginBtn");
const message = document.getElementById("message");
const signupButton = document.getElementById("signupButton");
const signupMessage = document.getElementById("signupMessage");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupConfirm = document.getElementById("signupConfirm");

// Confirmation form
const confirmButton = document.getElementById("confirmButton");
const confirmEmail = document.getElementById("confirmEmail");
const confirmCode = document.getElementById("confirmCode");
const confirmMessage = document.getElementById("confirmMessage");

// ---------- TOGGLE HANDLERS ----------
function showLoginForm() {
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("confirmForm")?.style.display = "none";
}

function showSignupForm() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("signupForm").style.display = "block";
  document.getElementById("confirmForm")?.style.display = "none";
}

function showConfirmForm(emailPrefill = "") {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("confirmForm").style.display = "block";
  if (emailPrefill) confirmEmail.value = emailPrefill;
}

document.getElementById("showSignup")?.addEventListener("click", showSignupForm);
document.getElementById("showLogin")?.addEventListener("click", showLoginForm);
document.getElementById("showLogin2")?.addEventListener("click", showLoginForm);

// ---------- SIGNUP (CREATE ACCOUNT) ----------
signupButton?.addEventListener("click", async () => {
  const email = signupEmail.value.trim();
  const password = signupPassword.value.trim();
  const confirm = signupConfirm.value.trim();

  if (!email || !password || !confirm) {
    signupMessage.textContent = "Please fill out all fields.";
    signupMessage.style.color = "red";
    return;
  }

  if (password !== confirm) {
    signupMessage.textContent = "Passwords do not match.";
    signupMessage.style.color = "red";
    return;
  }

  signupMessage.style.color = "rgb(255, 117, 31)";
  signupMessage.textContent = "Creating account...";

  const payload = {
    ClientId: clientId,
    Username: email,
    Password: password,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.SignUp",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("Signup response:", data);

    if (data.userConfirmed === false) {
      signupMessage.textContent = "✅ Account created! Check your email for a code.";
      signupMessage.style.color = "green";
      setTimeout(() => showConfirmForm(email), 1000);
    } else if (data.UserSub) {
      signupMessage.textContent = "✅ Account created successfully!";
      signupMessage.style.color = "green";
      setTimeout(() => showLoginForm(), 1500);
    } else {
      signupMessage.textContent = "⚠️ " + (data.message || "Signup failed.");
      signupMessage.style.color = "red";
    }
  } catch (err) {
    console.error("Signup error:", err);
    signupMessage.textContent = "❌ " + (err.message || "Signup failed.");
    signupMessage.style.color = "red";
  }
});

// ---------- CONFIRM EMAIL VERIFICATION ----------
confirmButton?.addEventListener("click", async () => {
  const email = confirmEmail.value.trim();
  const code = confirmCode.value.trim();

  if (!email || !code) {
    confirmMessage.textContent = "Please fill out both fields.";
    confirmMessage.style.color = "red";
    return;
  }

  confirmMessage.style.color = "rgb(255, 117, 31)";
  confirmMessage.textContent = "Verifying account...";

  const payload = {
    ClientId: clientId,
    Username: email,
    ConfirmationCode: code,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.ConfirmSignUp",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("Confirm response:", data);

    if (!data.__type) {
      confirmMessage.textContent = "✅ Account verified! You can now sign in.";
      confirmMessage.style.color = "green";
      setTimeout(() => showLoginForm(), 1500);
    } else {
      confirmMessage.textContent = "⚠️ " + (data.message || "Invalid code.");
      confirmMessage.style.color = "red";
    }
  } catch (err) {
    console.error("Confirm error:", err);
    confirmMessage.textContent = "❌ " + (err.message || "Verification failed.");
    confirmMessage.style.color = "red";
  }
});

// ---------- LOGIN ----------
loginBtn?.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    message.textContent = "Please enter your email and password.";
    message.style.color = "red";
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
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.AuthenticationResult) {
      const { AccessToken, IdToken, RefreshToken } = data.AuthenticationResult;
      localStorage.setItem("amplyAccessToken", AccessToken);
      localStorage.setItem("amplyIdToken", IdToken);
      localStorage.setItem("amplyRefreshToken", RefreshToken);

      const userInfo = parseJwt(IdToken);
      console.log("🧠 Decoded user info:", userInfo);

      const emailDecoded = (userInfo.email || email).toLowerCase();
      const artistId =
        (userInfo["custom:artistId"] ||
          userInfo["custom:artistID"] ||
          userInfo["custom:ArtistId"] ||
          (userInfo["email"] ? userInfo["email"].split("@")[0] : "") ||
          userInfo["cognito:username"] ||
          "unknown").toLowerCase();

      const role = userInfo["custom:role"] || "artist";
      console.log("🎯 artistId:", artistId, "| role:", role);

      localStorage.setItem("email", emailDecoded);
      localStorage.setItem("artistId", artistId);
      localStorage.setItem("role", role);

      // === Fetch artist config ===
      try {
        const fullUrl = `${API_URL}/get-artist-config?artist=${encodeURIComponent(artistId)}`;
        let artistConfig = null;

        const configRes = await fetch(fullUrl);
        if (configRes.ok) {
          artistConfig = await configRes.json();
        } else {
          const altUrl = `${API_URL}/get-artist-config?artist=${encodeURIComponent(emailDecoded)}`;
          const altRes = await fetch(altUrl);
          if (altRes.ok) artistConfig = await altRes.json();
        }

        if (artistConfig?.bucketName) {
          localStorage.setItem("amplyArtistConfig", JSON.stringify(artistConfig));
          console.log("✅ Artist config loaded:", artistConfig);
        } else {
          console.warn("⚠️ No artist config found for:", artistId);
        }
      } catch (err) {
        console.error("❌ Failed to load artist config:", err);
      }

      // === Load artist profile from index ===
      try {
        const indexData = await loadAmplyIndex();
        let artistProfile =
          indexData?.artists?.find(
            (a) => a.artistId?.toLowerCase() === artistId.toLowerCase()
          ) ||
          indexData?.artists?.find(
            (a) => a.artistName?.toLowerCase() === artistId.toLowerCase()
          ) ||
          indexData?.artists?.find((a) => a.artistName?.toLowerCase() === "besethda"); // fallback

        if (artistProfile) {
          localStorage.setItem("amplyArtistProfile", JSON.stringify(artistProfile));
          console.log("✅ Artist profile cached:", artistProfile);
        } else {
          console.warn("⚠️ No artist profile found for ID:", artistId);
        }
      } catch (err) {
        console.error("❌ Failed to load artist profile:", err);
      }

      // === Redirect ===
      const groups = userInfo["cognito:groups"] || [];
      const isArtist = role === "artist" || groups.includes("artist") || groups.includes("admin");

      if (isArtist) {
        const profileComplete = isArtistProfileComplete();
        console.log("🎨 Profile completeness:", profileComplete);

        if (!profileComplete) {
          console.log("🧭 Redirecting to setup-profile.html...");
          setTimeout(() => goTo("/artist/setup-profile.html"), 800);
        } else {
          console.log("🧭 Redirecting to artist dashboard...");
          setTimeout(() => goTo("/artist/dashboard.html"), 800);
        }
      } else {
        console.log("🎧 Redirecting listener...");
        setTimeout(() => goTo("/listener/listener.html"), 800);
      }
    } else {
      message.textContent =
        data.message || "Login failed. Please check your credentials.";
      message.style.color = "red";
    }
  } catch (err) {
    console.error("❌ Login error:", err);
    message.style.color = "red";
    message.textContent = "❌ " + (err.message || "Login failed.");
  }
});
