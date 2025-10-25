import { API_URL } from "../general.js";

document.getElementById("saveProfileBtn").addEventListener("click", async () => {
  const artistConfig = JSON.parse(localStorage.getItem("amplyArtistConfig") || "{}");
  const artistId = artistConfig.id || localStorage.getItem("artistId");
  const bucketName = artistConfig.bucketName;
  const cloudfrontDomain = artistConfig.cloudfrontDomain;
  const artistName = document.getElementById("artistDisplayName").value.trim();
  const bio = document.getElementById("artistBio").value.trim();
  const profileFile = document.getElementById("profilePhoto").files[0];
  const coverFile = document.getElementById("coverPhoto").files[0];
  const statusMessage = document.getElementById("statusMessage");

  if (!artistName) {
    statusMessage.textContent = "Please enter your artist name.";
    return;
  }

  statusMessage.textContent = "Uploading images...";

  const uploadToS3 = async (file, keyPrefix) => {
    if (!file) return null;
    const key = `${keyPrefix}/${file.name}`;
    const res = await fetch(`${API_URL}/get-upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: key,
        artistRoleArn: artistConfig.roleArn,
        bucketName,
        contentType: file.type,
      }),
    });

    const { uploadUrl } = await res.json();
    await fetch(uploadUrl, { method: "PUT", body: file });
    return `https://${cloudfrontDomain}/${key}`;
  };

  const profileUrl = await uploadToS3(profileFile, "profile");
  const coverUrl = await uploadToS3(coverFile, "cover");

  const payload = {
    artistId,
    artistName,
    bucketName,
    cloudfrontDomain,
    profilePhoto: profileUrl,
    coverPhoto: coverUrl,
    bio,
  };

  console.log("🧩 Sending artist profile setup payload:", payload);

  const res = await fetch(`${API_URL}/update-index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("✅ Profile response:", data);

  if (res.ok) {
    statusMessage.style.color = "green";
    statusMessage.textContent = "Profile created! Redirecting...";
    setTimeout(() => (window.location.href = "./dashboard.html"), 1500);
  } else {
    statusMessage.style.color = "red";
    statusMessage.textContent = "Failed to save profile: " + (data.error || "Unknown error");
  }
});