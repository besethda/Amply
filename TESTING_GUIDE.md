# Artist Onboarding Testing Guide

## Overview

This guide explains how to test the artist onboarding flow using the provided test scripts. The artist onboarding process involves:

1. **Initiate Setup** (`/connect`) - Create CloudFormation stack
2. **Poll Status** (`/stack-status/*`) - Monitor stack creation
3. **Complete Setup** (`/complete-artist-setup`) - Receive cloud provider callback
4. **List Files** (`/list`) - List files in artist bucket
5. **Generate Upload URL** (`/get-upload-url`) - Get presigned upload URL
6. **Update Index** (`/update-index`) - Save artist profile to central index

---

## Quick Start

### Option 1: Run Python Test Suite (Recommended)

```bash
# Install requests if needed
pip install requests

# Run all tests
python test_artist_onboarding.py

# Or with custom API URL and token
export API_URL="https://your-api.example.com"
export JWT_TOKEN="your-jwt-token"
python test_artist_onboarding.py
```

**Output Example:**
```
╔════════════════════════════════════════════════════════════╗
║  Artist Onboarding Endpoint Test Suite                     ║
║  2025-01-05 12:00:00                                       ║
╚════════════════════════════════════════════════════════════╝

Configuration:
API URL: https://api.amply.app
AWS Account: 123456789
JWT Token: ✗ Not provided

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test 1: POST /connect - Valid Artist Name
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

→ Initiating artist setup...
✅ Field 'status' = CREATE_IN_PROGRESS in connect response
✅ Field 'stackName' exists in connect response
✅ Artist setup initiated: amply-test-artist-1234567890

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Passed: 11
Failed: 0
Total: 11

✓ All tests passed!
```

### Option 2: Run Bash Test Suite

```bash
# Set environment variables (optional)
export API_URL="https://your-api.example.com"
export JWT_TOKEN="your-jwt-token"

# Run all tests
./test-artist-onboarding.sh
```

### Option 3: Manual Testing with cURL

See the manual test examples below.

---

## Test Coverage

### Test 1: POST /connect - Valid Artist Name
**What it tests:** Creating a CloudFormation stack for a new artist

**Expected behavior:**
- Returns HTTP 202 (Accepted)
- Includes `stackName` in response
- Includes `status: "CREATE_IN_PROGRESS"`
- Includes polling URL

**Example:**
```bash
curl -X POST https://api.amply.app/connect \
  -H "Content-Type: application/json" \
  -d '{"artistName":"My Awesome Band"}'

# Response (202):
{
  "message": "Artist environment setup initiated",
  "stackName": "amply-my-awesome-band",
  "status": "CREATE_IN_PROGRESS",
  "estimatedTime": "5-10 minutes",
  "pollUrl": "/stack-status/amply-my-awesome-band"
}
```

### Test 2: POST /connect - Missing Artist Name
**What it tests:** Validation of required fields

**Expected behavior:**
- Returns HTTP 400 (Bad Request)
- Includes error message

**Example:**
```bash
curl -X POST https://api.amply.app/connect \
  -H "Content-Type: application/json" \
  -d '{}'

# Response (400):
{
  "error": "Missing artist name"
}
```

### Test 3: GET /stack-status - Non-existent Stack
**What it tests:** Error handling for invalid stack names

**Expected behavior:**
- Returns HTTP 404 (Not Found)
- Includes error message

**Example:**
```bash
curl https://api.amply.app/stack-status/amply-nonexistent

# Response (404):
{
  "error": "Stack not found"
}
```

### Test 4: POST /complete-artist-setup - Missing Required Fields
**What it tests:** Validation of callback payload

**Expected behavior:**
- Returns HTTP 400 (Bad Request)
- Lists missing required fields in error

**Example:**
```bash
curl -X POST https://api.amply.app/complete-artist-setup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{}'

# Response (400):
{
  "error": "Missing required fields: artistId, provider, outputs, callback_token"
}
```

### Test 5: POST /complete-artist-setup - Invalid Callback Token
**What it tests:** Token validation (minimum 10 characters)

**Expected behavior:**
- Returns HTTP 401 (Unauthorized)
- Indicates invalid token

**Example:**
```bash
curl -X POST https://api.amply.app/complete-artist-setup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "artistId":"test-artist",
    "provider":"aws",
    "outputs":{"BucketName":"bucket"},
    "callback_token":"short"
  }'

# Response (401):
{
  "error": "Invalid or missing callback token"
}
```

### Test 6: POST /list - Missing Required Fields
**What it tests:** Validation of list endpoint

**Expected behavior:**
- Returns HTTP 400 (Bad Request)
- Requires both `artistRoleArn` and `bucketName`

**Example:**
```bash
curl -X POST https://api.amply.app/list \
  -H "Content-Type: application/json" \
  -d '{}'

# Response (400):
{
  "error": "Missing artistRoleArn or bucketName"
}
```

### Test 7: POST /get-upload-url - Missing Required Fields
**What it tests:** Validation of upload URL generation

