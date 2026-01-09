/**
 * Waveform Analyzer Integration Guide
 * This file shows how to integrate waveform analysis into the existing upload workflow
 */

// ========================================
// STEP 1: Update Artist Upload Handler
// ========================================
// In your artist settings/upload page (e.g., artist/upload.html or scripts/artist/upload.js)

export async function uploadSongWithWaveform(songFile) {
  try {
    console.log("🎵 Starting song upload with waveform analysis...");
    
    // 1. Get presigned upload URL
    const uploadUrlRes = await fetch(`${API_URL}/get-upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        fileName: songFile.name,
        contentType: songFile.type,
      }),
    });

    const { uploadUrl } = await uploadUrlRes.json();

    // 2. Upload file to S3 via presigned URL
    console.log("📤 Uploading file to S3...");
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": songFile.type,
      },
      body: songFile,
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload failed: ${uploadRes.status}`);
    }

    console.log("✅ File uploaded to S3");
    
    // 3. S3 event automatically triggers waveform analyzer Lambda
    // (No action needed here - it's triggered by the upload event)
    
    console.log("⏳ Waveform analysis started in background...");
    console.log("📍 The Lambda function will analyze the audio and save waveform data");
    
    // 4. Update artist index (existing flow)
    const artistId = getCurrentArtistId(); // Your function to get artist ID
    const artistBucket = getCurrentArtistBucket(); // Your function to get bucket
    
    await fetch(`${API_URL}/update-index`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        artistId: artistId,
        artistName: getArtistName(),
        cloudfrontDomain: getCloudfrontDomain(),
        bucketName: artistBucket,
        song: {
          title: songFile.name.replace(/\.[^.]+$/, ''), // Remove extension
          file: `${artistId}/${songFile.name}`, // S3 path
          duration: await getSongDuration(songFile), // Calculate duration
          uploadedAt: new Date().toISOString(),
        },
      }),
    });

    console.log("✅ Song added to artist index");
    
    return {
      success: true,
      message: "Song uploaded successfully. Waveform analysis in progress.",
    };

  } catch (error) {
    console.error("❌ Upload failed:", error);
    throw error;
  }
}

// Helper to get audio duration
async function getSongDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.onloadedmetadata = () => resolve(audio.duration);
    audio.src = URL.createObjectURL(file);
  });
}

// ========================================
// STEP 2: Monitor Waveform Analysis Progress
// ========================================
// Optional: Show user that waveform is being analyzed

export async function checkWaveformStatus(artistId, songTitle, bucketName) {
  try {
    const res = await fetch(`${API_URL}/get-waveform`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        artistId: artistId,
        songTitle: songTitle,
        bucketName: bucketName,
      }),
    });

    if (res.ok) {
      console.log("✅ Waveform analysis complete!");
      const waveformData = await res.json();
      return {
        status: "complete",
        sampleCount: waveformData.sampleCount,
        data: waveformData.data,
      };
    } else if (res.status === 404) {
      console.log("⏳ Waveform still being analyzed...");
      return {
        status: "pending",
        message: "Waveform analysis in progress",
      };
    } else {
      throw new Error(`API error: ${res.status}`);
    }
  } catch (error) {
    console.error("❌ Error checking waveform status:", error);
    return {
      status: "error",
      error: error.message,
    };
  }
}

// ========================================
// STEP 3: Poll for Waveform Completion
// ========================================
// Optional: Keep checking until waveform is ready

export async function waitForWaveformAnalysis(artistId, songTitle, bucketName, maxWaitSeconds = 60) {
  const startTime = Date.now();
  const checkInterval = 2000; // Check every 2 seconds

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const status = await checkWaveformStatus(artistId, songTitle, bucketName);

    if (status.status === "complete") {
      console.log(`✅ Waveform ready after ${(Date.now() - startTime) / 1000}s`);
      return status;
    }

    if (status.status === "error") {
      throw new Error(status.error);
    }

    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error(`Waveform analysis timed out after ${maxWaitSeconds} seconds`);
}

// ========================================
// STEP 4: Display Upload Progress UI
// ========================================
// Example HTML/UI for showing upload status

const uploadProgressHTML = `
<div id="uploadProgress" style="display: none;">
  <div class="progress-container">
    <h3>Uploading Song</h3>
    
    <div class="progress-step">
      <span class="step-number">1</span>
      <span class="step-label">Uploading to S3</span>
      <span class="step-status" id="step1-status">In Progress...</span>
    </div>

    <div class="progress-step">
      <span class="step-number">2</span>
      <span class="step-label">Analyzing Waveform</span>
      <span class="step-status" id="step2-status">Waiting...</span>
      <p class="step-description">FFmpeg is analyzing the audio file for waveform data</p>
    </div>

    <div class="progress-step">
      <span class="step-number">3</span>
      <span class="step-label">Normalizing Data</span>
      <span class="step-status" id="step3-status">Waiting...</span>
      <p class="step-description">Scaling waveform to 0-1 range for consistent display</p>
    </div>

    <div class="progress-step">
      <span class="step-number">4</span>
      <span class="step-label">Done!</span>
      <span class="step-status" id="step4-status">Waiting...</span>
    </div>
  </div>
</div>
`;

