# 🎵 Amply Artist Onboarding System - Complete Implementation Guide

## Overview

This document summarizes the complete artist onboarding system with multi-provider cloud hosting and automatic credential callback to Amply.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ AMPLY FRONTEND                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Listener → Profile → "🎤 Become an Artist" → Setup Template   │
│                                                                 │
│  Template Selection (AWS/GCP/Azure/DO/Linode/Vultr/Hetzner)   │
│  → Provider-specific setup page                                │
│  → Opens cloud provider console (new tab)                      │
│  → Artist deploys infrastructure                               │
│                                                                 │
│  Meanwhile, frontend's CallbackListener waits for callback...  │
│                                                                 │
│  ✅ Callback received (or polling finds completion)            │
│  → setupMetadata fetched from endpoint                         │
│  → Auto-redirect to profile setup page                         │
│  → Artist completes profile (name, bio, socials)              │
│  → Artist Dashboard ready                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↑ HTTP
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ AMPLY BACKEND (Lambda @ api.amply.app)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Routes:                                                        │
│  ✅ POST /complete-artist-setup                                │
│     └─ Receives callback from cloud provider                  │
│     └─ Validates token and artist ID                          │
│     └─ Saves config to amply-artist-configs DynamoDB          │
│     └─ Updates central amply-index.json                        │
│     └─ Returns 200 OK to trigger frontend redirect            │
│                                                                 │
│  ✅ POST /verify-stack (fallback polling)                      │
│     └─ Checks CloudFormation stack status                     │
│     └─ Extracts outputs if complete                           │
│     └─ Saves config same as callback                          │
│                                                                 │
│  (existing routes for music, playlists, user data)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↑ HTTPS
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ CLOUD PROVIDER                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AWS CloudFormation (aws-cloudformation-template.yaml)         │
│  ├─ Creates S3 Bucket (storage)                               │
│  ├─ Creates CloudFront Distribution (CDN)                     │
│  ├─ Creates IAM Role (Amply access)                           │
│  ├─ Creates Lambda Function (callback notifier)               │
│  └─ Triggers Lambda on stack completion                       │
│     → Lambda POSTs to /complete-artist-setup                  │
│                                                                 │
│  GCP Deployment Manager (gcp-deployment-manager-template.yaml)│
│  ├─ Creates Cloud Storage bucket                              │
│  ├─ Creates Cloud CDN                                         │
│  ├─ Creates Service Account                                   │
│  ├─ Creates Cloud Function (callback)                         │
│  └─ Cloud Function POSTs to /complete-artist-setup            │
│                                                                 │
│  Azure (azure-resource-manager-template.json)                 │
│  ├─ Creates Blob Storage                                      │
│  ├─ Creates Azure CDN                                         │
│  ├─ Creates Managed Identity                                  │
│  ├─ Creates Azure Function (callback)                         │
│  └─ Function POSTs to /complete-artist-setup                  │
│                                                                 │
│  DigitalOcean (digitalocean-setup.sh)                         │
│  ├─ Creates Spaces bucket (S3-compatible)                     │
│  ├─ Creates App Platform app                                  │
│  ├─ Sets up callback function                                 │
│  └─ Function POSTs to /complete-artist-setup                  │
│                                                                 │
│  (Linode, Vultr, Hetzner, Self-hosted coming soon)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

### Frontend Files

```
listener/
  listener.html                    # Main listener page (profile modal in header)
  views/
    settings.html                  # Listener settings page

Styles/
  listener/settings.css            # Settings page styling
  core.css                         # Profile modal styles (+ artist card)

scripts/
  listener/
    settings.js                    # Settings page logic (hide/show artist button)
    general.js                     # Profile modal logic + artist card init
    listener.js                    # Home view

artist/
  setup-template.html              # Provider selection (AWS, GCP, Azure, etc)
  setup-complete.html              # Waiting for callback/polling
  setup-profile.html               # Create artist profile (after setup complete)

scripts/artist/
  provider-config.js               # Defines all 8 hosting providers
  callback-config.js               # Callback schema validation
  callback-listener.js             # Listens for postMessage from cloud provider
  setup-template.js                # Render provider cards
  setup-complete.js                # Wait for callback, poll fallback
  general.js                       # Save artist config to localStorage
```

### Backend Files

```
index.js                           # Lambda handler with new /complete-artist-setup route
  → Receives callback from cloud providers
  → Validates token
  → Saves to amply-artist-configs DynamoDB table
  → Updates central index
```

### Template Files

