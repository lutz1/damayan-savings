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
};

const ASSIGNMENT_WINDOW_SECONDS = 10;
const MAX_DISPATCH_RADIUS_KM = 5;

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractCoordinates(payload) {
  if (!payload || typeof payload !== "object") return null;

  const directLat = toNumber(payload.lat);
  const directLng = toNumber(payload.lng);
  if (directLat != null && directLng != null) {
    return { lat: directLat, lng: directLng };
  }

  const location = payload.location || payload.currentLocation || payload.coordinates;
  if (location && typeof location === "object") {
    const nestedLat = toNumber(location.lat);
    const nestedLng = toNumber(location.lng);
    if (nestedLat != null && nestedLng != null) {
      return { lat: nestedLat, lng: nestedLng };
    }
  }

  return null;
}

function normalizeStatus(value) {
  if (!value) return "";
  return String(value).trim().toUpperCase();
}

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function distanceKm(from, to) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

async function getDispatchOrigin(saleData) {
  const merchantId = saleData.merchantId;
  if (merchantId) {
    const merchantSnap = await db.collection("merchants").doc(merchantId).get();
    if (merchantSnap.exists) {
      const merchantCoords = extractCoordinates(merchantSnap.data());
      if (merchantCoords) return merchantCoords;
    }

    const merchantUserSnap = await db.collection("users").doc(merchantId).get();
    if (merchantUserSnap.exists) {
      const merchantUserCoords = extractCoordinates(merchantUserSnap.data());
      if (merchantUserCoords) return merchantUserCoords;
    }
  }

  return extractCoordinates(saleData.deliveryAddress) || null;
}

async function findCandidateRiders(originCoords, excludedIds = []) {
  const excludedSet = new Set(excludedIds.filter(Boolean));
  const ridersSnap = await db.collection("users").where("onlineStatus", "==", true).limit(200).get();

  const candidates = [];

  for (const snap of ridersSnap.docs) {
    const data = snap.data() || {};
    const role = normalizeStatus(data.role);
    if (role !== "RIDER") continue;

    const availability = normalizeStatus(data.availability || "AVAILABLE");
    if (availability !== "AVAILABLE") continue;
    if (excludedSet.has(snap.id)) continue;

    const riderCoords = extractCoordinates(data);
    if (!riderCoords || !originCoords) {
      candidates.push({ riderId: snap.id, distanceKm: null });
      continue;
    }

    const km = distanceKm(originCoords, riderCoords);
    if (km <= MAX_DISPATCH_RADIUS_KM) {
      candidates.push({ riderId: snap.id, distanceKm: km });
    }
  }

  candidates.sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0;
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });

  return candidates;
}

async function assignInitialRiderForSale(saleId, saleData) {
  const originCoords = await getDispatchOrigin(saleData);
  const candidates = await findCandidateRiders(originCoords);

  const now = TIMESTAMP.now();
  const assignmentExpiresAt = TIMESTAMP.fromMillis(
    now.toMillis() + ASSIGNMENT_WINDOW_SECONDS * 1000
  );

  const deliveryRef = db.collection("deliveries").doc();
  const saleRef = db.collection("sales").doc(saleId);

  const hasCandidate = candidates.length > 0;
  const assignedRiderId = hasCandidate ? candidates[0].riderId : null;

  const payload = {
    saleId,
    merchantId: saleData.merchantId || null,
    customerId: saleData.customerId || null,
    deliveryAddress: saleData.deliveryAddress || null,
    cityProvince: saleData.cityProvince || "",
    paymentMethod: saleData.paymentMethod || "COD",
    amount: Number(saleData.total || 0),
    deliveryFee: Number(saleData.deliveryFee || 0),
    riderId: assignedRiderId,
    candidateRiderIds: candidates.map((c) => c.riderId),
    currentRiderIndex: hasCandidate ? 0 : -1,
    assignmentExpiresAt: hasCandidate ? assignmentExpiresAt : null,
    dispatchAttempts: hasCandidate ? 1 : 0,
    status: hasCandidate ? DELIVERY_STATUS.ASSIGNED : DELIVERY_STATUS.NEW,
    dispatchStatus: hasCandidate ? "ASSIGNED" : "NO_RIDER_AVAILABLE",
    createdAt: FIELD_VALUE.serverTimestamp(),
    updatedAt: FIELD_VALUE.serverTimestamp(),
  };

  await db.runTransaction(async (transaction) => {
    transaction.set(deliveryRef, payload);

    const salePatch = {
      deliveryId: deliveryRef.id,
      status: hasCandidate ? ORDER_STATUS.ASSIGNED : ORDER_STATUS.NEW,
      riderId: assignedRiderId,
      dispatchStatus: hasCandidate ? "ASSIGNED" : "NO_RIDER_AVAILABLE",
      updatedAt: FIELD_VALUE.serverTimestamp(),
    };

    transaction.update(saleRef, salePatch);
  });

  return {
    deliveryId: deliveryRef.id,
    assignedRiderId,
    hasCandidate,
    candidateCount: candidates.length,
  };
}

