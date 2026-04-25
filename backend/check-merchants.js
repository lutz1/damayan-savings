const { db } = require("./firebaseAdmin.js");

async function checkMerchants() {
  try {
    console.log("Fetching all users from Firestore...\n");
    
    // Get all users from the users collection
    const usersSnapshot = await db.collection("users").get();
    
    if (usersSnapshot.empty) {
      console.log("No users found in the collection.");
      return;
    }
    
    // Filter for merchants and collect their data
    let merchants = [];
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userType === "merchant" || data.merchantStatus) {
        merchants.push({
          uid: doc.id,
          name: data.name || "N/A",
          email: data.email || "N/A",
          merchantStatus: data.merchantStatus || "N/A",
          open: data.open !== undefined ? data.open : "N/A",
        });
      }
    });
    
    if (merchants.length === 0) {
      console.log("No merchants found in the users collection.");
      return;
    }
    
    console.log(`Found ${merchants.length} merchant(s):\n`);
    console.log("=".repeat(80));
    merchants.forEach((merchant, index) => {
      console.log(`\n[${index + 1}] UID: ${merchant.uid}`);
      console.log(`    Name: ${merchant.name}`);
      console.log(`    Email: ${merchant.email}`);
      console.log(`    Merchant Status: ${merchant.merchantStatus}`);
      console.log(`    Open: ${merchant.open}`);
    });
    console.log("\n" + "=".repeat(80));
    
    // Update the first merchant
    if (merchants.length > 0) {
      const firstMerchant = merchants[0];
      console.log(`\nEnabling first merchant: ${firstMerchant.name} (${firstMerchant.uid})`);
      
      await db.collection("users").doc(firstMerchant.uid).update({
        merchantStatus: "APPROVED",
        open: true,
      });
      
      console.log("? Successfully updated merchant status to APPROVED and open to true");
      
      // Verify the update
      const updatedDoc = await db.collection("users").doc(firstMerchant.uid).get();
      const updatedData = updatedDoc.data();
      console.log(`\nVerification - Updated values:`);
      console.log(`  Merchant Status: ${updatedData.merchantStatus}`);
      console.log(`  Open: ${updatedData.open}`);
    }
    
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkMerchants().then(() => {
  console.log("\nDone!");
  process.exit(0);
});
