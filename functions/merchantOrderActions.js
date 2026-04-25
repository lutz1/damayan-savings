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

// Accept order by merchant, assign rider and update status
exports.merchantAcceptOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required");
  }

  const merchantId = context.auth.uid;
  const orderId = String(data?.orderId || "").trim();
  if (!orderId) {
    throw new functions.https.HttpsError("invalid-argument", "orderId is required");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Order not found");
  }
  const orderData = orderSnap.data();
  if (orderData.merchantId !== merchantId) {
    throw new functions.https.HttpsError("permission-denied", "Not your order");
  }
  if (orderData.status !== ORDER_STATUS.NEW) {
    throw new functions.https.HttpsError("failed-precondition", "Order is not NEW");
  }

  // Find delivery doc
  const deliveryId = orderData.deliveryId;
  if (!deliveryId) {
    throw new functions.https.HttpsError("not-found", "Delivery not found");
  }
  const deliveryRef = db.collection("deliveries").doc(deliveryId);
  const deliverySnap = await deliveryRef.get();
  if (!deliverySnap.exists) {
    throw new functions.https.HttpsError("not-found", "Delivery not found");
  }
  const deliveryData = deliverySnap.data();
  const candidateRiderIds = Array.isArray(deliveryData.candidateRiderIds) ? deliveryData.candidateRiderIds.filter(Boolean) : [];
  if (candidateRiderIds.length === 0) {
    throw new functions.https.HttpsError("failed-precondition", "No available riders");
  }
  const assignmentExpiresAt = TIMESTAMP.fromMillis(Date.now() + 10000); // 10 seconds

  await db.runTransaction(async (transaction) => {
    transaction.update(orderRef, {
      status: ORDER_STATUS.ASSIGNED,
      riderId: null, // No rider assigned yet
      dispatchStatus: "ASSIGNED",
      updatedAt: FIELD_VALUE.serverTimestamp(),
    });
    transaction.update(deliveryRef, {
      status: DELIVERY_STATUS.ASSIGNED,
      riderId: null, // No rider assigned yet
      assignmentExpiresAt,
      dispatchStatus: "ASSIGNED",
      updatedAt: FIELD_VALUE.serverTimestamp(),
    });
  });

  return { success: true };
});

// Reject order by merchant
exports.merchantRejectOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required");
  }

  const merchantId = context.auth.uid;
  const orderId = String(data?.orderId || "").trim();
  if (!orderId) {
    throw new functions.https.HttpsError("invalid-argument", "orderId is required");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Order not found");
  }
  const orderData = orderSnap.data();
  if (orderData.merchantId !== merchantId) {
    throw new functions.https.HttpsError("permission-denied", "Not your order");
  }
  if (orderData.status !== ORDER_STATUS.NEW) {
    throw new functions.https.HttpsError("failed-precondition", "Order is not NEW");
  }

  await orderRef.update({
    status: ORDER_STATUS.CANCELLED,
    dispatchStatus: "REJECTED_BY_MERCHANT",
    updatedAt: FIELD_VALUE.serverTimestamp(),
  });

  // Optionally, update delivery as well
  const deliveryId = orderData.deliveryId;
  if (deliveryId) {
    await db.collection("deliveries").doc(deliveryId).update({
      status: DELIVERY_STATUS.CANCELLED,
      dispatchStatus: "REJECTED_BY_MERCHANT",
      updatedAt: FIELD_VALUE.serverTimestamp(),
    });
  }

  return { success: true };
});
