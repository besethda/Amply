// === CONFIGURATION ===
const region = "eu-north-1";
const clientId = "2a031n3pf59i2grgkqcd2m6jrj"; // your Cognito app client ID
const url = `https://cognito-idp.${region}.amazonaws.com/`; // shared endpoint

// === SITE PATH CONFIG (works locally + GitHub Pages) ===
const BASE_PATH =
  window.location.origin +
  (window.location.pathname.includes("Amply-main") ? "/Amply-main" : "");

// ✅ Small helper for cleaner navigation
function goTo(path) {
  window.location.href = `${BASE_PATH}${path}`;
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
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("🔹 Login response:", data);

    // ✅ Login successful
    if (data.AuthenticationResult) {
      const { AccessToken, IdToken, RefreshToken } = data.AuthenticationResult;
      localStorage.setItem("amplyAccessToken", AccessToken);
      localStorage.setItem("amplyIdToken", IdToken);
      localStorage.setItem("amplyRefreshToken", RefreshToken);

      message.style.color = "green";
      message.textContent = "✅ Login successful! Redirecting...";

      try {
        // Decode JWT to check Cognito group
        const base64Url = IdToken.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        const userInfo = JSON.parse(jsonPayload);
        const groups = userInfo["cognito:groups"] || [];
        console.log("User groups:", groups);

        // Redirect based on Cognito group
        if (groups.includes("artist") || groups.includes("admin")) {
          setTimeout(() => goTo("/artist/dashboard.html"), 1000);
        } else {
          setTimeout(() => goTo("/listener/listener.html"), 1000);
        }
      } catch (e) {
        console.error("Error decoding JWT:", e);
        setTimeout(() => goTo("/listener/listener.html"), 1000);
      }

      return;
    }

    // ⚠️ Unconfirmed user → show verify form
    if (data.__type?.includes("UserNotConfirmedException")) {
      message.style.color = "orange";
      message.textContent = "⚠️ Account not verified. Please check your email.";
      showVerifyForm(email, true);
      return;
    }

    throw new Error(data.message || "Login failed");
  } catch (err) {
    console.error("❌ Login error:", err);
    message.style.color = "red";
    message.textContent = "❌ " + (err.message || "Login failed.");
  }
});

// === SIGNUP ===
const signupButton = document.getElementById("signupButton");
const signupMessage = document.getElementById("signupMessage");

signupButton?.addEventListener("click", async () => {
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value.trim();
  const confirm = document.getElementById("signupConfirm").value.trim();

  if (password !== confirm) {
    signupMessage.textContent = "❌ Passwords do not match.";
    return;
  }

  const payload = {
    ClientId: clientId,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "custom:role", Value: "listener" }, // 👈 everyone starts as listener
    ],
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
    console.log("🔹 Signup response:", data);

    if (data.CodeDeliveryDetails || data.UserConfirmed === false) {
      signupMessage.style.color = "green";
      signupMessage.textContent =
        "✅ Account created! Check your email for the verification code.";
      showVerifyForm(email);
    } else if (data.UserConfirmed === true) {
      signupMessage.style.color = "green";
      signupMessage.textContent = "✅ Account created and confirmed!";
    } else {
      signupMessage.style.color = "red";
      signupMessage.textContent =
        "❌ " + (data.message || "Signup failed. Try again.");
    }
  } catch (err) {
    console.error("❌ Signup error:", err);
    signupMessage.style.color = "red";
    signupMessage.textContent = "❌ " + (err.message || "Signup failed.");
  }
});

// === TOGGLE LOGIN/SIGNUP ===
document.getElementById("showSignup")?.addEventListener("click", () => {
  loginForm.style.display = "none";
  signupForm.style.display = "block";
});
document.getElementById("showLogin")?.addEventListener("click", () => {
  signupForm.style.display = "none";
  loginForm.style.display = "block";
});

