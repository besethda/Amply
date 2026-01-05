# Artist Onboarding Endpoint Tests

## Overview
Testing the artist onboarding flow including AWS CloudFormation stack setup, status polling, and completion callbacks.

---

## 1. POST `/connect` - Initiate Artist Setup

**Purpose**: Starts the artist environment setup by creating a CloudFormation stack

**Request:**
```json
{
  "artistName": "Test Artist One"
}
```

**Expected Response (202 Accepted):**
```json
{
  "message": "Artist environment setup initiated",
  "stackName": "amply-test-artist-one",
  "status": "CREATE_IN_PROGRESS",
  "estimatedTime": "5-10 minutes",
  "pollUrl": "/stack-status/amply-test-artist-one"
}
```

**Test Cases:**
- ✅ Valid artist name
- ❌ Missing artist name (should return 400)
- ✅ Special characters in artist name (should be sanitized in stackName)

**cURL Example:**
```bash
curl -X POST https://api.amply.app/connect \
  -H "Content-Type: application/json" \
  -d '{"artistName":"Test Artist One"}'
```

---

## 2. GET `/stack-status/{stackName}` - Poll Stack Status

**Purpose**: Check the status of the CloudFormation stack creation

**Request:**
```
GET /stack-status/amply-test-artist-one
```

**Expected Responses:**

### While Creating (202):
```json
{
  "status": "CREATE_IN_PROGRESS",
  "stackName": "amply-test-artist-one",
  "message": "Setup in progress, please check again in 30 seconds"
}
```

### When Complete (200):
```json
{
  "status": "CREATE_COMPLETE",
  "stackName": "amply-test-artist-one",
  "message": "Artist environment ready!",
  "BucketName": "amply-test-artist-one-bucket-xyz",
  "CloudFrontDomain": "d12345.cloudfront.net",
  "RoleArn": "arn:aws:iam::123456789:role/AmplyArtistRole",
  "StackId": "arn:aws:cloudformation:eu-north-1:123456789:stack/..."
}
```

### If Failed (400):
```json
{
  "status": "CREATE_FAILED",
  "stackName": "amply-test-artist-one",
  "error": "Stack creation failed: IAM role cannot be created"
}
```

**Test Cases:**
- ✅ Valid stack exists and is creating
- ✅ Valid stack exists and is complete
- ✅ Stack creation failed (should return error)
- ❌ Non-existent stack (should return 404)
- ❌ Missing stackName in path (should return 400)

**cURL Example:**
```bash
curl https://api.amply.app/stack-status/amply-test-artist-one
```

**Polling Loop (Client-side):**
```bash
# Poll every 30 seconds until CREATE_COMPLETE
while true; do
  response=$(curl -s https://api.amply.app/stack-status/amply-test-artist-one)
  status=$(echo $response | jq -r '.status')
  echo "Status: $status"
  
  if [ "$status" = "CREATE_COMPLETE" ]; then
    echo "✅ Setup complete!"
    break
  fi
  
  sleep 30
done
```

---

## 3. POST `/complete-artist-setup` - Finalize Setup with Callback

**Purpose**: Receives callback from cloud provider (CloudFormation, GCP Deployment Manager, etc.) and saves artist configuration

**Request:**
```json
{
  "artistId": "test-artist-one",
  "provider": "aws",
  "outputs": {
    "BucketName": "amply-test-artist-one-bucket",
    "CloudFrontDomain": "d123.cloudfront.net",
    "RoleArn": "arn:aws:iam::123456789:role/AmplyArtistRole",
    "StackId": "arn:aws:cloudformation:eu-north-1:123456789:stack/amply-test-artist-one"
  },
  "callback_token": "secure_callback_token_abc123",
  "callback_timestamp": "2025-01-05T12:00:00Z"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "artistId": "test-artist-one",
  "provider": "aws",
  "message": "Artist setup completed successfully",
  "artistConfig": {
    "artistId": "test-artist-one",
    "provider": "aws",
    "bucketName": "amply-test-artist-one-bucket",
    "cloudfrontDomain": "d123.cloudfront.net",
    "roleArn": "arn:aws:iam::123456789:role/AmplyArtistRole",
    "createdAt": "2025-01-05T12:00:00Z"
  }
}
```

**Provider-Specific Payloads:**

### AWS Example:
```json
{
  "artistId": "test-artist",
  "provider": "aws",
  "outputs": {
    "BucketName": "amply-test-artist-bucket",
    "CloudFrontDomain": "d123.cloudfront.net",
    "RoleArn": "arn:aws:iam::123456789:role/Artist"
  },
  "callback_token": "token_aws",
  "stack_id": "arn:aws:cloudformation:..."
}
```

