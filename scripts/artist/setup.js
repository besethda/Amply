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

  setupStatus.textContent = "✅ AWS setup opened! Complete the steps above, then we'll monitor your setup automatically.";
  setupStatus.style.color = "#6cf";

  // Start polling for stack completion
  let pollAttempts = 0;
  const maxPollAttempts = 60; // 5 minutes with 5-second intervals
  
  const pollStackStatus = setInterval(async () => {
    pollAttempts++;
    
    try {
      const response = await fetch(`https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com/stack-status/${stackName}`);
      
      if (response.status === 200) {
        // Stack creation complete!
        clearInterval(pollStackStatus);
        setupStatus.textContent = "✅ Your environment is ready! Configuring your account...";
        setupStatus.style.color = "#6cf";
        
        // Get infrastructure outputs from response
        const stackData = await response.json();
        const bucketName = stackData.BucketName;
        const cloudfrontDomain = stackData.CloudFrontDomain;
        const roleArn = stackData.RoleArn;
        
        // Register user as artist in Cognito and save infrastructure
        try {
          const registerResponse = await fetch("https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com/register-artist", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem("amplyIdToken") || ""}`
            },
            body: JSON.stringify({
              artistId: artistId,
              bucketName,
              cloudfrontDomain,
              roleArn
            })
          });
          
          if (registerResponse.ok) {
            const registerData = await registerResponse.json();
            console.log("✅ Artist registered with infrastructure:", registerData);
            
            const configData = {
              artistId: registerData.artistId,
              artistName: registerData.artistName,
              provider: registerData.provider,
              bucketName: registerData.bucketName,
              cloudfrontDomain: registerData.cloudfrontDomain,
              roleArn: registerData.roleArn
            };
            
            // Save infrastructure data to localStorage for current session
            localStorage.setItem("artistConfig", JSON.stringify(configData));
            
            // Also save to backend
            try {
              const token = localStorage.getItem("amplyIdToken");
              await fetch(`${API_URL}/artist/save-config`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ config: configData })
              });
              console.log("✅ Artist config saved to backend");
            } catch (err) {
              console.warn("⚠️ Could not save config to backend:", err);
            }
          } else {
            console.warn("⚠️ Registration failed, but infrastructure is ready");
          }
        } catch (err) {
          console.error("⚠️ Registration error:", err);
        }
        
        // Redirect to completion page
        setTimeout(() => {
          window.location.href = "setup-complete.html";
        }, 2000);
      } else if (response.status === 202) {
        // Still creating
        const data = await response.json();
        setupStatus.textContent = `⏳ Setting up your environment... ${pollAttempts * 5}s elapsed`;
        setupStatus.style.color = "#fff";
      } else if (response.status === 400) {
        // Stack failed
        clearInterval(pollStackStatus);
        const data = await response.json();
        setupStatus.textContent = `❌ Stack creation failed: ${data.message || 'Unknown error'}`;
        setupStatus.style.color = "#ff8080";
      }
    } catch (error) {
      console.error("Poll error:", error);
    }
    
    // Stop polling after max attempts
    if (pollAttempts >= maxPollAttempts) {
      clearInterval(pollStackStatus);
      setupStatus.textContent = "⏱️ Stack creation is taking longer than expected. Check your AWS console or try again.";
      setupStatus.style.color = "#ff9500";
    }
  }, 5000); // Poll every 5 seconds

  // Show message about what happens next
  if (postSetup) {
    postSetup.innerHTML = `
      <div style="margin-top: 20px; padding: 15px; background: #1a1a2e; border-left: 4px solid #6cf; border-radius: 4px;">
        <h4 style="margin-top: 0;">⏳ Waiting for your environment...</h4>
        <p>Amply is automatically checking CloudFormation for stack completion.</p>
        <p style="color: #aaa; font-size: 13px;">You can keep this tab open, or monitor your AWS CloudFormation console directly.</p>
      </div>
    `;
    postSetup.classList.remove("hidden");
  }
});