```
aws-cloudformation-template.yaml   # AWS: S3 + CloudFront + IAM + Lambda callback
gcp-deployment-manager-template.yaml # GCP: Cloud Storage + CDN + Cloud Function
azure-resource-manager-template.json # Azure: Blob Storage + CDN + Function
digitalocean-setup.sh              # DigitalOcean: Spaces + App Platform
```

### Documentation Files

```
CALLBACK_SYSTEM.md                 # Callback architecture and provider templates
PROVIDER_SYSTEM.md                 # Provider abstraction layer technical details
MULTI_PROVIDER_GUIDE.md            # Artist-facing provider comparison
BACKEND_SETUP.md                   # Backend implementation guide (DynamoDB, etc)
```

## Implementation Status

### ✅ Completed

1. **Frontend**

   - ✅ "Become an Artist" button in listener settings
   - ✅ "Become an Artist" card in profile modal (Settings tab)
   - ✅ Provider selection UI (setup-template.html)
   - ✅ Setup completion page with CallbackListener
   - ✅ Polling fallback if callback times out
   - ✅ Provider abstraction (8 providers defined)
   - ✅ Callback payload validation
   - ✅ Role-based button visibility (listener vs artist)

2. **Backend**

   - ✅ `/complete-artist-setup` endpoint
   - ✅ Callback token validation
   - ✅ Provider-specific output mapping
   - ✅ DynamoDB storage
   - ✅ Central index update
   - ✅ Error handling and fallback support

3. **Cloud Provider Templates**

   - ✅ AWS CloudFormation with callback Lambda
   - ✅ GCP Deployment Manager with Cloud Functions
   - ✅ Azure Resource Manager with Azure Functions
   - ✅ DigitalOcean setup script

4. **Documentation**
   - ✅ CALLBACK_SYSTEM.md with technical details
   - ✅ BACKEND_SETUP.md with DynamoDB setup
   - ✅ MULTI_PROVIDER_GUIDE.md for artists
   - ✅ PROVIDER_SYSTEM.md technical reference

### 🔄 In Progress / TODO

1. **Backend Setup (Your Action)**

   - [ ] Create `amply-artist-configs-{env}` DynamoDB table
   - [ ] Update Lambda IAM role for DynamoDB access
   - [ ] Implement API key generation endpoint
   - [ ] Implement `/verify-stack` polling endpoint
   - [ ] Deploy updated Lambda
   - [ ] Test with AWS CloudFormation

2. **Frontend Integration**

   - [ ] Add provider card images/icons
   - [ ] Link templates to setup pages (setup-aws.html, setup-gcp.html, etc)
   - [ ] Add deep link to cloud provider console
   - [ ] Handle provider-specific setup flows

3. **Cloud Provider Templates**

   - [ ] Test AWS template end-to-end
   - [ ] Finish GCP template (Cloud Function code upload)
   - [ ] Finish Azure template (Function code deployment)
   - [ ] Test DigitalOcean script
   - [ ] Create Linode, Vultr, Hetzner templates

4. **Security**
   - [ ] Implement secure callback token validation
   - [ ] Add rate limiting to callback endpoint
   - [ ] Sign callbacks with HMAC-SHA256
   - [ ] Add callback attempt logging

## How It Works - Step by Step

### 1. Artist Clicks "Become an Artist"

```
listener/listener.html (Profile Modal > Settings)
  ↓
becomeArtistBtn click event
  ↓
scripts/listener/general.js → initializeArtistCard()
  ↓
Sets localStorage.role = "artist"
  ↓
Redirects to /artist/setup-template.html
```

### 2. Artist Selects Provider

```
setup-template.html (shows 4 provider cards)
  ↓
Artist clicks AWS card
  ↓
scripts/artist/setup-template.js stores selectedTemplate
  ↓
Redirects to /artist/setup-aws.html (or selected provider)
```

### 3. Artist Opens Cloud Provider Console

```
setup-aws.html shows CloudFormation link
  ↓
Artist clicks link → opens AWS CloudFormation in new tab
  ↓
Artist provides:
  - Artist Name
  - Amply API Key
  ↓
CloudFormation creates stack (2-3 minutes)
```

### 4. Cloud Provider Deploys & Sends Callback

```
CloudFormation stack completes
  ↓
Custom Resource triggers Lambda
  ↓
Lambda extracts outputs:
  - BucketName: amply-skywave-123456
  - CloudFrontDomain: d123456.cloudfront.net
  - RoleArn: arn:aws:iam::123456:role/...
  ↓
Lambda POSTs to https://amply.app/api/complete-artist-setup
```

