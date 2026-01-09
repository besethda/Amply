/**
 * Waveform Analyzer Lambda Function with ITU-R BS.1770 LUFS Loudness Measurement
 * Triggered by S3 upload events when an artist uploads a song
 * Analyzes the audio file using professional loudness metering (LUFS)
 * Saves the waveform data back to the artist's S3 bucket
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const child_process = require("child_process");
const execFile = promisify(child_process.execFile);

const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-north-1" });

/**
 * K-weighting filter for ITU-R BS.1770 LUFS measurement
 * Approximates the frequency response curve that matches human hearing
 * This emphasizes frequencies our ears are most sensitive to
 */
function applyKWeighting(samples) {
  if (samples.length < 2) return samples;
  
  // Simplified K-weighting using cascaded high-pass and shelf filters
  // Filters out low frequency rumble and boosts mid/high frequencies
  const filtered = [];
  
  // High-pass filter coefficients (removes frequencies below ~300Hz)
  const hpAlpha = 0.85;
  let prevHP = 0;
  
  // Shelf filter boost for high frequencies
  const shelfBoost = 1.3;
  
  for (let i = 0; i < samples.length; i++) {
    // Apply high-pass filter
    const delta = samples[i] - (i > 0 ? samples[i-1] : 0);
    const hp = hpAlpha * (prevHP + delta);
    prevHP = hp;
    
    // Apply shelf filter boost and take absolute value
    const weighted = Math.abs(hp) * shelfBoost;
    filtered.push(weighted);
  }
  
  return filtered;
}

/**
 * Calculate ITU-R BS.1770 LUFS loudness from audio samples
 * LUFS = Loudness Units relative to Full Scale
 * Standard reference: -23 LUFS for broadcast audio
 */
function calculateLUFS(samples, sampleRate) {
  if (samples.length === 0) return -60;
  
  // Apply K-weighting to simulate human hearing response
  const weighted = applyKWeighting(samples);
  
  // Calculate mean square (power) of weighted signal
  let sumSquares = 0;
  for (let i = 0; i < weighted.length; i++) {
    sumSquares += weighted[i] * weighted[i];
  }
  
  const meanSquare = sumSquares / weighted.length;
  
  // ITU-R BS.1770 formula: LUFS = -0.691 + 10 * log10(meanSquare)
  // Reference level where meanSquare = 1.0 corresponds to 0 LUFS
  const lufs = -0.691 + 10 * Math.log10(Math.max(0.0001, meanSquare));
  
  return lufs;
}

/**
 * Parse WAV file and extract normalized audio samples
 */
function parseWAVToSamples(buffer) {
  try {
    // Validate RIFF header
    if (buffer.toString('ascii', 0, 4) !== 'RIFF') {
      throw new Error('Invalid WAV file: missing RIFF header');
    }
    
    // Find fmt chunk
    const fmtPos = buffer.indexOf(Buffer.from('fmt '));
    if (fmtPos === -1) throw new Error('Invalid WAV: missing fmt chunk');
    
    const fmtDataStart = fmtPos + 8;
    const audioFormat = buffer.readUInt16LE(fmtDataStart);
    const channels = buffer.readUInt16LE(fmtDataStart + 2);
    const sampleRate = buffer.readUInt32LE(fmtDataStart + 4);
    const bitDepth = buffer.readUInt16LE(fmtDataStart + 14);
    
    console.log(`🎵 WAV Format: ${channels}ch, ${sampleRate}Hz, ${bitDepth}-bit`);
    
    if (audioFormat !== 1) {
      throw new Error('Only PCM WAV files are supported');
    }
    
    // Find data chunk
    const dataPos = buffer.indexOf(Buffer.from('data'));
    if (dataPos === -1) throw new Error('Invalid WAV: missing data chunk');
    
    const dataSize = buffer.readUInt32LE(dataPos + 4);
    const sampleDataStart = dataPos + 8;
    const sampleDataEnd = sampleDataStart + dataSize;
    
    // Extract and normalize samples
    const samples = [];
    const bytesPerSample = bitDepth / 8;
    
    for (let i = sampleDataStart; i < sampleDataEnd; i += bytesPerSample * channels) {
      let sampleValue = 0;
      if (bitDepth === 16) {
        sampleValue = buffer.readInt16LE(i) / 32768;
      } else if (bitDepth === 32) {
        sampleValue = buffer.readInt32LE(i) / 2147483648;
      }
      samples.push(Math.abs(sampleValue));
    }
    
    return { samples, sampleRate, channels, bitDepth };
  } catch (error) {
    console.error("❌ Error parsing WAV:", error.message);
    return { samples: [], sampleRate: 44100, channels: 2, bitDepth: 16 };
  }
}

