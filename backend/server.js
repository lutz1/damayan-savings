

// --- Email utility for admin-triggered notifications ---
// Use require for nodemailer and all modules (CommonJS style)
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const { db, auth } = require("./firebaseAdmin.js");
const os = require("os");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const SERVER_START_TS = Date.now();

const logEvent = (level, event, meta = {}) => {
  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    service: process.env.RENDER_SERVICE_NAME || "amayan-backend",
    env: process.env.NODE_ENV || "development",
    ...meta,
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }
  console.log(JSON.stringify(payload));
};

const logTransactionEvent = (meta = {}) => {
  logEvent("info", "transaction_event", meta);
};

app.use((req, res, next) => {
  const startedAt = Date.now();
  const incomingRequestId = req.headers["x-request-id"];
  const requestId =
    (typeof incomingRequestId === "string" && incomingRequestId.trim()) ||
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  logEvent("info", "http_request_start", {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers["user-agent"] || null,
  });

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    logEvent("info", "http_request_end", {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
});

// � Add Payback Entry Endpoint
app.post("/api/add-payback-entry", async (req, res) => {
  console.log("[payback-entry] 🔄 Request received");
  try {
    const { idToken, uplineUsername, amount, entryDate, clientRequestId } = req.body;
    console.log("[payback-entry] Validating input:", { uplineUsername, amount, entryDate });
    
    // Validate input
    if (!idToken || !uplineUsername || !amount || !entryDate) {
      console.error("[payback-entry] ❌ Missing required fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      console.error("[payback-entry] ❌ Invalid amount");
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    if (numAmount < 300) {
      console.error("[payback-entry] ❌ Amount below minimum (₱300)");
      return res.status(400).json({ error: "Minimum payback entry is ₱300" });
    }

    // Verify user authentication
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
      console.log("[payback-entry] ✅ User authenticated:", decodedToken.uid);
    } catch (error) {
      console.error("[payback-entry] ❌ Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = decodedToken.uid;

    // Run transaction
    try {
      const result = await db.runTransaction(async (transaction) => {
        // Get user document
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        const userData = userDoc.data();
        const walletBalance = userData.eWallet || 0;

        const paybackRef = clientRequestId
          ? db.collection("paybackEntries").doc(`${userId}_${clientRequestId}`)
          : db.collection("paybackEntries").doc();

        const existingPaybackSnap = await transaction.get(paybackRef);
        if (existingPaybackSnap.exists) {
          const existingData = existingPaybackSnap.data() || {};
          return {
            success: true,
            paybackEntryId: paybackRef.id,
            newBalance: walletBalance,
            deduped: true,
            uplineReward: {
              amount: 65,
              currency: "PHP",
              claimableAfterDays: 30,
              description: "Upline will receive ₱65 override reward when entry expires"
            },
            existingEntryDate: existingData.date || null,
          };
        }

        // Check wallet balance
        if (walletBalance < numAmount) {
          throw new Error("Insufficient wallet balance");
        }

        // Get upline document
        const uplineQuery = await db
          .collection("users")
          .where("username", "==", uplineUsername)
          .limit(1)
          .get();

        if (uplineQuery.empty) {
          throw new Error("Upline not found");
        }

        const uplineData = uplineQuery.docs[0].data();
        const uplineId = uplineQuery.docs[0].id;

        // Deduct wallet
        transaction.update(userRef, {
          eWallet: walletBalance - numAmount,
          updatedAt: new Date(),
        });

        // Create payback entry
        const expirationDate = new Date(new Date(entryDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        transaction.set(paybackRef, {
          userId,
          uplineUsername,
          amount: numAmount,
          role: uplineData.role || "MEMBER",
          date: entryDate,
          expirationDate,
          rewardGiven: false,
          createdAt: new Date(),
        });

        // Create upline reward immediately in separate collection (for fast querying)
        const uplineRewardRef = db.collection("uplineRewards").doc(`${paybackRef.id}_upline`);
        transaction.set(uplineRewardRef, {
          uplineId,
          uplineUsername,
          fromUserId: userId,
          paybackEntryId: paybackRef.id,
          amount: 65,
          currency: "PHP",
          status: "Pending",
          dueDate: expirationDate,
          claimed: false,
          createdAt: new Date(),
        });

        // Create transaction log for audit trail
        const logRef = db.collection("paybackTransactionLogs").doc(`${paybackRef.id}_log`);
        transaction.set(logRef, {
          userId,
          uplineUsername,
          amount: numAmount,
          paybackEntryId: paybackRef.id,
          uplineRewardId: uplineRewardRef.id,
          uplineRewardAmount: 65,
          walletDeducted: numAmount,
          status: "Success",
          createdAt: new Date(),
        });

        return {
          success: true,
          paybackEntryId: paybackRef.id,
          newBalance: walletBalance - numAmount,
          uplineReward: {
            amount: 65,
            currency: "PHP",
            claimableAfterDays: 30,
            description: "Upline will receive ₱65 override reward when entry expires"
          }
        };
      });

      console.info(
        `[payback-entry] ✅ TRANSACTION SUCCESS - user=${userId} upline=${uplineUsername} amount=₱${numAmount} uplineReward=₱65 (in 30 days) entryId=${result.paybackEntryId}`
      );

      logTransactionEvent({
        requestId: req.requestId || null,
        transactionType: "add_payback_entry",
        status: result.deduped ? "deduped" : "success",
        userId,
        amount: numAmount,
        paybackEntryId: result.paybackEntryId,
        newBalance: result.newBalance,
      });

      // 📊 Log to Render backend for monitoring
      try {
        const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
        await axios.post(`${logUrl}/api/log-event`, {
          level: "info",
          event: "payback_entry_created",
          data: {
            userId,
            uplineUsername,
            amount: numAmount,
            paybackEntryId: result.paybackEntryId,
            uplineReward: 65,
            newBalance: result.newBalance,
            deduped: result.deduped || false,
            source: "backend",
          },
        });
      } catch (logError) {
        console.warn("[payback-entry] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (transactionError) {
      console.error("[payback-entry] ❌ Transaction failed:", transactionError);
      res.status(400).json({ error: transactionError.message });
    }
  } catch (error) {
    console.error("[payback-entry] ❌ Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// �💼 Transfer Override Reward Endpoint
app.post("/api/transfer-override-reward", async (req, res) => {
  try {
    const { idToken, overrideId, amount, clientRequestId } = req.body;
    if (!idToken || !overrideId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const numAmount = parseFloat(amount);
    if (numAmount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    // Verify user authentication
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = decodedToken.uid;

    // Run transaction
    try {
      const result = await db.runTransaction(async (transaction) => {
        // Try both collections: uplineRewards and override
        let rewardData;
        let rewardRef;

        const overrideTransactionRef = clientRequestId
          ? db.collection("overrideTransactions").doc(`${userId}_${clientRequestId}`)
          : db.collection("overrideTransactions").doc();

        const existingOverrideTx = await transaction.get(overrideTransactionRef);
        if (existingOverrideTx.exists) {
          const existingData = existingOverrideTx.data() || {};
          if (existingData.overrideId && existingData.overrideId !== overrideId) {
            throw new Error("Request conflict: clientRequestId already used for a different override transfer");
          }

          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) {
            throw new Error("User not found");
          }

          return {
            success: true,
            newBalance: Number(userDoc.data().eWallet || 0),
            overrideId,
            deduped: true,
          };
        }

        // First try uplineRewards collection
        const uplineRewardRef = db.collection("uplineRewards").doc(overrideId);
        const uplineRewardDoc = await transaction.get(uplineRewardRef);
        
        if (uplineRewardDoc.exists) {
          rewardData = uplineRewardDoc.data();
          rewardRef = uplineRewardRef;
        } else {
          // Try override collection
          const overrideRef = db.collection("override").doc(overrideId);
          const overrideDoc = await transaction.get(overrideRef);
          
          if (overrideDoc.exists) {
            rewardData = overrideDoc.data();
            rewardRef = overrideRef;
          } else {
            throw new Error("Override reward not found");
          }
        }

        if (rewardData.uplineId !== userId) {
          throw new Error("Unauthorized: Not your override reward");
        }
        if (rewardData.status === "Credited") {
          throw new Error("Already claimed");
        }

        // Check if reward is due (1 month has passed)
        // For uplineRewards: check dueDate
        // For override: check releaseDate
        let dueDate = rewardData.dueDate || rewardData.releaseDate;
        if (dueDate && typeof dueDate.toDate === "function") {
          dueDate = dueDate.toDate();
        }
        
        const now = new Date();
        if (dueDate && now < dueDate) {
          throw new Error("Reward is not yet due. Please wait until the due date has passed.");
        }

        // Update user eWallet
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User not found");
        }
        const userData = userDoc.data();
        const newBalance = (userData.eWallet || 0) + numAmount;
        transaction.update(userRef, { eWallet: newBalance, updatedAt: new Date() });

        // Mark upline reward as claimed and status as Credited
        transaction.update(rewardRef, { 
          claimed: true,
          claimedAt: new Date(),
          status: "Credited" 
        });

        // Create override transaction record for history
        transaction.set(overrideTransactionRef, {
          userId,
          overrideId,
          amount: numAmount,
          status: "Credited",
          clientRequestId: clientRequestId || null,
          createdAt: new Date(),
          fromUsername: rewardData.fromUsername || "System",
        });

        return {
          success: true,
          newBalance,
          overrideId,
        };
      });

      console.info(
        `[override-transfer] user=${userId} overrideId=${overrideId} amount=${numAmount}`
      );

      logTransactionEvent({
        requestId: req.requestId || null,
        transactionType: "override_transfer",
        status: result.deduped ? "deduped" : "success",
        userId,
        amount: numAmount,
        overrideId,
        newBalance: result.newBalance,
      });

      // 📊 Log to Render backend for monitoring
      try {
        const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
        await axios.post(`${logUrl}/api/log-event`, {
          level: "info",
          event: "override_earnings_transfer_completed",
          data: {
            userId,
            overrideId,
            amount: numAmount,
            newBalance: result.newBalance,
            deduped: result.deduped || false,
            source: "backend",
          },
        });
      } catch (logError) {
        console.warn("[override-transfer] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (transactionError) {
      console.error("Override transfer transaction failed:", transactionError);
      res.status(400).json({ error: transactionError.message });
    }
  } catch (error) {
    console.error("Override transfer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🔄 Migrate Payback Rewards - Create uplineRewards for all existing payback entries
app.post("/api/migrate-payback-rewards", async (req, res) => {
  console.log("[migrate-rewards] 🔄 Migration started");
  try {
    const { adminIdToken } = req.body;
    
    // Verify admin authentication
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(adminIdToken);
    } catch (error) {
      console.error("[migrate-rewards] ❌ Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify user is admin
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists || !["admin", "ceo"].includes(userDoc.data().role.toUpperCase())) {
      console.error("[migrate-rewards] ❌ User is not admin");
      return res.status(403).json({ error: "Only admins can run migrations" });
    }

    // Get all payback entries
    const paybackSnapshot = await db.collection("paybackEntries").get();
    console.log(`[migrate-rewards] 📊 Found ${paybackSnapshot.docs.length} payback entries`);

    let createdCount = 0;
    let skippedCount = 0;
    const errors = [];

    // For each payback entry, create uplineReward if it doesn't exist
    for (const paybackDoc of paybackSnapshot.docs) {
      const paybackData = paybackDoc.data();
      const paybackId = paybackDoc.id;

      try {
        // Check if uplineReward already exists for this payback entry
        const existingReward = await db
          .collection("uplineRewards")
          .where("paybackEntryId", "==", paybackId)
          .limit(1)
          .get();

        if (!existingReward.empty) {
          console.log(`[migrate-rewards] ⏭️ Reward exists for payback ${paybackId}`);
          skippedCount++;
          continue;
        }

        // Get upline user data
        const uplineQuery = await db
          .collection("users")
          .where("username", "==", paybackData.uplineUsername)
          .limit(1)
          .get();

        if (uplineQuery.empty) {
          errors.push(`Upline "${paybackData.uplineUsername}" not found for payback ${paybackId}`);
          skippedCount++;
          continue;
        }

        const uplineId = uplineQuery.docs[0].id;
        const uplineUsername = paybackData.uplineUsername;

        // Calculate expiration date from original payback entry
        const expirationDate = new Date(paybackData.expirationDate || new Date(paybackData.createdAt.toDate().getTime() + 30 * 24 * 60 * 60 * 1000)).toISOString();

        // Create uplineReward
        const uplineRewardRef = db.collection("uplineRewards").doc();
        await uplineRewardRef.set({
          uplineId,
          uplineUsername,
          fromUserId: paybackData.userId,
          paybackEntryId: paybackId,
          amount: 65,
          currency: "PHP",
          status: "Pending",
          dueDate: expirationDate,
          claimed: false,
          createdAt: paybackData.createdAt, // Use original payback creation time
        });

        console.log(`[migrate-rewards] ✅ Created reward for payback ${paybackId} (upline: ${uplineUsername})`);
        createdCount++;
      } catch (error) {
        errors.push(`Error processing payback ${paybackId}: ${error.message}`);
        console.error(`[migrate-rewards] ❌ Error for payback ${paybackId}:`, error);
      }
    }

    console.info(
      `[migrate-rewards] ✅ MIGRATION COMPLETE - created=${createdCount} skipped=${skippedCount} errors=${errors.length}`
    );

    res.json({
      success: true,
      summary: {
        totalPaybackEntries: paybackSnapshot.docs.length,
        rewardsCreated: createdCount,
        rewardsSkipped: skippedCount,
        errors: errors.length > 0 ? errors : [],
      },
    });
  } catch (error) {
    console.error("[migrate-rewards] ❌ Migration error:", error);
    res.status(500).json({ error: "Migration failed" });
  }
});


// Lightweight request logger for Render logs
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// � PayMongo Checkout Endpoint
app.post("/api/create-payment-link", async (req, res) => {
  try {
    const { idToken, amount, name, email } = req.body;
    if (!idToken || !amount || !name || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const numAmount = parseFloat(amount);
    if (numAmount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    // Verify PayMongo keys are loaded
    if (!process.env.PAYMONGO_SECRET_KEY) {
      console.error("PAYMONGO_SECRET_KEY not found in environment");
      return res.status(500).json({ error: "PayMongo configuration error" });
    }

    // Verify user authentication
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = decodedToken.uid;

    // Create checkout session with PayMongo
    const paymongoUrl = "https://api.paymongo.com/v1/checkout_sessions";
    
    // Verify the secret key is properly formatted
    if (!process.env.PAYMONGO_SECRET_KEY.startsWith('sk_live_') && !process.env.PAYMONGO_SECRET_KEY.startsWith('sk_test_')) {
      console.error("Invalid PayMongo secret key format");
      return res.status(500).json({ error: "Invalid PayMongo configuration" });
    }
    
    const paymongoAuth = Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString("base64");
    
    // Get frontend URL from environment - use FRONTEND_URL or REACT_APP_FRONTEND_URL
    const frontendUrl = process.env.FRONTEND_URL || process.env.REACT_APP_FRONTEND_URL || "http://localhost:3000";

    const checkoutData = {
      data: {
        attributes: {
          amount: Math.round(numAmount * 100), // Convert to centavos
          currency: "PHP",
          description: "Damayan Savings Deposit",
          statement_descriptor: "Damayan Savings",
          success_url: `${frontendUrl}/deposit-success`,
          cancel_url: `${frontendUrl}/deposit-cancel`,
          payment_method_types: ["qrph"], // or ["card", "paymaya"] depending on what's available
          customer: {
            email: email,
            name: "Damayan Savings",
          },
          line_items: [
            {
              name: "Damayan Savings Deposit",
              quantity: 1,
              amount: Math.round(numAmount * 100),
              currency: "PHP",
            },
          ],
        },
      },
    };

    console.log("Creating PayMongo checkout for user:", userId, "amount:", numAmount);
    console.log("Success URL:", `${frontendUrl}/deposit-success`);
    console.log("PayMongo Secret Key loaded:", !!process.env.PAYMONGO_SECRET_KEY);
    
    const response = await axios.post(paymongoUrl, checkoutData, {
      headers: {
        Authorization: `Basic ${paymongoAuth}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    console.log("PayMongo response status:", response.status);
    console.log("PayMongo response data:", response.data);

    const checkoutId = response.data.data.id;
    const checkoutUrl = response.data.data.attributes.checkout_url;

    // Store payment metadata in Firestore (NOT a deposit yet - only for webhook reference)
    // This is just a temporary record to map checkoutId to user data when webhook confirms payment
    await db.collection("paymentMetadata").doc(checkoutId).set({
      userId,
      amount: numAmount,
      currency: "PHP",
      checkoutId,
      email,
      name,
      createdAt: new Date(),
      // status is NOT set here - deposit only created on successful webhook
    });

    res.json({
      success: true,
      checkoutUrl,
      checkoutId,
    });
  } catch (error) {
    console.error("PayMongo error details:", {
      message: error.message,
      status: error.response?.status,
      data: JSON.stringify(error.response?.data, null, 2)
    });
    res.status(500).json({ 
      error: "Failed to create payment link",
      details: error.response?.data?.errors || error.message
    });
  }
});

// 🔔 PayMongo Webhook Handler
app.post("/api/paymongo-webhook", async (req, res) => {
  try {
    // Log the raw request body and check for parsing issues
    if (!req.body) {
      console.error("[paymongo-webhook] ❌ req.body is undefined or empty!");
    } else {
      console.log("[paymongo-webhook] 🔄 Webhook payload received:", JSON.stringify(req.body, null, 2));
    }

    // For extra debugging, log the headers
    console.log("[paymongo-webhook] Headers:", JSON.stringify(req.headers, null, 2));

    const { data } = req.body || {};

    if (!data) {
      console.error("[paymongo-webhook] ❌ No data in webhook payload (after parsing req.body)");
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    // Log the event type
    console.log("[paymongo-webhook] Webhook type:", data.type);

    // Log all attributes for inspection
    if (data.attributes) {
      console.log("[paymongo-webhook] Attributes:", JSON.stringify(data.attributes, null, 2));
    } else {
      console.log("[paymongo-webhook] No attributes in data");
    }

    // Log the checkout_session_id if present
    // Try multiple possible field names for checkout session ID
    let checkoutId = data.attributes?.checkout_session_id || 
                     data.attributes?.session_id || 
                     data.id;
    console.log("[paymongo-webhook] checkout_session_id (primary):", data.attributes?.checkout_session_id);
    console.log("[paymongo-webhook] session_id (fallback):", data.attributes?.session_id);
    console.log("[paymongo-webhook] data.id (fallback):", data.id);
    console.log("[paymongo-webhook] Final checkoutId to use:", checkoutId);

    if (data.type === "checkout_session.payment.success") {
      if (!checkoutId) {
        console.error("[paymongo-webhook] ❌ No checkout_session_id in webhook data");
        return res.status(400).json({ error: "Missing checkout_session_id" });
      }

      console.log("[paymongo-webhook] 🔍 Looking for metadata with checkoutId:", checkoutId);

      // Get payment metadata from Firestore
      const metadataDoc = await db.collection("paymentMetadata").doc(checkoutId).get();

      if (!metadataDoc.exists) {
        console.error("[paymongo-webhook] ❌ Payment metadata not found for checkoutId:", checkoutId);
        // Don't fail - PayMongo will retry, and we'll handle it on success page
        return res.status(200).json({ success: true, message: "Metadata will be created on success page" });
      }

      const metadataData = metadataDoc.data();
      const metadataRef = db.collection("paymentMetadata").doc(checkoutId);
      let txResult = null;

      console.log("[paymongo-webhook] ✅ Metadata found - processing deposit for user:", metadataData.userId);

      await db.runTransaction(async (transaction) => {
        const freshMetadataSnap = await transaction.get(metadataRef);
        if (!freshMetadataSnap.exists) {
          throw new Error("Payment metadata disappeared during transaction");
        }

        const freshMetadata = freshMetadataSnap.data();
        if (freshMetadata.depositId) {
          txResult = {
            depositId: freshMetadata.depositId,
            userId: freshMetadata.userId,
            amount: freshMetadata.amount,
            alreadyExists: true,
          };
          return;
        }

        const depositRef = db.collection("deposits").doc();
        transaction.set(depositRef, {
          userId: freshMetadata.userId,
          name: freshMetadata.name,
          amount: freshMetadata.amount,
          reference: checkoutId,
          receiptUrl: "",
          status: "Pending",
          paymentMethod: "PayMongo",
          createdAt: new Date(),
        });

        transaction.update(metadataRef, {
          depositId: depositRef.id,
          completedAt: new Date(),
        });

        txResult = {
          depositId: depositRef.id,
          userId: freshMetadata.userId,
          amount: freshMetadata.amount,
          alreadyExists: false,
        };
      });

      if (txResult?.alreadyExists) {
        console.info(`[paymongo-webhook] ℹ️ Deposit already linked - checkoutId=${checkoutId} depositId=${txResult.depositId}`);
      } else {
        console.info(`[paymongo-webhook] ✅ DEPOSIT CREATED - user=${txResult?.userId} amount=₱${txResult?.amount} checkoutId=${checkoutId} depositId=${txResult?.depositId} status=Pending (awaiting admin approval)`);
      }

      logTransactionEvent({
        requestId: req.requestId || null,
        transactionType: "deposit_create_paymongo_webhook",
        status: txResult?.alreadyExists ? "deduped" : "success",
        userId: txResult?.userId || null,
        amount: txResult?.amount || null,
        reference: checkoutId,
        depositId: txResult?.depositId || null,
      });

      return res.json({ success: true });
    }

    console.log("[paymongo-webhook] ℹ️ Ignoring webhook type:", data.type);
    res.json({ success: true });
  } catch (error) {
    console.error("[paymongo-webhook] ❌ Error:", error.message);
    console.error("[paymongo-webhook] Stack:", error.stack);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// 🔐 Verify PayMongo Payment (called from frontend success page)
app.post("/api/verify-paymongo-payment", async (req, res) => {
  try {
    const { idToken, sessionId } = req.body;

    if (!idToken || !sessionId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify user authentication
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error("[verify-payment] Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = decodedToken.uid;

    // Check if deposit was already created by webhook
    const metadataRef = db.collection("paymentMetadata").doc(sessionId);
    const metadataDoc = await metadataRef.get();

    if (!metadataDoc.exists) {
      console.error("[verify-payment] Payment metadata not found:", sessionId);
      return res.status(404).json({ error: "Payment not found" });
    }

    const metadataData = metadataDoc.data();

    // Verify userId matches
    if (metadataData.userId !== userId) {
      console.error("[verify-payment] User mismatch:", { expected: metadataData.userId, actual: userId });
      return res.status(403).json({ error: "Unauthorized: Payment belongs to different user" });
    }

    if (metadataData.depositId) {
      console.info(`[verify-payment] ✅ Deposit already created: ${metadataData.depositId}`);
      return res.json({
        success: true,
        depositId: metadataData.depositId,
        message: "Payment received and awaiting admin approval",
      });
    }

    console.warn("[verify-payment] ⚠️ Webhook not processed yet, resolving via idempotent transaction");
    let txResult = null;

    await db.runTransaction(async (transaction) => {
      const freshMetadataSnap = await transaction.get(metadataRef);
      if (!freshMetadataSnap.exists) {
        throw new Error("Payment metadata not found");
      }

      const freshMetadata = freshMetadataSnap.data();
      if (freshMetadata.userId !== userId) {
        throw new Error("Unauthorized: Payment belongs to different user");
      }

      if (freshMetadata.depositId) {
        txResult = {
          depositId: freshMetadata.depositId,
          amount: freshMetadata.amount,
          alreadyExists: true,
        };
        return;
      }

      const depositRef = db.collection("deposits").doc();
      transaction.set(depositRef, {
        userId,
        name: freshMetadata.name,
        amount: freshMetadata.amount,
        reference: sessionId,
        receiptUrl: "",
        status: "Pending",
        paymentMethod: "PayMongo",
        createdAt: new Date(),
      });

      transaction.update(metadataRef, {
        depositId: depositRef.id,
        completedAt: new Date(),
      });

      txResult = {
        depositId: depositRef.id,
        amount: freshMetadata.amount,
        alreadyExists: false,
      };
    });

    console.info(`[verify-payment] ✅ user=${userId} amount=₱${txResult?.amount} sessionId=${sessionId} depositId=${txResult?.depositId} status=Pending (awaiting admin approval)`);

    logTransactionEvent({
      requestId: req.requestId || null,
      transactionType: "deposit_verify_paymongo",
      status: txResult?.alreadyExists ? "deduped" : "success",
      userId,
      amount: txResult?.amount || null,
      reference: sessionId,
      depositId: txResult?.depositId || null,
    });

    res.json({
      success: true,
      depositId: txResult?.depositId,
      message: "Payment received and awaiting admin approval",
    });
  } catch (error) {
    console.error("[verify-payment] ❌ Error:", error);
    res.status(500).json({ error: "Payment verification failed" });
  }
});

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages,
        max_tokens: 150,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// 💸 Secure Transfer Funds Endpoint
app.post("/api/transfer-funds", async (req, res) => {
  try {
    const { idToken, recipientUsername, amount, clientRequestId } = req.body;

    // Validate input
    if (!idToken || !recipientUsername || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const numAmount = parseFloat(amount);
    if (numAmount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    if (numAmount < 50) {
      return res.status(400).json({ error: "Minimum transfer is ₱50" });
    }

    // Verify user authentication
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const senderId = decodedToken.uid;

    // Calculate charges
    const charge = numAmount * 0.02;
    const netTransfer = numAmount - charge;

    // Run transaction
    try {
      const result = await db.runTransaction(async (transaction) => {
        // Get sender document
        const senderRef = db.collection("users").doc(senderId);
        const senderDoc = await transaction.get(senderRef);

        if (!senderDoc.exists) {
          throw new Error("Sender not found");
        }

        const senderData = senderDoc.data();
        const currentBalance = Number(senderData.eWallet);
        if (isNaN(currentBalance)) throw new Error("Sender wallet balance is invalid");

        const transferRef = clientRequestId
          ? db.collection("transferFunds").doc(`${senderId}_${clientRequestId}`)
          : db.collection("transferFunds").doc();

        const existingTransferSnap = await transaction.get(transferRef);
        if (existingTransferSnap.exists) {
          return {
            success: true,
            newBalance: currentBalance,
            transferId: transferRef.id,
            deduped: true,
          };
        }

        // Check balance
        if (currentBalance < numAmount) {
          throw new Error("Insufficient wallet balance");
        }

        // Find recipient by username
        const recipientQuery = await db
          .collection("users")
          .where("username", "==", recipientUsername)
          .limit(1)
          .get();

        if (recipientQuery.empty) {
          throw new Error("Recipient not found");
        }

        const recipientDoc = recipientQuery.docs[0];
        const recipientRef = db.collection("users").doc(recipientDoc.id);
        const recipientData = recipientDoc.data();

        // Check if trying to send to self
        if (senderId === recipientDoc.id) {
          throw new Error("Cannot transfer to yourself");
        }

        // Update balances
        transaction.update(senderRef, {
          eWallet: Number(currentBalance - numAmount),
        });

        const recipientBalance = Number(recipientData.eWallet);
        transaction.update(recipientRef, {
          eWallet: isNaN(recipientBalance) ? netTransfer : Number(recipientBalance + netTransfer),
        });

        transaction.set(transferRef, {
          senderId: senderId,
          senderName: senderData.name || senderData.username,
          senderEmail: senderData.email,
          recipientUsername: recipientUsername,
          recipientId: recipientDoc.id,
          amount: numAmount,
          charge: charge,
          netAmount: netTransfer,
          clientRequestId: clientRequestId || null,
          status: "Approved",
          createdAt: new Date(),
        });

        return {
          success: true,
          newBalance: currentBalance - numAmount,
          transferId: transferRef.id,
        };
      });

      console.info(
        `[transfer] sender=${senderId} recipient=${recipientUsername} amount=${numAmount.toFixed(2)} net=${(numAmount - numAmount * 0.02).toFixed(2)} id=${result.transferId}`
      );

      logTransactionEvent({
        requestId: req.requestId || null,
        transactionType: "wallet_transfer",
        status: result.deduped ? "deduped" : "success",
        userId: senderId,
        recipientUsername,
        amount: numAmount,
        transferId: result.transferId,
        newBalance: result.newBalance,
      });

      // 📊 Log to Render backend for monitoring
      try {
        const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
        await axios.post(`${logUrl}/api/log-event`, {
          level: "info",
          event: "wallet_transfer_completed",
          data: {
            senderId,
            recipientUsername,
            amount: numAmount,
            netAmount: numAmount - numAmount * 0.02,
            transferId: result.transferId,
            newBalance: result.newBalance,
            deduped: result.deduped || false,
            source: "backend",
          },
        });
      } catch (logError) {
        console.warn("[transfer] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (transactionError) {
      console.error("Transaction failed:", transactionError);
      res.status(400).json({ error: transactionError.message });
    }
  } catch (error) {
    console.error("Transfer funds error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// � Transfer Profit from Capital Share Endpoint
app.post("/api/transfer-profit", async (req, res) => {
  try {
    const { idToken, entryId, amount, clientRequestId } = req.body;

    // Validate input
    if (!idToken || !entryId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const numAmount = parseFloat(amount);
    if (numAmount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    // Verify user authentication
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = decodedToken.uid;

    // Run transaction
    try {
      const result = await db.runTransaction(async (transaction) => {
        const depositRef = clientRequestId
          ? db.collection("deposits").doc(`profit_${userId}_${clientRequestId}`)
          : db.collection("deposits").doc();

        const existingDepositSnap = await transaction.get(depositRef);

        // Get capital share entry
        const entryRef = db.collection("capitalShareEntries").doc(entryId);
        const entryDoc = await transaction.get(entryRef);

        if (!entryDoc.exists) {
          throw new Error("Capital share entry not found");
        }

        const entryData = entryDoc.data();

        // Verify entry belongs to user
        if (entryData.userId !== userId) {
          throw new Error("Unauthorized: Not your capital share entry");
        }

        // Verify profit is available
        if (!entryData.profit || entryData.profit <= 0) {
          throw new Error("No profit available for this entry");
        }

        // Verify profit hasn't been claimed yet
        if (entryData.profitStatus === "Claimed") {
          throw new Error("This profit was already claimed");
        }

        // Verify amount matches profit amount
        if (Math.abs(numAmount - (entryData.profit || 0)) > 0.01) {
          throw new Error("Profit amount mismatch");
        }

        // Get user document
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        const userData = userDoc.data();
        const currentBalance = Number(userData.eWallet || 0);

        if (existingDepositSnap.exists) {
          return {
            success: true,
            newBalance: currentBalance,
            transferId: depositRef.id,
            deduped: true,
          };
        }

        // Update user eWallet (no fees for profit transfers)
        transaction.update(userRef, {
          eWallet: currentBalance + numAmount,
          updatedAt: new Date(),
        });

        // Update entry status
        transaction.update(entryRef, {
          profitStatus: "Claimed",
          profitClaimedAmount: numAmount,
          profitClaimedAt: new Date(),
        });

        // Create deposit record for wallet history
        transaction.set(depositRef, {
          userId: userId,
          amount: numAmount,
          status: "Approved",
          type: "Monthly Profit Transfer",
          sourceEntryId: entryId,
          clientRequestId: clientRequestId || null,
          createdAt: new Date(),
        });

        return {
          success: true,
          newBalance: currentBalance + numAmount,
          transferId: depositRef.id,
        };
      });

      console.info(
        `[transfer-profit] user=${userId} entryId=${entryId} amount=${numAmount.toFixed(2)} newBalance=${(result.newBalance || 0).toFixed(2)}`
      );

      logTransactionEvent({
        requestId: req.requestId || null,
        transactionType: "profit_transfer",
        status: result.deduped ? "deduped" : "success",
        userId,
        amount: numAmount,
        entryId,
        transferId: result.transferId,
        newBalance: result.newBalance,
      });

      // 📊 Log to Render backend for monitoring
      try {
        const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
        await axios.post(`${logUrl}/api/log-event`, {
          level: "info",
          event: "monthly_profit_transfer_completed",
          data: {
            userId,
            entryId,
            amount: numAmount,
            newBalance: result.newBalance,
            deduped: result.deduped || false,
            source: "backend",
          },
        });
      } catch (logError) {
        console.warn("[transfer-profit] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (transactionError) {
      console.error("Transfer profit transaction failed:", transactionError);
      res.status(400).json({ error: transactionError.message });
    }
  } catch (error) {
    console.error("Transfer profit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// 💰 Transfer Capital Share to Wallet Endpoint
app.post("/api/transfer-capital-share", async (req, res) => {
  try {
    const { idToken, entryId, amount } = req.body;

    // Validate input
    if (!idToken || !entryId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const numAmount = parseFloat(amount);
    if (numAmount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    // Verify user authentication
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = decodedToken.uid;

    // Run transaction
    try {
      const result = await db.runTransaction(async (transaction) => {
        // Get capital share entry
        const entryRef = db.collection("capitalShareEntries").doc(entryId);
        const entryDoc = await transaction.get(entryRef);

        if (!entryDoc.exists) {
          throw new Error("Capital share entry not found");
        }

        const entryData = entryDoc.data();

        // Verify entry belongs to user
        if (entryData.userId !== userId) {
          throw new Error("Unauthorized: Not your capital share entry");
        }

        // Verify transferable portion is available
        if (!entryData.transferablePortion || entryData.transferablePortion <= 0) {
          throw new Error("No transferable portion available for this entry");
        }

        // Verify amount hasn't been fully transferred yet
        if (entryData.transferredAmount && entryData.transferredAmount >= entryData.transferablePortion) {
          throw new Error("This entry has already been fully transferred");
        }

        // Calculate actual transfer amount
        const actualTransferAmount = entryData.transferablePortion - (entryData.transferredAmount || 0);

        // Verify amount matches
        if (Math.abs(numAmount - actualTransferAmount) > 0.01) {
          throw new Error("Transfer amount mismatch");
        }

        // Verify transferable date has passed
        let transferableAfterDate = entryData.transferableAfterDate;
        if (transferableAfterDate && typeof transferableAfterDate.toDate === "function") {
          transferableAfterDate = transferableAfterDate.toDate();
        }
        
        const now = new Date();
        if (transferableAfterDate && now < transferableAfterDate) {
          throw new Error("This entry is not yet transferable. Please wait until the 1-month period has passed");
        }

        // Get user document
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        const userData = userDoc.data();
        const currentBalance = Number(userData.eWallet || 0);

        // Update user eWallet (no fees for capital share transfers)
        transaction.update(userRef, {
          eWallet: currentBalance + numAmount,
          updatedAt: new Date(),
        });

        // Create deposit record for wallet history
        const depositRef = db.collection("deposits").doc();
        transaction.set(depositRef, {
          userId: userId,
          amount: numAmount,
          status: "Approved",
          type: "Capital Share Transfer",
          sourceEntryId: entryId,
          createdAt: new Date(),
        });

        // Update entry to mark as transferred
        // Note: profitEnabled remains true - profit continues on remaining lock-in
        transaction.update(entryRef, {
          transferredAmount: (entryData.transferredAmount || 0) + numAmount,
          transferredAt: new Date(),
        });

        return {
          success: true,
          newBalance: currentBalance + numAmount,
          transferId: depositRef.id,
        };
      });

      console.info(
        `[transfer-capital-share] user=${userId} entryId=${entryId} amount=${numAmount.toFixed(2)} newBalance=${(result.newBalance || 0).toFixed(2)}`
      );

      logTransactionEvent({
        requestId: req.requestId || null,
        transactionType: "capital_transfer",
        status: result.deduped ? "deduped" : "success",
        userId,
        amount: numAmount,
        entryId,
        transferId: result.transferId,
        newBalance: result.newBalance,
      });

      // 📊 Log to Render backend for monitoring
      try {
        const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
        await axios.post(`${logUrl}/api/log-event`, {
          level: "info",
          event: "capital_share_transfer_completed",
          data: {
            userId,
            entryId,
            amount: numAmount,
            newBalance: result.newBalance,
            deduped: result.deduped || false,
            source: "backend",
          },
        });
      } catch (logError) {
        console.warn("[transfer-capital-share] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (transactionError) {
      console.error("Transfer capital share transaction failed:", transactionError);
      res.status(400).json({ error: transactionError.message });
    }
  } catch (error) {
    console.error("Transfer capital share error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// �💸 Passive Income Transfer Endpoint
app.post("/api/transfer-passive-income", async (req, res) => {
  try {
    const { idToken, paybackEntryId, amount, clientRequestId } = req.body;
    if (!idToken || !paybackEntryId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const numAmount = parseFloat(amount);
    if (numAmount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    // Verify user authentication
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = decodedToken.uid;

    // Run transaction
    try {
      const result = await db.runTransaction(async (transaction) => {
        const transferRef = clientRequestId
          ? db.collection("passiveTransfers").doc(`passive_${userId}_${clientRequestId}`)
          : db.collection("passiveTransfers").doc();

        const existingTransferSnap = await transaction.get(transferRef);

        // Get payback entry
        const paybackRef = db.collection("paybackEntries").doc(paybackEntryId);
        const paybackDoc = await transaction.get(paybackRef);
        if (!paybackDoc.exists) {
          throw new Error("Payback entry not found");
        }
        const paybackData = paybackDoc.data();
        if (paybackData.userId !== userId) {
          throw new Error("Unauthorized: Not your payback entry");
        }
        if (paybackData.transferred) {
          throw new Error("This profit has already been transferred");
        }
        // Check if matured
        const expirationDate = new Date(paybackData.expirationDate);
        if (expirationDate > new Date()) {
          throw new Error("Profit not yet matured");
        }
        // Check amount matches 2% profit
        const expectedProfit = (paybackData.amount || 0) * 0.02;
        if (Math.abs(expectedProfit - numAmount) > 0.01) {
          throw new Error("Invalid profit amount");
        }

        // Get user
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User not found");
        }
        const userData = userDoc.data();

        if (existingTransferSnap.exists) {
          const currentBalance = Number(userData.eWallet || 0);
          return {
            success: true,
            newBalance: currentBalance,
            transferId: transferRef.id,
            deduped: true,
          };
        }

        // Calculate fee and net
        const fee = numAmount * 0.01;
        const net = numAmount - fee;

        // Update user eWallet
        const userBalance = Number(userData.eWallet);
        transaction.update(userRef, {
          eWallet: isNaN(userBalance) ? net : Number(userBalance + net),
        });

        // Mark payback entry as transferred
        transaction.update(paybackRef, {
          transferred: true,
          transferredAt: new Date(),
        });

        // Log transfer
        transaction.set(transferRef, {
          userId,
          paybackEntryId,
          amount: numAmount,
          fee,
          netAmount: net,
          clientRequestId: clientRequestId || null,
          status: "Approved",
          createdAt: new Date(),
        });

        return {
          success: true,
          newBalance: (userData.eWallet || 0) + net,
          transferId: transferRef.id,
        };
      });

      console.info(
        `[passive-transfer] user=${userId} paybackEntry=${paybackEntryId} amount=${amount} net=${(numAmount - numAmount * 0.01).toFixed(2)} id=${result.transferId}`
      );

      logTransactionEvent({
        requestId: req.requestId || null,
        transactionType: "passive_income_transfer",
        status: result.deduped ? "deduped" : "success",
        userId,
        amount: numAmount,
        paybackEntryId,
        transferId: result.transferId,
        newBalance: result.newBalance,
      });

      // 📊 Log to Render backend for monitoring
      try {
        const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
        await axios.post(`${logUrl}/api/log-event`, {
          level: "info",
          event: "passive_income_transfer_completed",
          data: {
            userId,
            paybackEntryId,
            amount: numAmount,
            netAmount: numAmount - numAmount * 0.01,
            newBalance: result.newBalance,
            deduped: result.deduped || false,
            source: "backend",
          },
        });
      } catch (logError) {
        console.warn("[passive-transfer] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (transactionError) {
      console.error("Passive transfer transaction failed:", transactionError);
      res.status(400).json({ error: transactionError.message });
    }
  } catch (error) {
    console.error("Passive income transfer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 💰 Add Capital Share Entry Endpoint
app.post("/api/add-capital-share", async (req, res) => {
  console.log("[capital-share] 🔄 Request received");
  try {
    const { idToken, amount, entryDate, referredBy, clientRequestId } = req.body;
    console.log("[capital-share] Validating input:", { amount, entryDate, referredBy, clientRequestId });

    // Validate input
    if (!idToken || !amount || !entryDate) {
      console.error("[capital-share] ❌ Missing required fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      console.error("[capital-share] ❌ Invalid amount");
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    if (numAmount < 1000) {
      console.error("[capital-share] ❌ Amount below minimum (₱1000)");
      return res.status(400).json({ error: "Minimum capital share amount is ₱1,000" });
    }

    // Verify user authentication
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
      console.log("[capital-share] ✅ User authenticated:", decodedToken.uid);
    } catch (error) {
      console.error("[capital-share] ❌ Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = decodedToken.uid;

    // Run transaction
    try {
      const result = await db.runTransaction(async (transaction) => {
        // Get user document
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        const userData = userDoc.data();
        const walletBalance = Number(userData.eWallet || 0);

        const entryRef = clientRequestId
          ? db.collection("capitalShareEntries").doc(`${userId}_${clientRequestId}`)
          : db.collection("capitalShareEntries").doc();

        const existingEntrySnap = await transaction.get(entryRef);
        if (existingEntrySnap.exists) {
          const existingData = existingEntrySnap.data() || {};
          return {
            success: true,
            entryId: entryRef.id,
            newBalance: walletBalance,
            deduped: true,
            lockInPortion: existingData.lockInPortion || 0,
            transferablePortion: existingData.transferablePortion || 0,
          };
        }

        // Check wallet balance
        if (walletBalance < numAmount) {
          throw new Error("Insufficient wallet balance");
        }

        // Get existing entries to calculate cumulative lock-in
        const existingEntriesSnap = await db
          .collection("capitalShareEntries")
          .where("userId", "==", userId)
          .get();

        let cumulativeLockIn = 0;
        existingEntriesSnap.docs.forEach((doc) => {
          const data = doc.data();
          cumulativeLockIn += data.lockInPortion || 0;
        });

        // Calculate lock-in: 25% of the added amount
        const lockInPortion = numAmount * 0.25;
        const transferablePortion = numAmount - lockInPortion;

        // Calculate when the entry becomes transferable
        const now = new Date();
        const transferableAfterDate = new Date(now);
        transferableAfterDate.setMonth(transferableAfterDate.getMonth() + 1);

        // Create capital share entry
        transaction.set(entryRef, {
          userId,
          amount: numAmount,
          date: new Date(entryDate),
          profit: 0,
          profitStatus: "Pending",
          lockInPortion,
          transferablePortion,
          status: "Approved",
          createdAt: new Date(),
          transferableAfterDate,
          nextProfitDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        });

        // Deduct from user wallet
        transaction.update(userRef, {
          eWallet: walletBalance - numAmount,
          updatedAt: new Date(),
        });

        // Create deposit record for eWallet history
        const depositRef = db.collection("deposits").doc(`${entryRef.id}_deposit`);
        transaction.set(depositRef, {
          userId,
          amount: numAmount,
          status: "Approved",
          type: "Capital Share Added",
          sourceEntryId: entryRef.id,
          createdAt: new Date(),
        });

        // Store 5% upline bonus in override collection (if referredBy exists)
        if (referredBy) {
          const uplineQuery = await db
            .collection("users")
            .where("username", "==", referredBy)
            .limit(1)
            .get();

          if (!uplineQuery.empty) {
            const uplineId = uplineQuery.docs[0].id;
            const uplineBonus = numAmount * 0.05;
            const releaseDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const overrideRef = db.collection("override").doc(`${entryRef.id}_override`);
            transaction.set(overrideRef, {
              uplineId,
              fromUserId: userId,
              fromUsername: userData.username || "",
              uplineUsername: referredBy,
              amount: uplineBonus,
              type: "Upline Capital Share Bonus",
              status: "Pending",
              createdAt: new Date(),
              releaseDate,
            });
          }
        }

        // System special bonuses for capital share entries
        const masterMDQuery = await db
          .collection("users")
          .where("role", "==", "MasterMD")
          .limit(1)
          .get();

        if (!masterMDQuery.empty) {
          const masterMDRef = db.collection("referralReward").doc();
          transaction.set(masterMDRef, {
            userId: masterMDQuery.docs[0].id,
            username: masterMDQuery.docs[0].data().username,
            role: "MasterMD",
            amount: 100,
            source: "System Capital Share bonuses",
            type: "System Bonus",
            approved: true,
            payoutReleased: true,
            createdAt: new Date(),
          });
        }

        // Special emails for capital share entries
        const specialEmails = {
          "eliskie40@gmail.com": 100,
          "gedeongipulankjv1611@gmail.com": 100,
          "monares.cyriljay@gmail.com": 50,
        };

        for (const [specialEmail, bonusAmount] of Object.entries(specialEmails)) {
          const specialUserQuery = await db
            .collection("users")
            .where("email", "==", specialEmail)
            .limit(1)
            .get();

          if (!specialUserQuery.empty) {
            const specialUserRef = db.collection("referralReward").doc();
            transaction.set(specialUserRef, {
              userId: specialUserQuery.docs[0].id,
              username: specialUserQuery.docs[0].data().username,
              role: specialUserQuery.docs[0].data().role,
              amount: bonusAmount,
              source: "System Capital Share bonuses",
              type: "System Bonus",
              approved: true,
              payoutReleased: true,
              createdAt: new Date(),
            });
          }
        }

        return {
          success: true,
          entryId: entryRef.id,
          newBalance: walletBalance - numAmount,
          lockInPortion,
          transferablePortion,
        };
      });

      console.info(
        `[capital-share] ✅ ENTRY CREATED - user=${userId} amount=₱${numAmount} lockIn=₱${result.lockInPortion} transferable=₱${result.transferablePortion} entryId=${result.entryId}`
      );

      logTransactionEvent({
        requestId: req.requestId || null,
        transactionType: "add_capital_share",
        status: result.deduped ? "deduped" : "success",
        userId,
        amount: numAmount,
        entryId: result.entryId,
        newBalance: result.newBalance,
      });

      res.json(result);
    } catch (transactionError) {
      console.error("[capital-share] ❌ Transaction failed:", transactionError);
      res.status(400).json({ error: transactionError.message });
    }
  } catch (error) {
    console.error("[capital-share] ❌ Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 💳 Transfer Referral Reward to eWallet
app.post("/api/transfer-referral-reward", async (req, res) => {
  console.log("[referral-reward] 🔄 Request received");
  try {
    const { idToken, rewardId, amount, clientRequestId } = req.body;
    console.log("[referral-reward] Input:", { rewardId, amount, clientRequestId });

    if (!idToken || !rewardId || !amount) {
      console.error("[referral-reward] ❌ Missing required fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      console.error("[referral-reward] ❌ Invalid amount");
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    // Verify user authentication
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
      console.log("[referral-reward] ✅ User authenticated:", decodedToken.uid);
    } catch (error) {
      console.error("[referral-reward] ❌ Token verification failed:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = decodedToken.uid;

    // Run transaction
    try {
      const result = await db.runTransaction(async (transaction) => {
        const logRef = clientRequestId
          ? db.collection("referralRewardTransferlogs").doc(`${userId}_${clientRequestId}`)
          : db.collection("referralRewardTransferlogs").doc();

        const existingLogSnap = await transaction.get(logRef);
        if (existingLogSnap.exists) {
          const existingData = existingLogSnap.data() || {};
          if (existingData.rewardId && existingData.rewardId !== rewardId) {
            throw new Error("Request conflict: clientRequestId already used for a different referral transfer");
          }

          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) {
            throw new Error("User not found");
          }

          return {
            success: true,
            newBalance: Number(userDoc.data().eWallet || 0),
            deduped: true,
          };
        }

        // Get referral reward document
        const rewardRef = db.collection("referralReward").doc(rewardId);
        const rewardDoc = await transaction.get(rewardRef);

        if (!rewardDoc.exists) {
          throw new Error("Referral reward not found");
        }

        const rewardData = rewardDoc.data();

        // Verify reward belongs to user
        if (rewardData.userId !== userId) {
          throw new Error("Unauthorized: Not your reward");
        }

        // Check if already transferred (has transferredAmount)
        if (rewardData.transferredAmount) {
          throw new Error("This reward has already been transferred");
        }

        // Get user document
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        const userData = userDoc.data();
        const currentBalance = Number(userData.eWallet || 0);

        // Update user eWallet (add amount)
        transaction.update(userRef, {
          eWallet: currentBalance + numAmount,
          updatedAt: new Date(),
        });

        // Mark reward as payout released
        transaction.update(rewardRef, {
          payoutReleased: true,
          dateTransferred: new Date(),
          transferredAmount: numAmount,
        });

        // Create referral reward transfer log
        transaction.set(logRef, {
          userId,
          rewardId,
          amount: rewardData.amount,
          transferredAmount: numAmount,
          source: rewardData.source || "Referral",
          status: "Transferred",
          clientRequestId: clientRequestId || null,
          createdAt: new Date(),
        });

        // Create deposit record for eWallet history
        const depositRef = clientRequestId
          ? db.collection("deposits").doc(`referral_${userId}_${clientRequestId}`)
          : db.collection("deposits").doc();
        let depositType = "Referral Reward Transfer";
        
        // Determine the type based on the source/amount
        if (rewardData.source === "System Network Bonus" || numAmount === 15) {
          depositType = "System Network Bonus";
        } else if (rewardData.source === "Direct Invite Reward") {
          depositType = "Direct Invite Reward";
        } else if (rewardData.source === "Network Bonus") {
          depositType = "Network Bonus";
        }
        
        transaction.set(depositRef, {
          userId,
          amount: numAmount,
          status: "Approved",
          type: depositType,
          source: rewardData.source || "Referral",
          sourceRewardId: rewardId,
          createdAt: new Date(),
        });

        return {
          success: true,
          newBalance: currentBalance + numAmount,
          depositId: depositRef.id,
        };
      });

      console.info(
        `[referral-reward] ✅ TRANSFER SUCCESS - user=${userId} rewardId=${rewardId} amount=₱${numAmount} newBalance=₱${result.newBalance}`
      );

      logTransactionEvent({
        requestId: req.requestId || null,
        transactionType: "referral_reward_transfer",
        status: result.deduped ? "deduped" : "success",
        userId,
        amount: numAmount,
        rewardId,
        newBalance: result.newBalance,
      });

      // 📊 Log to Render backend for monitoring
      try {
        const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
        await axios.post(`${logUrl}/api/log-event`, {
          level: "info",
          event: "referral_earnings_transfer_completed",
          data: {
            userId,
            rewardId,
            amount: numAmount,
            newBalance: result.newBalance,
            deduped: result.deduped || false,
            source: "backend",
          },
        });
      } catch (logError) {
        console.warn("[referral-reward] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (transactionError) {
      console.error("[referral-reward] ❌ Transaction failed:", transactionError);
      res.status(400).json({ error: transactionError.message });
    }
  } catch (error) {
    console.error("[referral-reward] ❌ Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Simple health check for deployment platforms
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: new Date(SERVER_START_TS).toISOString(),
    service: process.env.RENDER_SERVICE_NAME || "amayan-backend",
    host: os.hostname(),
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/ready", async (req, res) => {
  try {
    await db.collection("users").limit(1).get();
    res.status(200).json({
      status: "ready",
      firestore: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logEvent("error", "readiness_check_failed", {
      requestId: req.requestId || null,
      message: error?.message || "unknown",
    });
    res.status(503).json({
      status: "not_ready",
      firestore: "error",
      message: "Firestore readiness check failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// 📊 Logging endpoint for Cloud Functions to log events to Render.com
app.post("/api/log-event", (req, res) => {
  try {
    const { level = "info", event, data = {} } = req.body;

    if (!event) {
      return res.status(400).json({ error: "Missing event name" });
    }

    logEvent(level, event, {
      source: "cloud-function",
      ...data,
    });

    res.json({ success: true, message: `Event '${event}' logged` });
  } catch (error) {
    console.error("[log-event] Error:", error);
    res.status(500).json({ error: "Failed to log event" });
  }
});

process.on("unhandledRejection", (reason) => {
  logEvent("error", "unhandled_rejection", {
    message: reason?.message || String(reason),
    stack: reason?.stack || null,
  });
});

process.on("uncaughtException", (error) => {
  logEvent("error", "uncaught_exception", {
    message: error?.message || "unknown",
    stack: error?.stack || null,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  logEvent("info", "server_started", {
    port: PORT,
    healthPath: "/health",
    readinessPath: "/health/ready",
  })
);