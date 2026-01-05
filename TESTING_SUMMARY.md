# Artist Onboarding Testing - Complete Summary

## What's Been Created

I've created a comprehensive testing suite for the artist onboarding flow with multiple tools to test all endpoints. Here's what you have:

### 📋 Documentation Files

1. **[ARTIST_ONBOARDING_TESTS.md](./ARTIST_ONBOARDING_TESTS.md)**
   - Detailed endpoint documentation
   - Request/response examples for all 6 main endpoints
   - Error codes and handling
   - Full testing sequence (copy-paste ready)

2. **[TESTING_GUIDE.md](./TESTING_GUIDE.md)**
   - Quick start guide
   - Test coverage overview
   - Full end-to-end testing script
   - Debugging and troubleshooting

### 🧪 Test Scripts

1. **[test_artist_onboarding.py](./test_artist_onboarding.py)** ⭐ Recommended
   - 11 comprehensive tests with assertions
   - Color-coded output
   - Tests valid requests AND error cases
   - Run: `python test_artist_onboarding.py`

2. **[test-artist-onboarding.sh](./test-artist-onboarding.sh)**
   - Bash script version
   - cURL-based testing
   - Run: `./test-artist-onboarding.sh`

3. **[Amply_Artist_Onboarding_API.postman_collection.json](./Amply_Artist_Onboarding_API.postman_collection.json)**
   - Postman collection with all endpoints
   - Pre-configured variables
   - Example requests and tests
   - Import into Postman for UI-based testing

---

## The 6 Core Endpoints

### 1️⃣ POST `/connect` - Initiate Setup
```bash
curl -X POST https://api.amply.app/connect \
  -H "Content-Type: application/json" \
  -d '{"artistName":"Test Artist"}'
```
✅ Starts CloudFormation stack creation  
⏱️ Takes 5-10 minutes  

### 2️⃣ GET `/stack-status/{stackName}` - Poll Status
```bash
curl https://api.amply.app/stack-status/amply-test-artist
```
✅ Check if stack is ready  
⏳ Poll every 30 seconds until `CREATE_COMPLETE`

### 3️⃣ POST `/complete-artist-setup` - Finalize
```bash
curl -X POST https://api.amply.app/complete-artist-setup \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"artistId":"...","provider":"aws","outputs":{...},"callback_token":"..."}'
```
✅ Saves artist config to DynamoDB  
🔐 Requires valid JWT token and callback token

### 4️⃣ POST `/list` - List Files
```bash
curl -X POST https://api.amply.app/list \
  -d '{"artistRoleArn":"...","bucketName":"..."}'
```
✅ Lists all files in artist's bucket  

### 5️⃣ POST `/get-upload-url` - Get Presigned URL
```bash
curl -X POST https://api.amply.app/get-upload-url \
  -d '{"fileName":"song.mp3","artistRoleArn":"...","bucketName":"..."}'
```
✅ Generates 5-minute presigned URL  
⬆️ Use to upload songs

### 6️⃣ POST `/update-index` - Save to Central Index
```bash
curl -X POST https://api.amply.app/update-index \
  -d '{"artistId":"...","artistName":"...","cloudfrontDomain":"...","bucketName":"...","song":{...}}'
```
✅ Saves artist profile and songs  
🌐 Makes them discoverable to listeners

---

## Quick Testing Steps

### Option A: Python (Automated) ⭐
```bash
# Install requests library
pip install requests

# Run all 11 tests
python test_artist_onboarding.py

# With custom API
export API_URL="https://your-api.example.com"
export JWT_TOKEN="your-token"
python test_artist_onboarding.py
```

**Output:**
- ✅ Green checkmarks for passing tests
- ❌ Red X's for failing tests
- Summary count at the end

### Option B: Bash (Manual)
```bash
# Run all tests
./test-artist-onboarding.sh

# With custom API
export API_URL="https://your-api.example.com"
export JWT_TOKEN="your-token"
./test-artist-onboarding.sh
```

### Option C: Postman (UI)
1. Open Postman
2. Click "Import" → Select `Amply_Artist_Onboarding_API.postman_collection.json`
3. Set environment variables in Postman:
   - `API_URL`: https://api.amply.app
   - `JWT_TOKEN`: your-jwt-token
   - `AWS_ACCOUNT_ID`: 123456789
