// ============================================================
// STRIPE INTEGRATION FOR AMPLY
// Payment verification, charging, and balance management
// ============================================================

import Stripe from "stripe";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18",
});

const dynamodb = new DynamoDBClient({ region: "eu-north-1" });
const environment = process.env.ENVIRONMENT || "dev";
const USERS_TABLE = `amply-users-${environment}`;
const ARTIST_CONFIG_TABLE = `amply-artist-config-${environment}`;

// ============================================================
// LISTENER: VERIFY PAYMENT METHOD (Sign Up Flow)
// ============================================================

/**
 * POST /verify-payment-method
 * Test charge $0.01 to verify card, create user account
 * Called during listener signup
 */
export async function verifyPaymentMethod(body) {
  const { userId, email, username, displayName, paymentMethodId } = body;

  if (!userId || !email || !username || !paymentMethodId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Missing required fields: userId, email, username, paymentMethodId",
      }),
    };
  }

  try {
    // Step 1: Create $0.01 test charge
    console.log(`Testing payment method for user: ${userId}`);
    
    const charge = await stripe.charges.create({
      amount: 1, // $0.01 in cents
      currency: "usd",
      payment_method: paymentMethodId,
      confirm: true,
      error_on_requires_action: false, // Don't require 3D secure for small test charge
    });

    if (charge.status !== "succeeded") {
      console.log(`Charge failed for user ${userId}: ${charge.status}`);
      return {
        statusCode: 402,
        body: JSON.stringify({ error: "Payment method verification failed" }),
      };
    }

    // Step 2: Create user in DynamoDB with balance
    const timestamp = Date.now();
    const user = {
      userId,
      email,
      username,
      displayName,
      accountType: "listener",
      createdAt: timestamp,
      updatedAt: timestamp,
      paymentMethod: {
        stripePaymentMethodId: paymentMethodId,
        verified: true,
        verifiedAt: timestamp,
        lastFour: charge.payment_method_details?.card?.last4 || "****",
        brand: charge.payment_method_details?.card?.brand || "unknown",
      },
      balance: 0.01, // Credit the $0.01 test charge
      autoRechargeEnabled: true,
      autoRechargeAmount: 10, // Auto-recharge with $10
      autoRechargeThreshold: 1, // Recharge when balance drops below $1
      preferences: {
        favoriteGenres: [],
        language: "en",
        emailNotifications: true,
      },
      stats: {
        totalListens: 0,
        playlistsCreated: 0,
        followingArtists: 0,
        totalSpent: 0.01,
      },
    };

    // Save user to DynamoDB
    await dynamodb.send(
      new PutItemCommand({
        TableName: USERS_TABLE,
        Item: marshall(user),
      })
    );

    console.log(`✅ User created with verified payment method: ${userId}`);

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Payment method verified, account created",
        userId,
        initialBalance: 0.01,
      }),
    };
  } catch (err) {
    console.error("Payment verification error:", err);

    // If charge fails, don't create account
    return {
      statusCode: 402,
      body: JSON.stringify({
        error: err.message || "Payment verification failed",
      }),
    };
  }
}

// ============================================================
// LISTENER: GET BALANCE
// ============================================================

/**
 * GET /listener/{userId}/balance
 * Get current account balance
 */
