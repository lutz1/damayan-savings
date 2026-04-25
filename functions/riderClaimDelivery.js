const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();
const FIELD_VALUE = admin.firestore.FieldValue;
const TIMESTAMP = admin.firestore.Timestamp;

const DELIVERY_STATUS = {
  NEW: "NEW",
  ASSIGNED: "ASSIGNED",
  ACCEPTED: "ACCEPTED",
  RIDER_PICKUP: "RIDER_PICKUP",
  ARRIVED_MERCHANT: "ARRIVED_MERCHANT",
  ORDER_PICKED_UP: "ORDER_PICKED_UP",
  IN_DELIVERY: "IN_DELIVERY",
  ARRIVED_CUSTOMER: "ARRIVED_CUSTOMER",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

const ORDER_STATUS = {
  NEW: "NEW",
  ASSIGNED: "ASSIGNED",
  ACCEPTED: "ACCEPTED",
  PREPARING: "PREPARING",
  READY_FOR_PICKUP: "READY_FOR_PICKUP",
  IN_DELIVERY: "IN_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

// Rider claims a delivery (first-to-accept wins)
exports.riderClaimDelivery = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required");
  }
  const riderId = context.auth.uid;
  const deliveryId = String(data?.deliveryId || "").trim();
  if (!deliveryId) {
    throw new functions.https.HttpsError("invalid-argument", "deliveryId is required");
  }
  const deliveryRef = db.collection("deliveries").doc(deliveryId);
  const deliverySnap = await deliveryRef.get();
  if (!deliverySnap.exists) {
    throw new functions.https.HttpsError("not-found", "Delivery not found");
  }
  const delivery = deliverySnap.data();
  if (delivery.status !== DELIVERY_STATUS.ASSIGNED || delivery.riderId) {
    return { success: false, error: "Job already taken" };
  }
  // Check if rider is a candidate
  const candidateRiderIds = Array.isArray(delivery.candidateRiderIds) ? delivery.candidateRiderIds.filter(Boolean) : [];
  if (!candidateRiderIds.includes(riderId)) {
    throw new functions.https.HttpsError("permission-denied", "Not a candidate for this delivery");
  }
  // Transaction: assign rider if still available
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(deliveryRef);
    const d = snap.data();
    if (d.status !== DELIVERY_STATUS.ASSIGNED || d.riderId) {
      throw new functions.https.HttpsError("failed-precondition", "Job already taken");
    }
    transaction.update(deliveryRef, {
      riderId,
      status: DELIVERY_STATUS.ACCEPTED,
      acceptedAt: FIELD_VALUE.serverTimestamp(),
      dispatchStatus: "ACCEPTED",
      updatedAt: FIELD_VALUE.serverTimestamp(),
    });
    // Update order or sale
    const orderId = d.orderId;
    if (orderId) {
      const orderRef = db.collection("orders").doc(orderId);
      transaction.update(orderRef, {
        riderId,
        status: ORDER_STATUS.ACCEPTED,
        updatedAt: FIELD_VALUE.serverTimestamp(),
      });
    }
    const saleId = d.saleId;
    if (saleId) {
      const saleRef = db.collection("sales").doc(saleId);
      transaction.update(saleRef, {
        riderId,
        status: ORDER_STATUS.ACCEPTED,
        updatedAt: FIELD_VALUE.serverTimestamp(),
      });
    }
  });
  return { success: true, riderId };
});