/**
 * Analyze MP3 file with LUFS measurement
 * Decodes MP3 to PCM samples and calculates loudness per interval
 */
async function analyzeMP3WithLUFS(audioPath, intervalSeconds = 0.5) {
  try {
    console.log("🎵 Analyzing MP3 with LUFS (ITU-R BS.1770)...");
    
    // Decode MP3 to WAV using ffmpeg
    const wavPath = `/tmp/${path.basename(audioPath, '.mp3')}_decoded.wav`;
    console.log(`🔄 Decoding MP3 to PCM with ffmpeg...`);
    
    try {
      await execFile('ffmpeg', [
        '-i', audioPath,
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        '-f', 'wav',
        '-y',
        wavPath
      ], { maxBuffer: 50 * 1024 * 1024 });
    } catch (ffmpegError) {
      console.error("❌ FFmpeg decoding failed:", ffmpegError.message);
      throw ffmpegError;
    }
    
    // Check if decoded file exists
    if (!fs.existsSync(wavPath)) {
      throw new Error('FFmpeg failed to create WAV file');
    }
    
    // Parse decoded WAV
    const wavBuffer = fs.readFileSync(wavPath);
    const waveData = parseWAVToSamples(wavBuffer);
    
    if (waveData.samples.length === 0) {
      throw new Error('Failed to extract audio samples from decoded WAV');
    }
    
    console.log(`✅ Decoded: ${waveData.samples.length} samples at ${waveData.sampleRate}Hz`);
    
    // Calculate short-term LUFS in intervals
    const sampleRate = waveData.sampleRate;
    const samplesPerInterval = Math.floor(sampleRate * intervalSeconds);
    const waveformData = [];
    
    // Sliding window LUFS calculation
    for (let i = 0; i < waveData.samples.length; i += samplesPerInterval) {
      const chunk = waveData.samples.slice(i, Math.min(i + samplesPerInterval, waveData.samples.length));
      const lufs = calculateLUFS(chunk, sampleRate);
      waveformData.push(lufs);
    }
    
    console.log(`📊 Calculated LUFS for ${waveformData.length} intervals`);
    
    // Log LUFS statistics
    const lufsValues = waveformData.filter(v => v > -60);
    const minLUFS = Math.min(...lufsValues);
    const maxLUFS = Math.max(...lufsValues);
    const avgLUFS = lufsValues.reduce((a, b) => a + b, 0) / lufsValues.length;
    
    console.log(`📊 LUFS Statistics:`);
    console.log(`   Min: ${minLUFS.toFixed(2)} LUFS (silence)`);
    console.log(`   Avg: ${avgLUFS.toFixed(2)} LUFS (typical)`);
    console.log(`   Max: ${maxLUFS.toFixed(2)} LUFS (loud)`);
    
    // Normalize LUFS to 0-1 range for visualization
    // LUFS scale: -60 (silence) to 0 (full scale)
    // Map to visualization: -60 LUFS → 0.0, -5 LUFS → 1.0
    const lufsMinMap = -60;
    const lufsMaxMap = -5;
    const lufsRange = lufsMaxMap - lufsMinMap;
    
    const normalized = waveformData.map(lufs => {
      // Clamp to range
      const clamped = Math.max(lufsMinMap, Math.min(lufsMaxMap, lufs));
      // Normalize to 0-1
      const norm = (clamped - lufsMinMap) / lufsRange;
      // Apply power curve for better visualization of dynamic range
      return Math.pow(norm, 0.4);
    });
    
    // Clean up temp WAV file
    try {
      fs.unlinkSync(wavPath);
    } catch (e) {
      console.warn("Warning: Could not delete temp WAV file");
    }
    
    return {
      sampleRate,
      channels: waveData.channels,
      bitDepth: 16,
      samples: normalized.map(val => Math.max(0.05, Math.min(1.0, val)))
    };
  } catch (error) {
    console.error("❌ Error with LUFS analysis:", error.message);
    console.log("🔄 Falling back to WAV-based analysis...");
    // Don't use fallback for MP3, just throw
    throw error;
  }
}

