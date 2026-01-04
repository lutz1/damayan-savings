// Utility to send a notification when there are available override rewards to transfer
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export async function sendOverrideTransferAvailableNotification(userId) {
  if (!userId) return;
  // Check for existing unread override-transfer notification
  const notifQuery = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("type", "==", "override-transfer"),
    where("read", "==", false)
  );
  const existing = await getDocs(notifQuery);
  if (!existing.empty) return; // Already exists, do not send duplicate
  await addDoc(collection(db, "notifications"), {
    userId,
    title: "Override Wallet Transfer Available",
    message: "You have override rewards ready to transfer to your wallet.",
    type: "override-transfer",
    createdAt: serverTimestamp(),
    read: false,
  });
}
