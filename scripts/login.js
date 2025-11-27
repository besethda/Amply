import { API_URL, loadAmplyIndex, isArtistProfileComplete } from "./general.js";

const region = "eu-north-1";
const clientId = "2a031n3pf59i2grgkqcd2m6jrj";
const url = `https://cognito-idp.${region}.amazonaws.com/`;

/* --------------------------------------------------------
   FORM ELEMENTS
--------------------------------------------------------- */
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const verifyForm = document.getElementById("verifyForm");

const showSignup = document.getElementById("showSignup");
const showLogin = document.getElementById("showLogin");
const verifyBackToLogin = document.getElementById("verifyBackToLogin");

/* --------------------------------------------------------
   FORM TOGGLING
--------------------------------------------------------- */
function showLoginForm() {
  loginForm.style.display = "block";
  signupForm.style.display = "none";
  verifyForm.style.display = "none";
}

function showSignupForm() {
  loginForm.style.display = "none";
  signupForm.style.display = "block";
  verifyForm.style.display = "none";
}

function showVerifyForm() {
  loginForm.style.display = "none";
  signupForm.style.display = "none";
  verifyForm.style.display = "block";
}

showSignup?.addEventListener("click", showSignupForm);
showLogin?.addEventListener("click", showLoginForm);
verifyBackToLogin?.addEventListener("click", showLoginForm);

/* --------------------------------------------------------
   UTILS
--------------------------------------------------------- */
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
  } catch {
    return {};
  }
}

/* --------------------------------------------------------
   ENTER KEY SUBMISSION
--------------------------------------------------------- */
function enableEnterSubmit(inputIds, button) {
  inputIds.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        button.click();
      }
    });
  });
}

/* --------------------------------------------------------
   INPUT ELEMENTS
--------------------------------------------------------- */
const loginBtn = document.getElementById("loginBtn");
const message = document.getElementById("message");

const signupBtn = document.getElementById("signupButton");
const signupMessage = document.getElementById("signupMessage");

const verifyButton = document.getElementById("verifyButton");
const verifyMessage = document.getElementById("verifyMessage");
const verifyEmail = document.getElementById("verifyEmail");
const verifyCode = document.getElementById("verifyCode");

enableEnterSubmit(["email", "password"], loginBtn);
enableEnterSubmit(["signupEmail", "signupPassword", "signupConfirm"], signupBtn);
enableEnterSubmit(["verifyCode"], verifyButton);

/* --------------------------------------------------------
   TEMP STORAGE (for auto-login after verification)
--------------------------------------------------------- */
let pendingSignupEmail = null;
let pendingSignupPassword = null;

/* --------------------------------------------------------
   AUTO LOGIN AFTER EMAIL VERIFICATION
--------------------------------------------------------- */
function autoLoginAfterVerification() {
  document.getElementById("email").value = pendingSignupEmail;
  document.getElementById("password").value = pendingSignupPassword;
  loginBtn.click();
}

/* --------------------------------------------------------
   CONFIRM SIGNUP
--------------------------------------------------------- */
verifyButton?.addEventListener("click", async () => {
  const email = verifyEmail.value.trim();
  const code = verifyCode.value.trim();

  if (!code) {
    verifyMessage.textContent = "Enter the verification code.";
    return;
  }

  verifyMessage.style.color = "rgb(255,117,31)";
  verifyMessage.textContent = "Verifying...";

  const payload = {
    ClientId: clientId,
    Username: email,
    ConfirmationCode: code
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.ConfirmSignUp"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.__type?.includes("Exception")) {
      verifyMessage.style.color = "red";
      verifyMessage.textContent = "Invalid verification code.";
      return;
    }

    verifyMessage.style.color = "white";
    verifyMessage.textContent = "Verified! Logging you in...";
    setTimeout(autoLoginAfterVerification, 800);

  } catch {
    verifyMessage.style.color = "red";
    verifyMessage.textContent = "Verification failed.";
  }
});

