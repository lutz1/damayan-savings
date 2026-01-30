// Manual Deposit Creation Script
// Usage: node create-deposit-manual.js
require('dotenv').config({ path: __dirname + '/.env' });
const { db } = require("./firebaseAdmin.js");

const createManualDeposit = async () => {
  try {
    // Update these values for the manual deposit you want to create
    const userId = "ivr91kuQMeXsrk1t6WR7QDcj7av1"; // From PayMongo checkout log
    const amount = 20000; // From PayMongo checkout log (₱200.00)
    const checkoutId = "cs_o2eq9e1TzvCmLd8E9pqddWr5"; // From PayMongo checkout log

    console.log("🔄 Fetching user details...");
    
    // Get user document to get their name
    const userDoc = await db.collection("users").doc(userId).get();
    
    if (!userDoc.exists) {
      console.error("❌ User not found");
      return;
    }

    const userData = userDoc.data();
    const userName = userData.name || userData.username || "User";

    console.log(`✅ User found: ${userName} (${userId})`);

    // Create deposit record
    const depositRef = db.collection("deposits").doc();
    
    const depositData = {
      userId,
      name: userName,
      amount,
      reference: checkoutId,
      receiptUrl: "",
      status: "Pending",
      paymentMethod: "PayMongo",
      createdAt: new Date(),
    };

    console.log("\n📝 Creating deposit with data:");
    console.log(JSON.stringify(depositData, null, 2));

    await depositRef.set(depositData);

    console.log(`\n✅ DEPOSIT CREATED SUCCESSFULLY!`);
    console.log(`📊 Deposit ID: ${depositRef.id}`);
    console.log(`👤 User: ${userName}`);
    console.log(`💰 Amount: ₱${amount}`);
    console.log(`🔗 Reference: ${checkoutId}`);
    console.log(`📍 Status: Pending`);
    console.log(`\n✨ The deposit is now visible in Admin Dashboard for approval!`);

  } catch (error) {
    console.error("❌ Error creating deposit:", error);
    process.exit(1);
  }
};

createManualDeposit();