**Expected behavior:**
- Returns HTTP 400 (Bad Request)
- Requires `fileName`, `artistRoleArn`, `bucketName`

**Example:**
```bash
curl -X POST https://api.amply.app/get-upload-url \
  -H "Content-Type: application/json" \
  -d '{}'

# Response (400):
{
  "error": "Missing required fields: fileName, artistRoleArn, bucketName"
}
```

### Test 8: POST /get-upload-url - Valid Request
**What it tests:** Presigned URL generation

**Expected behavior:**
- Returns HTTP 200 (OK)
- Includes valid HTTPS URL
- URL expires in 300 seconds (5 minutes)

**Example:**
```bash
curl -X POST https://api.amply.app/get-upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "fileName":"my-song.mp3",
    "artistRoleArn":"arn:aws:iam::123456789:role/AmplyArtistRole",
    "bucketName":"amply-my-bucket",
    "contentType":"audio/mpeg"
  }'

# Response (200):
{
  "uploadUrl": "https://amply-my-bucket.s3.eu-north-1.amazonaws.com/my-song.mp3?X-Amz-Algorithm=...",
  "expiresIn": 300
}

# Use the URL to upload
curl -X PUT --upload-file my-song.mp3 "$(echo $RESPONSE | jq -r '.uploadUrl')"
```

### Test 9: POST /update-index - Missing Required Fields
**What it tests:** Validation of index update

**Expected behavior:**
- Returns HTTP 400 (Bad Request)
- Requires core fields: `artistId`, `artistName`, `cloudfrontDomain`, `bucketName`

**Example:**
```bash
curl -X POST https://api.amply.app/update-index \
  -H "Content-Type: application/json" \
  -d '{}'

# Response (400):
{
  "error": "Missing one or more required fields"
}
```

### Test 10: CORS Preflight Request
**What it tests:** CORS headers support

**Expected behavior:**
- Returns HTTP 204 (No Content)
- Includes CORS headers in response

**Example:**
```bash
curl -X OPTIONS https://api.amply.app/connect \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"

# Response (204): Headers include:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: OPTIONS, GET, POST, PUT, DELETE
# Access-Control-Allow-Headers: Content-Type, Authorization
```

### Test 11: Invalid JSON Payload
**What it tests:** JSON validation

**Expected behavior:**
- Returns HTTP 400 (Bad Request)
- Graceful error message

**Example:**
```bash
curl -X POST https://api.amply.app/connect \
  -H "Content-Type: application/json" \
  -d 'not valid json'

# Response (400):
{
  "error": "Invalid JSON body"
}
```

---

## Full End-to-End Testing

Here's how to test the complete artist onboarding flow:

```bash
#!/bin/bash

API_URL="https://api.amply.app"
ARTIST_NAME="My Test Artist"
JWT_TOKEN="your-jwt-token"

# Step 1: Initiate setup
echo "🔧 Step 1: Initiating artist setup..."
SETUP_RESPONSE=$(curl -s -X POST "$API_URL/connect" \
  -H "Content-Type: application/json" \
  -d "{\"artistName\":\"$ARTIST_NAME\"}")

STACK_NAME=$(echo $SETUP_RESPONSE | jq -r '.stackName')
echo "Stack Name: $STACK_NAME"

# Step 2: Poll status until complete
echo "⏳ Step 2: Waiting for stack creation..."
for i in {1..60}; do
  STATUS_RESPONSE=$(curl -s "$API_URL/stack-status/$STACK_NAME")
  STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
  echo "Poll $i: $STATUS"
  
  if [ "$STATUS" = "CREATE_COMPLETE" ]; then
    echo "✅ Stack complete!"
    BUCKET=$(echo $STATUS_RESPONSE | jq -r '.BucketName')
    CLOUDFRONT=$(echo $STATUS_RESPONSE | jq -r '.CloudFrontDomain')
    ROLE=$(echo $STATUS_RESPONSE | jq -r '.RoleArn')
    break
  fi
  
  sleep 10
done

# Step 3: Send completion callback
echo "📤 Step 3: Sending completion callback..."
curl -X POST "$API_URL/complete-artist-setup" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"artistId\":\"$(echo $ARTIST_NAME | tr ' ' '-' | tr '[:upper:]' '[:lower:]')\",
    \"provider\":\"aws\",
    \"outputs\":{
      \"BucketName\":\"$BUCKET\",
      \"CloudFrontDomain\":\"$CLOUDFRONT\",
      \"RoleArn\":\"$ROLE\"
    },
    \"callback_token\":\"secure-token-12345\",
    \"callback_timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }"

# Step 4: List files in bucket
echo "📦 Step 4: Listing bucket files..."
curl -X POST "$API_URL/list" \
  -H "Content-Type: application/json" \
  -d "{
    \"artistRoleArn\":\"$ROLE\",
    \"bucketName\":\"$BUCKET\"
  }"

# Step 5: Generate upload URL
echo "⬆️  Step 5: Generating upload URL..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/get-upload-url" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileName\":\"test-song.mp3\",
    \"artistRoleArn\":\"$ROLE\",
    \"bucketName\":\"$BUCKET\",
    \"contentType\":\"audio/mpeg\"
  }")

UPLOAD_URL=$(echo $UPLOAD_RESPONSE | jq -r '.uploadUrl')
echo "Upload URL: $UPLOAD_URL"

# Step 6: Update index
echo "📇 Step 6: Updating central index..."
curl -X POST "$API_URL/update-index" \
  -H "Content-Type: application/json" \
  -d "{
    \"artistId\":\"$(echo $ARTIST_NAME | tr ' ' '-' | tr '[:upper:]' '[:lower:]')\",
    \"artistName\":\"$ARTIST_NAME\",
    \"cloudfrontDomain\":\"$CLOUDFRONT\",
    \"bucketName\":\"$BUCKET\",
    \"profilePhoto\":\"https://$CLOUDFRONT/profile.jpg\",
    \"bio\":\"Test artist\",
    \"song\":{
      \"id\":\"song-1\",
      \"title\":\"Test Song\",
      \"duration\":240,
      \"url\":\"https://$CLOUDFRONT/test-song.mp3\"
    }
  }"

echo "✅ Complete onboarding flow tested!"
```

