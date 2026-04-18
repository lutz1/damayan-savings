/**
 * DEBUG: Capital Share Profit Calculation Diagnostic
 * Usage: node debug-capital-share.js <userId>
 * 
 * This script helps identify discrepancies in capital share profit calculations
 * by comparing:
 * 1. Capital share entries and their profit statuses
 * 2. Claimed profit deposits in e-wallet history
 * 3. Expected vs actual unclaimed profit
 */

const admin = require('firebase-admin');
const serviceAccount = require('./firebaseAdmin.js');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function analyzeCapitalShareData(userId) {
  console.log('\n' + '='.repeat(70));
  console.log(`CAPITAL SHARE DIAGNOSTIC FOR: ${userId}`);
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Fetch all capital share entries
    const entriesSnap = await db
      .collection('capitalShareEntries')
      .where('userId', '==', userId)
      .get();

    console.log(`📊 Found ${entriesSnap.size} capital share entries\n`);

    let totalCapital = 0;
    let totalUnclaimedProfit = 0;
    let totalClaimedProfit = 0;
    const entries = [];

    entriesSnap.forEach((doc) => {
      const data = doc.data();
      entries.push({ id: doc.id, ...data });

      const amount = Number(data.amount || 0);
      const profit = Number(data.profit || 0);
      const status = data.profitStatus || 'Unknown';

      totalCapital += amount;
      if (status === 'Claimed') {
        totalClaimedProfit += profit;
      } else {
        totalUnclaimedProfit += profit;
      }

      console.log(`Entry ID: ${doc.id}`);
      console.log(`  Capital: ₱${amount.toLocaleString()}`);
      console.log(`  Profit: ₱${profit.toLocaleString()}`);
      console.log(`  Status: ${status}`);
      console.log(`  Created: ${data.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}`);
      console.log(`  NextProfit: ${data.nextProfitDate?.toDate?.()?.toLocaleDateString() || 'Unknown'}`);
      console.log(`  LockIn: ₱${(data.lockInPortion || 0).toLocaleString()}`);
      console.log('');
    });

    console.log('─'.repeat(70));
    console.log('💰 CAPITAL SHARE SUMMARY:');
    console.log(`  Total Capital: ₱${totalCapital.toLocaleString()}`);
    console.log(`  Total Unclaimed Profit: ₱${totalUnclaimedProfit.toLocaleString()}`);
    console.log(`  Total Claimed Profit: ₱${totalClaimedProfit.toLocaleString()}`);
    console.log('─'.repeat(70) + '\n');

    // 2. Fetch claimed profit deposits
    const depositsSnap = await db
      .collection('deposits')
      .where('userId', '==', userId)
      .where('type', '==', 'Monthly Profit Transfer')
      .get();

    console.log(`📈 Found ${depositsSnap.size} "Monthly Profit Transfer" deposits\n`);

    let totalDepositedProfit = 0;
    const deposits = [];

    depositsSnap.forEach((doc) => {
      const data = doc.data();
      deposits.push({ id: doc.id, ...data });

      const amount = Number(data.amount || 0);
      totalDepositedProfit += amount;

      console.log(`Deposit ID: ${doc.id}`);
      console.log(`  Amount: ₱${amount.toLocaleString()}`);
      console.log(`  Status: ${data.status || 'Unknown'}`);
      console.log(`  Created: ${data.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}`);
      console.log(`  Source Entry: ${data.sourceEntryId || 'Unknown'}`);
      console.log('');
    });

    console.log('─'.repeat(70));
    console.log('✅ CLAIMED PROFIT DEPOSITS:');
    console.log(`  Total Deposited from Claimed Profits: ₱${totalDepositedProfit.toLocaleString()}`);
    console.log('─'.repeat(70) + '\n');

    // 3. Calculate expected profit
    const now = new Date();
    let expectedTotalProfit = 0;

    console.log('🔍 EXPECTED PROFIT CALCULATION:\n');

    entries.forEach((entry) => {
      const createdAt = entry.createdAt?.toDate?.() || new Date(entry.createdAt);
      const amount = Number(entry.amount || 0);
      const lockInPortion = Number(entry.lockInPortion || 0);
      const nextProfitDate = entry.nextProfitDate?.toDate?.() || new Date(entry.nextProfitDate);

      // Only calculate for non-claimed, active entries
      const expireDate = new Date(createdAt);
      expireDate.setFullYear(expireDate.getFullYear() + 1);

      const isActive = now <= expireDate && nextProfitDate <= now;
      const isUnclaimed = (entry.profitStatus || 'Pending') !== 'Claimed';

      if (isActive && isUnclaimed) {
        // Calculate months due since nextProfitDate
        const monthsDiff = Math.floor((now - nextProfitDate) / (1000 * 60 * 60 * 24 * 30));
        const profitBase = lockInPortion > 0 ? lockInPortion : amount;
        const expectedProfit = profitBase * 0.05 * Math.max(monthsDiff, 0);

        console.log(`Entry: ${entry.id}`);
        console.log(`  Capital: ₱${amount.toLocaleString()}`);
        console.log(`  Profit Base: ₱${profitBase.toLocaleString()}`);
        console.log(`  Months Due: ${monthsDiff}`);
        console.log(`  Expected Profit: ₱${expectedProfit.toLocaleString()}`);
        console.log(`  Actual Stored: ₱${Number(entry.profit || 0).toLocaleString()}`);
        console.log('');

        expectedTotalProfit += expectedProfit;
      } else if (!isActive) {
        console.log(`Entry ${entry.id}: EXPIRED (created ${createdAt.toLocaleDateString()})`);
      } else if (!isUnclaimed) {
        console.log(`Entry ${entry.id}: Already CLAIMED`);
      } else {
        console.log(`Entry ${entry.id}: Not yet due (${nextProfitDate.toLocaleDateString()})`);
      }
    });

    console.log('\n' + '─'.repeat(70));
    console.log('🚨 DISCREPANCY ANALYSIS:');
    console.log(`  Unclaimed Profit (from entries): ₱${totalUnclaimedProfit.toLocaleString()}`);
    console.log(`  Expected Profit: ₱${Math.round(expectedTotalProfit).toLocaleString()}`);
    console.log(`  Difference: ₱${Math.round(totalUnclaimedProfit - expectedTotalProfit).toLocaleString()}`);
    console.log('─'.repeat(70) + '\n');

    if (totalUnclaimedProfit !== Math.round(expectedTotalProfit)) {
      console.log('⚠️  POSSIBLE BUG DETECTED!');
      console.log('The unclaimed profit does not match expected calculation.');
      console.log('This could indicate claimed profits being recalculated.\n');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }

  process.exit(0);
}

// Get userId from command line argument
const userId = process.argv[2];
if (!userId) {
  console.log('Usage: node debug-capital-share.js <userId>');
  console.log('Example: node debug-capital-share.js "abc123xyz"');
  process.exit(1);
}

analyzeCapitalShareData(userId);
