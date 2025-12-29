"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_sts_1 = require("@aws-sdk/client-sts");
const client_cloudfront_1 = require("@aws-sdk/client-cloudfront");
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
const region = "eu-north-1";
const templateURL = "https://amply-templates.s3.eu-north-1.amazonaws.com/artist-environment.yml";
const defaultBucket = process.env.S3_BUCKET;
const centralBucket = "amply-central-596430611327"; // ✅ central metadata bucket
const environment = process.env.ENVIRONMENT || "dev";
const USERS_TABLE = `amply-users-${environment}`;
const PLAYLISTS_TABLE = `amply-playlists-${environment}`;
const LIKES_TABLE = `amply-listen-history-${environment}`; // Reuse listen table with GSI for likes
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, GET, POST, PUT, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper function to extract userId from Authorization header JWT token
function extractUserIdFromToken(event) {
    console.log("🔑 extractUserIdFromToken called!");
    try {
        const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
        console.log("🔐 Auth header present:", !!authHeader);
        if (!authHeader) {
            console.warn("❌ No Authorization header found");
            return null;
        }
        
        const token = authHeader.replace("Bearer ", "").trim();
        console.log("🔐 Token extracted, length:", token.length);
        
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
            const stackName = `amply-${artistName.replace(/\s+/g, "-").toLowerCase()}`;
            await cf.send(new client_cloudformation_1.CreateStackCommand({
                StackName: stackName,
                TemplateURL: templateURL,
                Capabilities: ["CAPABILITY_NAMED_IAM"],
                Parameters: [
                    { ParameterKey: "ArtistName", ParameterValue: artistName },
                    { ParameterKey: "AmplyAccountId", ParameterValue: process.env.AWS_ACCOUNT_ID },
                    { ParameterKey: "Region", ParameterValue: region },
                ],
            }));
            await new Promise((r) => setTimeout(r, 8000));
            const describe = await cf.send(new client_cloudformation_1.DescribeStacksCommand({ StackName: stackName }));
            const outputs = describe.Stacks?.[0]?.Outputs || [];
            const result = Object.fromEntries(outputs.map((o) => [o.OutputKey, o.OutputValue]));
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ message: "Artist environment created!", ...result }),
            };
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
            const { artistId, artistName, cloudfrontDomain, bucketName, song, profilePhoto, coverPhoto, bio, socials } = body;
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
            if (!file || !bucket) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: "Missing 'file' or 'bucket' parameter" }),
                };
            }
            try {
                const s3 = new client_s3_1.S3Client({ region });
                const command = new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: file });
                // generate a temporary presigned URL to stream the song
                const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3, command, { expiresIn: 300 });
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ streamUrl: signedUrl }),
                };
            }
            catch (err) {
                console.error("❌ Stream error:", err);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: "Failed to generate stream URL: " + err.message }),
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
        if (path.endsWith("/record-listen") && method === "POST") {
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
                const { songId, durationPlayed, artistId } = body;

                if (!songId || durationPlayed === undefined || !artistId) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Missing required fields" }),
                    };
                }

                // Only count if 30+ seconds played
                if (durationPlayed < 30) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: "Minimum 30 seconds required" }),
                    };
                }

                const dynamodb = new client_dynamodb_1.DynamoDBClient({ region });
                const now = Date.now();
                const listenId = `${userId}#${songId}#${now}`;

                // Record the listen event
                const title = requestBody.title || "Unknown";
                await dynamodb.send(new client_dynamodb_1.PutItemCommand({
                    TableName: LIKES_TABLE,
                    Item: (0, util_dynamodb_1.marshall)({
                        songId: listenId,
                        title,
                        timestamp: now,
                        userId,
                        actualSongId: songId,
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

        // === FALLBACK ===
        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Not found", route: path }) };
    }
    catch (err) {
        console.error("❌ Lambda error:", err);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
};
exports.handler = handler;
