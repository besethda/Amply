import { requireAuth, parseJwt, getAuthToken } from "../../scripts/general.js";

requireAuth();

window.addEventListener("DOMContentLoaded", () => {
  const token = getAuthToken();
  const user = parseJwt(token);

  // Fill user info
  document.getElementById("userEmail").textContent = user?.email || "Unknown";
  document.getElementById("userId").textContent = user?.sub || "N/A";

  // Example placeholder payment data
  document.getElementById("paymentAmount").textContent = "49 SEK";
  document.getElementById("planName").textContent = "Listener Premium";

  // Toggles
  document.getElementById("darkModeToggle").addEventListener("change", (e) => {
    document.body.classList.toggle("dark-mode", e.target.checked);
  });

  document.getElementById("becomeArtistBtn").addEventListener("click", () => {
    window.location.href = "../artist/setup.html"; // future page
  });

  document.getElementById("managePayments").addEventListener("click", () => {
    alert("Opening payment settings (future integration)");
  });
});