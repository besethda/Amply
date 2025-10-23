import { API_URL, logout } from "../general.js";
import { requireArtistAWS, loadArtistConfig } from "./general.js";

const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const coverArtInput = document.getElementById("coverArt");
const statusDiv = document.getElementById("status");

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) logoutBtn.addEventListener("click", logout);

// === UPLOAD FLOW ===
uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    statusDiv.textContent = "Please choose a music file first.";
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
    statusDiv.innerHTML = `⚠️ Your audio file is <strong>${audioSizeMB} MB</strong>. 
    Large files may take longer to upload.`;
  }

  const config = loadArtistConfig();
  if (!config.roleArn || !config.bucketName) {
    statusDiv.textContent = "❌ Missing AWS configuration.";
    return;
  }

  const title = document.getElementById("trackTitle").value.trim();
  const genre = document.getElementById("trackGenre").value.trim();
  const price = parseFloat(document.getElementById("trackPrice").value) || 0.01;

  try {
    statusDiv.textContent = "Preparing upload...";

    // === 1️⃣ Upload cover art (optional) ===
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

      await fetch(presignCoverData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": coverFile.type || "image/jpeg" },
        body: coverFile,
      });
      coverUrl = `https://${config.cloudfrontDomain}/${coverKey}`;
    }

    // === 2️⃣ Upload audio ===
    statusDiv.textContent = "Uploading track to S3...";
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

    await fetch(presignAudioData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "audio/mpeg" },
      body: file,
    });

    // === 3️⃣ Metadata JSON ===
    const metadata = {
      title: title || file.name.replace(/\.[^/.]+$/, ""),
      artist: config.displayName || config.artistId,
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

    await fetch(presignMetaData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata, null, 2),
    });

    // === 4️⃣ Update central index ===
    await fetch(`${API_URL}/update-index`, {
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

    statusDiv.innerHTML = `✅ Uploaded "<strong>${metadata.title}</strong>" successfully!`;
  } catch (err) {
    console.error("❌ Upload error:", err);
    statusDiv.innerHTML = "❌ Error: " + err.message;
  }
});