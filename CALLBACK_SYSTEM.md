# Cloud Provider Callback System

## Problem Solved

**Before**: Artists had to manually copy-paste AWS bucket names, CDN domains, and credentials back to Amply. Complex for non-technical users.

**After**: Cloud provider automatically sends all required information back to Amply when setup completes. Seamless, one-click onboarding.

## How It Works

### Flow Diagram

```
1. Artist selects provider (AWS/GCP/Azure)
   ↓
2. Cloud provider setup page opens
   ↓
3. Artist completes setup in cloud console (e.g., CloudFormation)
   ↓
4. Cloud provider automatically triggers callback Lambda/Function
   ↓
5. Lambda POSTs to Amply: POST /complete-artist-setup
   ↓
6. Amply stores artist config (bucket, CDN, credentials)
   ↓
7. Frontend detects callback completion
   ↓
8. Page auto-redirects to profile setup
```

### Two Implementation Methods

#### Method 1: Frontend PostMessage (Client-to-Client)
- Cloud provider callback opens a child window
- Child window posts message back to Amply setup page
- Best for: Browser-based callbacks

#### Method 2: Backend API (Server-to-Server) ⭐ **Recommended**
- Cloud provider Lambda/Function calls Amply API directly
- No user interaction needed
- Best for: Reliable, non-technical users

## AWS Implementation

### 1. CloudFormation Template Modification

Add a Lambda function to your CloudFormation template:

```yaml
AWSTemplateFormatVersion: '2010-09-09'

Parameters:
  ArtistName:
    Type: String
  AmplyCallbackUrl:
    Type: String
    Default: "https://amply.app/api/complete-artist-setup"
  AmplyApiKey:
    Type: String
    NoEcho: true

Resources:
  # ... existing S3, CloudFront resources ...

  CallbackLambdaRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole

  CallbackLambda:
    Type: AWS::Lambda::Function
    Properties:
      Runtime: python3.11
      Handler: index.handler
      Role: !GetAtt CallbackLambdaRole.Arn
      Code:
        ZipFile: |
          import json
          import boto3
          import urllib.request
          import os
          
          def handler(event, context):
              try:
                  # Get stack outputs
                  cfn = boto3.client('cloudformation')
                  stack_info = cfn.describe_stacks(
                      StackName=os.environ['STACK_NAME']
                  )['Stacks'][0]
                  
                  outputs = {}
                  for output in stack_info.get('Outputs', []):
                      outputs[output['OutputKey']] = output['OutputValue']
                  
                  # Prepare callback payload
                  callback_payload = {
                      "artistId": os.environ['ARTIST_ID'],
                      "provider": "aws",
                      "stack_name": os.environ['STACK_NAME'],
                      "stack_id": stack_info['StackId'],
                      "stack_status": stack_info['StackStatus'],
                      "outputs": outputs,
                      "callback_token": os.environ['API_KEY']
                  }
                  
                  # Send to Amply
                  data = json.dumps(callback_payload).encode('utf-8')
                  req = urllib.request.Request(
                      os.environ['CALLBACK_URL'],
                      data=data,
                      headers={'Content-Type': 'application/json'},
                      method='POST'
                  )
                  
                  with urllib.request.urlopen(req) as response:
                      print(f"✅ Callback sent, response: {response.status}")
                      return {'statusCode': 200}
                      
              except Exception as e:
                  print(f"❌ Error: {str(e)}")
                  return {'statusCode': 500, 'error': str(e)}
      Environment:
        Variables:
          ARTIST_ID: !Ref ArtistName
          STACK_NAME: !Ref AWS::StackName
          CALLBACK_URL: !Ref AmplyCallbackUrl
          API_KEY: !Ref AmplyApiKey

  StackCompletionTopic:
    Type: AWS::SNS::Topic

  StackCompletionNotification:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: !Sub "..."
      NotificationARNs:
        - !Ref StackCompletionTopic

Outputs:
  BucketName:
    Value: !Ref S3Bucket
  CloudFrontDomain:
    Value: !GetAtt CloudFront.DomainName
  RoleArn:
    Value: !GetAtt ArtistRole.Arn
```

### 2. Backend API Endpoint

