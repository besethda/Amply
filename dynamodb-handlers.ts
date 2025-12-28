// ============================================================
// DYNAMODB OPERATIONS FOR AMPLY
// Add this code to your Lambda handler
// ============================================================

import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const region = "eu-north-1";
const environment = process.env.ENVIRONMENT || "dev";

const dynamodb = new DynamoDBClient({ region });

// Table names
const USERS_TABLE = `amply-users-${environment}`;
const LISTEN_HISTORY_TABLE = `amply-listen-history-${environment}`;
const PLAYLISTS_TABLE = `amply-playlists-${environment}`;
const ARTIST_CONFIG_TABLE = `amply-artist-config-${environment}`;
const FOLLOWS_TABLE = `amply-follows-${environment}`;

// ============================================================
// USERS ENDPOINTS
// ============================================================

/**
 * POST /users
 * Create a new user (listener or artist)
 */
export async function createUser(body) {
  const { userId, email, username, displayName, accountType } = body;

  if (!userId || !email || !username || !displayName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }

  // Check if username already exists
  const existingUser = await queryByIndex(
    USERS_TABLE,
    "UsernameIndex",
    "username",
    username
  );

  if (existingUser.length > 0) {
    return {
      statusCode: 409,
      body: JSON.stringify({ error: "Username already taken" }),
    };
  }

  const user = {
    userId,
    email,
    username,
    displayName,
    accountType: accountType || "listener",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    preferences: {
      favoriteGenres: [],
      language: "en",
      emailNotifications: true,
    },
    stats: {
      totalListens: 0,
      playlistsCreated: 0,
      followingArtists: 0,
    },
  };

  await putItem(USERS_TABLE, user);

  return {
    statusCode: 201,
    body: JSON.stringify({ message: "User created", userId }),
  };
}

/**
 * GET /users/{userId}
 * Get user profile
 */
export async function getUser(userId) {
  const user = await getItem(USERS_TABLE, { userId });

  if (!user) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "User not found" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(user),
  };
}

/**
 * GET /users/search?username={username}
 * Search for user by username
 */
export async function searchUsers(username) {
  const results = await queryByIndex(
    USERS_TABLE,
    "UsernameIndex",
    "username",
    username
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ results }),
  };
}

/**
 * POST /users/{userId}
 * Update user profile
 */
export async function updateUser(userId, updates) {
  const user = await getItem(USERS_TABLE, { userId });

  if (!user) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "User not found" }),
    };
  }

  const updated = { ...user, ...updates, updatedAt: Date.now() };
  await putItem(USERS_TABLE, updated);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "User updated", user: updated }),
  };
}

// ============================================================
// LISTEN HISTORY ENDPOINTS
// ============================================================

/**
 * POST /listen
 * Track a listen for payment calculations
 */
export async function recordListen(body) {
  const {
    songId,
    userId,
    artistId,
    duration,
    listeningDuration,
    completionPercentage,
    deviceType,
    ipCountry,
  } = body;

  if (!songId || !userId || !artistId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Missing required fields: songId, userId, artistId",
      }),
    };
  }

  const timestamp = Date.now();
  const expiryTime = Math.floor(timestamp / 1000) + 365 * 24 * 60 * 60; // 1 year

  const listen = {
    songId,
    timestamp,
    userId,
    artistId,
    duration: duration || 0,
    listeningDuration: listeningDuration || 0,
    completionPercentage: completionPercentage || 0,
    deviceType: deviceType || "unknown",
    ipCountry: ipCountry || "unknown",
    expiryTime, // Auto-delete after 1 year
  };

  // Only count as "listen" if >30% completion (industry standard)
  if (completionPercentage >= 30) {
    // Update user stats
    const user = await getItem(USERS_TABLE, { userId });
    if (user) {
      user.stats.totalListens = (user.stats.totalListens || 0) + 1;
      user.updatedAt = timestamp;
      await putItem(USERS_TABLE, user);
    }
  }

  await putItem(LISTEN_HISTORY_TABLE, listen);

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: "Listen recorded",
      counted: completionPercentage >= 30,
    }),
  };
}

/**
 * GET /listens/{songId}
 * Get all listens for a song (for artist analytics)
 */
export async function getListensForSong(songId, filters = {}) {
  const query = {
    TableName: LISTEN_HISTORY_TABLE,
    KeyConditionExpression: "songId = :songId",
    ExpressionAttributeValues: marshall({
      ":songId": songId,
    }),
  };

  // Optional: filter by date range
  if (filters.startDate && filters.endDate) {
    query.KeyConditionExpression +=
      " AND #ts BETWEEN :startDate AND :endDate";
    query.ExpressionAttributeNames = { "#ts": "timestamp" };
    query.ExpressionAttributeValues[":startDate"] = filters.startDate;
    query.ExpressionAttributeValues[":endDate"] = filters.endDate;
  }

  const response = await dynamodb.send(new QueryCommand(query));
  const listens = response.Items.map((item) => unmarshall(item));

  // Calculate stats
  const totalListens = listens.filter((l) => l.completionPercentage >= 30)
    .length;
  const avgCompletion = Math.round(
    listens.reduce((sum, l) => sum + l.completionPercentage, 0) /
      listens.length
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      songId,
      totalListens,
      avgCompletion,
      listens: listens.slice(0, 100), // Return latest 100
    }),
  };
}