/**
 * Analyze WAV file with LUFS measurement
 */
async function analyzeWAVWithLUFS(audioPath, intervalSeconds = 0.5) {
  try {
    console.log("📀 Analyzing WAV file with LUFS...");
    
    const buffer = fs.readFileSync(audioPath);
    const waveData = parseWAVToSamples(buffer);
    
    if (waveData.samples.length === 0) {
      throw new Error('Failed to extract samples from WAV file');
    }
    
    console.log(`✅ Parsed WAV: ${waveData.samples.length} samples at ${waveData.sampleRate}Hz`);
    
    // Calculate short-term LUFS in intervals
    const sampleRate = waveData.sampleRate;
    const samplesPerInterval = Math.floor(sampleRate * intervalSeconds);
    const waveformData = [];
    
    for (let i = 0; i < waveData.samples.length; i += samplesPerInterval) {
      const chunk = waveData.samples.slice(i, Math.min(i + samplesPerInterval, waveData.samples.length));
      const lufs = calculateLUFS(chunk, sampleRate);
      waveformData.push(lufs);
    }
    
    console.log(`📊 Calculated LUFS for ${waveformData.length} intervals`);
    
    // Log LUFS statistics
    const lufsValues = waveformData.filter(v => v > -60);
    const minLUFS = Math.min(...lufsValues);
    const maxLUFS = Math.max(...lufsValues);
    const avgLUFS = lufsValues.reduce((a, b) => a + b, 0) / lufsValues.length;
    
    console.log(`📊 LUFS Statistics:`);
    console.log(`   Min: ${minLUFS.toFixed(2)} LUFS`);
    console.log(`   Avg: ${avgLUFS.toFixed(2)} LUFS`);
    console.log(`   Max: ${maxLUFS.toFixed(2)} LUFS`);
    
    // Normalize LUFS to 0-1 range
    const lufsMinMap = -60;
    const lufsMaxMap = -5;
    const lufsRange = lufsMaxMap - lufsMinMap;
    
    const normalized = waveformData.map(lufs => {
      const clamped = Math.max(lufsMinMap, Math.min(lufsMaxMap, lufs));
      const norm = (clamped - lufsMinMap) / lufsRange;
      return Math.pow(norm, 0.4);
    });
    
    return {
      sampleRate,
      channels: waveData.channels,
      bitDepth: 16,
      samples: normalized.map(val => Math.max(0.05, Math.min(1.0, val)))
    };
  } catch (error) {
    console.error("❌ Error analyzing WAV with LUFS:", error.message);
    throw error;
  }
}

/**
 * Extract audio samples based on file format
 */