async function assignInitialRiderForOrder(orderId, orderData) {
  const originCoords = await getDispatchOrigin(orderData);
  const candidates = await findCandidateRiders(originCoords);

  const now = TIMESTAMP.now();
  const assignmentExpiresAt = TIMESTAMP.fromMillis(
    now.toMillis() + ASSIGNMENT_WINDOW_SECONDS * 1000
  );

  const deliveryRef = db.collection("deliveries").doc();
  const orderRef = db.collection("orders").doc(orderId);

  const hasCandidate = candidates.length > 0;
  const assignedRiderId = hasCandidate ? candidates[0].riderId : null;

  const payload = {
    orderId,
    saleId: orderData.saleId || null,
    merchantId: orderData.merchantId || null,
    customerId: orderData.customerId || null,
    pickupLocation: orderData.pickupLocation || null,
    dropoffLocation: orderData.dropoffLocation || null,
    deliveryAddress: orderData.dropoffLocation?.address || orderData.deliveryAddress || null,
    cityProvince: orderData.cityProvince || orderData.dropoffLocation?.cityProvince || "",
    paymentMethod: orderData.paymentMethod || "COD",
    amount: Number(orderData.total || 0),
    deliveryFee: Number(orderData.deliveryFee || 0),
    riderId: assignedRiderId,
    candidateRiderIds: candidates.map((c) => c.riderId),
    currentRiderIndex: hasCandidate ? 0 : -1,
    assignmentExpiresAt: hasCandidate ? assignmentExpiresAt : null,
    dispatchAttempts: hasCandidate ? 1 : 0,
    status: hasCandidate ? DELIVERY_STATUS.ASSIGNED : DELIVERY_STATUS.NEW,
    dispatchStatus: hasCandidate ? "ASSIGNED" : "NO_RIDER_AVAILABLE",
    createdAt: FIELD_VALUE.serverTimestamp(),
    updatedAt: FIELD_VALUE.serverTimestamp(),
  };

  await db.runTransaction(async (transaction) => {
    transaction.set(deliveryRef, payload);

    transaction.update(orderRef, {
      deliveryId: deliveryRef.id,
      status: hasCandidate ? ORDER_STATUS.ASSIGNED : ORDER_STATUS.NEW,
      riderId: assignedRiderId,
      dispatchStatus: hasCandidate ? "ASSIGNED" : "NO_RIDER_AVAILABLE",
      updatedAt: FIELD_VALUE.serverTimestamp(),
    });
  });

  return {
    deliveryId: deliveryRef.id,
    assignedRiderId,
    hasCandidate,
    candidateCount: candidates.length,
  };
}

