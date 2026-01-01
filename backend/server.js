// --- Email utility for admin-triggered notifications ---
import nodemailer from "nodemailer";

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_PORT == 465, // true for 465, false for other ports
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

async function sendEmail(to, subject, text) {
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) throw new Error("Email not configured");
  return transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    text,
  });
}

// Admin-triggered: Send custom email to user for a payback entry
app.post("/api/send-payback-email", async (req, res) => {
  try {
    const { userId, paybackEntryId, subject, message } = req.body;
    if (!userId || !paybackEntryId || !subject || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    // Get user email
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "User not found" });
    const user = userSnap.data();
    if (!user.email) return res.status(400).json({ error: "User has no email" });
    // Optionally: check paybackEntry exists
    const entryRef = db.collection("paybackEntries").doc(paybackEntryId);
    const entrySnap = await entryRef.get();
    if (!entrySnap.exists) return res.status(404).json({ error: "Payback entry not found" });
    // Send email
    await sendEmail(user.email, subject, message);
    res.json({ success: true });
  } catch (err) {
    console.error("Admin email send error:", err);
    res.status(500).json({ error: err.message || "Failed to send email" });
  }
});
// server.js
import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { db, auth } from "./firebaseAdmin.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Lightweight request logger for Render logs
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
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
    const { idToken, recipientUsername, amount } = req.body;

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
        const currentBalance = senderData.eWallet || 0;

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
          eWallet: currentBalance - numAmount,
        });

        transaction.update(recipientRef, {
          eWallet: (recipientData.eWallet || 0) + netTransfer,
        });

        // Create transfer log
        const transferRef = db.collection("transferFunds").doc();
        transaction.set(transferRef, {
          senderId: senderId,
          senderName: senderData.name || senderData.username,
          senderEmail: senderData.email,
          recipientUsername: recipientUsername,
          recipientId: recipientDoc.id,
          amount: numAmount,
          charge: charge,
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

      console.info(
        `[transfer] sender=${senderId} recipient=${recipientUsername} amount=${numAmount.toFixed(2)} net=${(numAmount - numAmount * 0.02).toFixed(2)} id=${result.transferId}`
      );

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


// 💸 Passive Income Transfer Endpoint
app.post("/api/transfer-passive-income", async (req, res) => {
  try {
    const { idToken, paybackEntryId, amount } = req.body;
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

        // Calculate fee and net
        const fee = numAmount * 0.01;
        const net = numAmount - fee;

        // Update user eWallet
        transaction.update(userRef, {
          eWallet: (userData.eWallet || 0) + net,
        });

        // Mark payback entry as transferred
        transaction.update(paybackRef, {
          transferred: true,
          transferredAt: new Date(),
        });

        // Log transfer
        const transferRef = db.collection("passiveTransfers").doc();
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

      console.info(
        `[passive-transfer] user=${userId} paybackEntry=${paybackEntryId} amount=${amount} net=${(numAmount - numAmount * 0.01).toFixed(2)} id=${result.transferId}`
      );
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

// Simple health check for deployment platforms
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));