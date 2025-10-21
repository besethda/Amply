document.addEventListener("DOMContentLoaded", () => {
  const artistConfig = localStorage.getItem("amplyArtistConfig");
  const summary = document.getElementById("configSummary");
  const manual = document.getElementById("manualConfig");
  const continueBtn = document.getElementById("continueBtn");

  if (artistConfig) {
    const config = JSON.parse(artistConfig);

    document.getElementById("artistNameDisplay").textContent = config.displayName || config.artistId;
    document.getElementById("bucketDisplay").textContent = config.bucketName;
    document.getElementById("cloudfrontDisplay").textContent = config.cloudfrontDomain;

    summary.classList.remove("hidden");
    continueBtn.classList.remove("hidden");
  } else {
    manual.classList.remove("hidden");
  }

  document.getElementById("saveConfigBtn")?.addEventListener("click", () => {
    const bucket = document.getElementById("bucketName").value.trim();
    const role = document.getElementById("roleArn").value.trim();
    const cf = document.getElementById("cloudfrontDomain").value.trim();
    const status = document.getElementById("configStatus");

    if (!bucket || !role || !cf) {
      status.textContent = "⚠️ Please fill in all fields.";
      return;
    }

    const artistName = localStorage.getItem("artistName") || "Unknown";
    const artistId = localStorage.getItem("artistId") || artistName.toLowerCase();

    const config = {
      artistId,
      displayName: artistName,
      bucketName: bucket,
      roleArn: role,
      cloudfrontDomain: cf,
    };

    localStorage.setItem("amplyArtistConfig", JSON.stringify(config));
    status.textContent = "✅ Configuration saved!";
    setTimeout(() => window.location.reload(), 800);
  });

  continueBtn?.addEventListener("click", () => {
    window.location.href = "upload.html";
  });
});