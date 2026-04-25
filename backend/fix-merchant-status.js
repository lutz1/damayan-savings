const admin = require("firebase-admin");
const path = require("path");

// Load service account
const serviceAccountPath = path.join(__dirname, process.env.FIREBASE_KEY_PATH || "./amayan-savings-d7a9e.json");
const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://amayan-savings.firebaseio.com",
});

const db = admin.firestore();

async function fixMerchantStatus() {
  try {
    console.log("🔍 Checking merchants...");

    const merchantsSnap = await db.collection("users").where("role", "==", "MERCHANT").get();

    if (merchantsSnap.empty) {
      console.log("❌ No merchants found");
      return;
    }

    console.log(`✅ Found ${merchantsSnap.size} merchant(s)`);

    for (const doc of merchantsSnap.docs) {
      const merchantData = doc.data();
      console.log(`\n📦 Merchant: ${merchantData.storeName || merchantData.name || doc.id}`);
      console.log(`   - merchantStatus: ${merchantData.merchantStatus || "NOT SET"}`);
      console.log(`   - open: ${merchantData.open || "NOT SET"}`);

      const needsUpdate = 
        merchantData.merchantStatus !== "APPROVED" || 
        merchantData.open !== true;

      if (needsUpdate) {
        console.log(`   ⚠️  Updating merchant...`);
        await doc.ref.update({
          merchantStatus: "APPROVED",
          open: true,
        });
        console.log(`   ✅ Updated successfully`);
      } else {
        console.log(`   ✅ Already correct`);
      }
    }

    console.log("\n✅ All merchants fixed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixMerchantStatus();
