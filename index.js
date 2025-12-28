const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");
const {
  CloudFrontClient,
  ListDistributionsCommand,
  CreateInvalidationCommand,
} = require("@aws-sdk/client-cloudfront");
const {
  CloudFormationClient,
  CreateStackCommand,
  DescribeStacksCommand,
} = require("@aws-sdk/client-cloudformation");
const {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

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

exports.handler = async (event) => {
  const rawPath = event.rawPath || event.path || "";
  const path = rawPath.split("?")[0]; // Strip query string for routing
  const method = event.requestContext.http?.method || event.httpMethod;
  console.log("➡️ PATH:", path, "| METHOD:", method, "| RAW PATH:", rawPath);

  // === CORS Preflight ===
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    // === DEPLOY STACK ===
    if (path.endsWith("/deploy-stack") && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const artistName = body.artistName || "Unknown";
      const accountId = event.requestContext.accountId;

      const cf = new CloudFormationClient({ region });
      const result = await cf.send(
        new CreateStackCommand({
          StackName: `amply-${artistName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
          TemplateURL: templateURL,
          Parameters: [
            { ParameterKey: "AmplyAccountId", ParameterValue: process.env.AWS_ACCOUNT_ID },
            { ParameterKey: "ArtistName", ParameterValue: artistName },
          ],
          Capabilities: ["CAPABILITY_NAMED_IAM"],
        })
      );

      console.log("✅ Stack created:", result.StackId);

      // Wait a bit for stack to initialize
      await new Promise((r) => setTimeout(r, 8000));

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Stack creation initiated",
          stackId: result.StackId,
        }),
      };
    }

    // === UPLOAD PRESIGNED URL ===
    if (path.endsWith("/presigned-url") && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const fileName = body.fileName || `song-${Date.now()}.mp3`;
      const artistId = body.artistId || "unknown";

      console.log("➡️ Generating presigned upload URL...");

      const s3 = new S3Client({ region });
      const uploadUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: defaultBucket,
          Key: `${artistId}/${fileName}`,
          ContentType: "audio/mpeg",
        }),
        { expiresIn: 3600 }
      );

      console.log("✅ Presigned URL generated:", fileName);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          uploadUrl,
          fileName,
          bucketKey: `${artistId}/${fileName}`,
        }),
      };
    }

    // === UPDATE CENTRAL INDEX ===
    if (path.endsWith("/update-index") && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { artistId, artistName, songs } = body;

      console.log("➡️ Updating central index...");

      const s3 = new S3Client({ region });
      const indexKey = "global-index.json";

      let index = { artists: [] };
      try {
        const response = await s3.send(
          new GetObjectCommand({
            Bucket: centralBucket,
            Key: indexKey,
          })
        );
        const data = await response.Body.transformToString();
        index = JSON.parse(data);
      } catch (err) {
        console.log("ℹ️ No existing index file, creating new one.");
      }

      let artistEntry = index.artists.find((a) => a.id === artistId);
      if (!artistEntry) {
        artistEntry = { id: artistId, name: artistName, songs: [] };
        index.artists.push(artistEntry);
        console.log(`🆕 Created new artist entry for ${artistName}`);
      }

      // Update songs
      for (const song of songs) {
        const existingSongIndex = artistEntry.songs.findIndex(
          (s) => s.id === song.id
        );
        if (existingSongIndex >= 0) {
          artistEntry.songs[existingSongIndex] = song;
          console.log(`🔁 Updated existing song: ${song.title}`);
        } else {
          artistEntry.songs.push(song);
          console.log(`🎵 Added new song: ${song.title}`);
        }
      }

      await s3.send(
        new PutObjectCommand({
          Bucket: centralBucket,
          Key: indexKey,
          Body: JSON.stringify(index),
          ContentType: "application/json",
        })
      );

      console.log("✅ Central index updated successfully!");

      // Invalidate CloudFront cache if domain is provided
      if (body.cloudfrontDomain) {
        try {
          console.log("🔁 Invalidating cache for re-uploaded song...");

          const cloudfrontDomain = body.cloudfrontDomain;
          const cf = new CloudFrontClient({ region });
          const distributions = await cf.send(new ListDistributionsCommand({}));

          const distribution = distributions.DistributionList?.Items?.find(
            (d) => d.DomainName === cloudfrontDomain
          );

          if (distribution) {
            await cf.send(
              new CreateInvalidationCommand({
                DistributionId: distribution.Id,
                InvalidationBatch: {
                  CallerReference: Date.now().toString(),
                  Paths: { Quantity: 1, Items: ["/global-index.json"] },
                },
              })
            );
            console.log("✅ Cache invalidation triggered.");
          } else {
            console.warn(
              "⚠️ No matching CloudFront distribution found for domain:",
              cloudfrontDomain
            );
          }
        } catch (err) {
          console.warn("⚠️ Cache invalidation skipped:", err.message);
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Index updated successfully",
          totalArtists: index.artists.length,
        }),
      };
    }

    // === GET STREAM PRESIGNED URL ===
    if (path.endsWith("/stream-url") && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { bucketKey } = body;

      if (!bucketKey) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing bucketKey" }),
        };
      }

      try {
        const s3 = new S3Client({ region });
        const streamUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: defaultBucket,
            Key: bucketKey,
          }),
          { expiresIn: 3600 }
        );

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ streamUrl }),
        };
      } catch (err) {
        console.error("❌ Stream error:", err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: err.message }),
        };
      }
    }

    // === GET STREAM (Query params version) ===
    if (path.endsWith("/stream") && method === "GET") {
      const { bucket, file } = event.queryStringParameters || {};

      if (!bucket || !file) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Missing bucket or file parameter" }),
        };
      }

      try {
        const s3 = new S3Client({ region });
        const streamUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: bucket,
            Key: file,
          }),
          { expiresIn: 3600 }
        );

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ streamUrl }),
        };
      } catch (err) {
        console.error("❌ Stream error:", err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: err.message }),
        };
      }
    }

    // === CREATE USER ===
    if (path.endsWith("/create-user") && method === "POST") {
      try {
        const body = JSON.parse(event.body || "{}");
        const { userId, email, userType } = body;

        if (!userId || !email) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing userId or email" }),
          };
        }

        const dynamodb = new DynamoDBClient({ region });
        await dynamodb.send(
          new PutItemCommand({
            TableName: USERS_TABLE,
            Item: marshall({
              userId,
              email,
              userType: userType || "listener",
              createdAt: new Date().toISOString(),
              balance: 0,
            }),
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
        // Use Query if table has userId as partition key and playlistId as sort key
        // Otherwise use Scan with FilterExpression
        const result = await dynamodb.send(
          new QueryCommand({
            TableName: PLAYLISTS_TABLE,
            IndexName: "UserIdIndex",  // Assuming this GSI exists with userId as partition key
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: marshall({
              ":userId": userId,
            }),
          })
        );

        const playlists = (result.Items || []).map((item) =>
          unmarshall(item)
        );

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
            body: JSON.stringify({
              error: "Missing userId or playlistName",
            }),
          };
        }

        const playlistId = `playlist-${Date.now()}`;
        const dynamodb = new DynamoDBClient({ region });
        await dynamodb.send(
          new PutItemCommand({
            TableName: PLAYLISTS_TABLE,
            Item: marshall({
              userId,
              playlistId,
              playlistName,
              description: description || "",
              isPublic: 0,
              songs: [],
              createdAt: new Date().toISOString(),
            }),
          })
        );

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({
            message: "Playlist created",
            playlistId,
          }),
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

    // === UPDATE PLAYLIST (Add/Remove Songs) ===
    if (path.endsWith("/playlists") && method === "PUT") {
      try {
        const body = JSON.parse(event.body || "{}");
        const { userId, playlistId, action, song } = body;

        if (!userId || !playlistId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              error: "Missing userId or playlistId",
            }),
          };
        }

        if (action === "add" && !song) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing song for add action" }),
          };
        }

        const dynamodb = new DynamoDBClient({ region });

        if (action === "add") {
          await dynamodb.send(
            new UpdateItemCommand({
              TableName: PLAYLISTS_TABLE,
              Key: marshall({ playlistId }),
              UpdateExpression: "SET songs = list_append(if_not_exists(songs, :empty), :song)",
              ExpressionAttributeValues: marshall({
                ":song": [song],
                ":empty": [],
              }),
            })
          );
        } else if (action === "remove") {
          // Get playlist, find song index, remove it
          const getResult = await dynamodb.send(
            new GetItemCommand({
              TableName: PLAYLISTS_TABLE,
              Key: marshall({ playlistId }),
            })
          );

          const playlist = unmarshall(getResult.Item);
          const newSongs = (playlist.songs || []).filter(
            (s) => s.songId !== body.songId
          );

          await dynamodb.send(
            new UpdateItemCommand({
              TableName: PLAYLISTS_TABLE,
              Key: marshall({ playlistId }),
              UpdateExpression: "SET songs = :songs",
              ExpressionAttributeValues: marshall({
                ":songs": newSongs,
              }),
            })
          );
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: `Song ${action}ed from playlist` }),
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
        const body = JSON.parse(event.body || "{}");
        const { userId, playlistId } = body;

        if (!userId || !playlistId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              error: "Missing userId or playlistId",
            }),
          };
        }

        const dynamodb = new DynamoDBClient({ region });
        await dynamodb.send(
          new DeleteItemCommand({
            TableName: PLAYLISTS_TABLE,
            Key: marshall({ playlistId }),
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
        const { userId, songId, artistId, songName } = body;

        if (!userId || !songId || !artistId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              error: "Missing userId, songId, or artistId",
            }),
          };
        }

        const dynamodb = new DynamoDBClient({ region });
        const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp

        await dynamodb.send(
          new PutItemCommand({
            TableName: LIKES_TABLE,
            Item: marshall({
              songId,
              timestamp,
              userId,
              type: "like",
              artistId,
              songName: songName || "Unknown Song",
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
        const body = JSON.parse(event.body || "{}");
        const { userId, songId, timestamp } = body;

        if (!songId || !timestamp) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing songId or timestamp" }),
          };
        }

        const dynamodb = new DynamoDBClient({ region });

        await dynamodb.send(
          new DeleteItemCommand({
            TableName: LIKES_TABLE,
            Key: marshall({
              songId,
              timestamp,
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
            KeyConditionExpression: "userId = :userId",
            FilterExpression: "#type = :type",
            ExpressionAttributeNames: { "#type": "type" },
            ExpressionAttributeValues: marshall({
              ":userId": userId,
              ":type": "like",
            }),
          })
        );

        const likedSongs = (result.Items || []).map((item) => {
          const data = unmarshall(item);
          return { songId: data.songId, artistId: data.artistId };
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

    // === DELETE SONG ===
    if (path.endsWith("/delete-song") && method === "DELETE") {
      try {
        const body = JSON.parse(event.body || "{}");
        const { artistId, songId, fileName, cloudfrontDomain } = body;

        if (!artistId || !fileName) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing artistId or fileName" }),
          };
        }

        const s3 = new S3Client({ region });

        console.log("➡️ Deleting song from S3:", `${artistId}/${fileName}`);

        // Delete from S3
        await s3.send(
          new DeleteObjectCommand({
            Bucket: defaultBucket,
            Key: `${artistId}/${fileName}`,
          })
        );

        console.log("✅ Song deleted from S3");

        // Update central index to remove song if songId provided
        if (songId) {
          try {
            console.log("➡️ Updating central index...");
            const indexKey = "global-index.json";
            const response = await s3.send(
              new GetObjectCommand({
                Bucket: centralBucket,
                Key: indexKey,
              })
            );
            const index = JSON.parse(await response.Body.transformToString());

            const artistEntry = index.artists.find((a) => a.id === artistId);
            if (artistEntry) {
              const originalCount = artistEntry.songs.length;
              artistEntry.songs = artistEntry.songs.filter(
                (s) => s.id !== songId
              );
              console.log(
                `🗑️ Removed song from index (${originalCount} -> ${artistEntry.songs.length})`
              );

              await s3.send(
                new PutObjectCommand({
                  Bucket: centralBucket,
                  Key: indexKey,
                  Body: JSON.stringify(index),
                  ContentType: "application/json",
                })
              );
            }
          } catch (indexErr) {
            console.warn("⚠️ Index update failed:", indexErr.message);
          }
        }

        // Invalidate CloudFront cache if domain is provided
        if (cloudfrontDomain) {
          try {
            console.log("🔁 Invalidating CloudFront cache...");
            const cf = new CloudFrontClient({ region });
            const distributions = await cf.send(
              new ListDistributionsCommand({})
            );

            const distribution = distributions.DistributionList?.Items?.find(
              (d) => d.DomainName === cloudfrontDomain
            );

            if (distribution) {
              await cf.send(
                new CreateInvalidationCommand({
                  DistributionId: distribution.Id,
                  InvalidationBatch: {
                    CallerReference: Date.now().toString(),
                    Paths: { Quantity: 2, Items: ["/global-index.json", "/*"] },
                  },
                })
              );
              console.log("✅ Cache invalidation triggered.");
            }
          } catch (cfErr) {
            console.warn("⚠️ Cache invalidation failed:", cfErr.message);
          }
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

    // === GET USER PREFERENCES ===
    if (path === "/user-preferences" && method === "GET") {
      try {
        const userId = decodeURIComponent(event.queryStringParameters?.userId || "");
        
        if (!userId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing userId" }),
          };
        }

        const db = new DynamoDBClient({ region });
        const result = await db.send(
          new GetItemCommand({
            TableName: USERS_TABLE,
            Key: marshall({ userId }),
          })
        );

        const user = result.Item ? unmarshall(result.Item) : null;
        const preferences = user?.preferences || {
          sidebarItems: ["Explore", "Playlists", "Liked Songs", "Settings"],
          showHearts: true,
          theme: "dark",
        };

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(preferences),
        };
      } catch (err) {
        console.error("❌ Get preferences error:", err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: err.message }),
        };
      }
    }

    // === UPDATE USER PREFERENCES ===
    if (path === "/user-preferences" && method === "PUT") {
      try {
        const { userId, preferences } = JSON.parse(body || "{}");

        if (!userId || !preferences) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Missing userId or preferences" }),
          };
        }

        const db = new DynamoDBClient({ region });
        
        // First ensure user exists
        await db.send(
          new GetItemCommand({
            TableName: USERS_TABLE,
            Key: marshall({ userId }),
          })
        );

        // Update preferences
        await db.send(
          new UpdateItemCommand({
            TableName: USERS_TABLE,
            Key: marshall({ userId }),
            UpdateExpression: "SET preferences = :prefs, updatedAt = :ts",
            ExpressionAttributeValues: marshall({
              ":prefs": preferences,
              ":ts": new Date().toISOString(),
            }),
          })
        );

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Preferences updated", preferences }),
        };
      } catch (err) {
        console.error("❌ Update preferences error:", err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: err.message }),
        };
      }
    }

    // === FALLBACK ===
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Not found", route: path }),
    };
  } catch (err) {
    console.error("❌ Lambda error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
