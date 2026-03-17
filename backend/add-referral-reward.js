// Referral Reward Script - System Bonus
// Usage: node add-referral-reward.js
require('dotenv').config({ path: __dirname + '/.env' });
const { db } = require("./firebaseAdmin.js");

const addReferralReward = async () => {
  try {
    // Referral reward configuration
    const userEmail = "monares.cyriljay@gmail.com";
    const rewardAmount = 50;
    const rewardType = "System Bonus";
    const source = "System";

    console.log("🎁 Processing referral reward...");
    console.log(`📧 User Email: ${userEmail}`);
    console.log(`💰 Reward Amount: ₱${rewardAmount}`);
    console.log(`📝 Type: ${rewardType}\n`);

    // Find user by email
    console.log("🔍 Searching for user...");
    const usersSnapshot = await db.collection("users")
      .where("email", "==", userEmail)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.error("❌ User not found with email:", userEmail);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log(`✅ User found: ${userData.name} (${userId})`);
    console.log(`📊 Username: ${userData.username}`);
    console.log(`🎯 Role: ${userData.role}\n`);

    // Create referral reward document
    const rewardRef = db.collection("referralReward").doc();
    await rewardRef.set({
      userId,
      username: userData.username,
      role: userData.role,
      amount: rewardAmount,
      source,
      type: rewardType,
      approved: true,
      payoutReleased: true,
      createdAt: new Date(),
    });

    console.log(`✅ REFERRAL REWARD CREATED!`);
    console.log(`📊 Reward ID: ${rewardRef.id}`);
    console.log(`👤 User: ${userData.name} (${userData.username})`);
    console.log(`💰 Reward Amount: ₱${rewardAmount}`);
    console.log(`📝 Type: ${rewardType}`);
    console.log(`🔗 Source: ${source}`);
    console.log(`✨ Status: Approved & Ready to Claim`);
    console.log(`\n🎉 The referral reward is now visible in the user's rewards dashboard!`);

  } catch (error) {
    console.error("❌ Error processing referral reward:", error);
    process.exit(1);
  }
};

addReferralReward();