// ========================================
// STEP 5: Update UI During Upload
// ========================================

async function handleSongUploadWithProgress(songFile) {
  const progressEl = document.getElementById("uploadProgress");
  progressEl.style.display = "block";

  try {
    // Step 1: Upload
    console.log("Step 1: Uploading...");
    document.getElementById("step1-status").textContent = "In Progress...";
    
    await uploadSongWithWaveform(songFile);
    
    document.getElementById("step1-status").textContent = "✅ Complete";
    
    // Step 2-3: Waveform analysis (Lambda job)
    document.getElementById("step2-status").textContent = "In Progress...";
    document.getElementById("step3-status").textContent = "In Progress...";
    
    const artistId = getCurrentArtistId();
    const artistBucket = getCurrentArtistBucket();
    const songTitle = songFile.name.replace(/\.[^.]+$/, '');
    
    // Wait for waveform to be ready
    const waveformStatus = await waitForWaveformAnalysis(artistId, songTitle, artistBucket, 120);
    
    document.getElementById("step2-status").textContent = "✅ Complete";
    document.getElementById("step3-status").textContent = "✅ Complete";
    
    // Step 4: Done
    document.getElementById("step4-status").textContent = "✅ Complete";
    
    console.log("✅ Song upload and waveform analysis complete!");
    showSuccessMessage("Song uploaded successfully! Waveform ready for playback.");
    
  } catch (error) {
    console.error("❌ Upload failed:", error);
    showErrorMessage(`Upload failed: ${error.message}`);
  } finally {
    // Hide progress after 2 seconds
    setTimeout(() => {
      progressEl.style.display = "none";
    }, 2000);
  }
}

// ========================================
// STEP 6: CSS Styling for Progress UI
// ========================================

const progressCSS = `
.progress-container {
  max-width: 500px;
  margin: 20px auto;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.progress-container h3 {
  text-align: center;
  color: #333;
  margin-top: 0;
}

.progress-step {
  display: flex;
  align-items: center;
  margin: 15px 0;
  padding: 10px;
  border-left: 3px solid #ddd;
}

.progress-step.completed {
  border-left-color: #00ff88;
  background: rgba(0, 255, 136, 0.05);
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #f0f0f0;
  font-weight: bold;
  margin-right: 10px;
  flex-shrink: 0;
}

.progress-step.completed .step-number {
  background: #00ff88;
  color: white;
}

.step-label {
  font-weight: 600;
  color: #333;
  flex: 1;
}

.step-status {
  color: #666;
  font-size: 0.9em;
}

.step-description {
  font-size: 0.85em;
  color: #999;
  margin: 5px 0 0 40px;
}
`;

// ========================================
// STEP 7: Integration with Existing Upload Handler
// ========================================

// If you have an existing upload handler, modify it like this:

export async function existingUploadHandler(event) {
  const songFile = event.target.files[0];
  
  if (!songFile) return;

  // Show upload progress
  showUploadProgressUI();

  try {
    // Your existing upload logic here...
    
    // After successful upload, initiate waveform analysis
    const result = await uploadSongWithWaveform(songFile);
    
    // Optional: Wait for waveform to be ready before showing song as playable
    // Or show "Analysis in progress..." message
    
    console.log("✅ Song ready:", result);
    
  } catch (error) {
    console.error("❌ Upload error:", error);
  }
}

// ========================================
// SUMMARY: Complete Workflow
// ========================================

/*
Complete Upload & Waveform Analysis Workflow:

1. User selects song file in artist interface
2. Click "Upload" button
3. Frontend sends song file to presigned S3 URL
4. S3 upload event triggers Lambda
5. Lambda downloads audio file
6. FFmpeg analyzes audio for amplitude data
7. Normalize data to 0-1 range
8. Save .waveform.json to S3
9. Frontend polls /get-waveform endpoint (optional)
10. Client fetches waveform data when song is played
11. Instant waveform display without real-time analysis

Timeline:
- File upload: ~1-5 seconds (depends on file size)
- Waveform analysis: ~2-8 seconds (depends on duration)
- Total: ~5-15 seconds from upload to ready

Fallback:
- If .waveform.json not found, client generates synthetic waveform
- No disruption to user experience
*/
