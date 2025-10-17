// scripts/upload.js
import { API_URL, checkArtistConnected, loadConfig } from "./general.js";

const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const coverArtInput = document.getElementById("coverArt");
const statusDiv = document.getElementById("status");

// 🔒 Check AWS connection when page loads
window.addEventListener("DOMContentLoaded", () => {
  checkArtistConnected();
});

// ✅ Logout button (optional)
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("amplyArtistConfig");
    localStorage.removeItem("artistName");
    alert("You’ve been logged out.");
    window.location.href = "setup.html";
  });
}

// ✅ Silently verify connection on any user interaction
document.body.addEventListener("click", () => {
  checkArtistConnected({ redirect: false, showBanner: false });
});

// === UPLOAD FLOW ===
uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    statusDiv.textContent = "Please choose a music file first.";
    return;
  }

  const config = loadConfig();
  console.log("🎛 Loaded config:", config);

  if (!config.roleArn || !config.bucketName) {
    statusDiv.textContent = "❌ Please connect your AWS and save configuration first.";
    return;
  }

  const title = document.getElementById("trackTitle").value.trim();
  const genre = document.getElementById("trackGenre").value.trim();
  const price = parseFloat(document.getElementById("trackPrice").value) || 0.01;

  try {
    statusDiv.textContent = "Preparing upload...";

    // --- 1️⃣ Upload Cover Art (optional) ---
    let coverUrl = "";
    const coverFile = coverArtInput.files[0];
    if (coverFile) {
      const coverKey = `art/${file.name.replace(/\.[^/.]+$/, "")}-cover.${coverFile.name.split(".").pop()}`;
      console.log("🎨 Uploading cover art:", { coverKey });

      const presignCover = await fetch(`${API_URL}/get-upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: coverKey,
          artistRoleArn: config.roleArn,
          bucketName: config.bucketName,
          contentType: coverFile.type || "image/jpeg",
        }),
      });

      const presignCoverData = await presignCover.json();
      if (!presignCover.ok || !presignCoverData.uploadUrl)
        throw new Error(presignCoverData.error || "Failed to get upload URL for cover art.");

      const putCover = await fetch(presignCoverData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": coverFile.type || "image/jpeg" },
        body: coverFile,
      });

      if (!putCover.ok) throw new Error(`Cover upload failed (${putCover.status})`);
      coverUrl = `https://${config.cloudfrontDomain}/${coverKey}`;
    } else {
      console.log("🎨 No cover art selected — skipping cover upload.");
    }

    // --- 2️⃣ Upload Audio File ---
    statusDiv.textContent = "Uploading track to S3...";
    const songKey = `songs/${file.name}`;
    console.log("🎵 Uploading audio:", { songKey });

    const presignAudio = await fetch(`${API_URL}/get-upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: songKey,
        artistRoleArn: config.roleArn,
        bucketName: config.bucketName,
        contentType: file.type || "audio/mpeg",
      }),
    });

    const presignAudioData = await presignAudio.json();
    if (!presignAudio.ok || !presignAudioData.uploadUrl)
      throw new Error(presignAudioData.error || "Failed to get upload URL for audio.");

    const putAudio = await fetch(presignAudioData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "audio/mpeg" },
      body: file,
    });

    if (!putAudio.ok) throw new Error(`Audio upload failed (${putAudio.status})`);

    // --- 3️⃣ Upload Metadata JSON ---
    statusDiv.textContent = "Uploading metadata...";

    const metadata = {
      title: title || file.name.replace(/\.[^/.]+$/, ""),
      artist: config.displayName || config.artistId || "Unknown Artist",
      genre: genre ? genre.split(",").map((g) => g.trim()) : [],
      price_per_stream: price,
      art_url: coverUrl,
      file: songKey,
      uploaded_at: new Date().toISOString(),
    };

    const metaKey = `songs/${file.name.replace(/\.[^/.]+$/, "")}.json`;
    console.log("📝 Uploading metadata:", { metaKey });

    const presignMeta = await fetch(`${API_URL}/get-upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: metaKey,
        artistRoleArn: config.roleArn,
        bucketName: config.bucketName,
        contentType: "application/json",
      }),
    });

    const presignMetaData = await presignMeta.json();
    if (!presignMeta.ok || !presignMetaData.uploadUrl)
      throw new Error(presignMetaData.error || "Failed to get upload URL for metadata.");

    const putMeta = await fetch(presignMetaData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata, null, 2),
    });

    if (!putMeta.ok) throw new Error(`Metadata upload failed (${putMeta.status})`);

    // --- 4️⃣ Update Central Index ---
    console.log("🌍 Updating central index...");
    const updateResponse = await fetch(`${API_URL}/update-index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistId: config.artistId,
        artistName: config.displayName || config.artistId,
        cloudfrontDomain: config.cloudfrontDomain,
        bucketName: config.bucketName,
        song: metadata,
      }),
    });

    if (!updateResponse.ok) {
      const errText = await updateResponse.text();
      throw new Error(`Central index update failed: ${errText}`);
    }

    statusDiv.textContent = `✅ Uploaded "${metadata.title}" successfully!`;
    console.log("✅ Upload complete and central index updated.");
  } catch (err) {
    console.error("❌ Upload error:", err);
    statusDiv.textContent = "❌ Error: " + err.message;
  }
});