Create `/complete-artist-setup` endpoint that:

```javascript
POST /complete-artist-setup

Request Body:
{
  artistId: "artist-name",
  provider: "aws",
  stack_name: "amply-artist-name",
  stack_id: "arn:aws:cloudformation:...",
  stack_status: "CREATE_COMPLETE",
  outputs: {
    BucketName: "amply-artist-name-bucket",
    CloudFrontDomain: "d123456.cloudfront.net",
    RoleArn: "arn:aws:iam::123456789:role/..."
  },
  callback_token: "api-key-or-signed-token"
}

Response (200 OK):
{
  success: true,
  artistId: "artist-name",
  message: "Artist config saved successfully"
}
```

The endpoint should:
1. Validate callback token
2. Validate payload structure
3. Map provider-specific outputs to standardized config
4. Save to DynamoDB/database
5. Send success response

## Google Cloud Implementation

Similar approach using Cloud Functions + Pub/Sub:

```python
# Cloud Function triggered by deployment completion
import functions_framework
import requests

@functions_framework.http
def callback_on_deployment_complete(request):
    payload = request.get_json()
    
    # Send to Amply
    response = requests.post(
        "https://amply.app/api/complete-artist-setup",
        json={
            "artistId": payload['artist_id'],
            "provider": "gcp",
            "deployment_name": payload['deployment'],
            "project_id": payload['project'],
            "outputs": {
                "bucket_name": payload['bucket'],
                "cdn_domain": payload['cdn'],
            },
            "callback_token": payload['token']
        }
    )
    
    return {"status": response.status_code}
```

## Azure Implementation

Similar approach using Logic Apps or Azure Functions:

```csharp
[FunctionName("OnDeploymentComplete")]
public static async Task<IActionResult> Run(
    [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequest req,
    ILogger log)
{
    var payload = JsonConvert.DeserializeObject(await req.Body.ReadAsStringAsync());
    
    using (var client = new HttpClient())
    {
        var response = await client.PostAsJsonAsync(
            "https://amply.app/api/complete-artist-setup",
            new {
                artistId = payload.artistId,
                provider = "azure",
                resource_group = payload.resourceGroup,
                outputs = new {
                    storage_account = payload.storageAccount,
                    container = payload.container,
                    cdn_endpoint = payload.cdnEndpoint
                },
                callback_token = payload.token
            }
        );
        
        return new OkResult();
    }
}
```

## Frontend Integration

The setup-complete.js already handles callbacks:

```javascript
const callbackListener = new CallbackListener();

callbackListener.start(
  (callbackData) => {
    // Auto-redirect to profile setup
    window.location.href = "/artist/setup-profile.html";
  }
);

// Falls back to polling if no callback received within 3 minutes
```

## Security Considerations

1. **Validate Callback Token** - Sign tokens with AWS KMS/GCP Cloud KMS
2. **Verify Origin** - Only accept callbacks from known cloud provider IPs
3. **Rate Limiting** - Limit callback attempts per artist
4. **HTTPS Only** - All callbacks over HTTPS
5. **Idempotency** - Handle duplicate callbacks gracefully

## Testing

### Local Testing
```bash
curl -X POST http://localhost:3000/complete-artist-setup \
  -H "Content-Type: application/json" \
  -d '{
    "artistId": "test-artist",
    "provider": "aws",
    "outputs": {
      "bucketName": "test-bucket",
      "cloudfrontDomain": "d123456.cloudfront.net"
    }
  }'
```

### Cloud Testing
1. Create test CloudFormation stack with callback Lambda
2. Monitor Lambda logs during deployment
3. Verify Amply receives callback
4. Check artist config saved in database

## Fallback Mechanism

If callback fails:
1. Frontend still polls `/verify-stack` every 10 seconds
2. After 3 minutes of no callback, shows warning
3. Polling continues as fallback
4. This ensures non-technical users still complete setup even if callback fails

## Summary

✅ **Non-technical friendly** - No manual copy-paste
✅ **Automatic** - Cloud provider sends data back
✅ **Secure** - Uses API keys/tokens
✅ **Provider agnostic** - Works for AWS/GCP/Azure
✅ **Fallback safe** - Polling still works if callback fails