export async function getBalance(userId) {
  try {
    const response = await dynamodb.send(
      new GetItemCommand({
        TableName: USERS_TABLE,
        Key: marshall({ userId }),
      })
    );

    if (!response.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    const user = unmarshall(response.Item);

    return {
      statusCode: 200,
      body: JSON.stringify({
        userId,
        balance: user.balance || 0,
        currency: "USD",
        autoRechargeEnabled: user.autoRechargeEnabled,
      }),
    };
  } catch (err) {
    console.error("Get balance error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

// ============================================================
// LISTENER: CHARGE FOR LISTEN
// ============================================================

/**
 * POST /charge-listen
 * Deduct song price from listener balance
 * Called every time listener plays a song
 */
export async function chargeListen(body) {
  const { userId, songId, artistId, pricePerListen } = body;

  if (!userId || !songId || !artistId || !pricePerListen) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Missing required fields: userId, songId, artistId, pricePerListen",
      }),
    };
  }

  try {
    // Step 1: Get user
    const userResponse = await dynamodb.send(
      new GetItemCommand({
        TableName: USERS_TABLE,
        Key: marshall({ userId }),
      })
    );

    if (!userResponse.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    const user = unmarshall(userResponse.Item);
    let balance = user.balance || 0;

    // Step 2: Check if balance sufficient
    if (balance < pricePerListen) {
      // Attempt auto-recharge
      const recharged = await autoRecharge(user);
      if (!recharged) {
        return {
          statusCode: 402,
          body: JSON.stringify({
            error: "Insufficient balance and auto-recharge failed",
            currentBalance: balance,
            needed: pricePerListen,
          }),
        };
      }
      // Update balance after recharge
      const updatedUser = await getUser(userId);
      balance = updatedUser.balance || 0;
    }

    // Step 3: Deduct from balance
    const newBalance = balance - pricePerListen;

    await dynamodb.send(
      new UpdateItemCommand({
        TableName: USERS_TABLE,
        Key: marshall({ userId }),
        UpdateExpression:
          "SET #balance = :balance, #stats.#totalSpent = if_not_exists(#stats.#totalSpent, :zero) + :price, updatedAt = :now",
        ExpressionAttributeNames: {
          "#balance": "balance",
          "#stats": "stats",
          "#totalSpent": "totalSpent",
        },
        ExpressionAttributeValues: marshall({
          ":balance": newBalance,
          ":price": pricePerListen,
          ":zero": 0,
          ":now": Date.now(),
        }),
      })
    );

    console.log(
      `✅ Charged ${pricePerListen} to user ${userId} for song ${songId}`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Listen charged successfully",
        userId,
        songId,
        artistId,
        charged: pricePerListen,
        newBalance: newBalance,
      }),
    };
  } catch (err) {
    console.error("Charge listen error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

// ============================================================
// LISTENER: AUTO-RECHARGE
// ============================================================

async function autoRecharge(user) {
  if (!user.autoRechargeEnabled) {
    console.log(
      `Auto-recharge disabled for user ${user.userId}, cannot recharge`
    );
    return false;
  }

  try {
    const rechargeAmount = user.autoRechargeAmount || 10; // in dollars

    console.log(
      `Attempting auto-recharge of $${rechargeAmount} for user ${user.userId}`
    );

    // Create charge for auto-recharge amount
    const charge = await stripe.charges.create({
      amount: Math.round(rechargeAmount * 100), // Convert to cents
      currency: "usd",
      payment_method: user.paymentMethod.stripePaymentMethodId,
      confirm: true,
    });

    if (charge.status !== "succeeded") {
      console.log(
        `Auto-recharge failed for user ${user.userId}: ${charge.status}`
      );
      return false;
    }

    // Add funds to balance
    const currentBalance = user.balance || 0;
    const newBalance = currentBalance + rechargeAmount;

    await dynamodb.send(
      new UpdateItemCommand({
        TableName: USERS_TABLE,
        Key: marshall({ userId: user.userId }),
        UpdateExpression: "SET #balance = :balance, updatedAt = :now",
        ExpressionAttributeNames: {
          "#balance": "balance",
        },
        ExpressionAttributeValues: marshall({
          ":balance": newBalance,
          ":now": Date.now(),
        }),
      })
    );

    console.log(
      `✅ Auto-recharge successful for user ${user.userId}, new balance: ${newBalance}`
    );
    return true;
  } catch (err) {
    console.error("Auto-recharge error:", err);
    return false;
  }
}

// ============================================================
// ARTIST: GENERATE STRIPE PAYMENT LINK
// ============================================================

/**
 * POST /artist/generate-payment-link
 * Create Stripe payment link for artist support
 * Called during artist onboarding
 */
export async function generatePaymentLink(body) {
  const { artistId, artistName } = body;

  if (!artistId || !artistName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing artistId or artistName" }),
    };
  }

  try {
    // Create Stripe payment link (generic, artist can customize in Stripe dashboard)
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Support ${artistName}`,
              description: "Direct support for your favorite artist on Amply",
            },
            unit_amount: 500, // $5 default
          },
          quantity: 1,
        },
      ],
      after_completion: {
        type: "redirect",
        redirect: {
          url: `https://amply.app/artist/${artistId}/support-thank-you`,
        },
      },
    });

    console.log(`✅ Payment link created for artist ${artistId}`);

    // Save to artist config
    await dynamodb.send(
      new UpdateItemCommand({
        TableName: ARTIST_CONFIG_TABLE,
        Key: marshall({ artistId }),
        UpdateExpression: "SET stripePaymentLink = :link, updatedAt = :now",
        ExpressionAttributeValues: marshall({
          ":link": paymentLink.url,
          ":now": Date.now(),
        }),
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Payment link created",
        paymentLink: paymentLink.url,
        artistId,
      }),
    };
  } catch (err) {
    console.error("Generate payment link error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function getUser(userId) {
  const response = await dynamodb.send(
    new GetItemCommand({
      TableName: USERS_TABLE,
      Key: marshall({ userId }),
    })
  );

  return response.Item ? unmarshall(response.Item) : null;
}

// ============================================================
// EXPORT ALL FUNCTIONS
// ============================================================

export const stripeHandlers = {
  verifyPaymentMethod,
  getBalance,
  chargeListen,
  generatePaymentLink,
};
