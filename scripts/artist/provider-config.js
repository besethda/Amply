/**
 * PROVIDER CONFIGURATION SYSTEM
 * 
 * This file defines equivalent hosting providers and their configurations.
 * Each provider must have:
 * - storageService: The cloud storage equivalent (S3, GCS, Azure Blob)
 * - cdnService: The CDN equivalent (CloudFront, Cloud CDN, Azure CDN)
 * - uploadEndpoint: API endpoint for presigned URLs
 * - supportedFileTypes: Audio and image formats
 * 
 * The system is provider-agnostic - listeners always get consistent URLs
 */

export const PROVIDERS = {
  aws: {
    id: "aws",
    name: "Amazon AWS",
    icon: "☁️",
    storage: "S3",
    cdn: "CloudFront",
    description: "Enterprise-grade hosting with S3 and CloudFront CDN",
    configFields: {
      roleArn: "IAM Role ARN",
      bucketName: "S3 Bucket Name",
      cloudfrontDomain: "CloudFront Domain"
    },
    uploadEndpoint: (artistId) => `/get-presigned-url?artist=${artistId}`,
    cdnUrlPattern: (cloudfrontDomain, key) => `https://${cloudfrontDomain}/${key}`,
    storageType: "s3",
    supported: true
  },
  
  gcp: {
    id: "gcp",
    name: "Google Cloud",
    icon: "🔵",
    storage: "Cloud Storage",
    cdn: "Cloud CDN",
    description: "Fast deployment with Google Cloud Storage and CDN",
    configFields: {
      bucketName: "GCS Bucket Name",
      projectId: "Google Project ID",
      cdnDomain: "Cloud CDN Domain"
    },
    uploadEndpoint: (artistId) => `/get-gcs-signed-url?artist=${artistId}`,
    cdnUrlPattern: (cdnDomain, key) => `https://${cdnDomain}/${key}`,
    storageType: "gcs",
    supported: false
  },
  
  azure: {
    id: "azure",
    name: "Microsoft Azure",
    icon: "🟦",
    storage: "Blob Storage",
    cdn: "Azure CDN",
    description: "Azure Blob Storage with integrated CDN",
    configFields: {
      storageAccount: "Storage Account Name",
      container: "Blob Container Name",
      cdnEndpoint: "Azure CDN Endpoint"
    },
    uploadEndpoint: (artistId) => `/get-azure-sas-url?artist=${artistId}`,
    cdnUrlPattern: (cdnEndpoint, key) => `https://${cdnEndpoint}/${key}`,
    storageType: "azure",
    supported: false
  },

  digitalocean: {
    id: "digitalocean",
    name: "DigitalOcean",
    icon: "💧",
    storage: "Spaces",
    cdn: "DigitalOcean CDN",
    description: "Privacy-friendly, GDPR-compliant, global performance",
    configFields: {
      bucketName: "Spaces Bucket Name",
      endpoint: "Spaces Endpoint",
      cdnDomain: "CDN Domain"
    },
    uploadEndpoint: (artistId) => `/get-digitalocean-signed-url?artist=${artistId}`,
    cdnUrlPattern: (cdnDomain, key) => `https://${cdnDomain}/${key}`,
    storageType: "spaces",
    supported: false
  },

  linode: {
    id: "linode",
    name: "Linode",
    icon: "🎯",
    storage: "Object Storage",
    cdn: "Linode CDN",
    description: "Affordable, transparent pricing, excellent support",
    configFields: {
      bucketName: "Object Storage Bucket",
      clusterId: "Cluster ID",
      cdnDomain: "CDN Domain"
    },
    uploadEndpoint: (artistId) => `/get-linode-signed-url?artist=${artistId}`,
    cdnUrlPattern: (cdnDomain, key) => `https://${cdnDomain}/${key}`,
    storageType: "linode-object-storage",
    supported: false
  },

  vultr: {
    id: "vultr",
    name: "Vultr",
    icon: "⚡",
    storage: "Object Storage",
    cdn: "Vultr CDN",
    description: "Fast deployment, 28+ global locations",
    configFields: {
      bucketName: "Object Storage Bucket",
      region: "Storage Region",
      cdnDomain: "CDN Domain"
    },
    uploadEndpoint: (artistId) => `/get-vultr-signed-url?artist=${artistId}`,
    cdnUrlPattern: (cdnDomain, key) => `https://${cdnDomain}/${key}`,
    storageType: "vultr-object-storage",
    supported: false
  },

  hetzner: {
    id: "hetzner",
    name: "Hetzner Storage Box",
    icon: "🇩🇪",
    storage: "Storage Box",
    cdn: "Hetzner CDN",
    description: "European data centers, strong privacy, cost-effective",
    configFields: {
      storageBoxUsername: "Storage Box Username",
      storageBoxPassword: "Storage Box Password",
      cdnDomain: "CDN Domain"
    },
    uploadEndpoint: (artistId) => `/get-hetzner-signed-url?artist=${artistId}`,
    cdnUrlPattern: (cdnDomain, key) => `https://${cdnDomain}/${key}`,
    storageType: "hetzner-storage",
    supported: false
  },
  
  "self-hosted": {
    id: "self-hosted",
    name: "Self-Hosted",
    icon: "🖥️",
    storage: "Custom",
    cdn: "Custom CDN",
    description: "Use your own server or storage solution",
    configFields: {
      apiEndpoint: "API Endpoint",
      uploadUrl: "Upload URL",
      cdnUrl: "CDN Base URL"
    },
    uploadEndpoint: (artistId) => `/get-custom-upload-url?artist=${artistId}`,
    cdnUrlPattern: (cdnUrl, key) => `${cdnUrl}/${key}`,
    storageType: "custom",
    supported: false
  }
};

/**
 * Get provider configuration by ID
 */
export function getProvider(providerId) {
  return PROVIDERS[providerId] || null;
}

/**
 * Get list of supported providers
 */
export function getSupportedProviders() {
  return Object.values(PROVIDERS).filter(p => p.supported);
}

/**
 * Get list of all providers (including coming soon)
 */
export function getAllProviders() {
  return Object.values(PROVIDERS);
}

/**
 * Generate CDN URL for a file regardless of provider
 */
export function generateCdnUrl(artistConfig, fileKey) {
  const provider = getProvider(artistConfig.provider);
  if (!provider) {
    console.error("Unknown provider:", artistConfig.provider);
    return null;
  }

  const cdnDomain = artistConfig.cloudfrontDomain || 
                    artistConfig.cdnDomain || 
                    artistConfig.cdnEndpoint || 
                    artistConfig.cdnUrl;
  
  if (!cdnDomain) {
    console.error("No CDN domain configured");
    return null;
  }

  return provider.cdnUrlPattern(cdnDomain, fileKey);
}

/**
 * Get upload endpoint for provider
 */
export function getUploadEndpoint(artistConfig) {
  const provider = getProvider(artistConfig.provider);
  if (!provider) {
    console.error("Unknown provider:", artistConfig.provider);
    return null;
  }

  return provider.uploadEndpoint(artistConfig.artistId);
}

/**
 * Validate artist config has all required fields
 */
export function validateArtistConfig(config, providerId) {
  const provider = getProvider(providerId);
  if (!provider) return false;

  for (const field of Object.keys(provider.configFields)) {
    if (!config[field]) return false;
  }

  return true;
}
