import { TEMPLATE_URL, AMPLY_ACCOUNT_ID, REGION } from "../general.js";

const connectAwsBtn = document.getElementById("connectAwsBtn");
const postSetup = document.getElementById("postSetup");
const setupStatus = document.getElementById("setupStatus");

// Check if user came from template selection
window.addEventListener("DOMContentLoaded", () => {
  const selectedTemplate = localStorage.getItem("selectedTemplate");
  if (selectedTemplate && selectedTemplate !== "aws") {
    // User selected wrong template, redirect them back
    setupStatus.textContent = "⚠️ Please select AWS template to continue.";
    setupStatus.style.color = "#ff8080";
    connectAwsBtn.disabled = true;
  }
});

connectAwsBtn.addEventListener("click", () => {
  const artistInput = document.getElementById("artistName").value.trim();

  if (!artistInput) {
    setupStatus.textContent = "⚠️ Please enter an artist name first.";
    setupStatus.style.color = "#ff8080";
    return;
  }

  // Normalize artist name (lowercase, replace spaces with hyphens)
  const artistId = artistInput.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  
  localStorage.setItem("artistName", artistInput);
  localStorage.setItem("artistId", artistId);

  setupStatus.textContent = "🚀 Opening AWS setup...";
  setupStatus.style.color = "#fff";

  // CloudFormation quick-create URL with the Lambda-based setup template
  const templateURL = "https://amply-templates.s3.eu-north-1.amazonaws.com/artist-setup-lambda-template.yml";
  const stackName = `amply-setup-${artistId}`;
  
  const url = `https://console.aws.amazon.com/cloudformation/home?region=eu-north-1#/stacks/quickcreate?templateURL=${encodeURIComponent(
    templateURL
  )}&stackName=${encodeURIComponent(
    stackName
  )}&param_ArtistName=${encodeURIComponent(
    artistId
  )}&param_ArtistId=${encodeURIComponent(
    artistId
  )}&param_AmplyAPIEndpoint=${encodeURIComponent(
    "https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com/complete-artist-setup"
  )}`;

  // Open AWS CloudFormation in new tab
  window.open(url, "_blank");

  setupStatus.textContent = "✅ AWS setup opened! Click 'Create Stack' to create your infrastructure.";
  setupStatus.style.color = "#6cf";

  // Show message about what happens next
  if (postSetup) {
    postSetup.innerHTML = `
      <div style="margin-top: 20px; padding: 15px; background: #1a1a2e; border-left: 4px solid #6cf; border-radius: 4px;">
        <h4 style="margin-top: 0;">📋 Next Steps:</h4>
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Review the CloudFormation template parameters</li>
          <li>Click the <strong>"Create Stack"</strong> button</li>
          <li>AWS will automatically:
            <ul style="margin: 5px 0; padding-left: 20px;">
              <li>Create an S3 bucket in your account</li>
              <li>Set up a CloudFront distribution</li>
              <li>Create an IAM role for uploads</li>
              <li>Register everything with Amply</li>
            </ul>
          </li>
          <li>Once complete, return here to continue</li>
        </ol>
        <p style="color: #999; font-size: 12px;">This typically takes 5-10 minutes.</p>
      </div>
    `;
    postSetup.classList.remove("hidden");
  }
});