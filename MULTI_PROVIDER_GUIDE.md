# Amply Multi-Provider Hosting Guide

Artists on Amply can choose from multiple hosting providers based on their priorities: performance, privacy, cost, or familiarity.

## Supported Providers (Quick Deployment)

### ☁️ Amazon AWS (Recommended for Scale)
- **Best for**: Artists expecting high traffic
- **Advantages**: Enterprise reliability, 100+ availability zones, 99.99% uptime SLA
- **Storage**: S3 (Simple Storage Service)
- **CDN**: CloudFront
- **Callback**: ✅ Automated Lambda callback
- **Pricing**: Pay-as-you-go (typically $0.023/GB for data transfer)
- **Setup Time**: 2-3 minutes
- **Template**: `aws-cloudformation-template.yaml`

**How it works:**
1. Artist opens CloudFormation link with your template
2. Provides artist name and Amply API key
3. Stack creates S3 bucket, CloudFront distribution, and IAM role
4. Lambda automatically notifies Amply when complete
5. Artist auto-redirected to profile setup

---

## Coming Soon (Available Templates)

### 🔵 Google Cloud Platform (GCP)
- **Best for**: Artists who trust Google's infrastructure
- **Advantages**: Competitive pricing, excellent for AI/ML features
- **Storage**: Cloud Storage
- **CDN**: Cloud CDN
- **Callback**: ✅ Cloud Functions callback
- **Pricing**: ~$0.02/GB for data transfer
- **Setup Time**: 2-3 minutes
- **Template**: `gcp-deployment-manager-template.yaml`

### 🟦 Microsoft Azure
- **Best for**: Enterprise artists, Windows-focused workflows
- **Advantages**: Hybrid cloud support, strong compliance certifications
- **Storage**: Blob Storage
- **CDN**: Azure CDN
- **Callback**: ✅ Azure Functions callback
- **Pricing**: ~$0.087/GB for data transfer
- **Setup Time**: 2-3 minutes
- **Template**: `azure-resource-manager-template.json`

---

## Privacy-Focused Alternatives

These providers are excellent for artists who distrust Big Tech or prefer European data residency.

### 💧 DigitalOcean (Privacy-Friendly, GDPR-Compliant)
- **Best for**: Artists who value simplicity and privacy
- **Advantages**: GDPR-compliant, transparent pricing, community-friendly, data centers in EU
- **Storage**: Spaces (S3-compatible)
- **CDN**: DigitalOcean CDN
- **Callback**: ✅ App Platform functions
- **Pricing**: Spaces $5/month + $0.02/GB transfer
- **Setup Time**: 5-10 minutes
- **Template**: `digitalocean-setup.sh` (bash script)
- **Why Artists Love It**: Simple dashboard, no surprise charges, EU data centers

### 🎯 Linode (Community-Focused, Affordable)
- **Best for**: Indie artists on a tight budget
- **Advantages**: Nanode servers starting at $5, transparent pricing, excellent docs
- **Storage**: Object Storage ($5/month + $0.02/GB)
- **CDN**: Linode CDN
- **Callback**: Coming soon
- **Pricing**: Some of the lowest in the industry
- **Setup Time**: ~5 minutes
- **Why Artists Love It**: Affordable, no vendor lock-in, generous free tier

### ⚡ Vultr (Speed & Locations)
- **Best for**: Artists with global audiences
- **Advantages**: 28+ data center locations, DDoS protection built-in
- **Storage**: Object Storage
- **CDN**: Vultr CDN
- **Callback**: Coming soon
- **Pricing**: Object Storage $5/month + data transfer costs
- **Setup Time**: ~5 minutes
- **Why Artists Love It**: Blazing fast, flexible, no bandwidth overage charges

### 🇩🇪 Hetzner Storage Box (European Privacy)
- **Best for**: European artists, privacy advocates
- **Advantages**: German data centers (GDPR guarantees), extremely affordable
- **Storage**: Storage Box (secure FTP/SSH access)
- **CDN**: Hetzner CDN or your own
- **Callback**: Coming soon
- **Pricing**: Storage from €4/month, minimal transfer costs
- **Setup Time**: ~10 minutes
- **Why Artists Love It**: Rock-bottom pricing, European-based, strong privacy

### 🖥️ Self-Hosted
- **Best for**: Developers and artists with technical skills
- **Advantages**: Complete control, no vendor lock-in, privacy guaranteed
- **Storage**: Your own server/NAS
- **CDN**: CloudFlare, BunnyCDN, or self-hosted
- **Callback**: Custom webhook required
- **Pricing**: Depends on your infrastructure
- **Setup Time**: 30+ minutes (requires technical setup)
- **Why Artists Love It**: Maximum control, true independence

---

## Provider Comparison Matrix

