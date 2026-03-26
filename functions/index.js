const functions = require("firebase-functions");
const cors = require("cors");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const deliveryDispatch = require("./deliveryDispatch");

exports.onSaleCreatedDispatchRider = deliveryDispatch.onSaleCreatedDispatchRider;
exports.onOrderCreatedDispatchRider = deliveryDispatch.onOrderCreatedDispatchRider;
exports.respondToDeliveryRequest = deliveryDispatch.respondToDeliveryRequest;
exports.reassignExpiredDeliveries = deliveryDispatch.reassignExpiredDeliveries;

const normalizeStatus = (value) => String(value || "").trim().toUpperCase();
const DEFAULT_RESET_PASSWORD = "password123";

const collectTokensFromUser = (userData = {}) => {
  const raw = [
    userData.fcmToken,
    userData.pushToken,
    userData.notificationToken,
    ...(Array.isArray(userData.fcmTokens) ? userData.fcmTokens : []),
  ];

  return [...new Set(raw.filter((token) => typeof token === "string" && token.trim()))];
};

const sendPushToUsers = async ({ userIds = [], title, body, data = {} }) => {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (!uniqueUserIds.length || !title || !body) return { sent: 0, users: 0 };

  const userSnaps = await Promise.all(uniqueUserIds.map((uid) => db.collection("users").doc(uid).get()));
  const tokens = userSnaps.flatMap((snap) => (snap.exists ? collectTokensFromUser(snap.data() || {}) : []));
  if (!tokens.length) return { sent: 0, users: uniqueUserIds.length };

  const message = {
    notification: { title, body },
    data: Object.entries(data).reduce((acc, [key, value]) => {
      acc[key] = String(value ?? "");
      return acc;
    }, {}),
  };

  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  let sent = 0;
  for (const chunk of chunks) {
    const result = await admin.messaging().sendEachForMulticast({ ...message, tokens: chunk });
    sent += Number(result.successCount || 0);
  }

  return { sent, users: uniqueUserIds.length };
};

exports.processDepositApproval = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const depositId = String(data?.depositId || "").trim();
  const action = String(data?.action || "").trim().toLowerCase();
  const remarks = String(data?.remarks || "").trim();

  if (!depositId) {
    throw new functions.https.HttpsError("invalid-argument", "Deposit ID is required.");
  }

  if (!["approved", "rejected"].includes(action)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid deposit action.");
  }

  const reviewerRef = db.collection("users").doc(context.auth.uid);
  const reviewerSnap = await reviewerRef.get();
  const reviewerData = reviewerSnap.exists ? reviewerSnap.data() || {} : {};
  const reviewerRole = String(reviewerData.role || "").toUpperCase();

  if (!["ADMIN", "CEO", "SUPERADMIN"].includes(reviewerRole)) {
    throw new functions.https.HttpsError("permission-denied", "Not authorized to review deposits.");
  }

  return db.runTransaction(async (transaction) => {
    const depositRef = db.collection("deposits").doc(depositId);
    const depositSnap = await transaction.get(depositRef);

    if (!depositSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Deposit request not found.");
    }

    const depositData = depositSnap.data() || {};
    const currentStatus = String(depositData.status || "pending").toLowerCase();
    if (currentStatus !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "Deposit has already been reviewed.");
    }

    const updateData = {
      status: action,
      remarks,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedByUid: context.auth.uid,
      reviewedByEmail: context.auth.token.email || reviewerData.email || "",
      reviewedByUsername: reviewerData.username || reviewerData.name || "",
      reviewedByRole: reviewerRole,
    };

    let creditedAmount = 0;
    let userRef = null;
    let nextBalance = null;
    if (action === "approved") {
      const userId = String(depositData.userId || "").trim();
      if (!userId) {
        throw new functions.https.HttpsError("failed-precondition", "Deposit request has no user ID.");
      }

      userRef = db.collection("users").doc(userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Deposit user not found.");
      }

      const userData = userSnap.data() || {};
      const currentBalance = Number(userData.eWallet);
      const depositAmount = Number(depositData.netAmount || depositData.amount || 0);
      const safeBalance = Number.isFinite(currentBalance) ? currentBalance : 0;
      creditedAmount = Number.isFinite(depositAmount) ? depositAmount : 0;
      nextBalance = safeBalance + creditedAmount;
    }

    transaction.update(depositRef, updateData);

    if (action === "approved" && userRef) {
      transaction.update(userRef, {
        eWallet: nextBalance,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      status: action,
      creditedAmount,
    };
  });
});

exports.notifyMerchantOnNewOrder = functions.firestore
  .document("sales/{saleId}")
  .onCreate(async (snap, context) => {
    const sale = snap.data() || {};
    const status = normalizeStatus(sale.status);
    if (!["NEW", "PENDING"].includes(status)) return null;

    const merchantId = sale.merchantId;
    if (!merchantId) return null;

    await sendPushToUsers({
      userIds: [merchantId],
      title: "New Order",
      body: `You received a new order${sale.total ? ` (P${Number(sale.total).toFixed(2)})` : ""}.`,
      data: {
        type: "MERCHANT_NEW_ORDER",
        saleId: context.params.saleId,
      },
    });

    return null;
  });

exports.notifyMerchantOnNewOrderV2 = functions.firestore
  .document("orders/{orderId}")
  .onCreate(async (snap, context) => {
    const order = snap.data() || {};
    const status = normalizeStatus(order.status);
    if (!["NEW", "PENDING"].includes(status)) return null;

    const merchantId = order.merchantId;
    if (!merchantId) return null;

    await sendPushToUsers({
      userIds: [merchantId],
      title: "New Order",
      body: `You received a new order${order.total ? ` (P${Number(order.total).toFixed(2)})` : ""}.`,
      data: {
        type: "MERCHANT_NEW_ORDER",
        orderId: context.params.orderId,
      },
    });

    return null;
  });

