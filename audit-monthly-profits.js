/**
 * AUDIT & FIX: Monthly Profit Transfer Deduplication
 * 
 * This script:
 * 1. Finds all "Monthly Profit Transfer" deposits
 * 2. Traces back to capitalShareEntries to verify consistency
 * 3. Detects duplicates and mismatches
 * 4. Ensures profitStatus="Claimed" and profit=0 for all claimed entries
 * 5. Generates a detailed report per user
 * 
 * Usage: node audit-monthly-profits.js [--fix]
 * Add --fix flag to automatically correct issues
 */

const admin = require('firebase-admin');
const path = require('path');

// Try to load from backend folder
let serviceAccount;
try {
  serviceAccount = require('./backend/firebaseAdmin.js');
} catch (e) {
  try {
    serviceAccount = require('./firebaseAdmin.js');
  } catch (e2) {
    console.error('❌ Cannot find firebaseAdmin.js');
    process.exit(1);
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

class ProfitAuditor {
  constructor(shouldFix = false) {
    this.shouldFix = shouldFix;
    this.userReports = {};
    this.stats = {
      totalUsers: 0,
      totalDeposits: 0,
      duplicates: 0,
      mismatches: 0,
      fixed: 0,
    };
  }

  async run() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 MONTHLY PROFIT TRANSFER AUDIT & DEDUPLICATION');
    console.log('='.repeat(80));
    console.log(`Mode: ${this.shouldFix ? '✅ FIX MODE' : '📋 AUDIT MODE (read-only)'}\n`);

    try {
      // 1. Get all Monthly Profit Transfer deposits
      const deposits = await this.getAllProfitDeposits();
      console.log(`📊 Found ${deposits.length} Monthly Profit Transfer deposits\n`);

      // 2. Group by user
      const depositsByUser = this.groupDepositsByUser(deposits);
      console.log(`👥 Found ${Object.keys(depositsByUser).length} users with profit deposits\n`);

      this.stats.totalUsers = Object.keys(depositsByUser).length;
      this.stats.totalDeposits = deposits.length;

      // 3. Audit each user
      for (const [userId, userDeposits] of Object.entries(depositsByUser)) {
        await this.auditUser(userId, userDeposits);
      }

      // 4. Print report
      this.printReport();
    } catch (err) {
      console.error('❌ Error:', err);
    }

    process.exit(0);
  }

  async getAllProfitDeposits() {
    const snap = await db
      .collection('deposits')
      .where('type', '==', 'Monthly Profit Transfer')
      .get();

    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  groupDepositsByUser(deposits) {
    return deposits.reduce((acc, deposit) => {
      const userId = deposit.userId;
      if (!acc[userId]) acc[userId] = [];
      acc[userId].push(deposit);
      return acc;
    }, {});
  }

  async auditUser(userId, deposits) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`👤 User: ${userId}`);
    console.log(`${'─'.repeat(80)}`);

    const userReport = {
      userId,
      deposits: [],
      entries: {},
      issues: [],
      totalClaimedProfit: 0,
      totalFromEntries: 0,
    };

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log('❌ User not found in database');
      return;
    }

    console.log(`E-Wallet Balance: ₱${Number(userDoc.data().eWallet || 0).toLocaleString()}\n`);

    // Get all capital share entries
    const entriesSnap = await db
      .collection('capitalShareEntries')
      .where('userId', '==', userId)
      .get();

    const entries = {};
    entriesSnap.forEach(doc => {
      const data = doc.data();
      entries[doc.id] = {
        id: doc.id,
        amount: Number(data.amount || 0),
        profit: Number(data.profit || 0),
        profitStatus: data.profitStatus || 'Unknown',
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        lockInPortion: Number(data.lockInPortion || 0),
      };
    });

    userReport.entries = entries;
    console.log(`📋 Found ${deposits.length} profit deposits\n`);

    // Analyze deposits
    const entryClaimMap = {}; // Track claims per entry
    let totalClaimedFromDeposits = 0;

    for (const deposit of deposits) {
      const sourceEntryId = deposit.sourceEntryId;
      const claimedAmount = Number(deposit.amount || 0);
      const depositDate = deposit.createdAt?.toDate?.() || new Date(deposit.createdAt);

      userReport.deposits.push({
        id: deposit.id,
        sourceEntryId,
        amount: claimedAmount,
        status: deposit.status,
        createdAt: depositDate,
      });

      totalClaimedFromDeposits += claimedAmount;

      // Track claims per entry
      if (!entryClaimMap[sourceEntryId]) {
        entryClaimMap[sourceEntryId] = [];
      }
      entryClaimMap[sourceEntryId].push({
        depositId: deposit.id,
        amount: claimedAmount,
        date: depositDate,
      });

      console.log(`Deposit: ${deposit.id}`);
      console.log(`  Source Entry: ${sourceEntryId}`);
      console.log(`  Amount: ₱${claimedAmount.toLocaleString()}`);
      console.log(`  Status: ${deposit.status}`);
      console.log(`  Created: ${depositDate.toLocaleDateString()} ${depositDate.toLocaleTimeString()}`);

      // Verify source entry exists and has correct status
      if (sourceEntryId && entries[sourceEntryId]) {
        const entry = entries[sourceEntryId];
        console.log(`  ✓ Entry exists: Capital ₱${entry.amount.toLocaleString()}, Status: ${entry.profitStatus}`);

        // Check for mismatches
        if (entry.profitStatus !== 'Claimed') {
          console.log(`  ⚠️  MISMATCH: Entry status is "${entry.profitStatus}", expected "Claimed"`);
          userReport.issues.push({
            type: 'STATUS_MISMATCH',
            depositId: deposit.id,
            entryId: sourceEntryId,
            expected: 'Claimed',
            actual: entry.profitStatus,
          });
          this.stats.mismatches++;

          // Fix if requested
          if (this.shouldFix) {
            await this.fixEntryStatus(sourceEntryId, 'Claimed');
            console.log(`  ✅ FIXED: Set entry status to "Claimed"`);
          }
        }

        if (entry.profit !== 0) {
          console.log(`  ⚠️  MISMATCH: Entry profit is ₱${entry.profit.toLocaleString()}, expected 0`);
          userReport.issues.push({
            type: 'PROFIT_NOT_ZERO',
            depositId: deposit.id,
            entryId: sourceEntryId,
            expected: 0,
            actual: entry.profit,
          });
          this.stats.mismatches++;

          // Fix if requested
          if (this.shouldFix) {
            await this.fixEntryProfit(sourceEntryId, 0);
            console.log(`  ✅ FIXED: Reset entry profit to 0`);
            this.stats.fixed++;
          }
        }
      } else {
        console.log(`  ❌ ERROR: Entry not found!`);
        userReport.issues.push({
          type: 'MISSING_ENTRY',
          depositId: deposit.id,
          entryId: sourceEntryId,
        });
      }

      console.log('');
    }

    // Check for duplicate claims on same entry
    console.log(`🔍 Checking for duplicate claims...\n`);
    for (const [entryId, claims] of Object.entries(entryClaimMap)) {
      if (claims.length > 1) {
        console.log(`⚠️  DUPLICATE FOUND: Entry ${entryId} has ${claims.length} claims`);
        claims.forEach((claim, idx) => {
          console.log(`   Claim #${idx + 1}: ₱${claim.amount.toLocaleString()} on ${claim.date.toLocaleDateString()}`);
        });
        console.log(`   Total claimed: ₱${claims.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}\n`);
        this.stats.duplicates++;

        userReport.issues.push({
          type: 'DUPLICATE_CLAIMS',
          entryId,
          claimCount: claims.length,
          totalClaimed: claims.reduce((sum, c) => sum + c.amount, 0),
        });
      }
    }

    // Summary for user
    console.log(`${'─'.repeat(80)}`);
    console.log('📊 USER SUMMARY:');
    console.log(`  Capital Share Entries: ${Object.keys(entries).length}`);
    console.log(`  Profit Deposits: ${deposits.length}`);
    console.log(`  Total Claimed from Deposits: ₱${totalClaimedFromDeposits.toLocaleString()}`);

    let totalProfitFromEntries = 0;
    for (const entry of Object.values(entries)) {
      if (entry.profitStatus === 'Claimed') {
        totalProfitFromEntries += entry.profit;
      }
    }
    console.log(`  Total Profit in Claimed Entries: ₱${totalProfitFromEntries.toLocaleString()}`);

    if (userReport.issues.length > 0) {
      console.log(`\n  🚨 Issues Found: ${userReport.issues.length}`);
      userReport.issues.forEach(issue => {
        if (issue.type === 'STATUS_MISMATCH') {
          console.log(`     • Entry ${issue.entryId}: Status is "${issue.actual}", should be "${issue.expected}"`);
        } else if (issue.type === 'PROFIT_NOT_ZERO') {
          console.log(`     • Entry ${issue.entryId}: Profit is ₱${issue.actual.toLocaleString()}, should be 0`);
        } else if (issue.type === 'DUPLICATE_CLAIMS') {
          console.log(`     • Entry ${issue.entryId}: ${issue.claimCount} duplicate claims totaling ₱${issue.totalClaimed.toLocaleString()}`);
        } else if (issue.type === 'MISSING_ENTRY') {
          console.log(`     • Deposit ${issue.depositId}: References non-existent entry`);
        }
      });
    } else {
      console.log(`\n  ✅ No issues found`);
    }

    userReport.totalClaimedProfit = totalClaimedFromDeposits;
    userReport.totalFromEntries = totalProfitFromEntries;
    this.userReports[userId] = userReport;
  }

  async fixEntryStatus(entryId, newStatus) {
    await db.collection('capitalShareEntries').doc(entryId).update({
      profitStatus: newStatus,
    });
  }

  async fixEntryProfit(entryId, newProfit) {
    await db.collection('capitalShareEntries').doc(entryId).update({
      profit: newProfit,
    });
  }

  printReport() {
    console.log('\n\n' + '='.repeat(80));
    console.log('📈 AUDIT REPORT SUMMARY');
    console.log('='.repeat(80) + '\n');

    console.log('Overall Statistics:');
    console.log(`  Total Users: ${this.stats.totalUsers}`);
    console.log(`  Total Profit Deposits: ${this.stats.totalDeposits}`);
    console.log(`  Duplicate Claims: ${this.stats.duplicates}`);
    console.log(`  Mismatches Found: ${this.stats.mismatches}`);
    console.log(`  Items Fixed: ${this.stats.fixed}\n`);

    const usersWithIssues = Object.values(this.userReports).filter(r => r.issues.length > 0);
    if (usersWithIssues.length > 0) {
      console.log(`\n⚠️  Users with Issues: ${usersWithIssues.length}\n`);
      usersWithIssues.forEach(report => {
        console.log(`  User: ${report.userId}`);
        console.log(`    Issues: ${report.issues.length}`);
        console.log(`    Total Claimed: ₱${report.totalClaimedProfit.toLocaleString()}`);
        console.log(`    Profit in Entries: ₱${report.totalFromEntries.toLocaleString()}`);
        if (report.totalClaimedProfit !== report.totalFromEntries) {
          console.log(`    ⚠️  Discrepancy: ₱${Math.abs(report.totalClaimedProfit - report.totalFromEntries).toLocaleString()}`);
        }
        console.log('');
      });
    } else {
      console.log('✅ No issues found. All users have consistent profit calculations!');
    }

    if (this.shouldFix) {
      console.log(`\n✅ Fixed ${this.stats.fixed} issues`);
    } else {
      console.log(`\n💡 Run with --fix flag to automatically correct ${this.stats.mismatches} mismatches`);
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Main
const shouldFix = process.argv.includes('--fix');
const auditor = new ProfitAuditor(shouldFix);
auditor.run();