| Provider | Price/Month | Uptime SLA | Setup Time | EU Data | Callback | Best For |
|----------|------------|-----------|-----------|---------|----------|----------|
| **AWS** | Variable | 99.99% | 2-3 min | ✓ (Frankfurt) | ✅ Auto | Scale & reliability |
| **GCP** | Variable | 99.99% | 2-3 min | ✓ (Belgium) | ✅ Auto | Google ecosystem |
| **Azure** | Variable | 99.99% | 2-3 min | ✓ (Multiple) | ✅ Auto | Microsoft ecosystem |
| **DigitalOcean** | $5+ | 99.99% | 5-10 min | ✓ (Amsterdam) | ✅ Auto | Privacy + simplicity |
| **Linode** | $5+ | 99.99% | ~5 min | ✗ | 🔄 Soon | Budget-conscious |
| **Vultr** | $5+ | 99.99% | ~5 min | ✓ (London) | 🔄 Soon | Global reach |
| **Hetzner** | €4+ | 99.9% | ~10 min | ✓ (Germany) | 🔄 Soon | Ultra-budget |
| **Self-Hosted** | Varies | Custom | 30+ min | ✓ | 🔄 Custom | Full control |

---

## How Callbacks Work

When artists complete setup on any provider, Amply receives configuration automatically:

### AWS Example Flow
```
1. Artist creates CloudFormation stack
2. Stack finishes (2-3 mins)
3. Custom Resource triggers Lambda
4. Lambda queries stack outputs
5. Lambda POSTs to: POST /api/complete-artist-setup
   {
     "artistId": "skywave",
     "provider": "aws",
     "stack_id": "arn:aws:cloudformation:...",
     "outputs": {
       "bucketName": "amply-skywave-596430611327",
       "cloudfrontDomain": "d123456.cloudfront.net",
       "roleArn": "arn:aws:iam::123456:role/..."
     },
     "callback_token": "secret-key"
   }
6. Amply validates token and saves config
7. Frontend receives callback
8. Artist auto-redirected to profile setup
```

### Fallback to Polling
If callback fails to arrive within 3 minutes:
- Frontend continues polling `/verify-stack`
- Artist can still complete setup via manual verification
- Ensures non-technical users always succeed

---

## Implementation Timeline

### Phase 1 (Current) ✅
- ✅ AWS CloudFormation with callback Lambda
- ✅ GCP template with Cloud Functions
- ✅ Azure template with Azure Functions  
- ✅ DigitalOcean setup script
- ✅ Backend `/complete-artist-setup` endpoint (needed)

### Phase 2 (Next)
- 🔄 Linode Object Storage templates
- 🔄 Vultr Object Storage templates
- 🔄 Hetzner Storage Box integration
- 🔄 Self-hosted documentation

### Phase 3 (Future)
- 🔄 One-click provider setup UI
- 🔄 Wallet-style provider card selection
- 🔄 Multi-provider account management
- 🔄 Provider migration tools

---

## For Non-Technical Artists

**We recommend:** DigitalOcean or AWS (whichever they've heard of)

**Why:** Both provide one-click setup with automatic credential delivery to Amply. Artists never need to:
- Copy bucket names
- Create IAM policies
- Manage credentials
- Verify stack outputs

Just click a button, wait 3 minutes, and it's done.

---

## Security Notes

### API Key Management
- Each artist gets a unique API key
- Keys are short-lived (expire after setup)
- Backend validates callback signature
- Tokens sent over HTTPS only

### Callback Validation
- Verify artist ID matches request
- Check callback timestamp (prevent replay)
- Validate against stored provider schema
- Rate-limit callback attempts

### Provider Credentials
- Never stored in Amply frontend
- Sent directly from provider → Amply backend
- Backend assumes artist's IAM role (AWS)
- Credentials never exposed to artist's browser

---

## Testing Callback System

### Local Testing
```bash
# Simulate callback
curl -X POST http://localhost:3000/api/complete-artist-setup \
  -H "Content-Type: application/json" \
  -d '{
    "artistId": "test-artist",
    "provider": "aws",
    "outputs": {
      "bucketName": "test-bucket",
      "cloudfrontDomain": "d123456.cloudfront.net"
    },
    "callback_token": "test-key"
  }'
```

### Cloud Testing
1. Create test CloudFormation stack
2. Monitor Lambda logs during deployment
3. Check CloudWatch for callback POST
4. Verify artist config saved in database
5. Check frontend auto-redirect

---

## Provider-Specific Setup Instructions

See individual template files for detailed setup:
- `aws-cloudformation-template.yaml` - AWS setup
- `gcp-deployment-manager-template.yaml` - GCP setup
- `azure-resource-manager-template.json` - Azure setup
- `digitalocean-setup.sh` - DigitalOcean setup
- `CALLBACK_SYSTEM.md` - Callback architecture
- `PROVIDER_SYSTEM.md` - Technical provider abstraction

---

## FAQ

**Q: Which provider should I recommend?**
A: AWS for scale, DigitalOcean for privacy, Linode for budget.

**Q: What if callback fails?**
A: Polling fallback ensures artists can still complete setup.

**Q: Can artists switch providers later?**
A: Yes, but would require re-uploading music. We'll build migration tools later.

**Q: Is my data with the provider or Amply?**
A: The provider. Amply never touches your music files, only stores metadata.

**Q: Do I need AWS/GCP account first?**
A: No! Amply links directly to provider setup. Artists create account during setup.

---

**Last Updated**: January 5, 2026
**Next Review**: When Phase 2 providers are ready
