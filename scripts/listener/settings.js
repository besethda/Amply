import { requireAuth, parseJwt, getAuthToken } from "../../scripts/general.js";

requireAuth();

export function initSettingsView() {
  const token = getAuthToken();
  const user = parseJwt(token);

  const email = document.getElementById("userEmail");
  const userId = document.getElementById("userId");
  const amount = document.getElementById("paymentAmount");
  const plan = document.getElementById("planName");

  if (email) email.textContent = user?.email || "Unknown";
  if (userId) userId.textContent = user?.sub || "N/A";
  if (amount) amount.textContent = "49 SEK";
  if (plan) plan.textContent = "Listener Premium";

  document.getElementById("darkModeToggle")?.addEventListener("change", (e) => {
    document.body.classList.toggle("dark-mode", e.target.checked);
  });

  document.getElementById("becomeArtistBtn")?.addEventListener("click", () => {
    window.location.href = "../artist/setup.html";
  });

  document.getElementById("managePayments")?.addEventListener("click", () => {
    alert("Opening payment settings (future integration)");
  });
}