exports.notifyOrderCancelled = functions.firestore
  .document("sales/{saleId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    const beforeStatus = normalizeStatus(before.status);
    const afterStatus = normalizeStatus(after.status);
    if (beforeStatus === afterStatus || afterStatus !== "CANCELLED") return null;

    const recipients = [after.merchantId, after.customerId].filter(Boolean);
    if (!recipients.length) return null;

    await sendPushToUsers({
      userIds: recipients,
      title: "Order Cancelled",
      body: `Order #${String(context.params.saleId).slice(-6)} has been cancelled.`,
      data: {
        type: "ORDER_CANCELLED",
        saleId: context.params.saleId,
      },
    });

    return null;
  });

exports.notifyOrderCancelledV2 = functions.firestore
  .document("orders/{orderId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    const beforeStatus = normalizeStatus(before.status);
    const afterStatus = normalizeStatus(after.status);
    if (beforeStatus === afterStatus || afterStatus !== "CANCELLED") return null;

    const recipients = [after.merchantId, after.customerId].filter(Boolean);
    if (!recipients.length) return null;

    await sendPushToUsers({
      userIds: recipients,
      title: "Order Cancelled",
      body: `Order #${String(context.params.orderId).slice(-6)} has been cancelled.`,
      data: {
        type: "ORDER_CANCELLED",
        orderId: context.params.orderId,
      },
    });

    return null;
  });

exports.notifyDeliveryLifecycle = functions.firestore
  .document("deliveries/{deliveryId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    const beforeStatus = normalizeStatus(before.status);
    const afterStatus = normalizeStatus(after.status);
    if (!afterStatus || beforeStatus === afterStatus) return null;

    if (afterStatus === "ARRIVED_MERCHANT") {
      await sendPushToUsers({
        userIds: [after.merchantId].filter(Boolean),
        title: "Rider Arrived",
        body: "Your rider has arrived for pickup.",
        data: {
          type: "RIDER_ARRIVED",
          deliveryId: context.params.deliveryId,
          orderId: after.orderId || "",
          saleId: after.saleId || "",
        },
      });
      return null;
    }

    if (afterStatus === "DELIVERED") {
      await sendPushToUsers({
        userIds: [after.merchantId, after.customerId].filter(Boolean),
        title: "Order Delivered",
        body: "The order has been delivered successfully.",
        data: {
          type: "ORDER_DELIVERED",
          deliveryId: context.params.deliveryId,
          orderId: after.orderId || "",
          saleId: after.saleId || "",
        },
      });
    }

    return null;
  });

// Support both Firestore snapshot APIs (exists boolean vs exists() method).
const docExists = (snap) => {
  if (!snap) return false;
  return typeof snap.exists === "function" ? snap.exists() : !!snap.exists;
};

// Initialize CORS middleware
const corsHandler = cors({ origin: true });

exports.resetUserPasswordDefault = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { targetUid } = req.body || {};

      if (!targetUid) {
        return res.status(400).json({ error: "targetUid is required" });
      }

      const decoded = await admin.auth().verifyIdToken(idToken);
      const requesterSnap = await db.collection("users").doc(decoded.uid).get();
      if (!docExists(requesterSnap)) {
        return res.status(403).json({ error: "Requester profile not found" });
      }

      const requesterRole = normalizeStatus((requesterSnap.data() || {}).role);
      if (requesterRole !== "SUPERADMIN") {
        return res.status(403).json({ error: "Only SUPERADMIN can reset user passwords" });
      }

      const targetSnap = await db.collection("users").doc(String(targetUid)).get();
      if (!docExists(targetSnap)) {
        return res.status(404).json({ error: "Target user not found" });
      }

      await admin.auth().updateUser(String(targetUid), { password: DEFAULT_RESET_PASSWORD });

      return res.status(200).json({
        success: true,
        targetUid: String(targetUid),
        defaultPassword: DEFAULT_RESET_PASSWORD,
      });
    } catch (error) {
      console.error("[resetUserPasswordDefault] error:", error);
      return res.status(500).json({ error: "Failed to reset user password" });
    }
  });
});

/**
 * Transfer Referral Reward to eWallet
 * Idempotent: Safe to retry without duplication
 */
