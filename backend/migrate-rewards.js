const admin = require('firebase-admin');
require('dotenv').config();

const cert = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
};

admin.initializeApp({
  credential: admin.credential.cert(cert)
});

const db = admin.firestore();

async function migratePaybackRewards() {
  console.log('[migrate-rewards] 🔄 Migration started');
  
  try {
    const paybackSnapshot = await db.collection('paybackEntries').get();
    console.log(`[migrate-rewards] 📊 Found ${paybackSnapshot.docs.length} payback entries`);

    let createdCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const paybackDoc of paybackSnapshot.docs) {
      const paybackData = paybackDoc.data();
      const paybackId = paybackDoc.id;

      try {
        // Check if uplineReward already exists
        const existingReward = await db
          .collection('uplineRewards')
          .where('paybackEntryId', '==', paybackId)
          .limit(1)
          .get();

        if (!existingReward.empty) {
          console.log(`[migrate-rewards] ⏭️ Reward exists for payback ${paybackId}`);
          skippedCount++;
          continue;
        }

        // Get upline user data
        const uplineQuery = await db
          .collection('users')
          .where('username', '==', paybackData.uplineUsername)
          .limit(1)
          .get();

        if (uplineQuery.empty) {
          errors.push(`Upline "${paybackData.uplineUsername}" not found for payback ${paybackId}`);
          skippedCount++;
          continue;
        }

        const uplineId = uplineQuery.docs[0].id;
        const uplineUsername = paybackData.uplineUsername;
        const expirationDate = paybackData.expirationDate || new Date(paybackData.createdAt.toDate().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Create uplineReward
        const uplineRewardRef = db.collection('uplineRewards').doc();
        await uplineRewardRef.set({
          uplineId,
          uplineUsername,
          fromUserId: paybackData.userId,
          paybackEntryId: paybackId,
          amount: 65,
          currency: 'PHP',
          status: 'Pending',
          dueDate: expirationDate,
          claimed: false,
          createdAt: paybackData.createdAt,
        });

        console.log(`[migrate-rewards] ✅ Created reward for payback ${paybackId} (upline: ${uplineUsername}, dueDate: ${expirationDate})`);
        createdCount++;
      } catch (error) {
        errors.push(`Error processing payback ${paybackId}: ${error.message}`);
        console.error(`[migrate-rewards] ❌ Error for payback ${paybackId}:`, error);
      }
    }

    console.info(
      `[migrate-rewards] ✅ MIGRATION COMPLETE - created=${createdCount} skipped=${skippedCount} errors=${errors.length}`
    );
    console.log('\nMigration Summary:');
    console.log(`  Total payback entries: ${paybackSnapshot.docs.length}`);
    console.log(`  Rewards created: ${createdCount}`);
    console.log(`  Rewards skipped: ${skippedCount}`);
    if (errors.length > 0) {
      console.log(`  Errors: ${errors.length}`);
      errors.forEach(e => console.log(`    - ${e}`));
    }

  } catch (error) {
    console.error('[migrate-rewards] ❌ Migration error:', error);
  } finally {
    admin.app().delete();
    process.exit(0);
  }
}

migratePaybackRewards();