4. Run requests individually or use "Run Collection"

### Option D: Manual cURL
```bash
# See ARTIST_ONBOARDING_TESTS.md or TESTING_GUIDE.md for examples
# Copy-paste any cURL commands directly into terminal
```

---

## What Each Test Covers

| Test # | Name | Checks |
|--------|------|--------|
| 1 | POST /connect valid | Can create stack with artist name |
| 2 | POST /connect missing | Rejects empty requests (400) |
| 3 | GET /stack-status notfound | Returns 404 for non-existent stacks |
| 4 | POST /complete-artist-setup missing | Requires all fields (400) |
| 5 | POST /complete-artist-setup invalid | Rejects short tokens (401) |
| 6 | POST /list missing | Requires role + bucket (400) |
| 7 | POST /get-upload-url missing | Requires all fields (400) |
| 8 | POST /get-upload-url valid | Generates presigned URLs ✅ |
| 9 | POST /update-index missing | Requires artist info (400) |
| 10 | CORS preflight | Returns CORS headers (204) |
| 11 | Invalid JSON | Graceful error handling (400) |

---

## Expected Test Results

**All tests should pass** ✅:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Passed: 11
Failed: 0
Total: 11

✓ All tests passed!
```

---

## Troubleshooting

### "Connection refused"
```bash
# Check API URL
echo $API_URL

# Verify API is running
curl -I https://api.amply.app/health
```

### "Unauthorized" (401)
```bash
# Set JWT token
export JWT_TOKEN="your-jwt-token"

# Verify it's set
echo $JWT_TOKEN
```

### Stack creation fails
```bash
# Check CloudFormation logs
aws cloudformation describe-stacks \
  --stack-name amply-test-artist \
  --region eu-north-1

# View stack events
aws cloudformation describe-stack-events \
  --stack-name amply-test-artist \
  --region eu-north-1
```

### Presigned URL invalid
```bash
# Check role ARN is correct
aws iam get-role \
  --role-name AmplyArtistRole

# Verify bucket exists
aws s3api list-buckets
```

---

## Full Onboarding Flow Test

Use the script in [TESTING_GUIDE.md](./TESTING_GUIDE.md) to test the entire flow:

```bash
# 1. Create artist
# 2. Wait for stack completion
# 3. Send callback
# 4. List files
# 5. Generate upload URL
# 6. Update index

# Run: bash full-test-flow.sh
```

---

## Next Steps

After confirming all tests pass:

1. ✅ Test with **real artist data** (name, songs, profile)
2. ✅ Test **file uploads** to S3 bucket
3. ✅ Verify **CloudFront** serves files correctly
4. ✅ Test **listener app** can find and play songs
5. ✅ Monitor **DynamoDB** writes
6. ✅ Set up **CloudWatch** alarms
7. ✅ Deploy to **production**

---

## Files You Can Use

| File | Purpose | Format |
|------|---------|--------|
| `test_artist_onboarding.py` | Automated test suite | Python |
| `test-artist-onboarding.sh` | Bash test runner | Shell |
| `Amply_Artist_Onboarding_API.postman_collection.json` | Postman collection | JSON |
| `ARTIST_ONBOARDING_TESTS.md` | API documentation | Markdown |
| `TESTING_GUIDE.md` | How to test | Markdown |

---

## Quick Reference

**Python tests:**
```bash
python test_artist_onboarding.py
```

**Bash tests:**
```bash
./test-artist-onboarding.sh
```

**Manual testing:**
```bash
# Example: Create artist
curl -X POST https://api.amply.app/connect \
  -H "Content-Type: application/json" \
  -d '{"artistName":"My Band"}'
```

**Postman:**
1. Import `Amply_Artist_Onboarding_API.postman_collection.json`
2. Set environment variables
3. Click "Run Collection"

---

## Support

For questions about specific endpoints, see:
- Detailed docs: [ARTIST_ONBOARDING_TESTS.md](./ARTIST_ONBOARDING_TESTS.md)
- Testing guide: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- Source code: [amplyAPI.js](./amplyAPI.js)
- Provider guide: [MULTI_PROVIDER_GUIDE.md](./MULTI_PROVIDER_GUIDE.md)

---

**Created:** January 5, 2026  
**Status:** Ready for testing ✅
