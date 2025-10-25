import { API_URL, loadAmplyIndex } from "../general.js";

document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.getElementById("saveProfileBtn");
  const statusMessage = document.getElementById("statusMessage");

  if (!saveBtn) return;

  saveBtn.addEventListener("click", async () => {
    try {
      const artistConfig = JSON.parse(localStorage.getItem("amplyArtistConfig") || "{}");
      const artistId = artistConfig.id || localStorage.getItem("artistId");
      const bucketName = artistConfig.bucketName;
      const cloudfrontDomain = artistConfig.cloudfrontDomain;
      const roleArn = artistConfig.roleArn;

      const artistName = document.getElementById("artistDisplayName").value.trim();
      const bio = document.getElementById("artistBio").value.trim();
      const profileFile = document.getElementById("profilePhoto").files[0];
      const coverFile = document.getElementById("coverPhoto").files[0];

      if (!artistId || !bucketName || !cloudfrontDomain || !roleArn) {
        statusMessage.style.color = "red";
        statusMessage.textContent = "Missing artist configuration. Please reconnect.";
        console.error("❌ Missing required artist config:", { artistId, bucketName, cloudfrontDomain, roleArn });
        return;
      }

      if (!artistName) {
        statusMessage.style.color = "orange";
        statusMessage.textContent = "Please enter your artist name.";
        return;
      }

      statusMessage.style.color = "black";
      statusMessage.textContent = "Uploading images...";

      // === Helper: upload file to S3 using Lambda presigned URL ===
      const uploadToS3 = async (file, keyPrefix) => {
        if (!file) return null;
        const key = `${keyPrefix}/${file.name}`;

        const presignRes = await fetch(`${API_URL}/get-upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: key,
            artistRoleArn: roleArn,
            bucketName,
            contentType: file.type,
          }),
        });

        if (!presignRes.ok) {
          throw new Error(`Failed to get upload URL: ${await presignRes.text()}`);
        }

        const { uploadUrl } = await presignRes.json();
        await fetch(uploadUrl, { method: "PUT", body: file });
        return `https://${cloudfrontDomain}/${key}`;
      };

      const existingProfile = JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}");

      const profileUrl = profileFile
        ? await uploadToS3(profileFile, "profile")
        : existingProfile.profilePhoto || "";

      const coverUrl = coverFile
        ? await uploadToS3(coverFile, "cover")
        : existingProfile.coverPhoto || "";

      statusMessage.textContent = "Saving profile data...";

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
        statusMessage.textContent = "Profile saved! Redirecting...";

        // 🧠 Update local cache with latest data
        const indexData = await loadAmplyIndex();
        const updatedProfile = indexData?.artists?.find((a) => a.artistId === artistId);
        if (updatedProfile) {
          localStorage.setItem("amplyArtistProfile", JSON.stringify(updatedProfile));
          console.log("🎨 Cached updated artist profile:", updatedProfile);
        }

        setTimeout(() => {
          window.location.href = `${window.location.origin}/artist/dashboard.html`;
        }, 1500);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {
      console.error("❌ Profile setup failed:", err);
      statusMessage.style.color = "red";
      statusMessage.textContent = "Failed to save profile: " + err.message;
    }
  });
});