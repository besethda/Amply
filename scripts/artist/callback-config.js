/**
 * CLOUD PROVIDER CALLBACK SYSTEM
 * 
 * When an artist sets up hosting infrastructure (AWS CloudFormation, GCP deployment, etc.),
 * the cloud provider automatically sends setup completion info back to this endpoint.
 * 
 * This eliminates the need for non-technical artists to manually copy-paste credentials.
 */

// ============================================
// CALLBACK FLOW DOCUMENTATION
// ============================================
/*
1. Artist selects provider and enters artist name
2. Cloud provider setup page opens (AWS CloudFormation, GCP, etc.)
3. Artist completes setup in cloud console
4. Cloud provider triggers Lambda/Function on completion
5. Lambda/Function POSTs to /complete-artist-setup with stack outputs
6. Amply stores artist config in DynamoDB
7. Frontend receives callback notification
8. Page auto-redirects to profile setup

CALLBACK PAYLOAD STRUCTURE (provider-agnostic):
{
  artistId: "artist-name",
  provider: "aws",
  provider_account_id: "123456789",
  
  // AWS-specific
  stack_name: "amply-artist-name",
  stack_id: "arn:aws:cloudformation:...",
  stack_status: "CREATE_COMPLETE",
  outputs: {
    BucketName: "amply-artist-name-bucket",
    CloudFrontDomain: "d123456.cloudfront.net",
    RoleArn: "arn:aws:iam::123456789:role/..."
  },
  
  // GCP-specific (alternative)
  project_id: "my-project-123",
  deployment_name: "amply-artist-name",
  outputs: {
    bucket_name: "amply-artist-name-bucket",
    cdn_domain: "cdn.example.com",
    service_account: "..."
  },
  
  // Azure-specific (alternative)
  resource_group: "amply-artist-name",
  deployment_name: "amply-artist-name-deploy",
  outputs: {
    storage_account: "amplartistaname",
    container: "music",
    cdn_endpoint: "example.azureedge.net"
  },
  
  // Security
  callback_token: "signed-jwt-token",
  timestamp: 1234567890
}
*/

export const CALLBACK_CONFIG = {
  // Endpoint to receive cloud provider callbacks
  endpoint: "/complete-artist-setup",
  
  // Expected providers and their output field mappings
  providers: {
    aws: {
      required_fields: ["stack_id", "stack_name", "outputs"],
      output_mapping: {
        BucketName: "bucketName",
        CloudFrontDomain: "cloudfrontDomain",
        RoleArn: "roleArn",
      }
    },
    gcp: {
      required_fields: ["project_id", "deployment_name", "outputs"],
      output_mapping: {
        bucket_name: "bucketName",
        cdn_domain: "cdnDomain",
        project_id: "projectId",
      }
    },
    azure: {
      required_fields: ["resource_group", "deployment_name", "outputs"],
      output_mapping: {
        storage_account: "storageAccount",
        container: "container",
        cdn_endpoint: "cdnEndpoint",
      }
    }
  },
  
  // How long to wait for callback before showing "still waiting" message
  timeout_warning_ms: 30000, // 30 seconds
  timeout_error_ms: 180000,  // 3 minutes
};

/**
 * Validate callback payload structure
 */
export function validateCallbackPayload(payload) {
  const { artistId, provider, outputs } = payload;
  
  if (!artistId || !provider || !outputs) {
    return { valid: false, error: "Missing required fields: artistId, provider, outputs" };
  }
  
  const providerConfig = CALLBACK_CONFIG.providers[provider];
  if (!providerConfig) {
    return { valid: false, error: `Unknown provider: ${provider}` };
  }
  
  // Check required provider-specific fields
  for (const field of providerConfig.required_fields) {
    if (!(field in payload)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  
  return { valid: true };
}

/**
 * Map provider-specific outputs to standardized config
 */
export function mapProviderOutputs(provider, outputs) {
  const mapping = CALLBACK_CONFIG.providers[provider]?.output_mapping;
  if (!mapping) return outputs;
  
  const mapped = {};
  for (const [providerField, amplyField] of Object.entries(mapping)) {
    if (providerField in outputs) {
      mapped[amplyField] = outputs[providerField];
    }
  }
  
  return mapped;
}

/**
 * Format callback payload for API storage
 */
export function formatArtistConfig(callbackPayload) {
  const { artistId, provider, outputs, stack_name, deployment_name, resource_group, callback_timestamp } = callbackPayload;
  
  const mappedOutputs = mapProviderOutputs(provider, outputs);
  
  return {
    artistId,
    provider,
    // Provider-specific identifiers
    provider_stack_id: callbackPayload.stack_id || callbackPayload.deployment_name || callbackPayload.resource_group,
    provider_name: stack_name || deployment_name || resource_group,
    // Standardized config fields
    ...mappedOutputs,
    // Metadata
    setup_completed_at: callback_timestamp || new Date().toISOString(),
    setup_method: "cloud_callback"
  };
}
