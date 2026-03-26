// Utility for sending and cleaning up notifications
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

// Call this after a successful purchase
export async function sendPurchaseNotification({ userId, codeType }) {
  if (!userId || !codeType) return;
  await addDoc(collection(db, "notifications"), {
    userId,
    title: "Purchase Successful",
    message: `You have successfully purchased a ${codeType} activation code.`,
    type: "purchase",
    createdAt: serverTimestamp(),
    read: false,
  });
}

// Call this after a successful send money transaction
export async function sendTransferNotification({ userId, amount, recipientUsername }) {
  if (!userId) return;
  const safeAmount = Number(amount) || 0;
  const toUser = recipientUsername || "recipient";

  await addDoc(collection(db, "notifications"), {
    userId,
    title: "Transfer Successful",
    message: `You sent ${safeAmount.toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} to ${toUser}.`,
    type: "send-money",
    createdAt: serverTimestamp(),
    read: false,
  });
}

// Call this periodically or after loading notifications
export async function cleanupOldNotifications(userId) {
  if (!userId) return;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("createdAt", "<", oneWeekAgo)
  );
  const snap = await getDocs(q);
  for (const docSnap of snap.docs) {
    await deleteDoc(docSnap.ref);
  }
}
