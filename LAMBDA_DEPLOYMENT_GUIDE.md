# AWS Lambda Deployment Guide - Waveform Analyzer

## Step-by-Step Deployment

### Prerequisites

- AWS account with Lambda access
- Artist S3 buckets already configured
- Basic familiarity with AWS Lambda

### Option 1: Deploy via AWS Console (Easiest)

#### 1. Create Lambda Function

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda)
2. Click **Create function**
3. Choose **Author from scratch**
4. Fill in:
   - **Function name**: `waveform-analyzer`
   - **Runtime**: `Node.js 18.x` (or newer)
   - **Architecture**: `x86_64`
   - **Permissions**: Create new role with basic Lambda permissions
5. Click **Create function**

#### 2. Add FFmpeg Layer

1. In function page → scroll to **Layers** section
2. Click **Add a layer**
3. Choose **Specify an ARN**
4. Enter FFmpeg layer ARN for your region:
   - **eu-north-1**: `arn:aws:lambda:eu-north-1:496494173385:layer:ffmpeg-layer:1`
   - **us-east-1**: `arn:aws:lambda:us-east-1:496494173385:layer:ffmpeg-layer:1`
   - **Other regions**: Search "ffmpeg-layer" or use custom layer

#### 3. Paste Code

1. In function code editor (Code source section):
   - Delete default code
   - Copy entire content of `lambda/waveform-analyzer.js`
   - Paste into editor
   - Click **Deploy**

#### 4. Configure Settings

1. Click **Configuration** tab
2. Go to **General configuration** → **Edit**:

   - **Timeout**: Change from 3 to `300` seconds (5 minutes)
   - **Memory**: Keep at `128 MB` (or increase to `256 MB` for faster processing)
   - Click **Save**

3. Go to **Environment variables** → **Edit**:
   - Key: `AWS_REGION`
   - Value: `eu-north-1` (or your region)
   - Click **Save**

#### 5. Update IAM Role

1. Click **Configuration** tab → **Permissions**
2. Click the role name to open IAM
3. Click **Add inline policy**
4. Paste this policy:

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

5. Click **Review policy**
6. Name: `S3ArtistBucketAccess`
7. Click **Create policy**

#### 6. Test Function

1. Click **Test** tab
2. Create new test event:
   ```json
   {
     "Records": [
       {
         "s3": {
           "bucket": {
             "name": "test-bucket"
           },
           "object": {
             "key": "test-song.mp3"
           }
         }
       }
     ]
   }
   ```
3. Click **Test** button
4. Check results in **Execution results**

---

### Option 2: Deploy via AWS CLI

#### 1. Package Code

```bash
# Create function package
zip waveform-analyzer.zip lambda/waveform-analyzer.js

# Create execution role
aws iam create-role \
  --role-name waveform-analyzer-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' \
  --region eu-north-1
```

#### 2. Add Permissions

```bash
# Add S3 permissions
aws iam put-role-policy \
  --role-name waveform-analyzer-role \
  --policy-name S3Access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::artist-*/*"
    }]
  }' \
  --region eu-north-1

# Add basic Lambda execution policy
aws iam attach-role-policy \
  --role-name waveform-analyzer-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  --region eu-north-1
```

#### 3. Deploy Function

```bash
aws lambda create-function \
  --function-name waveform-analyzer \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT_ID:role/waveform-analyzer-role \
  --handler index.handler \
  --zip-file fileb://waveform-analyzer.zip \
  --timeout 300 \
  --memory-size 256 \
  --environment Variables="{AWS_REGION=eu-north-1}" \
  --layers arn:aws:lambda:eu-north-1:496494173385:layer:ffmpeg-layer:1 \
  --region eu-north-1
```

#### 4. Update Function (Future Deploys)

```bash
# After modifying code, update with:
zip waveform-analyzer.zip lambda/waveform-analyzer.js

aws lambda update-function-code \
  --function-name waveform-analyzer \
  --zip-file fileb://waveform-analyzer.zip \
  --region eu-north-1
```

---

### Option 3: Deploy via Serverless Framework

#### 1. Install Serverless

```bash
npm install -g serverless
```

#### 2. Create serverless.yml

```yaml
service: amply-waveform

frameworkVersion: "3"

provider:
  name: aws
  runtime: nodejs18.x
  region: eu-north-1
  timeout: 300
  memorySize: 256
  environment:
    AWS_REGION: eu-north-1
  iamRoleStatements:
    - Effect: Allow
      Action:
        - s3:GetObject
        - s3:PutObject
      Resource: "arn:aws:s3:::artist-*/*"

functions:
  waveformAnalyzer:
    handler: lambda/waveform-analyzer.handler
    layers:
      - arn:aws:lambda:eu-north-1:496494173385:layer:ffmpeg-layer:1

plugins:
  - serverless-python-requirements
```

#### 3. Deploy

```bash
serverless deploy
```

#### 4. View Logs

```bash
serverless logs -f waveformAnalyzer -t
```

---

## Configure S3 Event Triggers

After Lambda is deployed, set up S3 notifications for each artist bucket.

### Via AWS Console

For each artist S3 bucket:

1. Go to S3 → Select bucket
2. Go to **Properties** tab
3. Scroll to **Event Notifications**
4. Click **Create event notification**
5. Fill in:
   - **Event notification name**: `on-song-upload`
   - **Event types**: Check `All object create events`
   - **Filter - Suffix**: Enter `.mp3` (or all: `.mp3,.wav,.flac,.m4a,.aac,.ogg`)
   - **Destination**: Select **Lambda function**
   - **Lambda function**: Choose `waveform-analyzer`
