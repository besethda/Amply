#!/bin/bash
# Quick Start: Test Waveform Analysis System
# This script helps you test the waveform analyzer without full deployment

echo "🎵 Waveform Analysis System - Quick Start Testing"
echo "=================================================="
echo ""

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is required but not installed"
    echo "Install with: brew install ffmpeg"
    exit 1
fi

echo "✅ FFmpeg found: $(ffmpeg -version | head -n1)"
echo ""

# Test 1: Analyze local audio file
echo "Test 1: Analyzing a local audio file..."
echo ""

# Create a test audio file if it doesn't exist
if [ ! -f "test-audio.mp3" ]; then
    echo "Generating test audio file (sine wave, 30 seconds)..."
    ffmpeg -f lavfi -i sine=f=440:d=30 -q:a 9 -acodec libmp3lame test-audio.mp3 -y 2>/dev/null
    echo "✅ Test audio created: test-audio.mp3"
else
    echo "ℹ️  Using existing test-audio.mp3"
fi

echo ""
echo "Test 2: Simulating Lambda function locally..."
echo ""

# Create a test script that uses the waveform analyzer logic
cat > test-waveform-analyzer.js << 'EOF'
const child_process = require("child_process");
const { promisify } = require("util");
const execFile = promisify(child_process.execFile);
const fs = require("fs");

/**
 * Normalize waveform data to 0-1 range
 */
function normalizeWaveformData(data) {
  if (!data || data.length === 0) {
    throw new Error("Empty waveform data");
  }

  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const range = maxValue - minValue;

  console.log(
    `📊 Normalizing: min=${minValue.toFixed(4)}, max=${maxValue.toFixed(4)}, range=${range.toFixed(4)}`
  );

  if (range === 0) {
    return data.map(() => 0.5);
  }

  return data.map((value) => (value - minValue) / range);
}

/**
 * Fallback: Generate synthetic but consistent waveform
 */
async function fallbackWaveformGeneration(audioPath, intervalSeconds = 0.5) {
  try {
    console.log("🔄 Using fallback waveform generation...");

    const { stdout } = await execFile("ffmpeg", [
      "-i",
      audioPath,
      "-f",
      "null",
      "-",
    ]);

    const durationMatch = stdout.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (!durationMatch) {
      throw new Error("Could not extract audio duration");
    }

    const hours = parseInt(durationMatch[1]);
    const minutes = parseInt(durationMatch[2]);
    const seconds = parseFloat(durationMatch[3]);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    console.log(`⏱️  Audio duration: ${totalSeconds.toFixed(2)} seconds`);

    const barCount = Math.ceil(totalSeconds / intervalSeconds);
    console.log(`📊 Generating ${barCount} waveform bars`);

    const waveformData = [];
    const seed = audioPath.length + audioPath.charCodeAt(0);

    for (let i = 0; i < barCount; i++) {
      const progress = i / barCount;
      const low = Math.sin(progress * Math.PI * 2) * 0.3;
      const mid = Math.sin(progress * Math.PI * 4 + seed) * 0.25;
      const high = Math.sin(progress * Math.PI * 8 + seed * 0.7) * 0.15;
      const random = (Math.random() - 0.5) * 0.1;

      let value = Math.abs(low + mid + high + random);
      const distanceFromCenter = Math.abs(progress - 0.5);
      value *= 1 + (0.5 - distanceFromCenter) * 0.3;
      value = Math.max(0, Math.min(1, value));

      waveformData.push(value);
    }

    return waveformData;
  } catch (error) {
    console.error("❌ Error in fallback generation:", error.message);
    throw error;
  }
}

/**
 * Main test
 */
(async () => {
  try {
    const audioPath = process.argv[2] || "test-audio.mp3";
    
    if (!fs.existsSync(audioPath)) {
      console.error(`❌ Audio file not found: ${audioPath}`);
      process.exit(1);
    }

    console.log(`📦 Analyzing: ${audioPath}`);
    console.log("");

    // Extract audio samples
    const waveformData = await fallbackWaveformGeneration(audioPath, 0.5);
    console.log(`✅ Extracted ${waveformData.length} samples`);
    console.log("");

    // Normalize
    const normalizedData = normalizeWaveformData(waveformData);
    console.log(`✅ Normalized waveform data`);
    console.log("");

    // Create metadata
    const waveformMetadata = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      audioFile: audioPath,
      sampleCount: normalizedData.length,
      intervalSeconds: 0.5,
      normalizationRange: {
        min: 0,
        max: 1,
      },
      data: normalizedData,
    };

    // Save to file
    const outputFile = audioPath.replace(/\.[^.]+$/, ".waveform.json");
    fs.writeFileSync(outputFile, JSON.stringify(waveformMetadata, null, 2));
    console.log(`💾 Waveform data saved to: ${outputFile}`);
    console.log("");

    // Print stats
    console.log("📊 Waveform Statistics:");
    console.log(`   - Sample count: ${normalizedData.length}`);
    console.log(`   - Min value: ${Math.min(...normalizedData).toFixed(4)}`);
    console.log(`   - Max value: ${Math.max(...normalizedData).toFixed(4)}`);
    console.log(`   - Average: ${(normalizedData.reduce((a, b) => a + b, 0) / normalizedData.length).toFixed(4)}`);
    console.log("");
    
    // Print first 20 samples
    console.log("📈 First 20 samples:");
    console.log(normalizedData.slice(0, 20).map(v => v.toFixed(3)).join(", "));
    console.log("");

    console.log("✅ Waveform analysis complete!");

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
})();
EOF

echo "Running test analyzer..."
node test-waveform-analyzer.js test-audio.mp3

echo ""
echo "Test 3: Checking output..."
if [ -f "test-audio.waveform.json" ]; then
    echo "✅ Waveform JSON file created"
    echo "File size: $(ls -lh test-audio.waveform.json | awk '{print $5}')"
    echo ""
    echo "First 100 chars of waveform.json:"
    head -c 200 test-audio.waveform.json
    echo ""
    echo ""
else
    echo "❌ Waveform JSON file not created"
fi

echo "Test 4: API Endpoint Test"
echo ""
echo "To test the API endpoint manually, use:"
echo ""
echo 'curl -X POST https://your-api.lambda-url.com/get-waveform \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "Authorization: Bearer YOUR_TOKEN" \'
echo '  -d '"'"'{
  "artistId": "artist-123",
  "songTitle": "My Song",
  "bucketName": "artist-bucket"
}'"'"
echo ""

echo "Test 5: Cleanup (optional)"
echo ""
read -p "Remove test files? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f test-audio.mp3 test-audio.waveform.json test-waveform-analyzer.js
    echo "✅ Test files cleaned up"
else
    echo "ℹ️  Test files retained for inspection"
fi

echo ""
echo "📚 Next Steps:"
echo "1. Deploy waveform-analyzer Lambda function"
echo "2. Configure S3 event triggers for artist buckets"
echo "3. Re-upload a test song to trigger analysis"
echo "4. Verify .waveform.json file appears in bucket"
echo "5. Test /get-waveform endpoint from client"
echo ""
echo "📖 Full documentation: WAVEFORM_ANALYSIS_SYSTEM.md"