### GCP Example:
```json
{
  "artistId": "test-artist",
  "provider": "gcp",
  "outputs": {
    "bucketName": "amply-test-artist-bucket",
    "projectId": "amply-project",
    "serviceAccountEmail": "artist@amply-project.iam.gserviceaccount.com",
    "cdnDomain": "cdn.example.com"
  },
  "callback_token": "token_gcp",
  "deployment_name": "amply-test-artist"
}
```

### Azure Example:
```json
{
  "artistId": "test-artist",
  "provider": "azure",
  "outputs": {
    "storageAccountName": "amplytestarist",
    "containerName": "music",
    "cdnEndpoint": "https://cdn.amply.io",
    "managedIdentityId": "/subscriptions/.../resourceGroups/.../providers/.../userAssignedIdentities/amply"
  },
  "callback_token": "token_azure",
  "resource_group": "amply-rg"
}
```

**Test Cases:**
- ✅ Valid AWS callback
- ✅ Valid GCP callback
- ✅ Valid Azure callback
- ✅ Valid DigitalOcean callback
- ❌ Missing artistId (should return 400)
- ❌ Missing provider (should return 400)
- ❌ Missing outputs (should return 400)
- ❌ Invalid callback_token (should return 401)
- ✅ Callback stored in DynamoDB artist-config table

**cURL Example:**
```bash
curl -X POST https://api.amply.app/complete-artist-setup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "artistId": "test-artist-one",
    "provider": "aws",
    "outputs": {
      "BucketName": "amply-test-artist-one-bucket",
      "CloudFrontDomain": "d123.cloudfront.net",
      "RoleArn": "arn:aws:iam::123456789:role/AmplyArtistRole"
    },
    "callback_token": "secure_token_123",
    "callback_timestamp": "2025-01-05T12:00:00Z"
  }'
```

---

## 4. POST `/list` - List Files in Artist Bucket

**Purpose**: Lists all files in the artist's S3/cloud bucket

**Request:**
```json
{
  "artistRoleArn": "arn:aws:iam::123456789:role/AmplyArtistRole",
  "bucketName": "amply-test-artist-one-bucket"
}
```

**Expected Response (200 OK):**
```json
{
  "files": [
    "song1.mp3",
    "song2.mp3",
    "cover-art.jpg"
  ]
}
```

**Test Cases:**
- ✅ Valid role and bucket (list files)
- ❌ Missing artistRoleArn (should return 400)
- ❌ Missing bucketName (should return 400)
- ❌ Invalid role ARN (should return 403 or 500)
- ❌ Non-existent bucket (should return 404)

**cURL Example:**
```bash
curl -X POST https://api.amply.app/list \
  -H "Content-Type: application/json" \
  -d '{
    "artistRoleArn": "arn:aws:iam::123456789:role/AmplyArtistRole",
    "bucketName": "amply-test-artist-one-bucket"
  }'
```

---

## 5. POST `/get-upload-url` - Generate Presigned Upload URL

**Purpose**: Generates a presigned URL for uploading a file to the artist's bucket

**Request:**
```json
{
  "fileName": "my-song.mp3",
  "artistRoleArn": "arn:aws:iam::123456789:role/AmplyArtistRole",
  "bucketName": "amply-test-artist-one-bucket",
  "contentType": "audio/mpeg"
}
```

**Expected Response (200 OK):**
```json
{
  "uploadUrl": "https://amply-test-artist-one-bucket.s3.eu-north-1.amazonaws.com/my-song.mp3?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
  "expiresIn": 300
}
```

**Test Cases:**
- ✅ Valid request (generates presigned URL)
- ❌ Missing fileName (should return 400)
- ❌ Missing artistRoleArn (should return 400)
- ❌ Missing bucketName (should return 400)
- ✅ Optional contentType (defaults to application/octet-stream)
- ✅ URL expires in 5 minutes (300 seconds)

**cURL Example:**
```bash
curl -X POST https://api.amply.app/get-upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "my-song.mp3",
    "artistRoleArn": "arn:aws:iam::123456789:role/AmplyArtistRole",
    "bucketName": "amply-test-artist-one-bucket",
    "contentType": "audio/mpeg"
  }' | jq -r '.uploadUrl' > upload_url.txt

# Use the presigned URL
curl -X PUT --upload-file my-song.mp3 "$(cat upload_url.txt)"
```

---

## 6. POST `/update-index` - Update Central Index with Artist Profile & Songs

**Purpose**: Saves artist profile, songs, and metadata to the central index

