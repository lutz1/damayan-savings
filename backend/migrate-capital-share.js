// Migrate existing capitalShareEntries to use 25% lock-in logic
const { db } = require("./firebaseAdmin.js");

async function migrateCapitalShareEntries() {
  console.log("[migrate-capital-share] 🔄 Migration started");
  try {
    // Get all capital share entries
    const snapshot = await db.collection("capitalShareEntries").get();
    console.log(`[migrate-capital-share] 📊 Found ${snapshot.docs.length} entries to migrate`);

    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process each entry
    for (const docSnap of snapshot.docs) {
      const entryId = docSnap.id;
      const data = docSnap.data();

      try {
        const amount = data.amount || 0;

        // Calculate 25% lock-in
        const newLockInPortion = amount * 0.25;
        const newTransferablePortion = amount - newLockInPortion;

        // Check if update is needed
        const lockInNeedsUpdate =
          !data.lockInPortion || data.lockInPortion !== newLockInPortion;
        const transferableNeedsUpdate =
          !data.transferablePortion ||
          data.transferablePortion !== newTransferablePortion;

        if (lockInNeedsUpdate || transferableNeedsUpdate) {
          // Update the entry
          await db.collection("capitalShareEntries").doc(entryId).update({
            lockInPortion: newLockInPortion,
            transferablePortion: newTransferablePortion,
            updatedAt: new Date(),
          });

          console.log(
            `[migrate-capital-share] ✅ Updated entry ${entryId}: amount=₱${amount} lockIn=₱${newLockInPortion} transferable=₱${newTransferablePortion}`
          );
          updatedCount++;
        } else {
          console.log(`[migrate-capital-share] ⏭️ Entry ${entryId} already correct`);
          skippedCount++;
        }
      } catch (error) {
        errors.push(`Entry ${entryId}: ${error.message}`);
        console.error(`[migrate-capital-share] ❌ Error for entry ${entryId}:`, error);
      }
    }

    console.info(
      `[migrate-capital-share] ✅ MIGRATION COMPLETE - updated=${updatedCount} skipped=${skippedCount} errors=${errors.length}`
    );

    if (errors.length > 0) {
      console.error("[migrate-capital-share] Error details:");
      errors.forEach((err) => console.error(`  - ${err}`));
    }

    return {
      success: true,
      summary: {
        totalEntries: snapshot.docs.length,
        entriesUpdated: updatedCount,
        entriesSkipped: skippedCount,
        errors: errors.length > 0 ? errors : [],
      },
    };
  } catch (error) {
    console.error("[migrate-capital-share] ❌ Migration error:", error);
    throw error;
  }
}

// Run migration
migrateCapitalShareEntries()
  .then((result) => {
    console.log("\n=== MIGRATION RESULTS ===");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
