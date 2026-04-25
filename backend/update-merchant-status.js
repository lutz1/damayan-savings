const { db } = require('./firebaseAdmin.js');

const MERCHANT_ID = 'JvrXHIOSiLUKU6ySzrccgQ5uG8E2';

async function updateMerchantStatus() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('MERCHANT STATUS UPDATE SCRIPT');
    console.log('='.repeat(80));
    console.log('\nMerchant ID: ' + MERCHANT_ID + '\n');

    // Step 1: Fetch the merchant
    console.log('Step 1: Fetching merchant data...');
    const merchantRef = db.collection('users').doc(MERCHANT_ID);
    const merchantDoc = await merchantRef.get();

    if (!merchantDoc.exists) {
      console.error('\nERROR: Merchant with ID "' + MERCHANT_ID + '" not found!');
      return;
    }

    const merchantData = merchantDoc.data();
    
    // Display BEFORE status
    console.log('\n' + '-'.repeat(80));
    console.log('BEFORE UPDATE - Current Status:');
    console.log('-'.repeat(80));
    console.log('Name: ' + (merchantData.name || 'N/A'));
    console.log('Email: ' + (merchantData.email || 'N/A'));
    console.log('Role: ' + (merchantData.role || 'N/A'));
    console.log('User Type: ' + (merchantData.userType || 'N/A'));
    console.log('Store Name: ' + (merchantData.storeName || 'N/A'));
    console.log('Merchant Status: ' + (merchantData.merchantStatus || 'N/A'));
    console.log('Open: ' + (merchantData.open !== undefined ? merchantData.open : 'N/A'));
    console.log('Phone: ' + (merchantData.phone || 'N/A'));
    console.log('Address: ' + (merchantData.address || 'N/A'));
    console.log('City: ' + (merchantData.city || 'N/A'));
    console.log('Country: ' + (merchantData.country || 'N/A'));
    console.log('Created At: ' + (merchantData.createdAt || 'N/A'));
    
    // Check if update is needed
    const needsUpdate = merchantData.merchantStatus !== 'APPROVED' || merchantData.open !== true;
    
    if (!needsUpdate) {
      console.log('\nMerchant is already APPROVED and OPEN. No update needed.');
      console.log('='.repeat(80) + '\n');
      return;
    }

    // Step 2: Update the merchant
    console.log('\n' + '-'.repeat(80));
    console.log('Step 2: Updating merchant status...');
    console.log('-'.repeat(80));
    
    const updateData = {
      merchantStatus: 'APPROVED',
      open: true
    };
    
    await merchantRef.update(updateData);
    console.log('Update executed successfully!');

    // Step 3: Verify the update
    console.log('\nStep 3: Verifying update...');
    const updatedMerchantDoc = await merchantRef.get();
    const updatedMerchantData = updatedMerchantDoc.data();

    console.log('\n' + '-'.repeat(80));
    console.log('AFTER UPDATE - Verified Status:');
    console.log('-'.repeat(80));
    console.log('Merchant Status: ' + updatedMerchantData.merchantStatus);
    console.log('Open: ' + updatedMerchantData.open);
    
    // Verify both fields are correct
    const statusOk = updatedMerchantData.merchantStatus === 'APPROVED';
    const openOk = updatedMerchantData.open === true;
    
    if (statusOk && openOk) {
      console.log('\nVerification SUCCESSFUL! All fields updated correctly.');
    } else {
      console.log('\nVerification FAILED! Fields were not updated correctly.');
      console.log('   - merchantStatus is APPROVED: ' + statusOk);
      console.log('   - open is true: ' + openOk);
    }

    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

updateMerchantStatus();
