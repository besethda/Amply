import { API_URL, loadAmplyIndex, isArtistProfileComplete } from "./general.js";

const region = "eu-north-1";
const clientId = "2a031n3pf59i2grgkqcd2m6jrj";
const url = `https://cognito-idp.${region}.amazonaws.com/`;

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
    if (data.AuthenticationResult) {
      const { AccessToken, IdToken, RefreshToken } = data.AuthenticationResult;
      localStorage.setItem("amplyAccessToken", AccessToken);
      localStorage.setItem("amplyIdToken", IdToken);
      localStorage.setItem("amplyRefreshToken", RefreshToken);
      const userInfo = parseJwt(IdToken);
      console.log("Decoded user info:", userInfo);

      const emailDecoded = (userInfo.email || email).toLowerCase();

      const artistId =
        (userInfo["custom:artistId"] ||
          userInfo["custom:artistID"] || // uppercase fallback
          userInfo["custom:ArtistId"] || // safety catch
          (userInfo["email"] ? userInfo["email"].split("@")[0] : "") ||
          userInfo["cognito:username"] ||
          "unknown").toLowerCase();

      const role = userInfo["custom:role"] || "artist"; // ✅ define role before using
      console.log("🎯 artistId resolved as:", artistId);
      console.log("🎯 role resolved as:", role);

      // Save to localStorage
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
          indexData?.artists?.find((a) => a.artistId?.toLowerCase() === artistId.toLowerCase()) ||
          indexData?.artists?.find((a) => a.artistName?.toLowerCase() === artistId.toLowerCase()) ||
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
      const isArtist =
        role === "artist" || groups.includes("artist") || groups.includes("admin");

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
    }
  } catch (err) {
    console.error("❌ Login error:", err);
    message.style.color = "red";
    message.textContent = "❌ " + (err.message || "Login failed.");
  }
});