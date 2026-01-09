// firebaseAdmin.js
const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
  });
}

module.exports = {
  db: admin.firestore(),
  auth: admin.auth(),
};

module.exports.default = admin;
