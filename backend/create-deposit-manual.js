// Manual Deposit Creation Script
// Usage: node create-deposit-manual.js
require('dotenv').config({ path: __dirname + '/.env' });
const { db } = require("./firebaseAdmin.js");

const createManualDeposit = async () => {
  try {
    // Update these values for the manual deposit you want to create
    const userId = "gvsQlCZECiMcaUtiq0F3lDP9MJq1"; // From PayMongo checkout log
    const amount = 300; // From PayMongo checkout log (₱3.00)
    const checkoutId = "cs_9f7c04312cf613f9f3d00d3a"; // From PayMongo checkout log

    console.log("🔄 Fetching user details...");
    
    // Get user document to get their name
    const userDoc = await db.collection("users").doc(userId).get();
    
    if (!userDoc.exists) {
      console.error("❌ User not found");
      return;
    }

    const userData = userDoc.data();
    const userName = userData.name || userData.username || "User";
    const userEmail = userData.email || "user@damayan.com";

    console.log(`✅ User found: ${userName} (${userId})`);

    // Check if deposit already exists
    console.log("🔍 Checking if deposit already exists for this checkout...");
    const existingDeposit = await db
      .collection("deposits")
      .where("reference", "==", checkoutId)
      .limit(1)
      .get();

    if (!existingDeposit.empty) {
      console.warn("⚠️  Deposit already exists for this checkout!");
      console.log(`   Deposit ID: ${existingDeposit.docs[0].id}`);
      console.log(`   Status: ${existingDeposit.docs[0].data().status}`);
      return;
    }
    console.log("   ✅ No existing deposit found.");

    // Create deposit record
    const depositRef = db.collection("deposits").doc();
    const metadataRef = db.collection("paymentMetadata").doc(checkoutId);
    
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

    await db.runTransaction(async (transaction) => {
      // Read metadata first (all reads before writes)
      const metadataDoc = await transaction.get(metadataRef);
      
      // Create deposit record
      transaction.set(depositRef, depositData);

      // Update or create payment metadata
      if (metadataDoc.exists) {
        transaction.update(metadataRef, {
          depositId: depositRef.id,
          completedAt: new Date(),
        });
      } else {
        transaction.set(metadataRef, {
          userId,
          amount,
          currency: "PHP",
          checkoutId,
          email: userEmail,
          name: userName,
          createdAt: new Date(),
          depositId: depositRef.id,
          completedAt: new Date(),
        });
      }
    });

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
