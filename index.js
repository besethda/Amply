"use strict";
// Updated: 2025-12-29 17:07:00
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_sts_1 = require("@aws-sdk/client-sts");
const client_cloudfront_1 = require("@aws-sdk/client-cloudfront");
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
const region = "eu-north-1";
const templateURL = "https://amply-templates.s3.eu-north-1.amazonaws.com/artist-environment.yml";
const defaultBucket = process.env.S3_BUCKET;
const centralBucket = "amply-central-596430611327"; // ✅ central metadata bucket
const COGNITO_USER_POOL_ID = "eu-north-1_pL55dqPRc"; // Amply user pool
const environment = process.env.ENVIRONMENT || "dev";
const USERS_TABLE = `amply-users-${environment}`;
const PLAYLISTS_TABLE = `amply-playlists-${environment}`;
const LIKES_TABLE = `amply-likes-${environment}`;
const ARTIST_CONFIG_TABLE = `amply-artist-config-${environment}`; // Artist cloud provider configurations
const RELEASES_TABLE = `amply-releases-${environment}`;
const SONGS_TABLE = `amply-songs-${environment}`;
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, GET, POST, PUT, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper function to extract userId from Authorization header JWT token
// Extract payload from JWT token
function extractTokenPayload(event) {
    try {
        const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
        if (!authHeader) {
            console.warn("❌ No Authorization header found");
            return null;
        }
        
        const token = authHeader.replace("Bearer ", "").trim();
        
        // Decode JWT without verification (frontend token is already validated by Cognito)
        const parts = token.split(".");
        if (parts.length !== 3) {
            console.warn("❌ Invalid JWT format, parts:", parts.length);
            return null;
        }
        
        // Handle base64url encoding (replace - with + and _ with /)
        let base64Payload = parts[1];
        base64Payload = base64Payload.replace(/-/g, "+").replace(/_/g, "/");
        
        const payload = JSON.parse(Buffer.from(base64Payload, "base64").toString());
        return payload;
    } catch (e) {
        console.error("Error extracting token payload:", e);
        return null;
    }
}

function extractUserIdFromToken(event) {
    console.log("🔑 extractUserIdFromToken called!");
    try {
        const payload = extractTokenPayload(event);
        if (!payload) return null;
        
        console.log("🔐 JWT payload extracted, sub:", payload.sub);
        
        const userId = payload.sub || payload["cognito:username"] || null;
        if (userId) {
            console.log("✅ Extracted userId from token:", userId);
        } else {
            console.warn("❌ No userId found in JWT payload");
        }
        return userId;
    } catch (err) {
        console.error("❌ Error extracting userId from token:", err.message);
        return null;
    }
}

// Helper function to enrich songs with streaming info
async function enrichSongsWithStreamInfo(songs, dynamodb, artistId) {
    console.log(`📦 Enriching ${songs.length} songs with bucket/file info for artist ${artistId}`);
    
    // Look up artist's bucket from config
    let bucketName = defaultBucket;
    try {
        const configResult = await dynamodb.send(
            new client_dynamodb_1.GetItemCommand({
                TableName: ARTIST_CONFIG_TABLE,
                Key: (0, util_dynamodb_1.marshall)({ artistId }),
            })
        );
        if (configResult.Item) {
            const config = (0, util_dynamodb_1.unmarshall)(configResult.Item);
            bucketName = config.bucketName || defaultBucket;
            console.log(`   ✅ Found artist bucket in config: ${bucketName}`);
        } else {
            console.log(`   ℹ️ No artist config found, using default bucket: ${defaultBucket}`);
        }
    } catch (e) {
        console.warn(`   ⚠️ Could not get artist bucket from config: ${e.message}, using default: ${defaultBucket}`);
    }
    
    for (let song of songs) {
        // Look for s3Key or file field
        const s3Path = song.s3Key || song.file;
        console.log(`   Song: ${song.title}, s3Key: ${song.s3Key}, file: ${song.file}`);
        if (s3Path) {
            // Provide bucket and file so player can call /stream endpoint
            // /stream endpoint has CORS headers configured and handles presigning
            song.bucket = bucketName;
            song.file = s3Path;
            console.log(`   ✅ Added bucket=${song.bucket}, file=${song.file}`);
        } else {
            console.warn(`   ⚠️ No s3Key or file for song ${song.title}`);
        }
    }
    return songs;
}

