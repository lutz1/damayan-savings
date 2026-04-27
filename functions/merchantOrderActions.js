const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");

const db = admin.firestore();
const FIELD_VALUE = admin.firestore.FieldValue;
const TIMESTAMP = admin.firestore.Timestamp;

// CORS configuration
const corsHandler = cors({ origin: true });

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
  try {
    if (!context.auth?.uid) {
      console.error("[merchantAcceptOrder] No auth context", { context });
      throw new functions.https.HttpsError("unauthenticated", "Authentication required");
    }

    const merchantId = context.auth.uid;
    const orderId = String(data?.orderId || "").trim();
    if (!orderId) {
      console.error("[merchantAcceptOrder] Missing orderId", { data });
      throw new functions.https.HttpsError("invalid-argument", "orderId is required");
    }

    console.log("[merchantAcceptOrder] Starting", { merchantId, orderId });

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      console.error("[merchantAcceptOrder] Order not found", { orderId });
      throw new functions.https.HttpsError("not-found", "Order not found");
    }
    
    const orderData = orderSnap.data();
    console.log("[merchantAcceptOrder] Order data:", { 
      orderId, 
      merchantId: orderData.merchantId, 
      status: orderData.status,
      deliveryId: orderData.deliveryId
    });
    
    if (orderData.merchantId !== merchantId) {
      console.error("[merchantAcceptOrder] Not your order", { merchantId, orderMerchantId: orderData.merchantId });
      throw new functions.https.HttpsError("permission-denied", "Not your order");
    }
    
    // Normalize status comparison - accept both uppercase and as-stored
    const orderStatus = String(orderData.status || "").toUpperCase().trim();
    console.log("[merchantAcceptOrder] Checking status", { orderStatus, expected: ORDER_STATUS.NEW });
    
    if (orderStatus !== ORDER_STATUS.NEW) {
      console.error("[merchantAcceptOrder] Order is not NEW", { status: orderStatus, orderData });
      throw new functions.https.HttpsError("failed-precondition", `Order status is ${orderStatus}, expected ${ORDER_STATUS.NEW}`);
    }

    // Find delivery doc
    const deliveryId = orderData.deliveryId;
    if (!deliveryId) {
      console.warn("[merchantAcceptOrder] DeliveryId missing, but proceeding", { orderId });
      // Still try to accept the order even without delivery
    } else {
      const deliveryRef = db.collection("deliveries").doc(deliveryId);
      const deliverySnap = await deliveryRef.get();
      if (!deliverySnap.exists) {
        console.warn("[merchantAcceptOrder] Delivery not found, but proceeding", { deliveryId });
      }
    }
    
    const assignmentExpiresAt = TIMESTAMP.fromMillis(Date.now() + 10000); // 10 seconds

    console.log("[merchantAcceptOrder] Starting transaction", { orderId, deliveryId });

    // Update order
    await orderRef.update({
      status: ORDER_STATUS.PREPARING,
      dispatchStatus: "ASSIGNED",
      updatedAt: FIELD_VALUE.serverTimestamp(),
    });

    // Update delivery if it exists
    if (deliveryId) {
      try {
        const deliveryRef = db.collection("deliveries").doc(deliveryId);
        await deliveryRef.update({
          status: DELIVERY_STATUS.ASSIGNED,
          assignmentExpiresAt,
          dispatchStatus: "ASSIGNED",
          updatedAt: FIELD_VALUE.serverTimestamp(),
        });
      } catch (deliveryErr) {
        console.warn("[merchantAcceptOrder] Failed to update delivery (non-fatal)", { 
          deliveryId,
          error: deliveryErr.message 
        });
      }
    }

    console.log("[merchantAcceptOrder] Success", { orderId });
    return { success: true };
  } catch (error) {
    console.error("[merchantAcceptOrder] Error", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    
    // If it's already an HttpsError, rethrow it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    // Otherwise wrap it
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to accept order"
    );
  }
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