---

## Environment Variables

### Python Tests
```bash
# API endpoint
export API_URL="https://api.amply.app"

# JWT token for endpoints requiring authentication
export JWT_TOKEN="eyJhbGc..."

# AWS account ID
export AWS_ACCOUNT_ID="123456789"
```

### Bash Tests
```bash
# API endpoint
export API_URL="https://api.amply.app"

# JWT token for endpoints requiring authentication
export JWT_TOKEN="eyJhbGc..."

# Test configuration
export TEST_ARTIST_NAME="My Test Artist"
export ROLE_ARN="arn:aws:iam::123456789:role/AmplyArtistRole"
export BUCKET_NAME="amply-test-bucket"
```

---

## Debugging Failed Tests

### Common Issues

**1. Connection refused**
```
Error: Connection refused at https://api.amply.app
```
- Verify API URL is correct
- Check if API is running
- Verify network connectivity

**2. Invalid JWT Token**
```json
{
  "error": "Unauthorized"
}
```
- Ensure JWT_TOKEN environment variable is set
- Verify token hasn't expired
- Check token format (should be `Bearer <token>`)

**3. Stack creation failed**
```json
{
  "status": "CREATE_FAILED",
  "error": "IAM role cannot be created"
}
```
- Check AWS account permissions
- Review CloudFormation logs in AWS console
- Verify IAM role ARN

**4. Presigned URL invalid**
```json
{
  "error": "Access Denied"
}
```
- Verify role ARN has S3 permissions
- Check bucket name exists
- Ensure role trusts the correct account

### Viewing Logs

**CloudFormation Stack Logs:**
```bash
# List stacks
aws cloudformation list-stacks --region eu-north-1

# Describe specific stack
aws cloudformation describe-stacks \
  --stack-name amply-test-artist \
  --region eu-north-1

# View stack events
aws cloudformation describe-stack-events \
  --stack-name amply-test-artist \
  --region eu-north-1
```

**DynamoDB Artist Config Table:**
```bash
# Scan artist config table
aws dynamodb scan \
  --table-name amply-artist-config-dev \
  --region eu-north-1
```

---

## Troubleshooting

### Q: Tests pass but endpoint still fails in production?
**A:** 
- Verify API_URL matches production endpoint
- Check CORS headers are correct
- Ensure JWT_TOKEN has correct permissions
- Review CloudWatch logs in AWS

### Q: Stack creation takes longer than expected?
**A:**
- Normal time is 5-10 minutes
- Check CloudFormation stack status in AWS Console
- Review stack events for any errors
- May be rate-limited by AWS

### Q: Getting "Invalid callback token" error?
**A:**
- Token must be at least 10 characters
- Ensure callback_token is included in request
- Verify token format (no spaces, valid characters)

### Q: Presigned URL expires immediately?
**A:**
- URLs expire in 5 minutes (300 seconds)
- Check system clock is synchronized
- AWS credentials may be expired

---

## Next Steps

After verifying all endpoints work:

1. ✅ Test with real artist data
2. ✅ Test file uploads to bucket
3. ✅ Verify CloudFront distribution works
4. ✅ Test listener app can access songs
5. ✅ Monitor DynamoDB writes
6. ✅ Set up CloudWatch monitoring
7. ✅ Deploy to production

---

## Resources

- [API Documentation](./IMPLEMENTATION_COMPLETE.md)
- [Provider System Guide](./PROVIDER_SYSTEM.md)
- [Multi-Provider Guide](./MULTI_PROVIDER_GUIDE.md)
- [AWS CloudFormation Docs](https://docs.aws.amazon.com/cloudformation/)
- [Postman Collection](#) - Coming soon
