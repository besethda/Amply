import { TEMPLATE_URL, AMPLY_ACCOUNT_ID, REGION } from "../general.js";

const connectAwsBtn = document.getElementById("connectAwsBtn");

connectAwsBtn.addEventListener("click", () => {
  const artistInput = document.getElementById("artistName").value.trim();

  if (!artistInput) {
    alert("Please enter your artist name first.");
    return;
  }

  const artistId = artistInput.toLowerCase().replace(/[^a-z0-9-]/g, "");
  localStorage.setItem("artistName", artistInput);
  localStorage.setItem("artistId", artistId);

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
  )}`;

  // Launch AWS CloudFormation tab
  window.open(url, "_blank");

  // Show post-setup message
  document.getElementById("postSetup").classList.remove("hidden");
});