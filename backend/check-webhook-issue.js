// Script to diagnose PayMongo webhook issues
require('dotenv').config({ path: __dirname + '/.env' });
const { db } = require("./firebaseAdmin.js");

const diagnoseWebhookIssue = async () => {
  try {
    console.log("🔍 WEBHOOK DIAGNOSTIC TOOL\n");

    // 1. Check if any paymentMetadata exists
    console.log("📋 Checking paymentMetadata collection...");
    const metadataSnapshot = await db.collection("paymentMetadata").limit(10).get();
    
    if (metadataSnapshot.empty) {
      console.log("❌ No paymentMetadata records found!");
      console.log("   This means payment links weren't created, or they were deleted.\n");
    } else {
      console.log(`✅ Found ${metadataSnapshot.docs.length} paymentMetadata records:\n`);
      metadataSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`   📌 Checkout ID: ${doc.id}`);
        console.log(`      User: ${data.userId}`);
        console.log(`      Amount: ₱${data.amount}`);
        console.log(`      Has depositId: ${!!data.depositId}`);
        console.log(`      Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
        console.log();
      });
    }

    // 2. Check recent deposits
    console.log("\n💰 Checking recent deposits...");
    const depositsSnapshot = await db.collection("deposits")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    if (depositsSnapshot.empty) {
      console.log("❌ No deposits found!");
    } else {
      console.log(`✅ Found ${depositsSnapshot.docs.length} recent deposits:\n`);
      depositsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`   💳 Deposit ID: ${doc.id}`);
        console.log(`      User: ${data.userId}`);
        console.log(`      Amount: ₱${data.amount}`);
        console.log(`      Status: ${data.status}`);
        console.log(`      Reference: ${data.reference}`);
        console.log(`      Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
        console.log();
      });
    }

    // 3. Check if there are any pending payments with no deposits
    console.log("\n⚠️ Checking for orphaned paymentMetadata (no deposit)...");
    const orphanedSnapshot = await db.collection("paymentMetadata").get();
    
    const orphaned = orphanedSnapshot.docs.filter(doc => !doc.data().depositId);

    if (orphaned.length === 0) {
      console.log("✅ No orphaned payments - all payments have deposits");
    } else {
      console.log(`❌ Found ${orphaned.length} orphaned payments (webhook never processed them):\n`);
      orphaned.forEach(doc => {
        const data = doc.data();
        console.log(`   🔴 Checkout ID: ${doc.id}`);
        console.log(`      User: ${data.userId}`);
        console.log(`      Amount: ₱${data.amount}`);
        console.log(`      Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
        console.log(`      ➜ This payment was initiated but deposit was never created!`);
        console.log();
      });
    }

    console.log("\n📌 NEXT STEPS:");
    console.log("1. Check Render logs for '[paymongo-webhook]' messages");
    console.log("2. If webhook logs appear, check for checkout_session_id extraction");
    console.log("3. If no webhook logs, PayMongo may not be configured with the correct URL");
    console.log("4. Your webhook URL must be: https://<your-render-url>/api/paymongo-webhook\n");

  } catch (error) {
    console.error("❌ Diagnostic error:", error.message);
  }
};

diagnoseWebhookIssue();