/**
 * GET /listens/user/{userId}
 * Get user's listening history
 */
export async function getUserListeningHistory(userId, limit = 50) {
  const query = {
    TableName: LISTEN_HISTORY_TABLE,
    IndexName: "UserIdIndex",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: marshall({
      ":userId": userId,
    }),
    ScanIndexForward: false, // Latest first
    Limit: limit,
  };

  const response = await dynamodb.send(new QueryCommand(query));
  const listens = response.Items.map((item) => unmarshall(item));

  return {
    statusCode: 200,
    body: JSON.stringify({ userId, listens }),
  };
}

// ============================================================
// PLAYLIST ENDPOINTS
// ============================================================

/**
 * POST /playlists
 * Create a new playlist
 */
export async function createPlaylist(body) {
  const { playlistId, userId, title, description, isPublic, songIds } = body;

  if (!playlistId || !userId || !title) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Missing required fields: playlistId, userId, title",
      }),
    };
  }

  const playlist = {
    playlistId,
    userId,
    title,
    description: description || "",
    isPublic: isPublic ? 1 : 0,
    songIds: songIds || [],
    genres: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    followers: 0,
    likeCount: 0,
  };

  await putItem(PLAYLISTS_TABLE, playlist);

  return {
    statusCode: 201,
    body: JSON.stringify({ message: "Playlist created", playlistId }),
  };
}

/**
 * GET /playlists/{playlistId}
 * Get playlist details
 */
export async function getPlaylist(playlistId) {
  const playlist = await getItem(PLAYLISTS_TABLE, { playlistId });

  if (!playlist) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Playlist not found" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(playlist),
  };
}

/**
 * GET /playlists/user/{userId}
 * Get all playlists for a user
 */
export async function getUserPlaylists(userId) {
  const query = {
    TableName: PLAYLISTS_TABLE,
    IndexName: "UserIdIndex",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: marshall({
      ":userId": userId,
    }),
  };

  const response = await dynamodb.send(new QueryCommand(query));
  const playlists = response.Items.map((item) => unmarshall(item));

  return {
    statusCode: 200,
    body: JSON.stringify({ userId, playlists }),
  };
}

/**
 * GET /playlists/discover
 * Get public playlists (for discovery)
 */
export async function getPublicPlaylists(limit = 50) {
  const query = {
    TableName: PLAYLISTS_TABLE,
    IndexName: "PublicPlaylistsIndex",
    KeyConditionExpression: "isPublic = :isPublic",
    ExpressionAttributeValues: marshall({
      ":isPublic": 1,
    }),
    ScanIndexForward: false,
    Limit: limit,
  };

  const response = await dynamodb.send(new QueryCommand(query));
  const playlists = response.Items.map((item) => unmarshall(item));

  return {
    statusCode: 200,
    body: JSON.stringify({ playlists }),
  };
}

/**
 * POST /playlists/{playlistId}
 * Update playlist (add/remove songs, edit metadata)
 */
export async function updatePlaylist(playlistId, updates) {
  const playlist = await getItem(PLAYLISTS_TABLE, { playlistId });

  if (!playlist) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Playlist not found" }),
    };
  }

  const updated = {
    ...playlist,
    ...updates,
    updatedAt: Date.now(),
  };

  await putItem(PLAYLISTS_TABLE, updated);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Playlist updated", playlist: updated }),
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function putItem(tableName, item) {
  const command = new PutItemCommand({
    TableName: tableName,
    Item: marshall(item),
  });
  return dynamodb.send(command);
}

async function getItem(tableName, key) {
  const command = new GetItemCommand({
    TableName: tableName,
    Key: marshall(key),
  });
  const response = await dynamodb.send(command);
  return response.Item ? unmarshall(response.Item) : null;
}

async function queryByIndex(tableName, indexName, keyName, keyValue) {
  const command = new QueryCommand({
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: `${keyName} = :value`,
    ExpressionAttributeValues: marshall({
      ":value": keyValue,
    }),
  });
  const response = await dynamodb.send(command);
  return response.Items.map((item) => unmarshall(item));
}

// ============================================================
// EXPORT ALL FUNCTIONS
// ============================================================

export const dynamodbHandlers = {
  // Users
  createUser,
  getUser,
  searchUsers,
  updateUser,
  // Listen History
  recordListen,
  getListensForSong,
  getUserListeningHistory,
  // Playlists
  createPlaylist,
  getPlaylist,
  getUserPlaylists,
  getPublicPlaylists,
  updatePlaylist,
};
