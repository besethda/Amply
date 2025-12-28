import { TEMPLATE_URL, AMPLY_ACCOUNT_ID, REGION } from "../general.js";

const connectAwsBtn = document.getElementById("connectAwsBtn");
const postSetup = document.getElementById("postSetup");
const setupStatus = document.getElementById("setupStatus");

connectAwsBtn.addEventListener("click", () => {
  const artistInput = document.getElementById("artistName").value.trim();

  if (!artistInput) {
    setupStatus.textContent = "⚠️ Please enter an artist name first.";
    setupStatus.style.color = "#ff8080";
    return;
  }

  setupStatus.textContent = "Opening AWS setup page...";
  setupStatus.style.color = "#fff";

  const artistId = artistInput.toLowerCase().replace(/[^a-z0-9-]/g, "");
  localStorage.setItem("artistName", artistInput);
  localStorage.setItem("artistId", artistId);

  // ✅ Add Return URL for the Quick Create flow
  const returnUrl = "https://amply.app/artist/setup-complete.html";

  // ✅ Build stack name and CloudFormation URL
  const stackName = `amply-${artistId}`;
  const url = `https://console.aws.amazon.com/cloudformation/home?region=${REGION}#/stacks/quickcreate?templateURL=${encodeURIComponent(
    TEMPLATE_URL
  )}&stackName=${encodeURIComponent(
    stackName
  )}&param_ArtistName=${encodeURIComponent(
    artistId
  )}&param_AmplyAccountId=${encodeURIComponent(
    AMPLY_ACCOUNT_ID
  )}&param_Region=${encodeURIComponent(
    REGION
  )}&param_ReturnUrl=${encodeURIComponent(returnUrl)}`;

  // 🚀 Open the AWS Stack creation page in a new tab
  window.open(url, "_blank");

  // 💬 Show next-step instructions
  if (postSetup) postSetup.classList.remove("hidden");

  // Update message after opening
  setupStatus.textContent =
    "✅ AWS setup page opened! Redirecting to verification page...";
  setupStatus.style.color = "#6cf";

  // 🔄 Auto-redirect to setup-complete after 1 second
  setTimeout(() => {
    window.location.href = "/artist/setup-complete.html";
  }, 1000);
});