**Request:**
```json
{
  "artistId": "test-artist-one",
  "artistName": "Test Artist One",
  "cloudfrontDomain": "d123.cloudfront.net",
  "bucketName": "amply-test-artist-one-bucket",
  "profilePhoto": "https://d123.cloudfront.net/profile.jpg",
  "coverPhoto": "https://d123.cloudfront.net/cover.jpg",
  "bio": "A talented artist",
  "socials": {
    "spotify": "https://open.spotify.com/artist/123",
    "instagram": "@testartist"
  },
  "song": {
    "id": "song-1",
    "title": "My First Song",
    "duration": 240,
    "url": "https://d123.cloudfront.net/song1.mp3"
  }
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Index updated successfully",
  "artistId": "test-artist-one",
  "indexUpdatedAt": "2025-01-05T12:00:00Z"
}
```

**Test Cases:**
- ✅ Valid artist profile with song
- ✅ Update without song (profile only)
- ✅ Multiple songs (batch update)
- ❌ Missing artistId (should return 400)
- ❌ Missing artistName (should return 400)
- ❌ Missing cloudfrontDomain (should return 400)
- ❌ Missing bucketName (should return 400)

**cURL Example:**
```bash
curl -X POST https://api.amply.app/update-index \
  -H "Content-Type: application/json" \
  -d '{
    "artistId": "test-artist-one",
    "artistName": "Test Artist One",
    "cloudfrontDomain": "d123.cloudfront.net",
    "bucketName": "amply-test-artist-one-bucket",
    "profilePhoto": "https://d123.cloudfront.net/profile.jpg",
    "bio": "A talented artist",
    "song": {
      "id": "song-1",
      "title": "My First Song",
      "duration": 240,
      "url": "https://d123.cloudfront.net/song1.mp3"
    }
  }'
```

---

## Testing Sequence

### Full Onboarding Flow:
```bash
# Step 1: Initiate setup
echo "🔧 Step 1: Creating CloudFormation stack..."
curl -X POST https://api.amply.app/connect \
  -H "Content-Type: application/json" \
  -d '{"artistName":"Test Artist Flow"}' | jq .

# Step 2: Poll status (repeat until CREATE_COMPLETE)
echo "⏳ Step 2: Polling stack status..."
for i in {1..30}; do
  response=$(curl -s https://api.amply.app/stack-status/amply-test-artist-flow)
  status=$(echo $response | jq -r '.status')
  echo "Poll $i: Status = $status"
  
  if [ "$status" = "CREATE_COMPLETE" ]; then
    echo "✅ Stack complete!"
    echo $response | jq '.outputs'
    break
  fi
  
  sleep 10
done

# Step 3: Complete setup with callback
echo "📤 Step 3: Sending callback..."
curl -X POST https://api.amply.app/complete-artist-setup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "artistId": "test-artist-flow",
    "provider": "aws",
    "outputs": {...},
    "callback_token": "token_123",
    "callback_timestamp": "2025-01-05T12:00:00Z"
  }' | jq .

# Step 4: Verify artist bucket
echo "📦 Step 4: Listing files..."
curl -X POST https://api.amply.app/list \
  -H "Content-Type: application/json" \
  -d '{...}' | jq .

# Step 5: Generate upload URL
echo "⬆️  Step 5: Getting upload URL..."
curl -X POST https://api.amply.app/get-upload-url \
  -H "Content-Type: application/json" \
  -d '{...}' | jq .

# Step 6: Update index
echo "📇 Step 6: Updating central index..."
curl -X POST https://api.amply.app/update-index \
  -H "Content-Type: application/json" \
  -d '{...}' | jq .
```

---

## Error Codes & Handling

| Code | Endpoint | Error | Fix |
|------|----------|-------|-----|
| 400 | `/connect` | Missing artist name | Provide artistName in body |
| 400 | `/stack-status/*` | Missing stackName | Ensure stackName in URL path |
| 404 | `/stack-status/*` | Stack not found | Check stack name or wait for creation |
| 202 | `/stack-status/*` | Still creating | Wait 30 seconds and poll again |
| 400 | `/complete-artist-setup` | Missing required fields | Include artistId, provider, outputs, callback_token |
| 401 | `/complete-artist-setup` | Invalid callback token | Validate token format and source |
| 400 | `/list` | Missing artistRoleArn/bucketName | Include both parameters |
| 400 | `/get-upload-url` | Missing fileName | Provide fileName in request |
| 500 | Any | AWS/Cloud API error | Check CloudFormation logs and cloud provider console |

---

## Notes

- All presigned URLs expire after 5 minutes (300 seconds)
- Callback tokens must be at least 10 characters
- Stack creation typically takes 5-10 minutes
- Artist configuration is stored in DynamoDB `amply-artist-config-{env}` table
- Central index is stored in `amply-central-{account-id}` S3 bucket
