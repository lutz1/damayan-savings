/*
  One-time migration script:
  - Reads legacy sales documents
  - Creates canonical orders documents
  - Creates orders/{orderId}/items subcollection
  - Creates orderItems flat collection records

  Safe to rerun: checks if mapped order already exists via sales.orderId or migrationSourceSaleId.
*/

const admin = require("firebase-admin");
const firebaseAdmin = require("./firebaseAdmin");

const db = firebaseAdmin.db || admin.firestore();

function toDate(value) {
  if (!value) return new Date();
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeOrderStatus(status) {
  const raw = String(status || "").trim().toUpperCase();
  if (!raw) return "NEW";

  const map = {
    PENDING: "NEW",
    NEW: "NEW",
    ACCEPTED: "ACCEPTED",
    PREPARING: "PREPARING",
    READY_FOR_PICKUP: "READY_FOR_PICKUP",
    PICKED_UP: "ORDER_PICKED_UP",
    ORDER_PICKED_UP: "ORDER_PICKED_UP",
    OUT_FOR_DELIVERY: "IN_DELIVERY",
    IN_DELIVERY: "IN_DELIVERY",
    ARRIVING: "ARRIVED_CUSTOMER",
    ARRIVED_CUSTOMER: "ARRIVED_CUSTOMER",
    DELIVERED: "DELIVERED",
    COMPLETED: "DELIVERED",
    CANCELLED: "CANCELLED",
    REJECTED: "CANCELLED",
  };

  return map[raw] || raw;
}

async function migrate() {
  console.log("[migrate-sales-to-orders] Starting migration...");

  const salesSnap = await db.collection("sales").get();
  console.log(`[migrate-sales-to-orders] Found ${salesSnap.size} sales docs`);

  let createdOrders = 0;
  let skippedOrders = 0;
  let createdItems = 0;

  for (const saleDoc of salesSnap.docs) {
    const saleId = saleDoc.id;
    const sale = saleDoc.data() || {};

    try {
      let targetOrderId = String(sale.orderId || "").trim();

      if (!targetOrderId) {
        const existingOrderBySource = await db
          .collection("orders")
          .where("migrationSourceSaleId", "==", saleId)
          .limit(1)
          .get();

        if (!existingOrderBySource.empty) {
          targetOrderId = existingOrderBySource.docs[0].id;
        }
      }

      if (targetOrderId) {
        const existingOrder = await db.collection("orders").doc(targetOrderId).get();
        if (existingOrder.exists) {
          skippedOrders += 1;
          if (!sale.orderId) {
            await saleDoc.ref.set({ orderId: targetOrderId, migratedAt: new Date() }, { merge: true });
          }
          continue;
        }
      }

      const orderRef = targetOrderId
        ? db.collection("orders").doc(targetOrderId)
        : db.collection("orders").doc();

      const orderPayload = {
        customerId: sale.customerId || null,
        merchantId: sale.merchantId || null,
        riderId: sale.riderId || null,
        customerName: sale.customerName || "",
        customerEmail: sale.customerEmail || "",
        subtotal: Number(sale.subtotal || 0),
        deliveryFee: Number(sale.deliveryFee || 0),
        total: Number(sale.total || 0),
        paymentMethod: sale.paymentMethod || "COD",
        paymentStatus: sale.paymentStatus || "UNPAID",
        status: normalizeOrderStatus(sale.status),
        pickupLocation: sale.pickupLocation || { merchantId: sale.merchantId || null },
        dropoffLocation: sale.dropoffLocation || {
          address: sale.deliveryAddress || "",
          cityProvince: sale.cityProvince || "",
        },
        deliveryAddress: sale.deliveryAddress || "",
        cityProvince: sale.cityProvince || "",
        deliveryId: sale.deliveryId || null,
        migrationSourceSaleId: saleId,
        createdAt: toDate(sale.createdAt),
        updatedAt: toDate(sale.updatedAt || sale.createdAt),
      };

      await orderRef.set(orderPayload, { merge: true });

      const items = Array.isArray(sale.items) ? sale.items : [];
      for (const item of items) {
        const itemPayload = {
          orderId: orderRef.id,
          merchantId: sale.merchantId || null,
          customerId: sale.customerId || null,
          productId: item.productId || item.id || null,
          name: item.name || item.productName || "Item",
          image: item.image || "",
          price: Number(item.price || 0),
          quantity: Number(item.quantity || item.qty || 1),
          total:
            Number(item.total || 0) || Number(item.price || 0) * Number(item.quantity || item.qty || 1),
          createdAt: toDate(sale.createdAt),
          migrationSourceSaleId: saleId,
        };

        await db.collection("orders").doc(orderRef.id).collection("items").add(itemPayload);
        await db.collection("orderItems").add(itemPayload);
        createdItems += 1;
      }

      await saleDoc.ref.set({ orderId: orderRef.id, migratedAt: new Date() }, { merge: true });

      if (sale.deliveryId) {
        await db.collection("deliveries").doc(String(sale.deliveryId)).set(
          {
            orderId: orderRef.id,
            saleId,
            updatedAt: new Date(),
          },
          { merge: true }
        );
      }

      createdOrders += 1;
      console.log(`[migrate-sales-to-orders] Migrated sale ${saleId} -> order ${orderRef.id}`);
    } catch (error) {
      console.error(`[migrate-sales-to-orders] Failed sale ${saleId}:`, error.message || error);
    }
  }

  console.log("[migrate-sales-to-orders] Done", {
    createdOrders,
    skippedOrders,
    createdItems,
  });
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[migrate-sales-to-orders] Fatal error:", error);
    process.exit(1);
  });
