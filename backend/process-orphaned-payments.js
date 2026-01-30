// Bulk create deposits for all orphaned payments
require('dotenv').config({ path: __dirname + '/.env' });
const { db } = require("./firebaseAdmin.js");

const processOrphanedPayments = async () => {
  try {
    console.log("🔄 Processing orphaned PayMongo payments...\n");

    const metadataSnapshot = await db.collection("paymentMetadata").get();
    const orphaned = metadataSnapshot.docs.filter(doc => !doc.data().depositId);

    console.log(`Found ${orphaned.length} orphaned payments to process\n`);

    if (orphaned.length === 0) {
      console.log("✅ No orphaned payments to process!");
      return;
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const doc of orphaned) {
      const metadataData = doc.data();
      const checkoutId = doc.id;
      const { userId, amount, name } = metadataData;

      try {
        console.log(`Processing: ${checkoutId} (${name} - ₱${amount})...`);

        const depositRef = db.collection("deposits").doc();

        await db.runTransaction(async (transaction) => {
          // Create deposit record
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

          // Update metadata
          transaction.update(db.collection("paymentMetadata").doc(checkoutId), {
            depositId: depositRef.id,
            completedAt: new Date(),
          });
        });

        console.log(`✅ Deposit created: ${depositRef.id}\n`);
        processedCount++;
      } catch (error) {
        console.error(`❌ Error processing ${checkoutId}: ${error.message}\n`);
        errorCount++;
      }
    }

    console.log("\n📊 SUMMARY:");
    console.log(`✅ Processed: ${processedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`\n💡 All deposits are now in "Pending" status for admin approval.`);
  } catch (error) {
    console.error("❌ Fatal error:", error.message);
  }
};

processOrphanedPayments();