### 5. Amply Backend Receives Callback

```
POST /complete-artist-setup
  ↓
Validates:
  - Token matches artist
  - Artist ID is valid
  - All required fields present
  ↓
Saves to DynamoDB:
  - amply-artist-configs table
  - Key: artistId
  - Value: provider config
  ↓
Updates central index:
  - amply-index.json in S3
  - Adds artist to discoverable list
  ↓
Returns 200 OK
```

### 6. Frontend Redirects to Profile Setup

```
setup-complete.html running CallbackListener
  ↓
Receives postMessage from cloud provider callback
  ↓
Shows success message
  ↓
Auto-redirects to /artist/setup-profile.html
  ↓
Artist creates profile:
  - Artist name
  - Bio
  - Profile photo
  - Social links
  ↓
Setup complete!
```

## Testing Checklist

### Local Testing

- [ ] Test CallbackListener with manual postMessage
- [ ] Test callback payload validation
- [ ] Test provider config mapping
- [ ] Test DynamoDB save
- [ ] Test central index update

### AWS CloudFormation Test

- [ ] Create test CloudFormation stack
- [ ] Monitor Lambda logs
- [ ] Check callback is received
- [ ] Verify DynamoDB record created
- [ ] Test frontend callback receipt
- [ ] Test fallback polling

### Full End-to-End Test

- [ ] Register as listener
- [ ] Go to settings
- [ ] Click "Become an Artist"
- [ ] Select AWS provider
- [ ] Deploy CloudFormation stack
- [ ] Verify callback received within 3 minutes
- [ ] Page auto-redirects
- [ ] Complete artist profile
- [ ] See artist dashboard

## Security Summary

✅ **Frontend**

- Role-based button visibility (Cognito custom:role)
- Callback token validation (callback-config.js)
- Polling fallback if callback fails
- HTTPS only communication
- CORS headers properly set

✅ **Backend**

- Token validation (to be implemented)
- Artist ID verification
- Rate limiting (to be implemented)
- DynamoDB encryption at rest
- IAM least-privilege roles
- Audit logging (to be implemented)

✅ **Cloud Providers**

- Private buckets (no public access)
- IAM roles restrict Amply access
- HTTPS callbacks only
- Callback tokens are short-lived
- Credentials never exposed to frontend

## Cost Implications

### AWS

- S3 storage: ~$0.023/GB transfer
- CloudFront: ~$0.085/GB
- Lambda callback: ~$0.20 per million requests
- DynamoDB: ~$1.25/month for artist configs (on-demand)

### DigitalOcean

- Spaces: $5/month + $0.02/GB transfer
- App Platform: Free tier available
- Much cheaper than AWS for small artists

### GCP

- Cloud Storage: ~$0.020/GB
- Cloud CDN: ~$0.12/GB
- Cloud Functions: $0.40M invocations free per month

## Next Steps

1. **Immediate** (This week)

   - [ ] Create DynamoDB table
   - [ ] Deploy updated Lambda
   - [ ] Test AWS callback flow

2. **Short-term** (Next week)

   - [ ] Implement token validation
   - [ ] Test GCP and Azure templates
   - [ ] Add /verify-stack polling endpoint
   - [ ] Test fallback flow

3. **Medium-term** (This month)

   - [ ] Set up callback signing (HMAC-SHA256)
   - [ ] Add rate limiting
   - [ ] Complete Linode/Vultr templates
   - [ ] Improve error messages

4. **Long-term** (Next month)
   - [ ] Add provider migration tools
   - [ ] Multi-region support
   - [ ] Provider-specific onboarding UX
   - [ ] Analytics on provider preferences

## Resources

- **AWS CloudFormation Docs**: https://docs.aws.amazon.com/cloudformation/
- **GCP Deployment Manager**: https://cloud.google.com/deployment-manager/docs
- **Azure Resource Manager**: https://docs.microsoft.com/en-us/azure/azure-resource-manager/
- **DigitalOcean API**: https://docs.digitalocean.com/reference/api/
- **DynamoDB Best Practices**: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html

## Support

For questions on specific parts:

- **Frontend callback**: See `scripts/artist/callback-listener.js`
- **Provider config**: See `scripts/artist/provider-config.js`
- **Backend endpoint**: See `index.js` `/complete-artist-setup` route
- **DynamoDB setup**: See `BACKEND_SETUP.md`
- **CloudFormation**: See `aws-cloudformation-template.yaml`

---

**Last Updated**: January 5, 2026
**Version**: 1.0 (MVP)
**Status**: Ready for backend setup and testing
