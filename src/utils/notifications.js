// Utility for sending and cleaning up notifications
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const getNotificationDateValue = (createdAt) => {
  if (!createdAt) return null;
  if (typeof createdAt?.toDate === "function") return createdAt.toDate();
  if (typeof createdAt?.seconds === "number") return new Date(createdAt.seconds * 1000);
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getNotificationRefsForUser = async (userId, olderThanDate = null) => {
  if (!userId) return [];

  const buildQuery = (field) => {
    const constraints = [where(field, "==", userId)];
    if (olderThanDate) {
      constraints.push(where("createdAt", "<", olderThanDate));
    }
    return query(collection(db, "notifications"), ...constraints);
  };

  const [userSnap, recipientSnap] = await Promise.all([
    getDocs(buildQuery("userId")).catch(() => ({ docs: [] })),
    getDocs(buildQuery("recipientUid")).catch(() => ({ docs: [] })),
  ]);

  const refMap = new Map();
  [...userSnap.docs, ...recipientSnap.docs].forEach((docSnap) => {
    refMap.set(docSnap.id, docSnap.ref);
  });

  return [...refMap.values()];
};

export const isNotificationExpired = (createdAt) => {
  const dateValue = getNotificationDateValue(createdAt);
  if (!dateValue) return false;
  return dateValue.getTime() < Date.now() - ONE_WEEK_MS;
};

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

export async function deleteNotificationById(notificationId) {
  if (!notificationId) return;
  await deleteDoc(doc(db, "notifications", notificationId));
}

export async function deleteAllNotificationsForUser(userId) {
  const refs = await getNotificationRefsForUser(userId);
  await Promise.all(refs.map((ref) => deleteDoc(ref).catch(() => {})));
}

// Call this periodically or after loading notifications
export async function cleanupOldNotifications(userId) {
  if (!userId) return;
  const oneWeekAgo = new Date(Date.now() - ONE_WEEK_MS);
  const refs = await getNotificationRefsForUser(userId, oneWeekAgo);
  await Promise.all(refs.map((ref) => deleteDoc(ref).catch(() => {})));
}