// === VERIFY ACCOUNT ===
function showVerifyForm(prefilledEmail = "", autoResend = false) {
  loginForm.style.display = "none";
  signupForm.style.display = "none";

  const existing = document.getElementById("verifyForm");
  if (existing) existing.remove();

  const verifyForm = document.createElement("div");
  verifyForm.id = "verifyForm";
  verifyForm.innerHTML = `
    <h3>Email Verification</h3>
    <input type="email" id="verifyEmail" placeholder="Email" value="${prefilledEmail}" required />
    <input type="text" id="verifyCode" placeholder="Verification Code" required />
    <button id="verifyButton">Verify Account</button>
    <button id="resendCode" style="margin-top:8px;background:#555;">Resend Code</button>
    <p id="verifyMessage"></p>
    <p class="toggle-text"><span id="backToLogin">Back to login</span></p>
  `;
  container.appendChild(verifyForm);

  document.getElementById("backToLogin").onclick = () => {
    verifyForm.remove();
    loginForm.style.display = "block";
  };

  document.getElementById("verifyButton").onclick = verifyAccount;
  document.getElementById("resendCode").onclick = resendCode;

  if (autoResend && prefilledEmail) resendCode(prefilledEmail);
}

// === VERIFY + AUTO LOGIN ===
async function verifyAccount() {
  const email = document.getElementById("verifyEmail").value.trim();
  const code = document.getElementById("verifyCode").value.trim();
  const verifyMessage = document.getElementById("verifyMessage");

  if (!email || !code) {
    verifyMessage.textContent = "❌ Please enter both email and code.";
    return;
  }

  const payload = { ClientId: clientId, Username: email, ConfirmationCode: code };

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
    console.log("🔹 Verify response:", data);

    if (!data.__type || data.Session || Object.keys(data).length === 0) {
      verifyMessage.style.color = "green";
      verifyMessage.textContent = "✅ Verified! Logging you in...";

      const password =
        document.getElementById("signupPassword")?.value.trim() ||
        document.getElementById("password")?.value.trim();

      if (!password) {
        verifyMessage.textContent = "✅ Verified! Please log in manually.";
        return;
      }

      // Auto-login
      const loginPayload = {
        AuthParameters: { USERNAME: email, PASSWORD: password },
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
      };

      const loginRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-amz-json-1.1",
          "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
        },
        body: JSON.stringify(loginPayload),
      });

      const loginData = await loginRes.json();
      console.log("🔹 Auto-login response:", loginData);

      if (loginData.AuthenticationResult) {
        const { AccessToken, IdToken, RefreshToken } = loginData.AuthenticationResult;
        localStorage.setItem("amplyAccessToken", AccessToken);
        localStorage.setItem("amplyIdToken", IdToken);
        localStorage.setItem("amplyRefreshToken", RefreshToken);

        verifyMessage.textContent = "✅ Verified and logged in!";

        try {
          // decode the token to check group
          const base64Url = IdToken.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          );
          const userInfo = JSON.parse(jsonPayload);
          const groups = userInfo["cognito:groups"] || [];

          if (groups.includes("artist") || groups.includes("admin")) {
            setTimeout(() => goTo("/Amply-artist/dashboard.html"), 700);
          } else {
            setTimeout(() => goTo("/Amply-listener/listener.html"), 700);
          }
        } catch (e) {
          console.error("Error decoding JWT:", e);
          setTimeout(() => goTo("/Amply-listener/listener.html"), 700);
        }
      } else {
        verifyMessage.textContent = "✅ Verified! Please log in manually.";
      }
    } else {
      verifyMessage.style.color = "red";
      verifyMessage.textContent =
        "❌ " + (data.message || "Verification failed. Try again.");
      console.error("❌ Verify response error:", data);
    }
  } catch (err) {
    console.error("❌ Verify error:", err);
    verifyMessage.style.color = "red";
    verifyMessage.textContent =
      "❌ " + (err.message || "Verification failed. Try again.");
  }
}

// === RESEND CODE ===
async function resendCode(prefilledEmail = "") {
  const emailInput =
    prefilledEmail || document.getElementById("verifyEmail")?.value.trim();
  const verifyMessage = document.getElementById("verifyMessage");

  if (!emailInput) {
    verifyMessage.textContent = "Enter your email first.";
    return;
  }

  verifyMessage.style.color = "#333";
  verifyMessage.textContent = "Sending new code...";

  const payload = { ClientId: clientId, Username: emailInput };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.ResendConfirmationCode",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("🔹 Resend response:", data);

    if (data.CodeDeliveryDetails) {
      verifyMessage.style.color = "green";
      verifyMessage.textContent = `✅ Code resent to ${data.CodeDeliveryDetails.Destination}`;
    } else {
      verifyMessage.style.color = "red";
      verifyMessage.textContent = "❌ Could not resend code. Try again.";
    }
  } catch (err) {
    console.error("❌ Resend error:", err);
    verifyMessage.style.color = "red";
    verifyMessage.textContent =
      "❌ " + (err.message || "Failed to resend code.");
  }
}