const handler = async (event) => {
    const rawPath = event.rawPath || event.path || "";
    const path = rawPath.split("?")[0]; // Strip query string for routing
    const method = event.requestContext.http?.method || event.httpMethod;
    
    // Extract authorizer - handle both direct and nested claims structure
    let authorizer = event.requestContext?.authorizer || {};
    if (authorizer.claims === undefined && typeof authorizer === 'object') {
        // If authorizer is an object but doesn't have claims, it might BE the claims
        // Check if it has 'sub' directly
        if (!authorizer.sub && authorizer.claims) {
            authorizer = { claims: authorizer };
        } else if (!authorizer.sub) {
            // Try to extract claims if they're in a different format
            authorizer = { claims: authorizer };
        }
    }
    
    console.log("➡️ PATH:", path, "| METHOD:", method, "| RAW PATH:", rawPath);
    console.log("🔐 Full authorizer object:", JSON.stringify(event.requestContext?.authorizer || {}));
    console.log("🔐 Authorizer claims:", authorizer?.claims?.sub || "MISSING");
    try {
        // === Handle CORS preflight ===
        if (method === "OPTIONS") {
            return { statusCode: 204, headers: corsHeaders };
        }
        // === CONNECT ===
        if (path.endsWith("/connect") && method === "POST") {
            const body = JSON.parse(event.body || "{}");
            const { artistName } = body;
            if (!artistName)
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: "Missing artist name" }),
                };
            const cf = new client_cloudformation_1.CloudFormationClient({ region });
            const normalizedArtistName = artistName.replace(/\s+/g, "-").toLowerCase();
            const stackName = `amply-${normalizedArtistName}`;
            await cf.send(new client_cloudformation_1.CreateStackCommand({
                StackName: stackName,
                TemplateURL: templateURL,
                Capabilities: ["CAPABILITY_NAMED_IAM"],
                Parameters: [
                    { ParameterKey: "ArtistName", ParameterValue: normalizedArtistName },
                    { ParameterKey: "AmplyAccountId", ParameterValue: process.env.AWS_ACCOUNT_ID },
                    { ParameterKey: "Region", ParameterValue: region },
                ],
            }));
            console.log(`✅ CloudFormation stack creation initiated: ${stackName}`);
            return {
                statusCode: 202,
                headers: corsHeaders,
                body: JSON.stringify({
                    message: "Artist environment setup initiated",
                    stackName: stackName,
                    status: "CREATE_IN_PROGRESS",
                    estimatedTime: "5-10 minutes",
                    pollUrl: `/stack-status/${stackName}`,
                }),
            };
        }
        // === STACK STATUS (Polling endpoint) ===
        if (path.match(/^\/stack-status\//) && method === "GET") {
            const stackName = path.split("/").pop();
            if (!stackName) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: "Missing stackName" }),
                };
            }
            try {
                const cf = new client_cloudformation_1.CloudFormationClient({ region });
                const describe = await cf.send(new client_cloudformation_1.DescribeStacksCommand({ StackName: stackName }));
                const stack = describe.Stacks?.[0];
                if (!stack) {
                    return {
                        statusCode: 404,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Stack not found" }),
                    };
                }
                const status = stack.StackStatus;
                console.log(`📊 Stack ${stackName} status: ${status}`);
                if (status === "CREATE_COMPLETE") {
                    const outputs = stack.Outputs || [];
                    const result = Object.fromEntries(outputs.map((o) => [o.OutputKey, o.OutputValue]));
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            status: "CREATE_COMPLETE",
                            stackName: stackName,
                            message: "Artist environment ready!",
                            ...result,
                        }),
                    };
                } else if (status === "CREATE_IN_PROGRESS") {
                    return {
                        statusCode: 202,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            status: "CREATE_IN_PROGRESS",
                            stackName: stackName,
                            message: "Setup in progress, please check again in 30 seconds",
                        }),
                    };
                } else if (status.includes("FAILED")) {
                    const reason = stack.StackStatusReason || "Unknown error";
                    console.error(`❌ Stack creation failed: ${reason}`);
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            status: status,
                            stackName: stackName,
                            error: `Stack creation failed: ${reason}`,
                        }),
                    };
                } else {
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            status: status,
                            stackName: stackName,
                            message: `Stack status: ${status}`,
                        }),
                    };
                }
            } catch (err) {
                console.error("❌ Stack status check error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }
        // === LIST ===
        if (path.endsWith("/list") && method === "POST") {
            const body = JSON.parse(event.body || "{}");
            const { artistRoleArn, bucketName } = body;
            if (!artistRoleArn || !bucketName)
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: "Missing artistRoleArn or bucketName" }),
                };
            const sts = new client_sts_1.STSClient({ region });
            const assume = await sts.send(new client_sts_1.AssumeRoleCommand({
                RoleArn: artistRoleArn,
                RoleSessionName: "AmplyArtistList",
                DurationSeconds: 900,
            }));
            const s3 = new client_s3_1.S3Client({
                region,
                credentials: {
                    accessKeyId: assume.Credentials.AccessKeyId,
                    secretAccessKey: assume.Credentials.SecretAccessKey,
                    sessionToken: assume.Credentials.SessionToken,
                },
            });
            const res = await s3.send(new client_s3_1.ListObjectsV2Command({ Bucket: bucketName }));
            const files = (res.Contents || []).map((obj) => obj.Key);
            return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ files }) };
        }
        // === GET-UPLOAD-URL ===
        if (path.endsWith("/get-upload-url") && method === "POST") {
            console.log("➡️ Generating presigned upload URL...");
            let body;
            try {
                body = JSON.parse(event.body || "{}");
            }
            catch {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: "Invalid JSON body" }),
                };
            }
            const { fileName, artistRoleArn, bucketName, contentType } = body;
            if (!fileName || !artistRoleArn || !bucketName)
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        error: "Missing required fields: fileName, artistRoleArn, bucketName",
                    }),
                };
            const sts = new client_sts_1.STSClient({ region });
            const assume = await sts.send(new client_sts_1.AssumeRoleCommand({
                RoleArn: artistRoleArn,
                RoleSessionName: "AmplyArtistPresign",
                DurationSeconds: 900,
            }));
            const s3 = new client_s3_1.S3Client({
                region,
                credentials: {
                    accessKeyId: assume.Credentials.AccessKeyId,
                    secretAccessKey: assume.Credentials.SecretAccessKey,
                    sessionToken: assume.Credentials.SessionToken,
                },
            });
            const command = new client_s3_1.PutObjectCommand({
                Bucket: bucketName,
                Key: fileName,
                ContentType: contentType || "application/octet-stream",
                ChecksumAlgorithm: "CRC32",
                ACL: "bucket-owner-full-control", // ✅ Add this line
            });
            const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3, command, { expiresIn: 300 });
            console.log("✅ Presigned URL generated:", fileName);
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ uploadUrl, expiresIn: 300 }),
            };
        }
        // === UPDATE-INDEX (Artist Profile + Songs) ===
        if (path.endsWith("/update-index") && method === "POST") {
            console.log("➡️ Updating central index...");
            const body = JSON.parse(event.body || "{}");
            const { artistId, artistName, cloudfrontDomain, bucketName, song, profilePhoto, coverPhoto, bio, socials, defaultSongPrice, genre, socialLinks } = body;
            if (!artistId || !artistName || !cloudfrontDomain || !bucketName) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: "Missing one or more required fields" }),
                };
            }
            const s3 = new client_s3_1.S3Client({ region });
            const indexKey = "amply-index.json";
            let indexData = { artists: [] };
            let reuploading = false;
            // --- Load existing index (or create new)
            try {
                const existing = await s3.send(new client_s3_1.GetObjectCommand({ Bucket: centralBucket, Key: indexKey }));
                const text = await existing.Body.transformToString();
                indexData = JSON.parse(text);
            }
            catch {
                console.log("ℹ️ No existing index file, creating new one.");
            }
            // --- Find or create artist entry
            let artistEntry = indexData.artists.find((a) => a.artistId === artistId);
            if (!artistEntry) {
                artistEntry = {
                    artistId,
                    artistName,
                    bucket: bucketName,
                    cloudfrontDomain,
                    songs: [],
                };
                indexData.artists.push(artistEntry);
                console.log(`🆕 Created new artist entry for ${artistName}`);
            }
            // --- Update artist metadata (optional)
            artistEntry.artistName = artistName || artistEntry.artistName;
            artistEntry.bucket = bucketName;
            artistEntry.cloudfrontDomain = cloudfrontDomain;
            if (profilePhoto)
                artistEntry.profilePhoto = profilePhoto;
            if (coverPhoto)
                artistEntry.coverPhoto = coverPhoto;
            if (bio)
                artistEntry.bio = bio;
            if (socials)
                artistEntry.socials = socials;
            if (defaultSongPrice !== undefined && defaultSongPrice !== null)
                artistEntry.defaultSongPrice = defaultSongPrice;
            if (genre)
                artistEntry.genre = genre;
            if (socialLinks && Array.isArray(socialLinks) && socialLinks.length > 0)
                artistEntry.socialLinks = socialLinks;
            // --- If song provided, add/update it
            if (song) {
                const existingIndex = artistEntry.songs.findIndex((s) => s.title === song.title);
                if (existingIndex >= 0) {
                    artistEntry.songs[existingIndex] = song;
                    reuploading = true;
                    console.log(`🔁 Updated existing song: ${song.title}`);
                }
                else {
                    artistEntry.songs.push(song);
                    console.log(`🎵 Added new song: ${song.title}`);
                }
            }
            // --- Save updated index
            await s3.send(new client_s3_1.PutObjectCommand({
                Bucket: centralBucket,
                Key: indexKey,
                Body: JSON.stringify(indexData, null, 2),
                ContentType: "application/json",
                ACL: "public-read",
            }));
            console.log("✅ Central index updated successfully!");
            // --- Optional CloudFront cache invalidation (only if reuploading)
            if (reuploading) {
                try {
                    console.log("🔁 Invalidating cache for re-uploaded song...");
                    const cfClient = new client_cloudfront_1.CloudFrontClient({ region });
                    const list = await cfClient.send(new client_cloudfront_1.ListDistributionsCommand({}));
                    const target = list.DistributionList?.Items?.find((d) => d.DomainName === cloudfrontDomain);
                    if (target) {
                        await cfClient.send(new client_cloudfront_1.CreateInvalidationCommand({
                            DistributionId: target.Id,
                            InvalidationBatch: {
                                Paths: { Quantity: 1, Items: ["/*"] },
                                CallerReference: `reupload-${artistId}-${Date.now()}`,
                            },
                        }));
                        console.log("✅ Cache invalidation triggered.");
                    }
                    else {
                        console.warn("⚠️ No matching CloudFront distribution found for domain:", cloudfrontDomain);
                    }
                }
                catch (err) {
                    console.warn("⚠️ Cache invalidation skipped:", err.message);
                }
            }
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    message: song
                        ? "Song added and index updated successfully"
                        : "Artist profile updated successfully",
                }),
            };
        }
        // === STREAM ===
        if (path.endsWith("/stream") && method === "GET") {
            const { file, bucket } = event.queryStringParameters || {};
            console.log("🎵 [Stream] Received request - bucket:", bucket, "file:", file);
            if (!file || !bucket) {
                console.error("❌ [Stream] Missing parameters");
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: "Missing 'file' or 'bucket' parameter" }),
                };
            }
            try {
                console.log("📀 [Stream] Creating S3 client for region:", region);
                const s3 = new client_s3_1.S3Client({ region });
                console.log("📀 [Stream] Fetching from S3 - bucket:", bucket, "key:", file);
                const command = new client_s3_1.GetObjectCommand({ 
                    Bucket: bucket, 
                    Key: file,
                    ResponseContentType: "audio/mpeg"
                });
                
                // Fetch the file from S3
                const response = await s3.send(command);
                console.log("📀 [Stream] Got response from S3, converting to base64...");
                
                // Convert the stream to base64 for return as JSON
                const chunks = [];
                for await (const chunk of response.Body) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                const base64Audio = buffer.toString('base64');
                console.log("✅ [Stream] Successfully created base64 audio, size:", base64Audio.length);
                
                return {
                    statusCode: 200,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ 
                        audio: base64Audio,
                        mediaType: "audio/mpeg",
                        size: buffer.length
                    }),
                };
            } catch (err) {
                console.error("❌ Stream error:", err);
                console.error("Stack:", err.stack);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: "Failed to stream file: " + err.message }),
                };
            }
        }
        // === CREATE USER (on signup) ===
        if (path.endsWith("/create-user") && method === "POST") {
            try {
                const body = JSON.parse(event.body || "{}");
                const { userId, email, username, displayName } = body;
                if (!userId || !email) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing userId or email" }),
                    };
                }
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const user = {
                    userId,
                    email,
                    username: username || email.split("@")[0],
                    displayName: displayName || email,
                    createdAt: new Date().toISOString(),
                    likedSongs: [],
                    followingArtists: [],
                };
                await dynamodb.send(new client_dynamodb_1.PutItemCommand({
                    TableName: USERS_TABLE,
                    Item: (0, util_dynamodb_1.marshall)(user),
                }));
                return {
                    statusCode: 201,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: "User created", userId }),
                };
            }
            catch (err) {
                console.error("❌ Create user error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }
        // === GET PLAYLISTS ===
        if (path.endsWith("/playlists") && method === "GET") {
            try {
                const { userId } = event.queryStringParameters || {};
                if (!userId) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing userId" }),
                    };
                }
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const result = await dynamodb.send(new client_dynamodb_1.ScanCommand({
                    TableName: PLAYLISTS_TABLE,
                    FilterExpression: "userId = :userId",
                    ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                        ":userId": userId,
                    }),
                }));
                const playlists = (result.Items || []).map((item) => (0, util_dynamodb_1.unmarshall)(item));
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ playlists }),
                };
            }
            catch (err) {
                console.error("❌ Get playlists error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }
        // === CREATE PLAYLIST ===
        if (path.endsWith("/playlists") && method === "POST") {
            try {
                const body = JSON.parse(event.body || "{}");
                const { userId, playlistName, description } = body;
                if (!userId || !playlistName) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing userId or playlistName" }),
                    };
                }
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const playlistId = `${userId}#${Date.now()}`;
                const playlist = {
                    playlistId,
                    userId,
                    playlistName,
                    description: description || "",
                    songs: [],
                    isPublic: 0, // DynamoDB: 0 = false, 1 = true
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                await dynamodb.send(new client_dynamodb_1.PutItemCommand({
                    TableName: PLAYLISTS_TABLE,
                    Item: (0, util_dynamodb_1.marshall)(playlist),
                }));
                return {
                    statusCode: 201,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: "Playlist created", playlist }),
                };
            }
            catch (err) {
                console.error("❌ Create playlist error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }
        // === UPDATE PLAYLIST (add/remove songs) ===
        if (path.endsWith("/playlists") && method === "PUT") {
            try {
                const body = JSON.parse(event.body || "{}");
                const { userId, playlistId, action, song } = body;
                if (!userId || !playlistId || !action) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing required fields" }),
                    };
                }
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                if (action === "add") {
                    // Normalize song to have songId field
                    const normalizedSong = { songId: song.file || song.songId, ...song };
                    await dynamodb.send(new client_dynamodb_1.UpdateItemCommand({
                        TableName: PLAYLISTS_TABLE,
                        Key: (0, util_dynamodb_1.marshall)({ playlistId }),
                        UpdateExpression: "SET songs = list_append(if_not_exists(songs, :empty), :song), updatedAt = :now",
                        ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                            ":song": [normalizedSong],
                            ":empty": [],
                            ":now": new Date().toISOString(),
                        }),
                    }));
                }
                else if (action === "remove") {
                    // Get playlist, filter out song, and update
                    const getResult = await dynamodb.send(new client_dynamodb_1.GetItemCommand({
                        TableName: PLAYLISTS_TABLE,
                        Key: (0, util_dynamodb_1.marshall)({ playlistId }),
                    }));
                    if (!getResult.Item) {
                        return {
                            statusCode: 404,
                            headers: corsHeaders,
                            body: JSON.stringify({ error: "Playlist not found" }),
                        };
                    }
                    const playlist = (0, util_dynamodb_1.unmarshall)(getResult.Item);
                    if (!playlist.songs || playlist.songs.length === 0) {
                        return {
                            statusCode: 400,
                            headers: corsHeaders,
                            body: JSON.stringify({ error: "Playlist has no songs" }),
                        };
                    }
                    const songToRemove = song.file || song.songId;
                    const updatedSongs = playlist.songs.filter((s) => (s.songId !== songToRemove && s.file !== songToRemove));
                    await dynamodb.send(new client_dynamodb_1.UpdateItemCommand({
                        TableName: PLAYLISTS_TABLE,
                        Key: (0, util_dynamodb_1.marshall)({ playlistId }),
                        UpdateExpression: "SET songs = :songs, updatedAt = :now",
                        ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                            ":songs": updatedSongs,
                            ":now": new Date().toISOString(),
                        }),
                    }));
                }
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: `Song ${action === "add" ? "added to" : "removed from"} playlist` }),
                };
            }
            catch (err) {
                console.error("❌ Update playlist error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }
        // === DELETE PLAYLIST ===
        if (path.endsWith("/playlists") && method === "DELETE") {
            try {
                const body = JSON.parse(event.body || "{}");
                const { playlistId } = body;
                if (!playlistId) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing playlistId" }),
                    };
                }
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                await dynamodb.send(new client_dynamodb_1.DeleteItemCommand({
                    TableName: PLAYLISTS_TABLE,
                    Key: (0, util_dynamodb_1.marshall)({ playlistId }),
                }));
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: "Playlist deleted" }),
                };
            }
            catch (err) {
                console.error("❌ Delete playlist error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }
        // === LIKE SONG ===
        if (path.endsWith("/like-song") && method === "POST") {
            try {
                const body = JSON.parse(event.body || "{}");
                const { userId, songId, artistId } = body;
                if (!userId || !songId) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing userId or songId" }),
                    };
                }
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const likeId = `${userId}#${songId}`;
                const timestamp = Date.now();
                await dynamodb.send(new client_dynamodb_1.PutItemCommand({
                    TableName: LIKES_TABLE,
                    Item: (0, util_dynamodb_1.marshall)({
                        songId: likeId,
                        timestamp: timestamp,
                        userId,
                        actualSongId: songId,
                        artistId: artistId || "unknown",
                        type: "like",
                    }),
                }));
                return {
                    statusCode: 201,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: "Song liked" }),
                };
            }
            catch (err) {
                console.error("❌ Like song error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }
        // === UNLIKE SONG ===
        if (path.endsWith("/unlike-song") && method === "DELETE") {
            try {
                const { userId, songId } = event.queryStringParameters || {};
                if (!userId || !songId) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing userId or songId" }),
                    };
                }
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const likeId = `${userId}#${songId}`;
                
                // Scan to find the like record (can't use Query because we need to find all likes for this user#songId)
                const scanResult = await dynamodb.send(new client_dynamodb_1.ScanCommand({
                    TableName: LIKES_TABLE,
                    FilterExpression: "songId = :likeId",
                    ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                        ":likeId": likeId,
                    }),
                }));
                
                if (!scanResult.Items || scanResult.Items.length === 0) {
                    return {
                        statusCode: 404,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Like not found" }),
                    };
                }
                
                const likeRecord = (0, util_dynamodb_1.unmarshall)(scanResult.Items[0]);
                
                // Delete using both composite key elements
                await dynamodb.send(new client_dynamodb_1.DeleteItemCommand({
                    TableName: LIKES_TABLE,
                    Key: (0, util_dynamodb_1.marshall)({
                        songId: likeId,
                        timestamp: likeRecord.timestamp,
                    }),
                }));
                
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: "Song unliked" }),
                };
            }
            catch (err) {
                console.error("❌ Unlike song error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }
        // === GET LIKED SONGS ===
        if (path.endsWith("/liked-songs") && method === "GET") {
            try {
                const { userId } = event.queryStringParameters || {};
                if (!userId) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing userId" }),
                    };
                }
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const result = await dynamodb.send(new client_dynamodb_1.ScanCommand({
                    TableName: LIKES_TABLE,
                    FilterExpression: "userId = :userId AND #type = :type",
                    ExpressionAttributeNames: { "#type": "type" },
                    ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                        ":userId": userId,
                        ":type": "like",
                    }),
                }));
                const likedSongs = (result.Items || []).map((item) => {
                    const data = (0, util_dynamodb_1.unmarshall)(item);
                    return { songId: data.actualSongId || data.songId.split("#")[1], artistId: data.artistId };
                });
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ likedSongs }),
                };
            }
            catch (err) {
                console.error("❌ Get liked songs error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }
        // === GET USER PROFILE ===
        if (path.endsWith("/user") && method === "GET") {
            try {
                // Extract userId from JWT token directly instead of authorizer
                const userId = extractUserIdFromToken(event);
                if (!userId) {
                    console.warn("❌ No userId found in JWT token");
                    return {
                        statusCode: 401,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Not authenticated" }),
                    };
                }

                console.log("✅ Extracted userId from token:", userId);

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const result = await dynamodb.send(new client_dynamodb_1.GetItemCommand({
                    TableName: USERS_TABLE,
                    Key: (0, util_dynamodb_1.marshall)({ userId }),
                }));

                const user = result.Item ? (0, util_dynamodb_1.unmarshall)(result.Item) : { userId };

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        userId: user.userId,
                        username: user.username || null,
                        avatar: user.avatar || null,
                        email: null,
                        createdAt: user.createdAt || new Date().toISOString(),
                    }),
                };
            }
            catch (err) {
                console.error("❌ Get user error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // === UPDATE USER PROFILE ===
        if (path.endsWith("/user") && method === "PUT") {
            try {
                // Extract userId from JWT token directly instead of authorizer
                const userId = extractUserIdFromToken(event);
                if (!userId) {
                    console.warn("❌ No userId found in JWT token");
                    return {
                        statusCode: 401,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Not authenticated" }),
                    };
                }

                console.log("✅ Extracted userId from token:", userId);

                const body = JSON.parse(event.body || "{}");
                const { username, avatar } = body;

                // Validate input
                if (username && username.length > 50) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Username too long (max 50 chars)" }),
                    };
                }

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const updateExpression = [];
                const expressionValues = { ":now": new Date().toISOString() };

                if (username) {
                    updateExpression.push("username = :username");
                    expressionValues[":username"] = username;
                }
                if (avatar) {
                    updateExpression.push("avatar = :avatar");
                    expressionValues[":avatar"] = avatar;
                }

                if (updateExpression.length === 0) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "No fields to update" }),
                    };
                }

                updateExpression.push("updatedAt = :now");

                await dynamodb.send(new client_dynamodb_1.UpdateItemCommand({
                    TableName: USERS_TABLE,
                    Key: (0, util_dynamodb_1.marshall)({ userId }),
                    UpdateExpression: "SET " + updateExpression.join(", "),
                    ExpressionAttributeValues: (0, util_dynamodb_1.marshall)(expressionValues),
                }));

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: "User profile updated" }),
                };
            }
            catch (err) {
                console.error("❌ Update user error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // === RECORD LISTEN (30+ seconds) ===
        console.log("🔍 Checking /record-listen... path:", path, "method:", method, "match:", path.endsWith("/record-listen"));
        if (path.endsWith("/record-listen") && method === "POST") {
            try {
                // Extract userId and artistId from JWT token
                const payload = extractTokenPayload(event);
                if (!payload) {
                    console.warn("❌ Could not extract token payload");
                    return {
                        statusCode: 401,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Not authenticated" }),
                    };
                }

                const userId = payload.sub || payload["cognito:username"];
                const tokenArtistId = payload["custom:artistID"];
                
                if (!userId) {
                    console.warn("❌ No userId found in JWT token");
                    return {
                        statusCode: 401,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Not authenticated" }),
                    };
                }

                console.log("✅ Extracted userId from token:", userId);
                console.log("✅ Extracted artistId from token:", tokenArtistId);

                const body = JSON.parse(event.body || "{}");
                const { songId, durationPlayed, title } = body;
                
                // Use artistId from token, fallback to request body if not in token
                const artistId = tokenArtistId || body.artistId;

                if (!songId || durationPlayed === undefined || !artistId) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing required fields" }),
                    };
                }

                // Allow any duration - even short songs count as listens
                // Record the listen event regardless of duration
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const now = Date.now();
                const listenId = `${userId}#${songId}#${now}`;

                // Record the listen event
                await dynamodb.send(new client_dynamodb_1.PutItemCommand({
                    TableName: LIKES_TABLE,
                    Item: (0, util_dynamodb_1.marshall)({
                        songId: listenId,
                        timestamp: now,
                        userId,
                        actualSongId: songId,
                        title: title || "Unknown",
                        artistId,
                        durationPlayed,
                        type: "listen",
                    }),
                }));

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: "Listen recorded" }),
                };
            }
            catch (err) {
                console.error("❌ Record listen error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // === GET USER LISTENING HISTORY ===
        if (path.endsWith("/user/listening-history") && method === "GET") {
            try {
                // Extract userId from JWT token directly instead of authorizer
                const userId = extractUserIdFromToken(event);
                if (!userId) {
                    console.warn("❌ No userId found in JWT token");
                    return {
                        statusCode: 401,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Not authenticated" }),
                    };
                }

                console.log("✅ Extracted userId from token:", userId);

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const result = await dynamodb.send(new client_dynamodb_1.ScanCommand({
                    TableName: LIKES_TABLE,
                    FilterExpression: "userId = :userId AND #type = :type",
                    ExpressionAttributeNames: { "#type": "type" },
                    ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                        ":userId": userId,
                        ":type": "listen",
                    }),
                }));

                const listens = (result.Items || [])
                    .map((item) => (0, util_dynamodb_1.unmarshall)(item))
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 100); // Last 100 listens

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ listens }),
                };
            }
            catch (err) {
                console.error("❌ Get listening history error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // === COMPLETE ARTIST SETUP (Cloud Provider Callback) ===
        if (path.endsWith("/complete-artist-setup") && method === "POST") {
            console.log("📤 Received artist setup completion callback");
            try {
                const body = JSON.parse(event.body || "{}");
                const { artistId, provider, outputs, callback_token, callback_timestamp, stack_id, deployment_name, resource_group } = body;

                // Validate required fields
                if (!artistId || !provider || !outputs || !callback_token) {
                    console.warn("❌ Missing required callback fields");
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing required fields: artistId, provider, outputs, callback_token" }),
                    };
                }

                // Validate callback token (should match a stored token for this artist)
                // TODO: Implement token validation (compare against stored callback token in DynamoDB or secret)
                if (!callback_token || callback_token.length < 10) {
                    console.warn("❌ Invalid callback token");
                    return {
                        statusCode: 401,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Invalid or missing callback token" }),
                    };
                }

                console.log(`✅ Processing callback for artist: ${artistId}, provider: ${provider}`);

                // Map provider-specific outputs to standardized config
                const artistConfig = {
                    artistId,
                    provider,
                    createdAt: new Date().toISOString(),
                    callbackTimestamp: callback_timestamp || new Date().toISOString(),
                    outputs: outputs,
                };

                // Add provider-specific fields
                if (provider === "aws") {
                    artistConfig.bucketName = outputs.BucketName || outputs.bucketName;
                    artistConfig.cloudfrontDomain = outputs.CloudFrontDomain || outputs.cloudfrontDomain;
                    artistConfig.roleArn = outputs.RoleArn || outputs.roleArn;
                    artistConfig.stackId = stack_id || outputs.StackId;
                } else if (provider === "gcp") {
                    artistConfig.bucketName = outputs.bucketName || outputs.bucket_name;
                    artistConfig.projectId = outputs.projectId || outputs.project_id;
                    artistConfig.serviceAccountEmail = outputs.serviceAccountEmail || outputs.service_account_email;
                    artistConfig.deploymentName = deployment_name;
                    artistConfig.cdnDomain = outputs.cdnDomain || outputs.cdn_domain;
                } else if (provider === "azure") {
                    artistConfig.storageAccount = outputs.storageAccountName || outputs.storage_account;
                    artistConfig.container = outputs.containerName || outputs.container;
                    artistConfig.cdnEndpoint = outputs.cdnEndpoint || outputs.cdn_endpoint;
                    artistConfig.managedIdentityId = outputs.managedIdentityId;
                    artistConfig.resourceGroup = resource_group;
                } else if (provider === "digitalocean") {
                    artistConfig.bucketName = outputs.bucketName || outputs.bucket_name;
                    artistConfig.endpoint = outputs.endpoint || outputs.bucket_endpoint;
                    artistConfig.cdnDomain = outputs.cdnDomain || outputs.cdn_domain;
                } else if (provider === "linode") {
                    artistConfig.bucketName = outputs.bucketName;
                    artistConfig.region = outputs.region;
                    artistConfig.cdnDomain = outputs.cdnDomain;
                } else if (provider === "vultr") {
                    artistConfig.bucketName = outputs.bucketName;
                    artistConfig.region = outputs.region;
                    artistConfig.cdnDomain = outputs.cdnDomain;
                } else if (provider === "hetzner") {
                    artistConfig.storageBoxUsername = outputs.storageBoxUsername;
                    artistConfig.cdnDomain = outputs.cdnDomain;
                } else if (provider === "self-hosted") {
                    artistConfig.apiEndpoint = outputs.apiEndpoint;
                    artistConfig.uploadUrl = outputs.uploadUrl;
                    artistConfig.cdnUrl = outputs.cdnUrl;
                }

                // Save to DynamoDB
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                await dynamodb.send(new client_dynamodb_1.PutItemCommand({
                    TableName: ARTIST_CONFIG_TABLE,
                    Item: (0, util_dynamodb_1.marshall)({
                        artistId: artistId,
                        ...artistConfig,
                    }, { removeUndefinedValues: true }),
                }));

                console.log(`✅ Saved artist config for ${artistId} (${provider})`);

                // Also update the central index with essential info
                try {
                    const s3 = new client_s3_1.S3Client({ region });
                    const indexKey = "amply-index.json";
                    let indexData = { artists: [] };

                    // Load existing index
                    try {
                        const existing = await s3.send(new client_s3_1.GetObjectCommand({ Bucket: centralBucket, Key: indexKey }));
                        const text = await existing.Body.transformToString();
                        indexData = JSON.parse(text);
                    } catch (e) {
                        console.log("ℹ️ Creating new index file");
                    }

                    // Find or create artist entry
                    let artistEntry = indexData.artists.find((a) => a.artistId === artistId);
                    if (!artistEntry) {
                        artistEntry = {
                            artistId,
                            provider,
                            songs: [],
                        };
                        indexData.artists.push(artistEntry);
                    }

                    // Update with callback data
                    artistEntry.provider = provider;
                    artistEntry.lastUpdated = new Date().toISOString();

                    if (provider === "aws") {
                        artistEntry.bucket = artistConfig.bucketName;
                        artistEntry.cloudfrontDomain = artistConfig.cloudfrontDomain;
                    } else if (provider === "gcp") {
                        artistEntry.bucketName = artistConfig.bucketName;
                        artistEntry.cdnDomain = artistConfig.cdnDomain;
                    } else if (provider === "azure") {
                        artistEntry.storageAccount = artistConfig.storageAccount;
                        artistEntry.cdnEndpoint = artistConfig.cdnEndpoint;
                    } else if (provider === "digitalocean") {
                        artistEntry.bucketName = artistConfig.bucketName;
                        artistEntry.cdnDomain = artistConfig.cdnDomain;
                    }

                    // Save updated index
                    await s3.send(new client_s3_1.PutObjectCommand({
                        Bucket: centralBucket,
                        Key: indexKey,
                        ContentType: "application/json",
                        Body: JSON.stringify(indexData, null, 2),
                    }));

                    console.log("✅ Updated central index");
                } catch (e) {
                    console.warn("⚠️ Failed to update central index:", e.message);
                    // Don't fail the callback if index update fails
                }

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: true,
                        artistId,
                        provider,
                        message: "Artist configuration saved successfully",
                    }),
                };
            } catch (err) {
                console.error("❌ Complete artist setup error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // === REGISTER ARTIST IN COGNITO ===
        if (path.endsWith("/register-artist") && method === "POST") {
            console.log("📤 Registering user as artist");
            try {
                // Extract userId from JWT token
                const userId = extractUserIdFromToken(event);
                if (!userId) {
                    return {
                        statusCode: 401,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Not authenticated" }),
                    };
                }

                const body = JSON.parse(event.body || "{}");
                const { artistId, bucketName, cloudfrontDomain, roleArn } = body;

                if (!artistId) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing artistId" }),
                    };
                }

                if (!bucketName || !cloudfrontDomain || !roleArn) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing infrastructure data (bucketName, cloudfrontDomain, roleArn)" }),
                    };
                }

                // Update Cognito - just set artist ID and role
                const cognito = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({ region });
                
                await cognito.send(new client_cognito_identity_provider_1.AdminUpdateUserAttributesCommand({
                    UserPoolId: COGNITO_USER_POOL_ID,
                    Username: userId,
                    UserAttributes: [
                        { Name: "custom:artistID", Value: artistId },
                        { Name: "custom:role", Value: "artist" }
                    ]
                }));

                console.log(`✅ Updated Cognito user ${userId} to artist role with artistID: ${artistId}`);

                // Store infrastructure outputs in artist config table
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const artistConfig = {
                    artistId,
                    provider: "aws",
                    bucketName,
                    cloudfrontDomain,
                    roleArn,
                    createdAt: new Date().toISOString(),
                    userId
                };

                await dynamodb.send(new client_dynamodb_1.PutItemCommand({
                    TableName: ARTIST_CONFIG_TABLE,
                    Item: (0, util_dynamodb_1.marshall)(artistConfig, { removeUndefinedValues: true }),
                }));

                console.log(`✅ Saved artist infrastructure for ${artistId} to DynamoDB`);

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: true,
                        userId,
                        artistId,
                        bucketName,
                        cloudfrontDomain,
                        roleArn,
                        provider: "aws",
                        message: "Artist infrastructure registered successfully"
                    })
                };
            } catch (err) {
                console.error("❌ Register artist error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // === GET ARTIST SONGS ===
        if (path.endsWith("/get-artist-songs") && method === "POST") {
            console.log("🎵 Fetching artist songs from index...");
            try {
                const body = JSON.parse(event.body || "{}");
                const { artistId, cloudfrontDomain, bucketName } = body;

                if (!artistId) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing artistId" }),
                    };
                }

                const s3 = new client_s3_1.S3Client({ region });
                const indexKey = "amply-index.json";
                let songs = [];

                try {
                    const existing = await s3.send(new client_s3_1.GetObjectCommand({
                        Bucket: centralBucket,
                        Key: indexKey,
                    }));

                    const text = await existing.Body.transformToString();
                    const indexData = JSON.parse(text);

                    // Find artist in index
                    const artistEntry = indexData.artists.find((a) => a.artistId === artistId);
                    if (artistEntry && artistEntry.songs) {
                        songs = artistEntry.songs;
                        console.log(`✅ Found ${songs.length} songs for artist ${artistId}`);
                    } else {
                        console.log(`ℹ️ No songs found for artist ${artistId}`);
                    }
                } catch (err) {
                    console.log("ℹ️ Index file not found or error reading it:", err.message);
                    songs = [];
                }

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ songs }),
                };
            } catch (err) {
                console.error("❌ Get artist songs error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // === DELETE SONG ===
        if (path.endsWith("/delete-song") && method === "POST") {
            console.log("🗑️ Deleting song...");
            try {
                const body = JSON.parse(event.body || "{}");
                console.log("📋 Delete request body:", JSON.stringify(body));
                let { artistId, songId, songFile, artFile, artistRoleArn, bucketName } = body;

                // bucketName is required - use environment variable if not provided
                if (!bucketName) {
                    bucketName = process.env.ARTIST_BUCKET || "amply-besethdatest-596430611327";
                    console.log(`📝 bucketName not provided, using: ${bucketName}`);
                }
                
                if (!artistId || !songFile) {
                    console.error("❌ Missing required fields. Received:", { artistId, songFile, bucketName });
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing required fields: artistId, songFile" }),
                    };
                }

                // Create S3 client (use Lambda role if no roleArn provided, or assume role if provided)
                let s3;
                if (artistRoleArn) {
                    console.log(`🔐 Assuming role: ${artistRoleArn}`);
                    const sts = new client_sts_1.STSClient({ region });
                    const assume = await sts.send(new client_sts_1.AssumeRoleCommand({
                        RoleArn: artistRoleArn,
                        RoleSessionName: "AmplyArtistDelete",
                        DurationSeconds: 900,
                    }));

                    s3 = new client_s3_1.S3Client({
                        region,
                        credentials: {
                            accessKeyId: assume.Credentials.AccessKeyId,
                            secretAccessKey: assume.Credentials.SecretAccessKey,
                            sessionToken: assume.Credentials.SessionToken,
                        },
                    });
                } else {
                    console.log("📝 Using Lambda execution role for S3 access");
                    s3 = new client_s3_1.S3Client({ region });
                }

                // Delete the song file
                await s3.send(new client_s3_1.DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: songFile,
                }));

                console.log(`✅ Deleted song file: ${songFile}`);

                // Delete metadata file
                const metaKey = songFile.replace(/\.[^/.]+$/, ".json");
                await s3.send(new client_s3_1.DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: metaKey,
                }));

                console.log(`✅ Deleted metadata file: ${metaKey}`);

                // Delete waveform file if it exists
                const waveformKey = songFile.replace(/\.[^/.]+$/, ".waveform.json");
                try {
                    await s3.send(new client_s3_1.DeleteObjectCommand({
                        Bucket: bucketName,
                        Key: waveformKey,
                    }));
                    console.log(`✅ Deleted waveform file: ${waveformKey}`);
                } catch (err) {
                    // Waveform file may not exist, which is fine
                    console.log(`ℹ️ Waveform file not found (this is OK): ${waveformKey}`);
                }

                // Delete art file if provided
                if (artFile) {
                    await s3.send(new client_s3_1.DeleteObjectCommand({
                        Bucket: bucketName,
                        Key: `art/${artFile}`,
                    }));
                    console.log(`✅ Deleted art file: ${artFile}`);
                }

                // Remove from central index
                const s3Central = new client_s3_1.S3Client({ region });
                const indexKey = "amply-index.json";
                
                try {
                    const existing = await s3Central.send(new client_s3_1.GetObjectCommand({
                        Bucket: centralBucket,
                        Key: indexKey,
                    }));
                    
                    const text = await existing.Body.transformToString();
                    const indexData = JSON.parse(text);
                    
                    // Find artist in index
                    const artistEntry = indexData.artists.find((a) => a.artistId === artistId);
                    if (artistEntry && artistEntry.songs) {
                        // Remove song from artist's songs array
                        artistEntry.songs = artistEntry.songs.filter((s) => s.file !== songFile);
                        
                        // Save updated index
                        await s3Central.send(new client_s3_1.PutObjectCommand({
                            Bucket: centralBucket,
                            Key: indexKey,
                            Body: JSON.stringify(indexData, null, 2),
                            ContentType: "application/json",
                            ACL: "public-read",
                        }));
                        
                        console.log(`✅ Removed song from central index`);
                    }
                } catch (indexErr) {
                    console.warn("⚠️ Could not update central index:", indexErr.message);
                    // Don't fail the delete if index update fails
                }

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: "Song deleted successfully" }),
                };
            } catch (err) {
                console.error("❌ Delete song error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // === GET ARTIST ANALYTICS ===
        if (path.endsWith("/get-artist-analytics") && method === "POST") {
            try {
                const body = JSON.parse(event.body || "{}");
                const { artistId } = body;

                if (!artistId) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing artistId" }),
                    };
                }

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });

                console.log('📊 [Analytics] Scanning LIKES_TABLE for artistId:', artistId);
                
                // Scan the table to get all records for this artist
                // Note: In production, you'd want to add a GSI on artistId for better performance
                const result = await dynamodb.send(new client_dynamodb_1.ScanCommand({
                    TableName: LIKES_TABLE,
                    FilterExpression: "artistId = :artistId AND #t = :type",
                    ExpressionAttributeNames: { "#t": "type" },
                    ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                        ":artistId": artistId,
                        ":type": "listen",
                    }),
                }));

                console.log('📊 [Analytics] Scan returned', result.Items?.length, 'items');

                // Items are already filtered by type = "listen", so no need to filter again
                const listens = (result.Items || [])
                    .map((item) => (0, util_dynamodb_1.unmarshall)(item));

                // Aggregate stats
                const stats = {
                    totalListens: listens.length,
                    listensPerSong: {},
                    topSongs: [],
                    totalDurationPlayed: 0,
                };

                listens.forEach((listen) => {
                    const songId = listen.actualSongId || listen.songId;
                    const title = listen.title || "Unknown";
                    if (!stats.listensPerSong[songId]) {
                        stats.listensPerSong[songId] = { count: 0, title };
                    }
                    stats.listensPerSong[songId].count++;
                    stats.totalDurationPlayed += listen.durationPlayed || 0;
                });

                // Top 10 songs
                stats.topSongs = Object.entries(stats.listensPerSong)
                    .map(([songId, data]) => ({ songId, title: data.title, listens: data.count }))
                    .sort((a, b) => b.listens - a.listens)
                    .slice(0, 10);

                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(stats),
                };
            } catch (err) {
                console.error("❌ Get artist analytics error:", err);
                console.error("❌ Error message:", err.message);
                console.error("❌ Error stack:", err.stack);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message, details: err.toString() }),
                };
            }
        }

        // === SAVE ARTIST CONFIG ===
        if (path.endsWith("/artist/save-config") && method === "POST") {
            try {
                const payload = extractTokenPayload(event);
                if (!payload) {
                    return {
                        statusCode: 401,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Not authenticated" }),
                    };
                }

                const artistId = payload["custom:artistID"] || payload.sub;
                const body = JSON.parse(event.body || "{}");

                if (!artistId || !body.config) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing artistId or config" }),
                    };
                }

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                await dynamodb.send(new client_dynamodb_1.PutItemCommand({
                    TableName: ARTIST_CONFIG_TABLE,
                    Item: (0, util_dynamodb_1.marshall)({
                        artistId,
                        config: body.config,
                        savedAt: Date.now(),
                    }),
                }));

                console.log("✅ Artist config saved for:", artistId);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: "Config saved" }),
                };
            } catch (err) {
                console.error("❌ Save config error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // === GET ARTIST CONFIG ===
        if (path.endsWith("/artist/get-config") && method === "GET") {
            try {
                const payload = extractTokenPayload(event);
                if (!payload) {
                    return {
                        statusCode: 401,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Not authenticated" }),
                    };
                }

                const artistId = payload["custom:artistID"] || payload.sub;
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });

                const result = await dynamodb.send(new client_dynamodb_1.GetItemCommand({
                    TableName: ARTIST_CONFIG_TABLE,
                    Key: (0, util_dynamodb_1.marshall)({ artistId }),
                }));

                if (!result.Item) {
                    return {
                        statusCode: 404,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "No config found" }),
                    };
                }

                const item = (0, util_dynamodb_1.unmarshall)(result.Item);
                console.log("✅ Artist config retrieved for:", artistId);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(item.config),
                };
            } catch (err) {
                console.error("❌ Get config error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // === GET-WAVEFORM (Fetch pre-computed waveform data) ===
        if (path.endsWith("/get-waveform") && method === "POST") {
            console.log("➡️ Fetching waveform data...");
            const body = JSON.parse(event.body || "{}");
            let { artistId, songTitle, bucketName } = body;
            
            if (!songTitle || !bucketName) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: "Missing required fields: songTitle, bucketName" }),
                };
            }
            
            // Clean up song title - remove extension if present
            songTitle = songTitle.replace(/\.[^.]+$/, '');
            console.log(`📝 Looking for waveform: "${songTitle}" in bucket: ${bucketName}`);
            
            try {
                const s3 = new client_s3_1.S3Client({ region });
                
                // Generate multiple possible file paths to search
                // Handle case variations and different naming patterns
                const possibleKeys = [
                    `songs/${songTitle}.waveform.json`,              // Exact case: songs/Song Name.waveform.json
                    `songs/${songTitle.toLowerCase()}.waveform.json`, // Lowercase: songs/song name.waveform.json
                ];
                
                // Add artistId paths if artistId is provided
                if (artistId) {
                    possibleKeys.push(`${artistId}/${songTitle}.waveform.json`);        // Structured: artistId/Song Name.waveform.json
                    possibleKeys.push(`${artistId}/${songTitle.toLowerCase()}.waveform.json`); // Lowercase structured
                }
                
                let waveformData = null;
                let waveformKey = null;
                
                // Try each possible path
                for (const key of possibleKeys) {
                    try {
                        console.log(`  Trying: ${key}`);
                        const command = new client_s3_1.GetObjectCommand({
                            Bucket: bucketName,
                            Key: key,
                        });
                        
                        const response = await s3.send(command);
                        const text = await response.Body.transformToString();
                        waveformData = JSON.parse(text);
                        waveformKey = key;
                        console.log(`✅ Found waveform data at: ${key}`);
                        break;
                    } catch (err) {
                        // File doesn't exist, try next pattern
                        continue;
                    }
                }
                
                if (!waveformData) {
                    console.warn(`⚠️  Waveform data not found for: "${songTitle}"`);
                    console.log(`Attempted paths: ${possibleKeys.join(", ")}`);
                    return {
                        statusCode: 404,
                        headers: corsHeaders,
                        body: JSON.stringify({ 
                            error: "Waveform data not found",
                            message: "The waveform for this song has not been analyzed yet. Please re-upload the song.",
                            attemptedPaths: possibleKeys,
                        }),
                    };
                }
                
                console.log(`✅ Returning waveform data with ${waveformData.data.length} samples`);
                
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(waveformData),
                };
            } catch (err) {
                console.error("❌ Get waveform error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // === CREATE RELEASE ===
        if (path.endsWith("/create-release") && method === "POST") {
            try {
                const userId = extractUserIdFromToken(event);
                if (!userId) {
                    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
                }

                const body = JSON.parse(event.body || "{}");
                const { releaseType, title, description, coverArt, releaseDate, artistName } = body;

                if (!releaseType || !title) {
                    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing required fields: releaseType, title" }) };
                }

                if (!["single", "EP", "album"].includes(releaseType)) {
                    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "releaseType must be 'single', 'EP', or 'album'" }) };
                }

                const releaseId = require("crypto").randomUUID();
                const timestamp = new Date().toISOString();
                
                // Try to get artist name from request or from artist config
                let finalArtistName = artistName || "Unknown Artist";
                if (!artistName) {
                    try {
                        const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                        const configResult = await dynamodb.send(
                            new client_dynamodb_1.GetItemCommand({
                                TableName: ARTIST_CONFIG_TABLE,
                                Key: (0, util_dynamodb_1.marshall)({ artistId: userId }),
                            })
                        );
                        if (configResult.Item) {
                            const config = (0, util_dynamodb_1.unmarshall)(configResult.Item);
                            finalArtistName = config.artistName || config.displayName || "Unknown Artist";
                        }
                    } catch (err) {
                        console.warn("⚠️ Failed to fetch artist config, using default name:", err);
                    }
                }

                const releaseData = {
                    releaseId,
                    artistId: userId,
                    artistName: finalArtistName,
                    releaseType,
                    title,
                    description: description || "",
                    coverArt: coverArt || "",
                    releaseDate: releaseDate || timestamp,
                    status: "draft",
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                await dynamodb.send(
                    new client_dynamodb_1.PutItemCommand({
                        TableName: RELEASES_TABLE,
                        Item: (0, util_dynamodb_1.marshall)(releaseData),
                    })
                );

                console.log(`✅ Created release: ${releaseId} for artist ${finalArtistName}`);
                return {
                    statusCode: 201,
                    headers: corsHeaders,
                    body: JSON.stringify({ releaseId, ...releaseData }),
                };
            } catch (err) {
                console.error("❌ Create release error:", err);
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
            }
        }

        // === GET RELEASES (WITH SONGS EMBEDDED) ===
        if (path.endsWith("/releases") && method === "GET") {
            try {
                const userId = extractUserIdFromToken(event);
                if (!userId) {
                    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
                }

                const queryParams = event.queryStringParameters || {};
                const artistId = queryParams.artistId || userId;
                const releaseType = queryParams.type;

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const expressionValues = { ":artistId": artistId };
                if (releaseType) {
                    expressionValues[":type"] = releaseType;
                }

                let queryParams2 = {
                    TableName: RELEASES_TABLE,
                    KeyConditionExpression: "artistId = :artistId",
                    ExpressionAttributeValues: (0, util_dynamodb_1.marshall)(expressionValues),
                };

                if (releaseType) {
                    queryParams2.FilterExpression = "releaseType = :type";
                }

                const result = await dynamodb.send(new client_dynamodb_1.QueryCommand(queryParams2));
                let releases = (result.Items || []).map((item) => (0, util_dynamodb_1.unmarshall)(item));

                // For each release, fetch songs and embed them
                for (let release of releases) {
                    try {
                        const songsResult = await dynamodb.send(
                            new client_dynamodb_1.QueryCommand({
                                TableName: SONGS_TABLE,
                                IndexName: "releaseIdIndex",
                                KeyConditionExpression: "releaseId = :releaseId",
                                ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                                    ":releaseId": release.releaseId,
                                }),
                            })
                        );
                        release.songs = (songsResult.Items || []).map((item) => (0, util_dynamodb_1.unmarshall)(item));
                        console.log(`   Release ${release.releaseId}: Found ${release.songs.length} songs, enriching...`);
                        // Enrich songs with bucket and file info for streaming
                        release.songs = await enrichSongsWithStreamInfo(release.songs, dynamodb, artistId);
                    } catch (err) {
                        console.warn(`⚠️ Failed to fetch songs for release ${release.releaseId}:`, err);
                        release.songs = [];
                    }
                }

                console.log(`✅ Retrieved ${releases.length} releases with songs for artist ${artistId}`);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ releases }),
                };
            } catch (err) {
                console.error("❌ Get releases error:", err);
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
            }
        }

        // === GET SINGLE RELEASE ===
        if (path.match(/^\/release\/[^\/]+$/) && method === "GET") {
            try {
                const releaseId = path.split("/").pop();
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });

                // Query releases table to find the release
                const queryParams2 = {
                    TableName: RELEASES_TABLE,
                    IndexName: "releaseIdIndex",
                    KeyConditionExpression: "releaseId = :releaseId",
                    ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                        ":releaseId": releaseId,
                    }),
                };

                const result = await dynamodb.send(new client_dynamodb_1.QueryCommand(queryParams2));
                if (!result.Items || result.Items.length === 0) {
                    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Release not found" }) };
                }

                const release = (0, util_dynamodb_1.unmarshall)(result.Items[0]);
                console.log(`✅ Retrieved release: ${releaseId}`);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(release),
                };
            } catch (err) {
                console.error("❌ Get release error:", err);
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
            }
        }

        // === UPDATE RELEASE ===
        if (path.match(/^\/release\/[^\/]+$/) && method === "PUT") {
            try {
                const userId = extractUserIdFromToken(event);
                if (!userId) {
                    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
                }

                const releaseId = path.split("/").pop();
                const body = JSON.parse(event.body || "{}");
                const { title, description, coverArt, status } = body;

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const timestamp = new Date().toISOString();

                // Build update expression dynamically
                const updateFields = ["#updated = :updated"];
                const expressionNames = { "#updated": "updatedAt" };
                const expressionValues = { ":updated": timestamp };

                if (title) {
                    updateFields.push("#title = :title");
                    expressionNames["#title"] = "title";
                    expressionValues[":title"] = title;
                }
                if (description !== undefined) {
                    updateFields.push("#desc = :desc");
                    expressionNames["#desc"] = "description";
                    expressionValues[":desc"] = description;
                }
                if (coverArt !== undefined) {
                    updateFields.push("#cover = :cover");
                    expressionNames["#cover"] = "coverArt";
                    expressionValues[":cover"] = coverArt;
                }
                if (status) {
                    updateFields.push("#status = :status");
                    expressionNames["#status"] = "status";
                    expressionValues[":status"] = status;
                }

                const updateParams = {
                    TableName: RELEASES_TABLE,
                    Key: (0, util_dynamodb_1.marshall)({
                        artistId: userId,
                        releaseId,
                    }),
                    UpdateExpression: "SET " + updateFields.join(", "),
                    ExpressionAttributeNames: expressionNames,
                    ExpressionAttributeValues: (0, util_dynamodb_1.marshall)(expressionValues),
                    ReturnValues: "ALL_NEW",
                };

                const result = await dynamodb.send(new client_dynamodb_1.UpdateItemCommand(updateParams));
                const updatedRelease = (0, util_dynamodb_1.unmarshall)(result.Attributes);

                console.log(`✅ Updated release: ${releaseId}`);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(updatedRelease),
                };
            } catch (err) {
                console.error("❌ Update release error:", err);
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
            }
        }

        // === DELETE RELEASE ===
        if (path.match(/^\/release\/[^\/]+$/) && method === "DELETE") {
            try {
                const userId = extractUserIdFromToken(event);
                if (!userId) {
                    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
                }

                const releaseId = path.split("/").pop();
                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });

                await dynamodb.send(
                    new client_dynamodb_1.DeleteItemCommand({
                        TableName: RELEASES_TABLE,
                        Key: (0, util_dynamodb_1.marshall)({
                            artistId: userId,
                            releaseId,
                        }),
                    })
                );

                console.log(`✅ Deleted release: ${releaseId}`);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: "Release deleted" }),
                };
            } catch (err) {
                console.error("❌ Delete release error:", err);
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
            }
        }

        // === ADD SONG TO RELEASE ===
        if (path.match(/^\/release\/[^\/]+\/add-song$/) && method === "POST") {
            try {
                const userId = extractUserIdFromToken(event);
                if (!userId) {
                    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
                }

                const releaseId = path.split("/")[2];
                const body = JSON.parse(event.body || "{}");
                const { title, genre, duration, s3Key } = body;

                if (!title || !s3Key) {
                    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing required fields: title, s3Key" }) };
                }

                const songId = require("crypto").randomUUID();
                const timestamp = new Date().toISOString();

                const songData = {
                    songId,
                    releaseId,
                    artistId: userId,
                    title,
                    genre: genre || "",
                    duration: duration || 0,
                    s3Key,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                await dynamodb.send(
                    new client_dynamodb_1.PutItemCommand({
                        TableName: SONGS_TABLE,
                        Item: (0, util_dynamodb_1.marshall)(songData),
                    })
                );

                console.log(`✅ Added song ${songId} to release ${releaseId}`);
                return {
                    statusCode: 201,
                    headers: corsHeaders,
                    body: JSON.stringify({ songId, ...songData }),
                };
            } catch (err) {
                console.error("❌ Add song error:", err);
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
            }
        }

        // === REMOVE SONG FROM RELEASE ===
        if (path.match(/^\/release\/[^\/]+\/song\/[^\/]+$/) && method === "DELETE") {
            try {
                const userId = extractUserIdFromToken(event);
                if (!userId) {
                    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
                }

                const releaseId = path.split("/")[2];
                const songId = path.split("/")[4];

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                
                // First, get song to verify ownership and get s3Key
                const getResult = await dynamodb.send(
                    new client_dynamodb_1.GetItemCommand({
                        TableName: SONGS_TABLE,
                        Key: (0, util_dynamodb_1.marshall)({ songId }),
                    })
                );

                if (!getResult.Item) {
                    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Song not found" }) };
                }

                const song = (0, util_dynamodb_1.unmarshall)(getResult.Item);
                if (song.artistId !== userId || song.releaseId !== releaseId) {
                    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
                }

                // Get artist's S3 bucket from artist-config
                let bucketName = defaultBucket;
                try {
                    const configResult = await dynamodb.send(
                        new client_dynamodb_1.GetItemCommand({
                            TableName: ARTIST_CONFIG_TABLE,
                            Key: (0, util_dynamodb_1.marshall)({ artistId: userId }),
                        })
                    );
                    if (configResult.Item) {
                        const config = (0, util_dynamodb_1.unmarshall)(configResult.Item);
                        bucketName = config.bucketName || defaultBucket;
                    }
                } catch (e) {
                    console.warn("⚠️ Could not get artist bucket, using default:", e.message);
                }

                // Delete from S3
                const s3 = new client_s3_1.S3Client({ region });
                try {
                    await s3.send(new client_s3_1.DeleteObjectCommand({
                        Bucket: bucketName,
                        Key: song.s3Key,
                    }));
                    console.log(`✅ Deleted S3 file: ${bucketName}/${song.s3Key}`);
                } catch (s3Err) {
                    console.warn(`⚠️ S3 deletion failed (file may not exist): ${s3Err.message}`);
                    // Continue with DynamoDB deletion even if S3 fails
                }

                // Delete from DynamoDB
                await dynamodb.send(
                    new client_dynamodb_1.DeleteItemCommand({
                        TableName: SONGS_TABLE,
                        Key: (0, util_dynamodb_1.marshall)({ songId }),
                    })
                );

                // Check if there are any remaining songs in this release
                const remainingSongsResult = await dynamodb.send(
                    new client_dynamodb_1.QueryCommand({
                        TableName: SONGS_TABLE,
                        IndexName: "releaseIdIndex",
                        KeyConditionExpression: "releaseId = :releaseId",
                        ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                            ":releaseId": releaseId,
                        }),
                    })
                );

                const remainingSongs = remainingSongsResult.Items || [];
                if (remainingSongs.length === 0) {
                    // No more songs in release, delete the release too
                    try {
                        await dynamodb.send(
                            new client_dynamodb_1.DeleteItemCommand({
                                TableName: RELEASES_TABLE,
                                Key: (0, util_dynamodb_1.marshall)({ 
                                    artistId: userId,
                                    releaseId: releaseId,
                                }),
                            })
                        );
                        console.log(`✅ Deleted empty release ${releaseId}`);
                    } catch (err) {
                        console.warn(`⚠️ Failed to delete empty release ${releaseId}:`, err);
                    }
                }

                console.log(`✅ Deleted song ${songId} from release ${releaseId}`);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: "Song deleted", releaseDeleted: remainingSongs.length === 0 }),
                };
            } catch (err) {
                console.error("❌ Delete song error:", err);
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
            }
        }

        // === GET SONGS IN RELEASE ===
        // === GET RELEASE SONGS (WITH RELEASE DATA) ===
        if (path.match(/^\/release\/[^\/]+\/songs$/) && method === "GET") {
            try {
                const releaseId = path.split("/")[2];

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                
                // Get the release data first
                let release = null;
                try {
                    const releaseResult = await dynamodb.send(
                        new client_dynamodb_1.QueryCommand({
                            TableName: RELEASES_TABLE,
                            IndexName: "releaseIdIndex",
                            KeyConditionExpression: "releaseId = :releaseId",
                            ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                                ":releaseId": releaseId,
                            }),
                        })
                    );
                    if (releaseResult.Items && releaseResult.Items.length > 0) {
                        release = (0, util_dynamodb_1.unmarshall)(releaseResult.Items[0]);
                    }
                } catch (err) {
                    console.warn(`⚠️ Failed to fetch release ${releaseId}:`, err);
                }

                // Get songs for the release
                const songsResult = await dynamodb.send(
                    new client_dynamodb_1.QueryCommand({
                        TableName: SONGS_TABLE,
                        IndexName: "releaseIdIndex",
                        KeyConditionExpression: "releaseId = :releaseId",
                        ExpressionAttributeValues: (0, util_dynamodb_1.marshall)({
                            ":releaseId": releaseId,
                        }),
                    })
                );

                let songs = (songsResult.Items || []).map((item) => (0, util_dynamodb_1.unmarshall)(item));
                // Enrich songs with bucket and file info for streaming
                const artistId = release?.artistId || songs[0]?.artistId;
                songs = await enrichSongsWithStreamInfo(songs, dynamodb, artistId);
                console.log(`✅ Retrieved ${songs.length} songs in release ${releaseId}`);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ release, songs }),
                };
            } catch (err) {
                console.error("❌ Get songs error:", err);
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
            }
        }

        // === GET SONG DETAILS ===
        if (path.match(/^\/songs\/[^\/]+$/) && method === "GET") {
            try {
                const songId = path.split("/")[2];

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const result = await dynamodb.send(
                    new client_dynamodb_1.GetItemCommand({
                        TableName: SONGS_TABLE,
                        Key: (0, util_dynamodb_1.marshall)({ songId }),
                    })
                );

                if (!result.Item) {
                    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Song not found" }) };
                }

                let song = (0, util_dynamodb_1.unmarshall)(result.Item);
                // Enrich song with bucket and file info for streaming
                const songs = await enrichSongsWithStreamInfo([song], dynamodb, song.artistId);
                song = songs[0];
                console.log(`✅ Retrieved song ${songId}`);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(song),
                };
            } catch (err) {
                console.error("❌ Get song error:", err);
                return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
            }
        }

        // === FALLBACK ===
        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Not found", route: path }) };
    }
    catch (err) {
        console.error("❌ Lambda error:", err);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
};
exports.handler = handler;
