# Backend Setup: Artist Config Storage & Callbacks

## Overview

The `/complete-artist-setup` endpoint receives callbacks from cloud providers (AWS Lambda, GCP Cloud Functions, Azure Functions, etc.) when artist infrastructure is ready. It stores the configuration in DynamoDB and responds to the frontend to trigger auto-redirect.

## What You Need to Do

### 1. Create DynamoDB Table for Artist Configs

Create a new table in your AWS account:

```bash
# Using AWS CLI
aws dynamodb create-table \
  --table-name amply-artist-configs-dev \
  --attribute-definitions \
    AttributeName=artistId,AttributeType=S \
  --key-schema \
    AttributeName=artistId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1
```

**Table Schema:**
| Field | Type | Key | Description |
|-------|------|-----|-------------|
| `artistId` | String | Partition Key | Artist identifier |
| `provider` | String | | Hosting provider (aws, gcp, azure, etc) |
| `createdAt` | String | | ISO timestamp |
| `callbackTimestamp` | String | | When callback was received |
| `outputs` | Map | | Raw provider outputs |
| `bucketName` | String | | Storage bucket name |
| `cloudfrontDomain` | String | | CDN domain (AWS specific) |
| `roleArn` | String | | IAM role ARN (AWS specific) |
| `serviceAccountEmail` | String | | GCP service account |
| `projectId` | String | | GCP project ID |
| `storageAccount` | String | | Azure storage account |
| `cdnDomain` | String | | CDN domain for delivery |

Or via CloudFormation:

```yaml
ArtistConfigsTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub "amply-artist-configs-${Environment}"
    AttributeDefinitions:
      - AttributeName: artistId
        AttributeType: S
    KeySchema:
      - AttributeName: artistId
        KeyType: HASH
    BillingMode: PAY_PER_REQUEST
    StreamSpecification:
      StreamViewType: NEW_AND_OLD_IMAGES # Optional: for audit trail
```

### 2. Update Lambda Execution Role

Your Lambda needs permissions to:

- Read/write to `amply-artist-configs-*` table
- Update the central `amply-index.json` in S3

Add to your Lambda's IAM role:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:GetItem",
    "dynamodb:UpdateItem",
    "dynamodb:Query"
  ],
  "Resource": "arn:aws:dynamodb:eu-north-1:YOUR_ACCOUNT_ID:table/amply-artist-configs-*"
}
```

### 3. Generate API Keys for Callbacks

Before deploying CloudFormation templates, you need to generate API keys that artists will use. These tokens are short-lived and tied to specific artists.

**Option A: Pre-generate keys (Recommended)**

```javascript
// In your admin panel or setup flow
const crypto = require("crypto");

function generateArtistCallbackToken(artistId) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString("hex");
  const token = `amply_${artistId}_${timestamp}_${random}`;

  // Store in DynamoDB temporarily (expires after 24 hours)
  return token;
}

// Artist gets token when starting setup
const token = generateArtistCallbackToken("skywave");
// Token: amply_skywave_1704499200_a1b2c3d4...
```

**Option B: Validate via Cognito**
Modify the endpoint to extract artistId from Cognito token and validate ownership:

```javascript
// Check that the callback's artistId matches the authenticated user
const token = getAuthToken(event);
const user = parseJwt(token);
const cognitoArtistId = user.email.split("@")[0]; // or custom attribute

if (artistId !== cognitoArtistId) {
  return { statusCode: 403, error: "Artist ID mismatch" };
}
```

### 4. Update CloudFormation Templates with API Key Parameter

Your CloudFormation template (and others) already have this, but make sure:

```yaml
Parameters:
  AmplyApiKey:
    Type: String
    NoEcho: true
    Description: "API key for authenticating callback to Amply"
```

When artists start setup, they'll need to:

1. Get an API key from your setup page
2. Paste it into the CloudFormation parameters
3. Key validates on callback

### 5. Deploy Updated Lambda

```bash
# Build and package
npm install
npm run build  # Transpiles TypeScript if applicable

# Zip it
zip -r lambda-package.zip . -x "node_modules/*" "*.git*"

# Upload to Lambda (or use AWS SAM/CDK)
aws lambda update-function-code \
  --function-name amply-api \
  --zip-file fileb://lambda-package.zip \
  --region eu-north-1