async function reassignDelivery(deliveryId, reason, expectedCurrentRiderId = null) {
  const deliveryRef = db.collection("deliveries").doc(deliveryId);

  return db.runTransaction(async (transaction) => {
    const deliverySnap = await transaction.get(deliveryRef);
    if (!deliverySnap.exists) {
      throw new functions.https.HttpsError("not-found", "Delivery not found");
    }

    const delivery = deliverySnap.data() || {};
    if (expectedCurrentRiderId && delivery.riderId !== expectedCurrentRiderId) {
      throw new functions.https.HttpsError("permission-denied", "Not assigned to this delivery");
    }

    const saleId = delivery.saleId;
    if (!saleId) {
      throw new functions.https.HttpsError("failed-precondition", "Delivery has no saleId");
    }

    const saleRef = db.collection("sales").doc(saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Sale not found for delivery");
    }

    const currentStatus = normalizeStatus(delivery.status);
    if (currentStatus === DELIVERY_STATUS.ACCEPTED || currentStatus === DELIVERY_STATUS.DELIVERED) {
      return { reassigned: false, reason: "already-progressed" };
    }

    const candidateRiderIds = Array.isArray(delivery.candidateRiderIds)
      ? delivery.candidateRiderIds.filter(Boolean)
      : [];

    let nextIndex = Number(delivery.currentRiderIndex || -1) + 1;

    if (nextIndex >= candidateRiderIds.length) {
      const originCoords = await getDispatchOrigin(saleSnap.data() || {});
      const newCandidates = await findCandidateRiders(originCoords, candidateRiderIds);
      candidateRiderIds.push(...newCandidates.map((c) => c.riderId));
    }

    if (nextIndex >= candidateRiderIds.length) {
      transaction.update(deliveryRef, {
        riderId: null,
        currentRiderIndex: nextIndex,
        status: DELIVERY_STATUS.NEW,
        dispatchStatus: "NO_RIDER_AVAILABLE",
        assignmentExpiresAt: null,
        dispatchFailureReason: reason || "No available riders",
        updatedAt: FIELD_VALUE.serverTimestamp(),
      });

      transaction.update(saleRef, {
        riderId: null,
        status: ORDER_STATUS.NEW,
        dispatchStatus: "NO_RIDER_AVAILABLE",
        updatedAt: FIELD_VALUE.serverTimestamp(),
      });

      return { reassigned: false, reason: "no-rider" };
    }

    const nextRiderId = candidateRiderIds[nextIndex];
    const expiresAt = TIMESTAMP.fromMillis(Date.now() + ASSIGNMENT_WINDOW_SECONDS * 1000);

    transaction.update(deliveryRef, {
      riderId: nextRiderId,
      candidateRiderIds,
      currentRiderIndex: nextIndex,
      assignmentExpiresAt: expiresAt,
      dispatchAttempts: FIELD_VALUE.increment(1),
      status: DELIVERY_STATUS.ASSIGNED,
      dispatchStatus: "ASSIGNED",
      lastDispatchReason: reason || "manual-reassign",
      updatedAt: FIELD_VALUE.serverTimestamp(),
    });

    transaction.update(saleRef, {
      riderId: nextRiderId,
      status: ORDER_STATUS.ASSIGNED,
      dispatchStatus: "ASSIGNED",
      updatedAt: FIELD_VALUE.serverTimestamp(),
    });

    return {
      reassigned: true,
      riderId: nextRiderId,
      currentRiderIndex: nextIndex,
    };
  });
}

exports.onSaleCreatedDispatchRider = functions.firestore
  .document("sales/{saleId}")
  .onCreate(async (snap, context) => {
    const saleData = snap.data() || {};
    const status = normalizeStatus(saleData.status || ORDER_STATUS.NEW);
    if (!["NEW", "PENDING"].includes(status)) {
      return null;
    }

    try {
      const result = await assignInitialRiderForSale(context.params.saleId, saleData);
      console.log("[dispatch] sale dispatched", {
        saleId: context.params.saleId,
        deliveryId: result.deliveryId,
        riderId: result.assignedRiderId,
        candidates: result.candidateCount,
      });
    } catch (error) {
      console.error("[dispatch] failed dispatching sale", {
        saleId: context.params.saleId,
        error: error.message,
      });
    }

    return null;
  });

