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

// Simple health check for deployment platforms
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));