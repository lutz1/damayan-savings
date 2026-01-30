// Check if deposit exists in Firestore
// Usage: node check-deposit.js <depositId>
require('dotenv').config({ path: __dirname + '/.env' });
const { db } = require("./firebaseAdmin.js");

const checkDeposit = async () => {
  try {
    const depositId = process.argv[2] || "vCeHoiQt17FT6TWL4bY3";
    
    console.log(`🔍 Checking deposit: ${depositId}\n`);
    
    const depositDoc = await db.collection("deposits").doc(depositId).get();
    
    if (!depositDoc.exists) {
      console.error("❌ Deposit NOT found in Firestore!");
      return;
    }
    
    const depositData = depositDoc.data();
    console.log("✅ Deposit EXISTS in Firestore:");
    console.log(JSON.stringify(depositData, null, 2));
    
    // Also check for the user
    console.log("\n🔍 Checking user details...");
    const userDoc = await db.collection("users").doc(depositData.userId).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log(`✅ User: ${userData.name || userData.username} (${depositData.userId})`);
      console.log(`💰 Current eWallet: ₱${userData.eWallet || 0}`);
    }
    
    // Check all deposits for this checkout session
    console.log("\n🔍 Searching for all deposits with this checkout ID...");
    const allDeposits = await db.collection("deposits")
      .where("reference", "==", depositData.reference)
      .get();
    
    console.log(`Found ${allDeposits.size} deposit(s) with checkout ID: ${depositData.reference}`);
    allDeposits.forEach((doc) => {
      const data = doc.data();
      console.log(`  - ID: ${doc.id}, Status: ${data.status}, Amount: ₱${data.amount}`);
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkDeposit();
