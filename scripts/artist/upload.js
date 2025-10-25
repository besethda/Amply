// === UPLOAD SCRIPT (Artist Dashboard) ===
// Handles song uploads, cover art, metadata, and central index updates.

import { API_URL, logout } from "../general.js";
import { requireArtistAWS, loadArtistConfig } from "./general.js";

const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const coverArtInput = document.getElementById("coverArt");
const statusDiv = document.getElementById("status");
const logoutBtn = document.getElementById("logoutBtn");

// 🧭 Require authentication and AWS config
window.addEventListener("DOMContentLoaded", () => {
  requireArtistAWS();
});

if (logoutBtn) logoutBtn.addEventListener("click", logout);

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    statusDiv.textContent = "Please choose an audio file to upload.";
    return;
  }

  const validAudioTypes = ["audio/mpeg", "audio/wav"];
  const validAudioExts = [".mp3", ".wav"];
  const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!validAudioTypes.includes(file.type) && !validAudioExts.includes(fileExt)) {
    statusDiv.textContent = "❌ Only .mp3 or .wav audio files are allowed.";
    return;
  }

  const maxAudioSizeMB = 30;
  const audioSizeMB = (file.size / 1024 / 1024).toFixed(1);
  if (audioSizeMB > maxAudioSizeMB) {
    statusDiv.innerHTML = `⚠️ Your file is <strong>${audioSizeMB} MB</strong>. Large uploads may take longer.`;
  }

  const config = loadArtistConfig();
  if (!config?.roleArn || !config?.bucketName) {
    statusDiv.textContent = "❌ Missing AWS info. Please reconnect your artist account.";
    return;
  }

  // 🧠 Pull artist info from profile/config/local
  const artistProfile = JSON.parse(localStorage.getItem("amplyArtistProfile") || "{}");
  const artistId = config.artistId || localStorage.getItem("artistId");
  const artistName =
    artistProfile.artistName || config.displayName || config.artistName || "Unknown Artist";

  const title = document.getElementById("trackTitle").value.trim();
  const genre = document.getElementById("trackGenre").value.trim();
  const price = parseFloat(document.getElementById("trackPrice").value) || 0.01;

  try {
    statusDiv.innerHTML = `<span style="color:#8df;">Preparing upload...</span>`;

    // === 1️⃣ Upload Cover Art (optional) ===
    let coverUrl = "";
    const coverFile = coverArtInput.files[0];
    if (coverFile) {
      const validImageExts = [".jpg", ".jpeg", ".png"];
      const coverExt = coverFile.name.toLowerCase().slice(coverFile.name.lastIndexOf("."));
      if (!validImageExts.includes(coverExt)) {
        statusDiv.textContent = "❌ Only .jpg, .jpeg, or .png allowed for cover art.";
        return;
      }

      const coverKey = `art/${file.name.replace(/\.[^/.]+$/, "")}-cover${coverExt}`;
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
      if (!presignCoverData.uploadUrl) throw new Error("Failed to get upload URL for cover art.");

      await fetch(presignCoverData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": coverFile.type || "image/jpeg" },
        body: coverFile,
      });

      coverUrl = `https://${config.cloudfrontDomain}/${coverKey}`;
      console.log("🎨 Uploaded cover art:", coverUrl);
    }

    // === 2️⃣ Upload Audio File ===
    statusDiv.innerHTML = `<span style="color:#8df;">Uploading audio...</span>`;
    const songKey = `songs/${file.name}`;

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
    if (!presignAudioData.uploadUrl) throw new Error("Failed to get upload URL for audio.");

    await fetch(presignAudioData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "audio/mpeg" },
      body: file,
    });

    console.log("🎵 Uploaded audio:", songKey);

    // === 3️⃣ Upload Metadata JSON ===
    statusDiv.innerHTML = `<span style="color:#8df;">Finalizing metadata...</span>`;
    const metadata = {
      title: title || file.name.replace(/\.[^/.]+$/, ""),
      artist: artistName, // ✅ real artist name from index
      genre: genre ? genre.split(",").map((g) => g.trim()) : [],
      price_per_stream: price,
      art_url: coverUrl,
      file: songKey,
      uploaded_at: new Date().toISOString(),
    };

    const metaKey = `songs/${file.name.replace(/\.[^/.]+$/, "")}.json`;

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
    if (!presignMetaData.uploadUrl) throw new Error("Failed to get upload URL for metadata.");

    await fetch(presignMetaData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata, null, 2),
    });

    // === 4️⃣ Update Central Index ===
    statusDiv.innerHTML = `<span style="color:#8df;">Updating global index...</span>`;
    const updatePayload = {
      artistId,
      artistName, // ✅ from index
      cloudfrontDomain: config.cloudfrontDomain,
      bucketName: config.bucketName,
      song: metadata,
    };

    const updateRes = await fetch(`${API_URL}/update-index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Central index update failed: ${errText}`);
    }

    // ✅ Done
    statusDiv.innerHTML = `✅ Uploaded "<strong>${metadata.title}</strong>" successfully!`;
    console.log("✅ Upload complete and global index updated:", updatePayload);
  } catch (err) {
    console.error("❌ Upload error:", err);
    statusDiv.innerHTML = `❌ Error: ${err.message}`;
  }
});