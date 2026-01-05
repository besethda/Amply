# Provider Abstraction System Documentation

## Overview

The provider abstraction system allows artists to choose between equivalent hosting services while maintaining **complete consistency for listeners**. Each provider must offer:

1. **Cloud Storage** - where audio/image files are uploaded
2. **CDN** - where listeners download files from

## Supported Providers

### AWS (Currently Active)

- **Storage**: S3 (Simple Storage Service)
- **CDN**: CloudFront
- **Config Fields**: `roleArn`, `bucketName`, `cloudfrontDomain`
- **CDN URL Pattern**: `https://{cloudfrontDomain}/{fileKey}`

### Google Cloud (Template Ready)

- **Storage**: Cloud Storage (GCS)
- **CDN**: Cloud CDN
- **Config Fields**: `projectId`, `bucketName`, `cdnDomain`
- **CDN URL Pattern**: `https://{cdnDomain}/{fileKey}`

### Microsoft Azure (Template Ready)

- **Storage**: Blob Storage
- **CDN**: Azure CDN
- **Config Fields**: `storageAccount`, `container`, `cdnEndpoint`
- **CDN URL Pattern**: `https://{cdnEndpoint}/{fileKey}`

### Self-Hosted (Template Ready)

- **Storage**: Custom API
- **CDN**: Custom CDN
- **Config Fields**: `apiEndpoint`, `uploadUrl`, `cdnUrl`
- **CDN URL Pattern**: `{cdnUrl}/{fileKey}`

## How It Works

### 1. Artist Selects Provider

```
/artist/setup-template.html
↓
Displays template cards for each provider
↓
localStorage.setItem("selectedTemplate", providerId)
```

### 2. Provider-Specific Setup

```
setup.html (AWS) OR setup-gcp.html OR setup-azure.html
↓
Artist configures provider credentials
↓
saveArtistConfig() stores with provider: "aws/gcp/azure/self-hosted"
```

### 3. File Upload

```
Artist uploads audio/image files
↓
System uses getUploadEndpoint() to get provider's presigned URL
↓
Upload goes to provider's storage (S3/GCS/Azure)
↓
generateCdnUrl() creates consistent CDN URL
↓
Metadata saved to database with CDN URL
```

### 4. Listener Download

```
Database returns CDN URL: "https://{cdn}/{fileKey}"
↓
Browser downloads from provider's CDN (works same for all providers!)
↓
Listener sees no difference between providers
```

## File Structure

```
provider-config.js          - Defines all providers & their configs
general.js                  - saveArtistConfig() & loadArtistConfig()
upload.js                   - Uses generateCdnUrl() to make URLs
setup-template.js           - Displays provider options
setup-complete.js           - Stores provider in config
```

## Key Functions

### `generateCdnUrl(artistConfig, fileKey)`

**Purpose**: Create consistent CDN URLs regardless of provider

```javascript
const url = generateCdnUrl(config, "songs/artist/song.wav");
// AWS: https://cloudfront-domain.cdn.amazonaws.com/songs/artist/song.wav
// GCP: https://cdn.example.com/songs/artist/song.wav
// Azure: https://example.azureedge.net/songs/artist/song.wav
// All return the same format - transparent to the app!
```

### `getUploadEndpoint(artistConfig)`

**Purpose**: Get provider-specific API endpoint for presigned URLs

```javascript
const endpoint = getUploadEndpoint(config);
// AWS: /get-presigned-url?artist=artistId
// GCP: /get-gcs-signed-url?artist=artistId
// Azure: /get-azure-sas-url?artist=artistId
```

### `validateArtistConfig(config, providerId)`

**Purpose**: Ensure all required fields are present

```javascript
if (validateArtistConfig(config, "aws")) {
  // Config has roleArn, bucketName, cloudfrontDomain
}
```

## Adding a New Provider

1. **Add provider config** in `provider-config.js`:

```javascript
newprovider: {
  id: "newprovider",
  name: "New Provider",
  icon: "🆕",
  storage: "New Storage Service",
  cdn: "New CDN",
  configFields: {
    field1: "Description",
    field2: "Description"
  },
  uploadEndpoint: (artistId) => `/get-new-upload-url?artist=${artistId}`,
  cdnUrlPattern: (domain, key) => `https://${domain}/${key}`,
  supported: false  // Set to true when implemented
}
```

2. **Create setup page** (`setup-newprovider.html`)
3. **Create setup script** (`scripts/artist/setup-newprovider.js`)
4. **Implement backend API**:
   - `/get-new-upload-url` - returns presigned URL
   - Store config with `provider: "newprovider"`

## Consistency Guarantees

✅ **For Artists**:

- Simple template selection at onboarding
- Provider-specific setup flows
- Credentials stored securely

✅ **For Listeners**:

- All songs work the same way
- CDN URLs follow same format
- No difference in playback experience
- Seamless provider migration if needed

✅ **For Developers**:

- Centralized provider configuration
- Easy to add new providers
- No hardcoded provider logic in upload/playback
- Abstract away storage differences

## Future Expansion

When ready to support a new provider:

1. Update `provider-config.js` (change `supported: true`)
2. Implement backend endpoints
3. Create provider-specific setup pages
4. Test end-to-end (upload → playback)
5. That's it! The rest is handled by abstraction layer