exports.onOrderCreatedDispatchRider = functions.firestore
  .document("orders/{orderId}")
  .onCreate(async (snap, context) => {
    const orderData = snap.data() || {};
    const status = normalizeStatus(orderData.status || ORDER_STATUS.NEW);
    if (!["NEW", "PENDING"].includes(status)) {
      return null;
    }

    try {
      const result = await assignInitialRiderForOrder(context.params.orderId, orderData);
      console.log("[dispatch] order dispatched", {
        orderId: context.params.orderId,
        deliveryId: result.deliveryId,
        riderId: result.assignedRiderId,
        candidates: result.candidateCount,
      });
    } catch (error) {
      console.error("[dispatch] failed dispatching order", {
        orderId: context.params.orderId,
        error: error.message,
      });
    }

    return null;
  });

exports.respondToDeliveryRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required");
  }

  const riderId = context.auth.uid;
  const deliveryId = String(data?.deliveryId || "").trim();
  const action = normalizeStatus(data?.action);

  if (!deliveryId || !["ACCEPT", "REJECT"].includes(action)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "deliveryId and action (ACCEPT|REJECT) are required"
    );
  }

  const deliveryRef = db.collection("deliveries").doc(deliveryId);

  if (action === "ACCEPT") {
    return db.runTransaction(async (transaction) => {
      const deliverySnap = await transaction.get(deliveryRef);
      if (!deliverySnap.exists) {
        throw new functions.https.HttpsError("not-found", "Delivery not found");
      }

      const delivery = deliverySnap.data() || {};
      if (delivery.riderId !== riderId) {
        throw new functions.https.HttpsError("permission-denied", "Not assigned to this rider");
      }

      const expiresAt = delivery.assignmentExpiresAt;
      const expired = expiresAt?.toMillis && expiresAt.toMillis() < Date.now();
      if (expired) {
        throw new functions.https.HttpsError("deadline-exceeded", "Delivery assignment expired");
      }

      const orderId = String(delivery.orderId || "").trim();
      const saleId = String(delivery.saleId || "").trim();

      const orderRef = orderId ? db.collection("orders").doc(orderId) : null;
      const saleRef = saleId ? db.collection("sales").doc(saleId) : null;

      let targetRef = null;
      if (orderRef) {
        const orderSnap = await transaction.get(orderRef);
        if (orderSnap.exists) targetRef = orderRef;
      }

      if (!targetRef && saleRef) {
        const saleSnap = await transaction.get(saleRef);
        if (saleSnap.exists) targetRef = saleRef;
      }

      if (!targetRef) {
        throw new functions.https.HttpsError("not-found", "Order/Sale not found");
      }

      transaction.update(deliveryRef, {
        status: DELIVERY_STATUS.ACCEPTED,
        acceptedAt: FIELD_VALUE.serverTimestamp(),
        assignmentExpiresAt: null,
        dispatchStatus: "ACCEPTED",
        updatedAt: FIELD_VALUE.serverTimestamp(),
      });

      transaction.update(targetRef, {
        status: ORDER_STATUS.ACCEPTED,
        riderId,
        updatedAt: FIELD_VALUE.serverTimestamp(),
      });

      return { success: true, status: DELIVERY_STATUS.ACCEPTED };
    });
  }

  const result = await reassignDelivery(deliveryId, "rider-rejected", riderId);
  return { success: true, action: "REJECT", ...result };
});

exports.reassignExpiredDeliveries = functions.https.onCall(async (_, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required");
  }

  const callerSnap = await db.collection("users").doc(context.auth.uid).get();
  const callerRole = normalizeStatus(callerSnap.data()?.role);
  if (!["ADMIN", "CEO"].includes(callerRole)) {
    throw new functions.https.HttpsError("permission-denied", "Admin/CEO access required");
  }

  const now = TIMESTAMP.now();
  const expiredSnap = await db
    .collection("deliveries")
    .where("status", "==", DELIVERY_STATUS.ASSIGNED)
    .where("assignmentExpiresAt", "<=", now)
    .limit(20)
    .get();

  const outcomes = [];
  for (const docSnap of expiredSnap.docs) {
    try {
      const reassigned = await reassignDelivery(docSnap.id, "assignment-expired");
      outcomes.push({ deliveryId: docSnap.id, ...reassigned });
    } catch (error) {
      outcomes.push({ deliveryId: docSnap.id, error: error.message });
    }
  }

  return {
    processed: outcomes.length,
    outcomes,
  };
});