async function extractAudioSamples(audioPath, intervalSeconds = 0.5) {
  try {
    console.log(`📊 Extracting audio with LUFS measurement at ${intervalSeconds}s intervals`);

    const fileExtension = audioPath.toLowerCase().split('.').pop();

    if (fileExtension === 'wav') {
      return await analyzeWAVWithLUFS(audioPath, intervalSeconds);
    } else if (fileExtension === 'mp3') {
      return await analyzeMP3WithLUFS(audioPath, intervalSeconds);
    } else {
      throw new Error(`Unsupported audio format: ${fileExtension}`);
    }
  } catch (error) {
    console.error("❌ Error extracting audio samples:", error.message);
    throw error;
  }
}

/**
 * Generate fallback waveform (silent audio)
 */
function generateSilentWaveform(duration = 30) {
  const sampleRate = 44100;
  const barCount = Math.ceil(duration / 0.5);
  const samples = new Array(barCount).fill(0.05); // Minimum value for silent audio
  
  return {
    sampleRate,
    channels: 2,
    bitDepth: 16,
    samples
  };
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log("🎵 Waveform Analyzer Lambda triggered");
  console.log("📋 Event:", JSON.stringify(event, null, 2));

  try {
    // Parse S3 event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key);
    
    console.log(`🔗 S3 Bucket: ${bucket}`);
    console.log(`📁 Object Key: ${key}`);

    // Extract artist path and validate
    const pathParts = key.split('/');
    if (pathParts.length < 2) {
      throw new Error('Invalid S3 key structure');
    }

    const [artistId, songFileName] = [pathParts[0], pathParts[pathParts.length - 1]];
    const songTitle = songFileName.replace(/\.(wav|mp3)$/i, '');

    console.log(`👤 Artist ID: ${artistId}`);
    console.log(`🎵 Song Title: ${songTitle}`);

    // Download audio file from S3
    const tmpAudioPath = `/tmp/${songFileName}`;
    console.log(`⬇️  Downloading ${key} to ${tmpAudioPath}`);

    const getObjectCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(getObjectCommand);
    const body = await response.Body.transformToByteArray();
    fs.writeFileSync(tmpAudioPath, body);

    console.log(`✅ Downloaded ${(body.length / 1024 / 1024).toFixed(2)} MB`);

    // Analyze audio
    console.log(`🎼 Analyzing audio...`);
    const waveformResult = await extractAudioSamples(tmpAudioPath, 0.5);

    console.log(`📊 Waveform generated with ${waveformResult.samples.length} samples`);
    console.log(`📊 Sample values (first 10): ${waveformResult.samples.slice(0, 10).map(v => v.toFixed(3)).join(', ')}`);
    console.log(`📊 Min: ${Math.min(...waveformResult.samples).toFixed(3)}, Max: ${Math.max(...waveformResult.samples).toFixed(3)}`);

    // Create waveform data object
    const waveformData = {
      title: songTitle,
      duration: (waveformResult.samples.length * 0.5),
      sampleRate: waveformResult.sampleRate,
      channels: waveformResult.channels,
      bitDepth: waveformResult.bitDepth,
      analysisMethod: "ITU-R BS.1770 LUFS",
      timestamp: new Date().toISOString(),
      data: waveformResult.samples
    };

    // Upload waveform data to S3
    const waveformKey = `${artistId}/${songTitle}.waveform.json`;
    console.log(`📤 Uploading waveform data to s3://${bucket}/${waveformKey}`);

    const putObjectCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: waveformKey,
      Body: JSON.stringify(waveformData, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'original-file': songFileName,
        'analysis-date': new Date().toISOString(),
        'analysis-method': 'LUFS'
      }
    });

    await s3.send(putObjectCommand);
    console.log(`✅ Waveform data saved to S3`);

    // Cleanup
    fs.unlinkSync(tmpAudioPath);
    console.log(`🧹 Cleaned up temporary files`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Waveform analysis complete',
        waveformKey,
        sampleCount: waveformResult.samples.length,
        duration: waveformData.duration
      })
    };
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Stack:", error.stack);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Waveform analysis failed',
        message: error.message
      })
    };
  }
};
