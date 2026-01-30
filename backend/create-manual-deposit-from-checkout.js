#!/usr/bin/env node
/**
 * Manual Deposit Creation from PayMongo Checkout
 * Creates a deposit record for a checkout session that didn't trigger webhook properly
 * 
 * Usage: node create-manual-deposit-from-checkout.js <userId> <amount> <checkoutId> [name] [email]
 */

const { db, auth } = require("./firebaseAdmin.js");

async function createManualDeposit() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error("❌ Usage: node create-manual-deposit-from-checkout.js <userId> <amount> <checkoutId> [name] [email]");
    console.error("");
    console.error("Example:");
    console.error("  node create-manual-deposit-from-checkout.js 5NdiaxtLMpg3YJObcTY8rPQQEdf2 1000 cs_zzAxYLUfUknPncXqNeGLNyNn");
    process.exit(1);
  }

  const userId = args[0];
  const amount = parseFloat(args[1]);
  const checkoutId = args[2];
  const name = args[3] || "Damayan Savings";
  const email = args[4] || "user@damayan.com";

  if (isNaN(amount) || amount <= 0) {
    console.error("❌ Invalid amount. Must be a positive number.");
    process.exit(1);
  }

  try {
    console.log("🔄 Starting manual deposit creation...");
    console.log(`   User ID: ${userId}`);
    console.log(`   Amount: ₱${amount}`);
    console.log(`   Checkout ID: ${checkoutId}`);
    console.log(`   Name: ${name}`);
    console.log(`   Email: ${email}`);
    console.log("");

    // Verify user exists
    console.log("🔍 Verifying user exists...");
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error("❌ User not found!");
      process.exit(1);
    }
    const userData = userDoc.data();
    console.log(`   ✅ User found: ${userData.username} (${userData.email})`);
    console.log("");

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
      process.exit(0);
    }
    console.log("   ✅ No existing deposit found.");
    console.log("");

    // Create the deposit
    console.log("💾 Creating deposit record...");
    const depositRef = db.collection("deposits").doc();
    
    await db.runTransaction(async (transaction) => {
      // Create deposit record with Pending status
      transaction.set(depositRef, {
        userId,
        name,
        amount,
        reference: checkoutId,
        receiptUrl: "",
        status: "Pending",
        paymentMethod: "PayMongo",
        createdAt: new Date(),
      });

      // Update payment metadata if it exists
      const metadataDoc = await db.collection("paymentMetadata").doc(checkoutId).get();
      if (metadataDoc.exists) {
        transaction.update(db.collection("paymentMetadata").doc(checkoutId), {
          depositId: depositRef.id,
          completedAt: new Date(),
        });
      } else {
        // Create payment metadata if it doesn't exist
        transaction.set(db.collection("paymentMetadata").doc(checkoutId), {
          userId,
          amount,
          currency: "PHP",
          checkoutId,
          email,
          name,
          createdAt: new Date(),
          depositId: depositRef.id,
          completedAt: new Date(),
        });
      }
    });

    console.log("   ✅ Deposit created successfully!");
    console.log("");
    console.log("📋 Deposit Details:");
    console.log(`   Deposit ID: ${depositRef.id}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Amount: ₱${amount}`);
    console.log(`   Status: Pending (awaiting admin approval)`);
    console.log(`   Reference: ${checkoutId}`);
    console.log(`   Created At: ${new Date().toISOString()}`);
    console.log("");
    console.log("✅ DEPOSIT CREATED - Awaiting admin approval");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

createManualDeposit();