/* --------------------------------------------------------
   SIGNUP — ALWAYS CREATE A LISTENER
--------------------------------------------------------- */
signupBtn?.addEventListener("click", async () => {
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value.trim();
  const confirm = document.getElementById("signupConfirm").value.trim();

  if (!email || !password || !confirm) {
    signupMessage.textContent = "Please fill in all fields.";
    return;
  }

  if (password !== confirm) {
    signupMessage.textContent = "Passwords do not match.";
    return;
  }

  signupMessage.style.color = "rgb(255,117,31)";
  signupMessage.textContent = "Creating account...";

  const payload = {
    ClientId: clientId,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "custom:role", Value: "listener" } // ⭐ NEW: all signups are listeners
    ]
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.SignUp"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    // If user exists but is unconfirmed → show verify form
    if (data.__type?.includes("UsernameExistsException")) {
      signupMessage.style.color = "red";
      signupMessage.textContent = "Account exists. Please verify.";

      showVerifyForm();
      verifyEmail.value = email;

      pendingSignupEmail = email;
      pendingSignupPassword = password;

      return;
    }

    // New user created → show verify
    if (data.userConfirmed === false || data.UserConfirmed === false) {
      showVerifyForm();
      verifyEmail.value = email;

      pendingSignupEmail = email;
      pendingSignupPassword = password;
      signupMessage.textContent = "";
      return;
    }

  } catch (err) {
    signupMessage.style.color = "red";
    signupMessage.textContent = "❌ Signup failed: " + err.message;
  }
});

/* --------------------------------------------------------
   LOGIN — Detect artist or listener
--------------------------------------------------------- */
loginBtn?.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    message.textContent = "Please enter your email and password.";
    return;
  }

  message.style.color = "rgb(255,117,31)";
  message.textContent = "Signing in...";

  const payload = {
    AuthParameters: { USERNAME: email, PASSWORD: password },
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.AuthenticationResult) {
      message.style.color = "red";
      message.textContent = "Invalid email or password.";
      return;
    }

    const { AccessToken, IdToken, RefreshToken } = data.AuthenticationResult;

    localStorage.setItem("amplyAccessToken", AccessToken);
    localStorage.setItem("amplyIdToken", IdToken);
    localStorage.setItem("amplyRefreshToken", RefreshToken);

    const userInfo = parseJwt(IdToken);

    const emailDecoded = (userInfo.email || email).toLowerCase();
    const userRole = userInfo["custom:role"]?.toLowerCase() || "listener";

    // Store email + role
    localStorage.setItem("email", emailDecoded);
    localStorage.setItem("role", userRole);

    /* --------------------------------------------------------
       If NOT an artist → just go to listener page
--------------------------------------------------------- */
    if (userRole !== "artist") {
      setTimeout(() => goTo("/listener/listener.html"), 400);
      return;
    }

    /* --------------------------------------------------------
       ARTIST LOGIN — load configs ONLY for artists
--------------------------------------------------------- */

    const artistId =
      (userInfo["custom:artistId"] ||
        userInfo["custom:artistID"] ||
        userInfo["custom:ArtistId"] ||
        userInfo.email.split("@")[0] ||
        userInfo["cognito:username"] ||
        "unknown"
      ).toLowerCase();

    localStorage.setItem("artistId", artistId);

    // Load artist config
    try {
      const configRes = await fetch(
        `${API_URL}/get-artist-config?artist=${encodeURIComponent(artistId)}`
      );

      if (configRes.ok) {
        const artistConfig = await configRes.json();
        localStorage.setItem("amplyArtistConfig", JSON.stringify(artistConfig));
      }
    } catch {}

    // Load artist profile
    try {
      const indexData = await loadAmplyIndex();
      const artistProfile =
        indexData?.artists?.find((a) => a.artistId?.toLowerCase() === artistId) ||
        indexData?.artists?.find((a) => a.artistName?.toLowerCase() === artistId);

      if (artistProfile) {
        localStorage.setItem("amplyArtistProfile", JSON.stringify(artistProfile));
      }
    } catch {}

    const complete = isArtistProfileComplete();

    if (!complete) {
      setTimeout(() => goTo("/artist/setup-profile.html"), 400);
    } else {
      setTimeout(() => goTo("/artist/dashboard.html"), 400);
    }

  } catch {
    message.style.color = "red";
    message.textContent = "❌ Login failed.";
  }
});