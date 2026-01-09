# Waveform Analysis System - Quick Reference

## 🎯 What This Does

When an artist uploads a song, a backend service automatically:

1. **Analyzes** the audio file using FFmpeg
2. **Extracts** amplitude measurements every 0.5 seconds
3. **Normalizes** data to 0-1 scale (min → 0, max → 1)
4. **Saves** as `.waveform.json` file in artist's S3 bucket
5. **Serves** to clients instantly via API

Result: **Accurate, consistent waveforms displayed instantly without real-time Web Audio analysis.**

---

## 📁 Files You Need to Know About

### Core Implementation

| File                          | Purpose                               | Status      |
| ----------------------------- | ------------------------------------- | ----------- |
| `lambda/waveform-analyzer.js` | Main analyzer Lambda function         | ✅ Created  |
| `index.js`                    | Added `/get-waveform` API endpoint    | ✅ Modified |
| `scripts/player.js`           | Fetch & display pre-computed waveform | ✅ Modified |

### Documentation

| File                                 | Purpose                          |
| ------------------------------------ | -------------------------------- |
| `WAVEFORM_ANALYSIS_SYSTEM.md`        | Complete technical documentation |
| `WAVEFORM_INTEGRATION_EXAMPLE.js`    | Code examples for integration    |
| `test-waveform.sh`                   | Local testing script             |
| `WAVEFORM_IMPLEMENTATION_SUMMARY.md` | This implementation overview     |

---

## 🚀 Quick Start (5 Steps)

### 1. Deploy Lambda Function

```bash
# Copy code from lambda/waveform-analyzer.js to AWS Lambda
# Runtime: Node.js 18+
# Timeout: 300 seconds
```

### 2. Add FFmpeg Layer

```
# Use Lambda Layer: arn:aws:lambda:eu-north-1:496494173385:layer:ffmpeg-layer:1
# Or create custom layer with FFmpeg binary
```

### 3. Configure S3 Event Trigger

- Go to each artist's S3 bucket
- S3 → Properties → Event Notifications
- Event: `s3:ObjectCreated:*`
- Suffix: `.mp3,.wav,.flac,.m4a,.aac,.ogg`
- Destination: `waveform-analyzer` Lambda

### 4. Test Upload

```
1. Upload song from artist dashboard
2. Wait 5-10 seconds (Lambda processing)
3. Check S3 bucket for songname.waveform.json
4. Play song from listener app → Waveform displays instantly
```

### 5. Verify API Endpoint

The `/get-waveform` endpoint is already in `index.js`. Test with:

```bash
curl -X POST https://your-api.domain/get-waveform \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "artistId": "artist-123",
    "songTitle": "My Song",
    "bucketName": "artist-bucket"
  }'
```

---

## 📊 Data Flow

```
Song Upload (mp3)
       ↓
   S3 PUT
       ↓
   S3 Event
       ↓
   Lambda Triggered
       ↓
   FFmpeg Analysis
       ↓
   Extract Samples (every 0.5 sec)
       ↓
   Normalize (min→0, max→1)
       ↓
   Save songname.waveform.json
       ↓
   Client Requests /get-waveform
       ↓
   API Returns JSON Array
       ↓
   Renderer Displays Instantly
```

---

## 💾 Data Format

**Request**:

```json
{
  "artistId": "user-123",
  "songTitle": "Song Title",
  "bucketName": "artist-bucket"
}
```

**Response**:

```json
{
  "version": "1.0",
  "createdAt": "2025-01-09T12:34:56Z",
  "audioFile": "user-123/song.mp3",
  "sampleCount": 360,
  "intervalSeconds": 0.5,
  "normalizationRange": { "min": 0, "max": 1 },
  "data": [0.1, 0.15, 0.2, 0.25, ..., 0.18]
}
```

---

## ⚡ Performance

| Task            | Time         |
| --------------- | ------------ |
| Upload file     | 1-5 sec      |
| FFmpeg analysis | 2-10 sec     |
| Fetch waveform  | <50 ms       |
| Display         | Instant      |
| **Total**       | **5-15 sec** |

---

## 🔧 Configuration Options

### Change Sample Interval

Default: `0.5` seconds (120 bars for 1-min song)

In `waveform-analyzer.js`:

```javascript
// Line ~10
async function extractAudioSamples(audioPath, intervalSeconds = 0.5) {
  // Change 0.5 to:
  // 0.25 for more bars (more detail)
  // 1.0 for fewer bars (less detail)
}
```

### Increase Lambda Timeout

For very long songs (>30 min):

1. AWS Lambda → Configuration → General Configuration
2. Timeout: 300 → 600+ seconds

---

## ❓ Troubleshooting

| Problem              | Solution                                               |
| -------------------- | ------------------------------------------------------ |
| "Waveform not found" | Re-upload the song (analyzer wasn't deployed yet)      |
| Lambda timeout       | Increase timeout to 600s or increase interval to 1.0s  |
| FFmpeg error         | Verify Lambda Layer is attached with `/opt/bin/ffmpeg` |
| S3 permission error  | Check Lambda IAM role has S3 GetObject + PutObject     |
| No .waveform.json    | Check Lambda logs in CloudWatch for errors             |

---

## 📝 Lambda Environment Variables

```
AWS_REGION=eu-north-1
```

---

## 🔐 IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::artist-*/*"
    }
  ]
}
```

---

## 📚 Full Documentation

For detailed information, see:

- `WAVEFORM_ANALYSIS_SYSTEM.md` - Complete technical guide
- `WAVEFORM_INTEGRATION_EXAMPLE.js` - Code examples
- `test-waveform.sh` - Testing instructions

---

## ✅ Verification Checklist

Before going live:

- [ ] Lambda function deployed
- [ ] FFmpeg layer attached
- [ ] IAM permissions configured
- [ ] S3 event triggers enabled
- [ ] Test song uploaded successfully
- [ ] .waveform.json file created
- [ ] `/get-waveform` API returns data
- [ ] Waveform displays when playing song
- [ ] Fallback works if .waveform.json missing

---

## 🎬 Live Example

After deployment:

```javascript
// When song plays, this automatically happens:
1. Client calls: GET /get-waveform
2. Server returns: { data: [0.1, 0.15, 0.2, ...] }
3. Renderer draws: Canvas with 120 bars
4. Animation: Plays smoothly, shows progress
5. Result: Accurate, instant waveform visualization
```

---

## 📞 Support

If issues occur:

1. Check Lambda CloudWatch logs
2. Verify S3 event delivery (S3 → Event notifications → Recent events)
3. Test locally with: `./test-waveform.sh`
4. Validate API endpoint manually with curl
5. Check IAM permissions in Lambda configuration

---

## 🚀 Next Steps

1. ✅ Code is ready - deploy Lambda
2. ✅ API endpoint is ready - no changes needed
3. ✅ Client is ready - fetches automatically
4. ⏳ Deploy Lambda function to AWS
5. ⏳ Configure S3 event triggers
6. ⏳ Test with first uploaded song

---

**Ready to deploy?**

1. Go to AWS Lambda console
2. Create new function: `waveform-analyzer`
3. Copy code from `lambda/waveform-analyzer.js`
4. Add FFmpeg Lambda Layer
5. Test!

Good luck! 🎵