6. Click **Save changes**

### Via CloudFormation

```yaml
ArtistBucketNotification:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: !Ref ArtistBucketName
    NotificationConfiguration:
      LambdaFunctionConfigurations:
        - Event: "s3:ObjectCreated:*"
          Filter:
            S3Key:
              Rules:
                - Name: suffix
                  Value: .mp3
                - Name: suffix
                  Value: .wav
          Function: !GetAtt WaveformAnalyzerFunction.Arn

WaveformAnalyzerPermission:
  Type: AWS::Lambda::Permission
  Properties:
    FunctionName: !Ref WaveformAnalyzerFunction
    Action: lambda:InvokeFunction
    Principal: s3.amazonaws.com
    SourceArn: !Sub "arn:aws:s3:::${ArtistBucketName}"
```

### Via AWS CLI

```bash
# Enable notification on bucket
aws s3api put-bucket-notification-configuration \
  --bucket artist-bucket-name \
  --notification-configuration '{
    "LambdaFunctionConfigurations": [{
      "LambdaFunctionArn": "arn:aws:lambda:eu-north-1:ACCOUNT_ID:function:waveform-analyzer",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "suffix", "Value": ".mp3"},
            {"Name": "suffix", "Value": ".wav"}
          ]
        }
      }
    }]
  }' \
  --region eu-north-1

# Add Lambda permission to S3
aws lambda add-permission \
  --function-name waveform-analyzer \
  --statement-id AllowS3Invoke \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::artist-bucket-name \
  --region eu-north-1
```

---

## Verify Deployment

### 1. Check Function Exists

```bash
aws lambda get-function \
  --function-name waveform-analyzer \
  --region eu-north-1
```

### 2. Check S3 Events Are Configured

```bash
aws s3api get-bucket-notification-configuration \
  --bucket artist-bucket-name \
  --region eu-north-1
```

### 3. Test Manual Invocation

```bash
# Create test event
cat > test-event.json << 'EOF'
{
  "Records": [{
    "s3": {
      "bucket": {"name": "artist-bucket"},
      "object": {"key": "test-song.mp3"}
    }
  }]
}
EOF

# Invoke function
aws lambda invoke \
  --function-name waveform-analyzer \
  --payload file://test-event.json \
  --region eu-north-1 \
  response.json

# View response
cat response.json
```

### 4. Check CloudWatch Logs

```bash
# View recent logs
aws logs tail /aws/lambda/waveform-analyzer \
  --follow \
  --region eu-north-1

# Or go to CloudWatch Console:
# CloudWatch → Log groups → /aws/lambda/waveform-analyzer
```

---

## Troubleshooting Deployment

| Issue                    | Solution                                        |
| ------------------------ | ----------------------------------------------- |
| "FFmpeg not found"       | Verify Lambda Layer ARN is correct and attached |
| "Permission denied" S3   | Check IAM role has GetObject and PutObject      |
| "Timeout"                | Increase timeout to 600s in configuration       |
| S3 events not triggering | Verify notification configuration on bucket     |
| Lambda not invoked       | Check S3 event filter matches file extension    |

---

## Monitor After Deployment

### CloudWatch Metrics

View in AWS Console:

1. CloudWatch → Dashboards
2. Create dashboard with:
   - Lambda invocations
   - Duration
   - Errors
   - Throttles

### Example Metrics to Track

```bash
# Get function metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=waveform-analyzer \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-10T00:00:00Z \
  --period 300 \
  --statistics Average,Maximum,Minimum \
  --region eu-north-1
```

### Set Up Alarms

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name waveform-analyzer-errors \
  --alarm-description "Alert if waveform analyzer has errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=waveform-analyzer \
  --alarm-actions arn:aws:sns:eu-north-1:ACCOUNT_ID:alert-topic \
  --region eu-north-1
```

---

## Cost Estimation

### Per Song Analysis

- **Compute**: ~5 GB-seconds (0.125 = 1/8 GB × 5 seconds)
- **Cost**: $0.0000002 (free tier includes 400,000 GB-seconds/month)

For typical usage:

- 100 songs/month = ~$0.02
- 1000 songs/month = ~$0.20
- 10,000 songs/month = ~$2.00

**Most users will stay within free tier.**

---

## Next Steps After Deployment

1. ✅ Lambda deployed and configured
2. ✅ S3 event triggers enabled
3. ⏳ Test with first song upload
4. ⏳ Verify `.waveform.json` created
5. ⏳ Test `/get-waveform` API endpoint
6. ⏳ Verify waveform displays in player

---

## Quick Reference Commands

```bash
# Get function info
aws lambda get-function --function-name waveform-analyzer

# View recent logs
aws logs tail /aws/lambda/waveform-analyzer --follow

# Test invocation
aws lambda invoke --function-name waveform-analyzer \
  --payload '{"Records":[{"s3":{"bucket":{"name":"test"},"object":{"key":"song.mp3"}}}]}' \
  response.json && cat response.json

# Update function code
zip waveform-analyzer.zip lambda/waveform-analyzer.js
aws lambda update-function-code --function-name waveform-analyzer \
  --zip-file fileb://waveform-analyzer.zip

# Delete function (if needed)
aws lambda delete-function --function-name waveform-analyzer
```

---

**Deployment complete! Your waveform analysis system is live.** 🎵
