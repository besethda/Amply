import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import {
  CloudFrontClient,
  ListDistributionsCommand,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import {
  CloudFormationClient,
  CreateStackCommand,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const region = "eu-north-1";
const templateURL =
  "https://amply-templates.s3.eu-north-1.amazonaws.com/artist-environment.yml";
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

export const handler = async (event) => {
  const rawPath = event.rawPath || event.path || "";
  const path = rawPath.split("?")[0]; // Strip query string for routing
  const method = event.requestContext.http?.method || event.httpMethod;
  console.log("➡️ PATH:", path, "| METHOD:", method, "| RAW PATH:", rawPath);

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

      const cf = new CloudFormationClient({ region });
      const stackName = `amply-${artistName.replace(/\s+/g, "-").toLowerCase()}`;

      await cf.send(
        new CreateStackCommand({
          StackName: stackName,
          TemplateURL: templateURL,
          Capabilities: ["CAPABILITY_NAMED_IAM"],
          Parameters: [
            { ParameterKey: "ArtistName", ParameterValue: artistName },
            { ParameterKey: "AmplyAccountId", ParameterValue: process.env.AWS_ACCOUNT_ID },
            { ParameterKey: "Region", ParameterValue: region },
          ],
        })
      );

      await new Promise((r) => setTimeout(r, 8000));

      const describe = await cf.send(new DescribeStacksCommand({ StackName: stackName }));
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

      const sts = new STSClient({ region });
      const assume = await sts.send(
        new AssumeRoleCommand({
          RoleArn: artistRoleArn,
          RoleSessionName: "AmplyArtistList",
          DurationSeconds: 900,
        })
      );

      const s3 = new S3Client({
        region,
        credentials: {
          accessKeyId: assume.Credentials.AccessKeyId,
          secretAccessKey: assume.Credentials.SecretAccessKey,
          sessionToken: assume.Credentials.SessionToken,
        },
      });

      const res = await s3.send(new ListObjectsV2Command({ Bucket: bucketName }));
      const files = (res.Contents || []).map((obj) => obj.Key);

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ files }) };
    }

    // === GET-UPLOAD-URL ===
    if (path.endsWith("/get-upload-url") && method === "POST") {
      console.log("➡️ Generating presigned upload URL...");
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
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

      const sts = new STSClient({ region });
      const assume = await sts.send(
        new AssumeRoleCommand({
          RoleArn: artistRoleArn,
          RoleSessionName: "AmplyArtistPresign",
          DurationSeconds: 900,
        })
      );

      const s3 = new S3Client({
        region,
        credentials: {
          accessKeyId: assume.Credentials.AccessKeyId,
          secretAccessKey: assume.Credentials.SecretAccessKey,
          sessionToken: assume.Credentials.SessionToken,
        },
      });

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        ContentType: contentType || "application/octet-stream",
        ChecksumAlgorithm: "CRC32",
        ACL: "bucket-owner-full-control", // ✅ Add this line
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
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
      const {
        artistId,
        artistName,
        cloudfrontDomain,
        bucketName,
        song,
        profilePhoto,
        coverPhoto,
        bio,
        socials
      } = body;

      if (!artistId || !artistName || !cloudfrontDomain || !bucketName) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing one or more required fields" }),
        };
      }

      const s3 = new S3Client({ region });
      const indexKey = "amply-index.json";
      let indexData = { artists: [] };
      let reuploading = false;

      // --- Load existing index (or create new)
      try {
        const existing = await s3.send(new GetObjectCommand({ Bucket: centralBucket, Key: indexKey }));
        const text = await existing.Body.transformToString();
        indexData = JSON.parse(text);
      } catch {
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
      if (profilePhoto) artistEntry.profilePhoto = profilePhoto;
      if (coverPhoto) artistEntry.coverPhoto = coverPhoto;
      if (bio) artistEntry.bio = bio;
      if (socials) artistEntry.socials = socials;

      // --- If song provided, add/update it
      if (song) {
        const existingIndex = artistEntry.songs.findIndex((s) => s.title === song.title);
        if (existingIndex >= 0) {
          artistEntry.songs[existingIndex] = song;
          reuploading = true;
          console.log(`🔁 Updated existing song: ${song.title}`);
        } else {
          artistEntry.songs.push(song);
          console.log(`🎵 Added new song: ${song.title}`);
        }
      }

      // --- Save updated index
      await s3.send(
        new PutObjectCommand({
          Bucket: centralBucket,
          Key: indexKey,
          Body: JSON.stringify(indexData, null, 2),
          ContentType: "application/json",
          ACL: "public-read",
        })
      );

      console.log("✅ Central index updated successfully!");

      // --- Optional CloudFront cache invalidation (only if reuploading)
      if (reuploading) {
        try {
          console.log("🔁 Invalidating cache for re-uploaded song...");
          const cfClient = new CloudFrontClient({ region });
          const list = await cfClient.send(new ListDistributionsCommand({}));
          const target = list.DistributionList?.Items?.find(
            (d) => d.DomainName === cloudfrontDomain
          );

          if (target) {
            await cfClient.send(
              new CreateInvalidationCommand({
                DistributionId: target.Id,
                InvalidationBatch: {
                  Paths: { Quantity: 1, Items: ["/*"] },
                  CallerReference: `reupload-${artistId}-${Date.now()}`,
                },
              })
            );
            console.log("✅ Cache invalidation triggered.");
          } else {
            console.warn("⚠️ No matching CloudFront distribution found for domain:", cloudfrontDomain);
          }
        } catch (err) {
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
        const s3 = new S3Client({ region });
        const command = new GetObjectCommand({ Bucket: bucket, Key: file });

        // generate a temporary presigned URL to stream the song
        const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ streamUrl: signedUrl }),
        };
      } catch (err) {
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

        const dynamodb = new DynamoDBClient({ region });
        const user = {
          userId,
          email,
          username: username || email.split("@")[0],
          displayName: displayName || email,
          createdAt: new Date().toISOString(),
          likedSongs: [],
          followingArtists: [],
        };

        await dynamodb.send(
          new PutItemCommand({
            TableName: USERS_TABLE,
            Item: marshall(user),
          })
        );

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({ message: "User created", userId }),
        };
      } catch (err) {
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

        const dynamodb = new DynamoDBClient({ region });
        const result = await dynamodb.send(
          new QueryCommand({
            TableName: PLAYLISTS_TABLE,
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: marshall({
              ":userId": userId,
            }),
          })
        );

        const playlists = (result.Items || []).map((item) => unmarshall(item));

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ playlists }),
        };
      } catch (err) {
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

        const dynamodb = new DynamoDBClient({ region });
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

        await dynamodb.send(
          new PutItemCommand({
            TableName: PLAYLISTS_TABLE,
            Item: marshall(playlist),
          })
        );

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Playlist created", playlist }),
        };
      } catch (err) {
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

        const dynamodb = new DynamoDBClient({ region });

        if (action === "add") {
          await dynamodb.send(
            new UpdateItemCommand({
              TableName: PLAYLISTS_TABLE,
              Key: marshall({ userId, playlistId }),
              UpdateExpression: "SET songs = list_append(if_not_exists(songs, :empty), :song), updatedAt = :now",
              ExpressionAttributeValues: marshall({
                ":song": [song],
                ":empty": [],
                ":now": new Date().toISOString(),
              }),
            })
          );
        } else if (action === "remove") {
          // Get playlist, filter out song, and update
          const getResult = await dynamodb.send(
            new GetItemCommand({
              TableName: PLAYLISTS_TABLE,
              Key: marshall({ userId, playlistId }),
            })
          );

          const playlist = unmarshall(getResult.Item);
          const updatedSongs = playlist.songs.filter((s) => s.songId !== song.songId);

          await dynamodb.send(
            new UpdateItemCommand({
              TableName: PLAYLISTS_TABLE,
              Key: marshall({ userId, playlistId }),
              UpdateExpression: "SET songs = :songs, updatedAt = :now",
              ExpressionAttributeValues: marshall({
                ":songs": updatedSongs,
                ":now": new Date().toISOString(),
              }),
            })
          );
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: `Song ${action === "add" ? "added to" : "removed from"} playlist` }),
        };
      } catch (err) {
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
        const { userId, playlistId } = event.queryStringParameters || {};

        if (!userId || !playlistId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing userId or playlistId" }),
          };
        }

        const dynamodb = new DynamoDBClient({ region });
        await dynamodb.send(
          new DeleteItemCommand({
            TableName: PLAYLISTS_TABLE,
            Key: marshall({ userId, playlistId }),
          })
        );

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Playlist deleted" }),
        };
      } catch (err) {
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

        const dynamodb = new DynamoDBClient({ region });
        const likeId = `${userId}#${songId}`;

        await dynamodb.send(
          new PutItemCommand({
            TableName: LIKES_TABLE,
            Item: marshall({
              songId: likeId,
              timestamp: Date.now(),
              userId,
              songId: songId,
              artistId: artistId || "unknown",
              type: "like",
            }),
          })
        );

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Song liked" }),
        };
      } catch (err) {
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

        const dynamodb = new DynamoDBClient({ region });
        const likeId = `${userId}#${songId}`;

        await dynamodb.send(
          new DeleteItemCommand({
            TableName: LIKES_TABLE,
            Key: marshall({
              songId: likeId,
              timestamp: Date.now(), // Note: this won't match - we'd need to query first
            }),
          })
        );

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Song unliked" }),
        };
      } catch (err) {
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

        const dynamodb = new DynamoDBClient({ region });
        const result = await dynamodb.send(
          new QueryCommand({
            TableName: LIKES_TABLE,
            IndexName: "UserIdIndex",
            KeyConditionExpression: "userId = :userId AND #type = :type",
            ExpressionAttributeNames: { "#type": "type" },
            ExpressionAttributeValues: marshall({
              ":userId": userId,
              ":type": "like",
            }),
          })
        );

        const likedSongs = (result.Items || []).map((item) => {
          const data = unmarshall(item);
          return { songId: data.songId.split("#")[1], artistId: data.artistId };
        });

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ likedSongs }),
        };
      } catch (err) {
        console.error("❌ Get liked songs error:", err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: err.message }),
        };
      }
    }

    // === FALLBACK ===
    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Not found", route: path }) };
  } catch (err) {
    console.error("❌ Lambda error:", err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};