```

### 6. Test the Endpoint

**Local Testing:**

```bash
curl -X POST http://localhost:3000/complete-artist-setup \
  -H "Content-Type: application/json" \
  -d '{
    "artistId": "test-artist",
    "provider": "aws",
    "stack_id": "arn:aws:cloudformation:eu-north-1:123456:stack/...",
    "outputs": {
      "BucketName": "amply-test-artist-123456",
      "CloudFrontDomain": "d1234567.cloudfront.net",
      "RoleArn": "arn:aws:iam::123456:role/AmplyAccessRole-test-artist"
    },
    "callback_token": "amply_test_artist_1704499200_...",
    "callback_timestamp": "2024-01-05T12:00:00Z"
  }'
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "artistId": "test-artist",
  "provider": "aws",
  "message": "Artist configuration saved successfully"
}
```

### 7. Test End-to-End

1. **Create test CloudFormation stack:**

   - Visit AWS CloudFormation console
   - Upload `aws-cloudformation-template.yaml`
   - Provide:
     - ArtistName: `test-artist`
     - AmplyApiKey: `amply_test_artist_1704499200_...`
     - AmplyCallbackUrl: `https://your-domain.com/complete-artist-setup`

2. **Monitor deployment:**

   - Watch CloudFormation stack status
   - Check Lambda logs for callback
   - Verify artist config saved in DynamoDB

3. **Check frontend:**
   - Open setup-complete.html in browser
   - Should receive callback within 2-3 minutes
   - Auto-redirect to profile setup

### 8. Security Checklist

- [ ] API keys are short-lived (expires after setup)
- [ ] Callback token validated against stored token
- [ ] Artist ID in callback matches authenticated user
- [ ] All callbacks logged for audit trail
- [ ] Rate limiting on `/complete-artist-setup` endpoint
- [ ] HTTPS enforced on all callback URLs
- [ ] Sensitive credentials never logged
- [ ] DynamoDB table encrypted at rest
- [ ] IAM role follows least-privilege principle

### 9. Fallback Mechanism

If callback fails, the frontend continues polling `/verify-stack` every 10 seconds. Add this endpoint to verify stack status without callback:

```javascript
// Add to Lambda
if (path.endsWith("/verify-stack") && method === "POST") {
  const { artistId, stackName, provider } = JSON.parse(event.body || "{}");

  if (provider === "aws") {
    const cfn = new CloudFormationClient({ region });
    const response = await cfn.send(
      new DescribeStacksCommand({
        StackName: stackName,
      })
    );

    const stack = response.Stacks[0];
    if (stack.StackStatus === "CREATE_COMPLETE") {
      // Extract outputs and save config
      // Same logic as complete-artist-setup
      return { statusCode: 200, success: true };
    }
  }

  return { statusCode: 202, message: "Stack still creating..." };
}
```

### 10. Future Enhancements

- **Token Rotation**: Implement token refresh if setup takes > 1 hour
- **Webhook Signatures**: Sign callbacks with HMAC-SHA256 for additional security
- **Provider Webhooks**: Subscribe to provider events instead of using CloudFormation callbacks
- **Multi-region Support**: Handle providers in multiple regions
- **Audit Trail**: Log all callback attempts to CloudWatch
- **Retries**: Implement exponential backoff for failed callbacks

---

## Troubleshooting

**Callback not received?**

1. Check Lambda logs: `aws logs tail /aws/lambda/amply-api --follow`
2. Verify CloudFormation Custom Resource created
3. Check Lambda has correct environment variables
4. Verify API Gateway has correct route mapping
5. Check CORS headers allow callback origin

**Artist config not saved?**

1. Verify DynamoDB table exists: `aws dynamodb describe-table --table-name amply-artist-configs-dev`
2. Check Lambda IAM role has PutItem permission
3. Look for marshalling errors in logs
4. Verify artistId is unique (no duplicates)

**Frontend not redirecting?**

1. Check callback was received by Lambda
2. Verify response includes `success: true`
3. Check browser console for CallbackListener errors
4. Ensure polling fallback is working if callback times out

---

## Summary

✅ Create DynamoDB table
✅ Update Lambda IAM role
✅ Generate API keys for artists
✅ Deploy updated Lambda
✅ Test with CloudFormation
✅ Monitor logs during deployment
✅ Verify end-to-end flow

Once complete, artists can:

1. Click "Become an Artist"
2. Select hosting provider (AWS/GCP/Azure/etc)
3. Provide artist name and API key
4. Stack deploys automatically
5. Credentials sent back to Amply
6. Setup completes without manual steps
