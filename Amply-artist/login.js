const region = "eu-north-1";
const clientId = "2a031n3pf59i2grgkqcd2m6jrj"; // your Cognito app client ID

// --- FORM ELEMENTS ---
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const container = document.getElementById("loginBox");

// --- LOGIN ---
const loginBtn = document.getElementById("loginBtn");
const message = document.getElementById("message");

loginBtn?.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    message.textContent = "Please enter your email and password.";
    return;
  }

  message.style.color = "#333";
  message.textContent = "Signing in...";

  const url = `https://cognito-idp.${region}.amazonaws.com/`;
  const payload = {
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
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

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    console.log("🔹 Login response:", data);

    // ✅ Login successful
    if (data.AuthenticationResult) {
      const { AccessToken, IdToken, RefreshToken } = data.AuthenticationResult;
      localStorage.setItem("amplyAccessToken", AccessToken);
      localStorage.setItem("amplyIdToken", IdToken);
      localStorage.setItem("amplyRefreshToken", RefreshToken);

      message.style.color = "green";
      message.textContent = "✅ Login successful! Redirecting...";
      setTimeout(() => (window.location.href = "dashboard.html"), 1000);
      return;
    }

    // ⚠️ User not confirmed
    if (
      data.__type?.includes("NotAuthorizedException") ||
      data.__type?.includes("UserNotConfirmedException") ||
      JSON.stringify(data).toLowerCase().includes("not confirmed")
    ) {
      message.style.color = "orange";
      message.textContent = "⚠️ Account not verified. Please check your email.";
      showVerifyForm(email, true); // auto resend code
      return;
    }

    throw new Error(data.message || "Login failed");
  } catch (err) {
    console.error("❌ Login error:", err);
    message.style.color = "red";
    message.textContent =
      err.message?.includes("not confirmed")
        ? "⚠️ Account not verified. Please check your email."
        : "❌ " + (err.message || "Login failed.");

    if (err.message?.toLowerCase().includes("not confirmed")) {
      showVerifyForm(email, true);
    }
  }
});

// --- SIGNUP ---
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

  const url = `https://cognito-idp.${region}.amazonaws.com/`;
  const payload = {
    ClientId: clientId,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
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

// --- TOGGLE LOGIN/SIGNUP ---
document.getElementById("showSignup")?.addEventListener("click", () => {
  loginForm.style.display = "none";
  signupForm.style.display = "block";
});
document.getElementById("showLogin")?.addEventListener("click", () => {
  signupForm.style.display = "none";
  loginForm.style.display = "block";
});

// --- VERIFY ACCOUNT ---
function showVerifyForm(prefilledEmail = "", autoResend = false) {
  loginForm.style.display = "none";
  signupForm.style.display = "none";

  let existing = document.getElementById("verifyForm");
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

async function verifyAccount() {
  const email = document.getElementById("verifyEmail").value.trim();
  const code = document.getElementById("verifyCode").value.trim();
  const verifyMessage = document.getElementById("verifyMessage");

  if (!email || !code) {
    verifyMessage.textContent = "❌ Please enter both email and code.";
    return;
  }

  const url = `https://cognito-idp.${region}.amazonaws.com/`;
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

    if (Object.keys(data).length === 0) {
      verifyMessage.style.color = "green";
      verifyMessage.textContent = "✅ Verified! You can now log in.";
      setTimeout(() => {
        document.getElementById("verifyForm").remove();
        loginForm.style.display = "block";
      }, 1500);
    } else {
      verifyMessage.style.color = "red";
      verifyMessage.textContent =
        "❌ " + (data.message || "Verification failed. Try again.");
    }
  } catch (err) {
    console.error("❌ Verify error:", err);
    verifyMessage.textContent =
      "❌ " + (err.message || "Verification failed. Try again.");
  }
}

// --- RESEND CODE ---
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

  const url = `https://cognito-idp.${region}.amazonaws.com/`;
  const payload = { ClientId: clientId, Username: emailInput };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target":
          "AWSCognitoIdentityProviderService.ResendConfirmationCode",
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
      verifyMessage.textContent =
        "❌ Could not resend code. Try again in a minute.";
    }
  } catch (err) {
    console.error("❌ Resend error:", err);
    verifyMessage.style.color = "red";
    verifyMessage.textContent =
      "❌ " + (err.message || "Failed to resend code.");
  }
}