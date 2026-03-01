// System Bonus Script
// Usage: node add-system-bonus.js
require('dotenv').config({ path: __dirname + '/.env' });
const { db } = require("./firebaseAdmin.js");

const addSystemBonus = async () => {
  try {
    // Bonus configuration
    const userEmail = "monares.cyriljay@gmail.com";
    const bonusAmount = 150;
    const bonusReason = "System Bonus";

    console.log("💝 Processing system bonus...");
    console.log(`📧 User Email: ${userEmail}`);
    console.log(`💰 Bonus Amount: ₱${bonusAmount}\n`);

    // Find user by email
    console.log("🔍 Searching for user...");
    const usersSnapshot = await db.collection("users")
      .where("email", "==", userEmail)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.error("❌ User not found with email:", userEmail);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    const currentBalance = Number(userData.eWallet || 0);

    console.log(`✅ User found: ${userData.name} (${userId})`);
    console.log(`💳 Current eWallet Balance: ₱${currentBalance.toFixed(2)}`);

    // Run transaction to ensure atomic operation
    await db.runTransaction(async (transaction) => {
      // Update user eWallet
      const userRef = db.collection("users").doc(userId);
      const newBalance = currentBalance + bonusAmount;
      
      transaction.update(userRef, {
        eWallet: newBalance,
        lastUpdated: new Date(),
      });

      // Create deposit record for eWallet history
      const depositRef = db.collection("deposits").doc();
      transaction.set(depositRef, {
        userId,
        name: userData.name || userData.username || "User",
        amount: bonusAmount,
        reference: `BONUS-${Date.now()}`,
        receiptUrl: "",
        status: "Approved",
        type: "System Bonus",
        paymentMethod: "System",
        remarks: bonusReason,
        createdAt: new Date(),
        reviewedAt: new Date(),
      });

      console.log(`\n✅ BONUS TRANSACTION COMPLETED!`);
      console.log(`📊 Deposit ID: ${depositRef.id}`);
      console.log(`👤 User: ${userData.name}`);
      console.log(`💰 Bonus Amount: ₱${bonusAmount}`);
      console.log(`💳 Old Balance: ₱${currentBalance.toFixed(2)}`);
      console.log(`💳 New Balance: ₱${newBalance.toFixed(2)}`);
      console.log(`📝 Type: ${bonusReason}`);
      console.log(`\n✨ The bonus is now visible in the user's eWallet history!`);
    });

  } catch (error) {
    console.error("❌ Error processing bonus:", error);
    process.exit(1);
  }
};

addSystemBonus();