exports.transferReferralReward = functions.https.onRequest(async (req, res) => {
  // Apply CORS middleware
  corsHandler(req, res, async () => {
    try {
      console.log("[transferReferralReward] 🔄 Request received:", req.method);

      // Only allow POST requests
      if (req.method !== "POST") {
        console.log("[transferReferralReward] Method:", req.method);
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Get authorization header
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error("[transferReferralReward] ❌ Missing or invalid authorization header");
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { rewardId, amount } = req.body || {};

      console.log("[transferReferralReward] Input:", { rewardId, amount });

      // Validate input
      if (!rewardId || !amount) {
        console.error("[transferReferralReward] ❌ Missing required fields");
        return res.status(400).json({ error: "Missing required fields: rewardId, amount" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        console.error("[transferReferralReward] ❌ Invalid amount");
        return res.status(400).json({ error: "Amount must be greater than zero" });
      }

      // Verify user authentication
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log("[transferReferralReward] ✅ User authenticated:", decodedToken.uid);
      } catch (error) {
        console.error("[transferReferralReward] ❌ Token verification failed:", error);
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
      }

      const userId = decodedToken.uid;

      // Run transaction
      try {
        const result = await db.runTransaction(async (transaction) => {
          // Get the reward document
          const rewardRef = db.collection("referralReward").doc(rewardId);
          const rewardDoc = await transaction.get(rewardRef);

          if (!rewardDoc.exists) {
            throw new Error("Referral reward not found");
          }

          const rewardData = rewardDoc.data();

          // Verify reward belongs to the authenticated user
          if (rewardData.userId !== userId) {
            throw new Error("This reward does not belong to you");
          }

          // ✅ IDEMPOTENCY CHECK: If already transferred, return success
          if (rewardData.transferredAmount && rewardData.dateTransferred) {
            console.log(
              `[transferReferralReward] Reward ${rewardId} already transferred (idempotent return)`
            );
            return {
              success: true,
              alreadyTransferred: true,
              message: "This reward was already transferred",
              newBalance: rewardData.transferredAmount,
            };
          }

          // Prevent re-entry: Check if we're in the middle of transferring
          if (rewardData.transferring === true) {
            throw new Error("Transfer in progress");
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

          // Mark reward as transferred with all required fields
          transaction.update(rewardRef, {
            payoutReleased: true,
            dateTransferred: new Date(),
            transferredAmount: numAmount,
            transferring: false, // Clear the lock
          });

          // Create transfer log
          const logRef = db.collection("referralRewardTransferlogs").doc();
          transaction.set(logRef, {
            userId,
            rewardId,
            amount: rewardData.amount,
            transferredAmount: numAmount,
            source: rewardData.source || "Referral",
            status: "Transferred",
            createdAt: new Date(),
          });

          // Create deposit record for eWallet history
          const depositRef = db.collection("deposits").doc();
          let depositType = "Referral Reward Transfer";

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
            alreadyTransferred: false,
            newBalance: currentBalance + numAmount,
            depositId: depositRef.id,
          };
        });

        console.log(
          `[transferReferralReward] ✅ SUCCESS - user=${userId} reward=${rewardId} amount=₱${numAmount} newBalance=₱${result.newBalance}`
        );

        // 📊 Log to Render backend for monitoring
        try {
          const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
          await fetch(`${logUrl}/api/log-event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              level: "info",
              event: "referral_earnings_transfer_completed",
              data: {
                userId,
                rewardId,
                amount: numAmount,
                newBalance: result.newBalance,
                alreadyTransferred: result.alreadyTransferred || false,
                source: "Cloud Function",
              },
            }),
          });
        } catch (logError) {
          console.warn("[transferReferralReward] Warning: Failed to log to Render:", logError);
        }

        res.json(result);
      } catch (transactionError) {
        console.error("[transferReferralReward] ❌ Transaction failed:", transactionError);
        res.status(400).json({ error: transactionError.message || "Transfer failed" });
      }
    } catch (error) {
      console.error("[transferReferralReward] ❌ Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

/**
 * Transfer Override Upline Reward to eWallet
 * HTTP function with explicit CORS support
 * Idempotent: Safe to retry without duplication
 */
exports.transferOverrideReward = functions.https.onRequest(async (req, res) => {
  // Apply CORS middleware
  corsHandler(req, res, async () => {
    try {
      console.log("[transferOverrideReward] 🔄 Request received:", req.method);

      // Only allow POST requests
      if (req.method !== "POST") {
        console.log("[transferOverrideReward] Method:", req.method);
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Get authorization header
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error("[transferOverrideReward] ❌ Missing or invalid authorization header");
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { overrideId, amount } = req.body || {};

      console.log("[transferOverrideReward] Input:", { overrideId, amount });

      // Validate input
      if (!overrideId || !amount) {
        console.error("[transferOverrideReward] ❌ Missing required fields");
        return res.status(400).json({ error: "Missing required fields: overrideId, amount" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        console.error("[transferOverrideReward] ❌ Invalid amount");
        return res.status(400).json({ error: "Amount must be greater than zero" });
      }

      // Verify user authentication
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log("[transferOverrideReward] ✅ User authenticated:", decodedToken.uid);
      } catch (error) {
        console.error("[transferOverrideReward] ❌ Token verification failed:", error);
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
      }

      const userId = decodedToken.uid;

      // Run transaction
      try {
        const result = await db.runTransaction(async (transaction) => {
          // Try both uplineRewards and override collections
          let rewardRef;
          let rewardData;

          // First try uplineRewards collection
          const uplineRewardRef = db.collection("uplineRewards").doc(overrideId);
          const uplineRewardDoc = await transaction.get(uplineRewardRef);

          if (uplineRewardDoc.exists) {
            rewardRef = uplineRewardRef;
            rewardData = uplineRewardDoc.data();
          } else {
            // Try override collection
            const overrideRef = db.collection("override").doc(overrideId);
            const overrideDoc = await transaction.get(overrideRef);

            if (overrideDoc.exists) {
              rewardRef = overrideRef;
              rewardData = overrideDoc.data();
            } else {
              throw new Error("Override reward not found");
            }
          }

          // Verify reward belongs to the authenticated user
          if (rewardData.uplineId !== userId) {
            throw new Error("This reward does not belong to you");
          }

          // ✅ IDEMPOTENCY CHECK: If already credited, return success
          if (rewardData.claimed || rewardData.status === "Credited") {
            console.log(
              `[transferOverrideReward] Reward ${overrideId} already credited (idempotent return)`
            );
            return {
              success: true,
              alreadyTransferred: true,
              message: "This reward was already credited",
              newBalance: rewardData.amount,
            };
          }

          // Check if reward is due
          let dueDate = rewardData.dueDate || rewardData.releaseDate;
          if (dueDate) {
            if (typeof dueDate === "object" && dueDate.seconds) {
              dueDate = new Date(dueDate.seconds * 1000);
            } else if (typeof dueDate === "string" || typeof dueDate === "number") {
              dueDate = new Date(dueDate);
            }
          }

          const now = new Date();
          if (dueDate && now < dueDate) {
            throw new Error("Reward is not yet due. Please wait until the due date has passed.");
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

          // Mark reward as claimed and status as Credited
          transaction.update(rewardRef, {
            claimed: true,
            claimedAt: new Date(),
            status: "Credited",
          });

          // Create override transaction record for audit trail
          const transactionRef = db.collection("overrideTransactions").doc();
          transaction.set(transactionRef, {
            userId,
            overrideId,
            amount: numAmount,
            status: "Credited",
            createdAt: new Date(),
          });

          return {
            success: true,
            alreadyTransferred: false,
            newBalance: currentBalance + numAmount,
          };
        });

        console.log(
          `[transferOverrideReward] ✅ SUCCESS - user=${userId} override=${overrideId} amount=₱${numAmount} newBalance=₱${result.newBalance}`
        );

        // 📊 Log to Render backend for monitoring
        try {
          const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
          await fetch(`${logUrl}/api/log-event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              level: "info",
              event: "override_earnings_transfer_completed",
              data: {
                userId,
                overrideId,
                amount: numAmount,
                newBalance: result.newBalance,
                alreadyTransferred: result.alreadyTransferred || false,
                source: "Cloud Function",
              },
            }),
          });
        } catch (logError) {
          console.warn("[transferOverrideReward] Warning: Failed to log to Render:", logError);
        }

        res.json(result);
      } catch (transactionError) {
        console.error("[transferOverrideReward] ❌ Transaction failed:", transactionError);
        res.status(400).json({ error: transactionError.message || "Transfer failed" });
      }
    } catch (error) {
      console.error("[transferOverrideReward] ❌ Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

/**
 * Add Capital Share Entry
 * Idempotent: Uses clientRequestId to prevent duplicates
 * Secure: Requires Bearer token authentication
 */
exports.addCapitalShare = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[capital-share] 🔄 Request received");

      if (req.method !== "POST") {
        console.error("[capital-share] ❌ Invalid method:", req.method);
        return res.status(405).json({ error: "Method not allowed" });
      }

      // Extract Bearer token from Authorization header
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error("[capital-share] ❌ Missing or invalid authorization header");
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { amount, entryDate, referredBy, clientRequestId } = req.body || {};

      console.log("[capital-share] Validating input:", { amount, entryDate, referredBy, clientRequestId });

      // Validate input
      if (!amount || !entryDate) {
        console.error("[capital-share] ❌ Missing required fields");
        return res.status(400).json({ error: "Missing required fields: amount, entryDate" });
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
        decodedToken = await admin.auth().verifyIdToken(idToken);
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

          // Idempotency: Check if entry already exists using clientRequestId
          const entryRef = clientRequestId
            ? db.collection("capitalShareEntries").doc(`${userId}_${clientRequestId}`)
            : db.collection("capitalShareEntries").doc();

          const existingEntrySnap = await transaction.get(entryRef);
          if (existingEntrySnap.exists) {
            const existingData = existingEntrySnap.data() || {};
            console.log(`[capital-share] Entry already exists (deduped) - entryId=${entryRef.id}`);
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

          // Store multi-level network bonus in override collection:
          // L1=3% (direct upline), L2=1%, L3=1%
          const levelPercentages = [0.03, 0.01, 0.01];
          let currentUplineUsername = userData.referredBy || referredBy || null;
          const releaseDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const visitedUplines = new Set();

          for (let i = 0; i < levelPercentages.length && currentUplineUsername; i += 1) {
            if (visitedUplines.has(currentUplineUsername)) {
              break;
            }
            visitedUplines.add(currentUplineUsername);

            const uplineQuery = await db
              .collection("users")
              .where("username", "==", currentUplineUsername)
              .limit(1)
              .get();

            if (uplineQuery.empty) {
              break;
            }

            const uplineDoc = uplineQuery.docs[0];
            const uplineData = uplineDoc.data() || {};
            const uplineId = uplineDoc.id;
            const level = i + 1;
            const bonusAmount = numAmount * levelPercentages[i];

            const overrideRef = db.collection("override").doc(`${entryRef.id}_override_l${level}`);
            transaction.set(overrideRef, {
              uplineId,
              fromUserId: userId,
              fromUsername: userData.username || "",
              uplineUsername: currentUplineUsername,
              amount: bonusAmount,
              type: `Level ${level} Capital Share Bonus`,
              networkLevel: level,
              status: "Pending",
              createdAt: new Date(),
              releaseDate,
            });

            currentUplineUsername = uplineData.referredBy || null;
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

        // 📊 Log to Render backend for monitoring
        try {
          const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
          await fetch(`${logUrl}/api/log-event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              level: "info",
              event: "capital_share_entry_created",
              data: {
                userId,
                entryId: result.entryId,
                amount: numAmount,
                lockInPortion: result.lockInPortion,
                transferablePortion: result.transferablePortion,
                deduped: result.deduped || false,
                source: "Cloud Function",
              },
            }),
          });
        } catch (logError) {
          console.warn("[capital-share] Warning: Failed to log to Render:", logError);
        }

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
});

/**
 * Add Payback Entry
 * Idempotent: Uses clientRequestId to prevent duplicates
 * Secure: Requires Bearer token authentication
 */
exports.addPaybackEntry = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[payback-entry] 🔄 Request received");

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { uplineUsername, amount, entryDate, clientRequestId } = req.body || {};

      if (!uplineUsername || !amount || !entryDate) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount < 300) {
        return res.status(400).json({ error: "Minimum payback entry is ₱300" });
      }

      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = decodedToken.uid;

      const result = await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error("User not found");

        const userData = userDoc.data();
        const walletBalance = userData.eWallet || 0;

        const paybackRef = clientRequestId
          ? db.collection("paybackEntries").doc(`${userId}_${clientRequestId}`)
          : db.collection("paybackEntries").doc();

        const existingSnap = await transaction.get(paybackRef);
        if (existingSnap.exists) {
          return {
            success: true,
            paybackEntryId: paybackRef.id,
            newBalance: walletBalance,
            deduped: true,
          };
        }

        if (walletBalance < numAmount) throw new Error("Insufficient wallet balance");

        const uplineQuery = await db
          .collection("users")
          .where("username", "==", uplineUsername)
          .limit(1)
          .get();

        if (uplineQuery.empty) throw new Error("Upline not found");

        const uplineData = uplineQuery.docs[0].data();
        const uplineId = uplineQuery.docs[0].id;

        transaction.update(userRef, {
          eWallet: walletBalance - numAmount,
          updatedAt: new Date(),
        });

        const expirationDate = new Date(new Date(entryDate).getTime() + 30 * 24 * 60 * 60 * 1000);
        transaction.set(paybackRef, {
          userId,
          uplineUsername,
          amount: numAmount,
          date: new Date(entryDate),
          expirationDate,
          status: "Approved",
          createdAt: new Date(),
        });

        const uplineRewardRef = db.collection("uplineRewards").doc(`${paybackRef.id}_upline`);
        transaction.set(uplineRewardRef, {
          uplineId,
          uplineUsername,
          fromUserId: userId,
          amount: 65,
          status: "Pending",
          dueDate: expirationDate,
          claimed: false,
          createdAt: new Date(),
        });

        return {
          success: true,
          paybackEntryId: paybackRef.id,
          newBalance: walletBalance - numAmount,
          uplineReward: 65,
        };
      });

      console.info(`[payback-entry] ✅ SUCCESS - user=${userId} upline=${uplineUsername} amount=₱${numAmount}`);

      // 📊 Log to Render
      try {
        await fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "payback_entry_created",
            data: {
              userId,
              uplineUsername,
              amount: numAmount,
              entryId: result.paybackEntryId,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[payback-entry] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[payback-entry] ❌ Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Transfer Funds (Send Money)
 * Idempotent: Uses clientRequestId to prevent duplicates
 */
exports.transferFunds = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[transfer-funds] 🔄 Request received");

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { recipientUsername, amount, clientRequestId } = req.body || {};

      if (!recipientUsername || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "Amount must be greater than zero" });
      }

      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const senderId = decodedToken.uid;
      const charge = numAmount * 0.02;
      const netTransfer = numAmount - charge;

      const result = await db.runTransaction(async (transaction) => {
        const senderRef = db.collection("users").doc(senderId);
        const senderDoc = await transaction.get(senderRef);
        if (!senderDoc.exists) throw new Error("Sender not found");

        const senderData = senderDoc.data();
        const currentBalance = Number(senderData.eWallet || 0);

        const transferRef = clientRequestId
          ? db.collection("transferFunds").doc(`${senderId}_${clientRequestId}`)
          : db.collection("transferFunds").doc();

        const existingSnap = await transaction.get(transferRef);
        if (existingSnap.exists) {
          return {
            success: true,
            newBalance: currentBalance,
            transferId: transferRef.id,
            deduped: true,
          };
        }

        if (currentBalance < numAmount) throw new Error("Insufficient wallet balance");

        const recipientQuery = await db
          .collection("users")
          .where("username", "==", recipientUsername)
          .limit(1)
          .get();

        if (recipientQuery.empty) throw new Error("Recipient not found");

        const recipientDoc = recipientQuery.docs[0];
        if (senderId === recipientDoc.id) throw new Error("Cannot transfer to yourself");

        const recipientRef = db.collection("users").doc(recipientDoc.id);
        const recipientData = recipientDoc.data();

        transaction.update(senderRef, {
          eWallet: Number(currentBalance - numAmount),
        });

        const recipientBalance = Number(recipientData.eWallet || 0);
        transaction.update(recipientRef, {
          eWallet: Number(recipientBalance + netTransfer),
        });

        transaction.set(transferRef, {
          senderId,
          senderName: senderData.name || senderData.username,
          recipientUsername,
          recipientId: recipientDoc.id,
          amount: numAmount,
          charge,
          netAmount: netTransfer,
          status: "Approved",
          createdAt: new Date(),
        });

        return {
          success: true,
          newBalance: currentBalance - numAmount,
          transferId: transferRef.id,
        };
      });

      console.info(`[transfer-funds] ✅ SUCCESS - sender=${senderId} recipient=${recipientUsername} amount=₱${numAmount}`);

      // 📊 Log to Render
      try {
        await fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "wallet_transfer_completed",
            data: {
              senderId,
              recipientUsername,
              amount: numAmount,
              netAmount: netTransfer,
              transferId: result.transferId,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[transfer-funds] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[transfer-funds] ❌ Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Transfer Monthly Profit
 * Idempotent: Uses clientRequestId to prevent duplicates
 */
exports.transferProfit = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[transfer-profit] 🔄 Request received");

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { entryId, amount, clientRequestId } = req.body || {};

      if (!entryId || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = decodedToken.uid;

      const result = await db.runTransaction(async (transaction) => {
        const depositRef = clientRequestId
          ? db.collection("deposits").doc(`profit_${userId}_${clientRequestId}`)
          : db.collection("deposits").doc();

        const existingSnap = await transaction.get(depositRef);
        if (existingSnap.exists && existingSnap.data().status === "Approved") {
          return {
            success: true,
            newBalance: 0,
            deduped: true,
          };
        }

        const entryRef = db.collection("capitalShareEntries").doc(entryId);
        const entryDoc = await transaction.get(entryRef);
        if (!entryDoc.exists) throw new Error("Entry not found");

        const entryData = entryDoc.data();
        if (entryData.userId !== userId) throw new Error("Not your entry");
        if (!entryData.profit || entryData.profitStatus === "Claimed") throw new Error("Profit unavailable");

        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error("User not found");

        const userData = userDoc.data();
        const currentBalance = Number(userData.eWallet || 0);

        transaction.update(userRef, {
          eWallet: currentBalance + numAmount,
          updatedAt: new Date(),
        });

        transaction.update(entryRef, {
          profitStatus: "Claimed",
          profitClaimedAmount: numAmount,
          profitClaimedAt: new Date(),
        });

        transaction.set(depositRef, {
          userId,
          amount: numAmount,
          status: "Approved",
          type: "Monthly Profit Transfer",
          sourceEntryId: entryId,
          createdAt: new Date(),
        });

        return {
          success: true,
          newBalance: currentBalance + numAmount,
          transferId: depositRef.id,
        };
      });

      console.info(`[transfer-profit] ✅ SUCCESS - user=${userId} entryId=${entryId} amount=₱${numAmount}`);

      // 📊 Log to Render
      try {
        await fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "monthly_profit_transfer_completed",
            data: {
              userId,
              entryId,
              amount: numAmount,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[transfer-profit] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[transfer-profit] ❌ Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Transfer Capital Share
 * Idempotent: Uses clientRequestId to prevent duplicates
 */
exports.transferCapitalShare = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[transfer-capital-share] 🔄 Request received");

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { entryId, amount, clientRequestId } = req.body || {};

      if (!entryId || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = decodedToken.uid;

      const result = await db.runTransaction(async (transaction) => {
        const depositRef = clientRequestId
          ? db.collection("deposits").doc(`capshare_${userId}_${clientRequestId}`)
          : db.collection("deposits").doc();

        const existingSnap = await transaction.get(depositRef);
        if (existingSnap.exists && existingSnap.data().sourceEntryId === entryId) {
          return {
            success: true,
            newBalance: 0,
            deduped: true,
          };
        }

        const entryRef = db.collection("capitalShareEntries").doc(entryId);
        const entryDoc = await transaction.get(entryRef);
        if (!entryDoc.exists) throw new Error("Entry not found");

        const entryData = entryDoc.data();
        if (entryData.userId !== userId) throw new Error("Not your entry");

        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error("User not found");

        const userData = userDoc.data();
        const currentBalance = Number(userData.eWallet || 0);

        transaction.update(userRef, {
          eWallet: currentBalance + numAmount,
          updatedAt: new Date(),
        });

        transaction.update(entryRef, {
          transferredAmount: (entryData.transferredAmount || 0) + numAmount,
          transferredAt: new Date(),
        });

        transaction.set(depositRef, {
          userId,
          amount: numAmount,
          status: "Approved",
          type: "Capital Share Transfer",
          sourceEntryId: entryId,
          createdAt: new Date(),
        });

        return {
          success: true,
          newBalance: currentBalance + numAmount,
          transferId: depositRef.id,
        };
      });

      console.info(`[transfer-capital-share] ✅ SUCCESS - user=${userId} entryId=${entryId} amount=₱${numAmount}`);

      // 📊 Log to Render
      try {
        await fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "capital_share_transfer_completed",
            data: {
              userId,
              entryId,
              amount: numAmount,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[transfer-capital-share] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[transfer-capital-share] ❌ Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Transfer Passive Income (Payback Entry Transfer)
 * Idempotent: Uses clientRequestId to prevent duplicates
 */
exports.transferPassiveIncome = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[transfer-passive-income] 🔄 Request received");

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { paybackEntryId, amount, clientRequestId } = req.body || {};

      if (!paybackEntryId || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = decodedToken.uid;
      const fee = numAmount * 0.01;
      const net = numAmount - fee;

      const result = await db.runTransaction(async (transaction) => {
        const transferRef = clientRequestId
          ? db.collection("passiveIncomeTransfers").doc(`${userId}_${clientRequestId}`)
          : db.collection("passiveIncomeTransfers").doc();

        const existingSnap = await transaction.get(transferRef);
        if (existingSnap.exists) {
          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);
          return {
            success: true,
            newBalance: Number(userDoc.data()?.eWallet || 0),
            transferId: transferRef.id,
            deduped: true,
          };
        }

        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error("User not found");

        const userData = userDoc.data();
        const userBalance = Number(userData.eWallet || 0);

        transaction.update(userRef, {
          eWallet: isNaN(userBalance) ? net : Number(userBalance + net),
        });

        transaction.set(transferRef, {
          userId,
          paybackEntryId,
          amount: numAmount,
          fee,
          netAmount: net,
          status: "Approved",
          createdAt: new Date(),
        });

        return {
          success: true,
          newBalance: (userData.eWallet || 0) + net,
          transferId: transferRef.id,
        };
      });

      console.info(`[transfer-passive-income] ✅ SUCCESS - user=${userId} paybackId=${paybackEntryId} amount=₱${numAmount} net=₱${net}`);

      // 📊 Log to Render
      try {
        await fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "passive_income_transfer_completed",
            data: {
              userId,
              paybackEntryId,
              amount: numAmount,
              netAmount: net,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[transfer-passive-income] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[transfer-passive-income] ❌ Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Purchase Activation Code
 * Idempotent: Safe to retry via clientRequestId
 */
exports.purchaseActivationCode = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      const { codeType, clientRequestId } = req.body || {};

      if (!codeType) {
        return res.status(400).json({ error: "Missing required field: codeType" });
      }

      const codePrices = { capital: 2400, downline: 600 };

      const getDateValue = (value) => {
        if (!value) return null;
        if (typeof value.toDate === "function") return value.toDate();
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const result = await db.runTransaction(async (transaction) => {
        // Idempotency check
        if (clientRequestId) {
          const idempotencyRef = db.collection("purchaseCodesIdempotency").doc(`${userId}_${clientRequestId}`);
          const existingSnap = await transaction.get(idempotencyRef);
          if (docExists(existingSnap)) {
            const data = existingSnap.data();
            return {
              success: true,
              deduped: true,
              code: data.code,
              codeId: data.codeId,
              amount: Number(data.amount || 0),
              isCapitalRenewalEligible: Boolean(data.isCapitalRenewalEligible),
            };
          }
        }

        const userRef = db.collection("users").doc(userId);
        const userSnap = await transaction.get(userRef);
        if (!docExists(userSnap)) {
          throw new Error("User account not found");
        }

        const userData = userSnap.data();
        const activatedAt = getDateValue(userData.capitalActivatedAt);
        const renewalDate = activatedAt
          ? new Date(activatedAt.getFullYear() + 1, activatedAt.getMonth(), activatedAt.getDate())
          : null;
        const isCapitalRenewalEligible = Boolean(
          codeType === "capital" && activatedAt && renewalDate && new Date() >= renewalDate
        );
        const amount =
          codeType === "capital"
            ? (isCapitalRenewalEligible ? 500 : codePrices.capital)
            : codePrices.downline;

        const currentBalance = Number(userData.eWallet || 0);
        if (currentBalance < amount) {
          throw new Error("Insufficient wallet balance");
        }

        const randomCode = "TCLC-" + Math.random().toString(36).substring(2, 10).toUpperCase();
        const purchaseRef = db.collection("purchaseCodes").doc();

        transaction.set(purchaseRef, {
          userId,
          name: userData.name || "",
          email: userData.email || "",
          code: randomCode,
          type: codeType === "capital" ? "Activate Capital Share" : "Downline Code",
          amount,
          used: false,
          status: "Success",
          createdAt: new Date(),
        });

        transaction.update(userRef, { eWallet: currentBalance - amount });

        // Store idempotency key
        if (clientRequestId) {
          const idempotencyRef = db.collection("purchaseCodesIdempotency").doc(`${userId}_${clientRequestId}`);
          transaction.set(idempotencyRef, {
            code: randomCode,
            codeId: purchaseRef.id,
            amount,
            isCapitalRenewalEligible,
            createdAt: new Date(),
          });
        }

        return {
          success: true,
          code: randomCode,
          codeId: purchaseRef.id,
          amount,
          isCapitalRenewalEligible,
          newBalance: currentBalance - amount,
        };
      });

      // Log to Render
      try {
        await fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "activation_code_purchased",
            data: {
              userId,
              codeType,
              amount: result.amount,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              isCapitalRenewalEligible: result.isCapitalRenewalEligible || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[purchase-activation-code] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[purchase-activation-code] Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Create Withdrawal Request
 * Idempotent: Safe to retry via clientRequestId
 */
exports.createWithdrawal = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      const { amount, paymentMethod, qrUrl, clientRequestId } = req.body || {};

      if (!amount || !paymentMethod || !qrUrl) {
        return res.status(400).json({ error: "Missing required fields: amount, paymentMethod, qrUrl" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount < 100) {
        return res.status(400).json({ error: "Minimum withdrawal is ₱100" });
      }

      const result = await db.runTransaction(async (transaction) => {
        // Idempotency check
        if (clientRequestId) {
          const idempotencyRef = db.collection("withdrawalIdempotency").doc(`${userId}_${clientRequestId}`);
          const existingSnap = await transaction.get(idempotencyRef);
          if (docExists(existingSnap)) {
            const data = existingSnap.data();
            return { success: true, deduped: true, withdrawalId: data.withdrawalId };
          }
        }

        const userRef = db.collection("users").doc(userId);
        const userSnap = await transaction.get(userRef);
        if (!docExists(userSnap)) {
          throw new Error("User account not found");
        }

        const userData = userSnap.data();
        const currentBalance = Number(userData.eWallet || 0);
        if (currentBalance < numAmount) {
          throw new Error("Insufficient wallet balance");
        }

        const charge = numAmount * 0.05;
        const netAmount = numAmount - charge;

        const withdrawalRef = db.collection("withdrawals").doc();
        transaction.set(withdrawalRef, {
          userId,
          name: userData.name || "",
          email: userData.email || "",
          amount: numAmount,
          paymentMethod,
          charge,
          netAmount,
          qrUrl,
          status: "Pending",
          createdAt: new Date(),
        });

        transaction.update(userRef, { eWallet: currentBalance - numAmount });

        // Store idempotency key
        if (clientRequestId) {
          const idempotencyRef = db.collection("withdrawalIdempotency").doc(`${userId}_${clientRequestId}`);
          transaction.set(idempotencyRef, {
            withdrawalId: withdrawalRef.id,
            createdAt: new Date(),
          });
        }

        return {
          success: true,
          withdrawalId: withdrawalRef.id,
          newBalance: currentBalance - numAmount,
          charge,
          netAmount,
        };
      });

      // Log to Render
      try {
        await fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "withdrawal_created",
            data: {
              userId,
              amount: numAmount,
              paymentMethod,
              charge: result.charge,
              netAmount: result.netAmount,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[create-withdrawal] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[create-withdrawal] Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Create Capital Share Voucher (WALK_IN or OFW)
 * Idempotent: Safe to retry via clientRequestId
 */
exports.createCapitalShareVoucher = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      const {
        voucherType,
        voucherCode,
        voucherIssuedAt,
        branchId,
        branchName,
        branchAddress,
        branchEmail,
        voucherKind,
        voucherStatus,
        claimablePercent,
        pointsConvertPercent,
        holdReason,
        sourceRewardLabel,
        splitGroupId,
        rewardConfigId,
        clientRequestId,
      } = req.body || {};

      if (!voucherType || !voucherCode) {
        return res.status(400).json({ error: "Missing required fields: voucherType, voucherCode" });
      }

      const result = await db.runTransaction(async (transaction) => {
        // Check user's capital activation date (vouchers only for activations >= Mar 4, 2026)
        const userRef = admin.firestore().collection("users").doc(userId);
        const userSnap = await transaction.get(userRef);
        
        if (!docExists(userSnap)) {
          throw new Error("User not found");
        }
        
        const userData = userSnap.data();
        const capitalActivatedAt = userData.capitalActivatedAt?.toDate?.() || (userData.capitalActivatedAt ? new Date(userData.capitalActivatedAt) : null);
        const voucherCutoffDate = new Date("2026-03-04"); // Implementation date
        
        // Vouchers only eligible for new activations (after Mar 4, 2026)
        if (!capitalActivatedAt || capitalActivatedAt < voucherCutoffDate) {
          throw new Error("Vouchers are only available for capital share activated after March 4, 2026. Please renew or reactivate your capital share to be eligible for vouchers.");
        }
        
        // Idempotency check
        if (clientRequestId) {
          const idempotencyKey = voucherKind ? `${userId}_${clientRequestId}_${voucherKind}` : `${userId}_${clientRequestId}`;
          const idempotencyRef = db.collection("voucherIdempotency").doc(idempotencyKey);
          const existingSnap = await transaction.get(idempotencyRef);
          if (existingSnap.exists) {
            const data = existingSnap.data();
            return { success: true, deduped: true, voucherId: data.voucherId };
          }
        }

        const voucherRef = db.collection("capitalShareVouchers").doc(userId);
        const voucherSnap = await transaction.get(voucherRef);

        let existingVouchers = [];
        if (voucherSnap.exists) {
          existingVouchers = voucherSnap.data().vouchers || [];
        }

        const parsedIssuedAt = voucherIssuedAt ? new Date(voucherIssuedAt) : new Date();
        const newVoucher = {
          voucherType,
          voucherCode,
          voucherStatus: voucherStatus || "ACTIVE",
          voucherKind: voucherKind || null, // Track voucher kind (RICE, MEAT, POINTS, etc.)
          claimablePercent: Number(claimablePercent || 100),
          pointsConvertPercent: Number(pointsConvertPercent || 0),
          holdReason: holdReason || "",
          sourceRewardLabel: sourceRewardLabel || "",
          splitGroupId: splitGroupId || null,
          rewardConfigId: rewardConfigId || null,
          branchId: branchId || null,
          branchName: branchName || "",
          branchAddress: branchAddress || "",
          branchEmail: branchEmail || "",
          voucherIssuedAt: parsedIssuedAt,
          createdAt: new Date(),
        };

        existingVouchers.push(newVoucher);

        transaction.set(voucherRef, {
          vouchers: existingVouchers,
          voucherType,
          voucherCode,
          voucherIssuedAt: parsedIssuedAt,
          lastUpdatedAt: new Date(),
        });

        // Store idempotency key
        if (clientRequestId) {
          const idempotencyKey = voucherKind ? `${userId}_${clientRequestId}_${voucherKind}` : `${userId}_${clientRequestId}`;
          const idempotencyRef = db.collection("voucherIdempotency").doc(idempotencyKey);
          transaction.set(idempotencyRef, {
            voucherId: userId,
            createdAt: new Date(),
          });
        }

        return {
          success: true,
          voucherId: userId,
          voucherCode,
          voucherType,
        };
      });

      // Log to Render
      try {
        await fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "capital_share_voucher_created",
            data: {
              userId,
              voucherType,
              voucherCode,
              branchName,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[create-capital-share-voucher] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[create-capital-share-voucher] Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Create Invite and Associated Rewards
 * Complex transaction: creates pendingInvites, consumes code, creates referral rewards and network bonuses
 * Idempotent: Safe to retry via clientRequestId
 */
exports.createInviteAndRewards = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const inviterId = decodedToken.uid;

      const {
        codeId,
        inviteeEmail,
        inviteeName,
        inviteeUsername,
        contactNumber,
        inviteeAddress,
        inviteeRole,
        referralCode,
        clientRequestId,
      } = req.body || {};

      if (!codeId || !inviteeEmail || !inviteeUsername || !inviteeRole) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await db.runTransaction(async (transaction) => {
        // Idempotency check
        if (clientRequestId) {
          const idempotencyRef = db.collection("inviteIdempotency").doc(`${inviterId}_${clientRequestId}`);
          const existingSnap = await transaction.get(idempotencyRef);
          if (existingSnap.exists) {
            const data = existingSnap.data();
            return { success: true, deduped: true, inviteId: data.inviteId };
          }
        }

        // 1️⃣ Get inviter data
        const inviterRef = db.collection("users").doc(inviterId);
        const inviterSnap = await transaction.get(inviterRef);
        if (!inviterSnap.exists) {
          throw new Error("Inviter not found");
        }
        const inviterData = inviterSnap.data();

        // 2️⃣ Verify and consume activation code
        const codeRef = db.collection("purchaseCodes").doc(codeId);
        const codeSnap = await transaction.get(codeRef);
        if (!codeSnap.exists) {
          throw new Error("Activation code not found");
        }

        const codeData = codeSnap.data();
        if (codeData.used) {
          throw new Error("Activation code already used");
        }
        if (codeData.userId !== inviterId) {
          throw new Error("Activation code does not belong to your account");
        }

        // 3️⃣ Create pending invite
        const pendingInviteRef = db.collection("pendingInvites").doc();
        transaction.set(pendingInviteRef, {
          inviterId,
          inviterUsername: inviterData.username || "",
          inviterRole: inviterData.role || "",
          inviteeEmail,
          inviteeName,
          inviteeUsername,
          contactNumber,
          address: inviteeAddress || "",
          role: inviteeRole,
          code: codeData.code,
          referralCode,
          referredBy: inviterData.username || "",
          referrerRole: inviterData.role || "",
          status: "Pending Approval",
          createdAt: new Date(),
        });

        // 4️⃣ Mark code as used
        transaction.update(codeRef, {
          used: true,
          usedAt: new Date(),
          usedByInviteeEmail: inviteeEmail,
        });

        // 5️⃣ Create direct referral reward
        const directRewardMap = {
          MasterMD: 235,
          MD: 210,
          MS: 160,
          MI: 140,
          Agent: 120,
        };
        const directReward = directRewardMap[inviterData.role] || 0;

        if (directReward > 0) {
          const referralRef = db.collection("referralReward").doc();
          transaction.set(referralRef, {
            userId: inviterId,
            username: inviterData.username || "",
            role: inviterData.role || "",
            amount: directReward,
            source: inviteeUsername,
            type: "Direct Invite Reward",
            approved: false,
            createdAt: new Date(),
          });
        }

        // 6️⃣ Create network/upline bonuses if applicable
        if (inviterData.uplineId) {
          const uplineRef = db.collection("users").doc(inviterData.uplineId);
          const uplineSnap = await transaction.get(uplineRef);
          if (uplineSnap.exists) {
            const uplineData = uplineSnap.data();
            const networkBonusMap = {
              MasterMD: 30,
              MD: 20,
              MS: 15,
              MI: 10,
              Agent: 5,
            };
            const networkBonus = networkBonusMap[uplineData.role] || 0;

            if (networkBonus > 0) {
              const networkRef = db.collection("referralReward").doc();
              transaction.set(networkRef, {
                userId: inviterData.uplineId,
                username: uplineData.username || "",
                role: uplineData.role || "",
                amount: networkBonus,
                source: inviteeUsername,
                type: "Network Bonus",
                approved: false,
                createdAt: new Date(),
              });
            }
          }
        }

        // Store idempotency key
        if (clientRequestId) {
          const idempotencyRef = db.collection("inviteIdempotency").doc(`${inviterId}_${clientRequestId}`);
          transaction.set(idempotencyRef, {
            inviteId: pendingInviteRef.id,
            createdAt: new Date(),
          });
        }

        return {
          success: true,
          inviteId: pendingInviteRef.id,
          directReward,
          inviteeUsername,
        };
      });

      // Log to Render
      try {
        await fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "invite_created_with_rewards",
            data: {
              inviterId,
              inviteeUsername,
              inviteeEmail,
              inviteeRole: inviteeRole,
              directReward: result.directReward,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[create-invite-and-rewards] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[create-invite-and-rewards] Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});
