const functions = require("firebase-functions");
const cors = require("cors");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Initialize CORS middleware
const corsHandler = cors({ origin: true });

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
