// Utility to send a notification when there are available referral rewards to transfer
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export async function sendReferralTransferAvailableNotification(userId) {
  if (!userId) return;
  // Check for existing unread referral-transfer notification
  const notifQuery = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("type", "==", "referral-transfer"),
    where("read", "==", false)
  );
  const existing = await getDocs(notifQuery);
  if (!existing.empty) return; // Already exists, do not send duplicate
  await addDoc(collection(db, "notifications"), {
    userId,
    title: "Referral Wallet Transfer Available",
    message: "You have referral rewards ready to transfer to your wallet.",
    type: "referral-transfer",
    createdAt: serverTimestamp(),
    read: false,
  });
}
