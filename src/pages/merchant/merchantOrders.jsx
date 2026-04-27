import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../../firebase";
import {
  MERCHANT_ORDER_STATUS,
  isMerchantOrderCompleted,
  isMerchantOrderInDelivery,
  isMerchantOrderNew,
  isMerchantOrderPreparing,
  isMerchantOrderReady,
  isMerchantOrderTerminal,
  normalizeMerchantOrderStatus,
} from "./lib/merchantOrderFlow";
import MerchantBottomNav from "./components/MerchantBottomNav";

const MaterialIcon = ({ name, filled = false, weight = 400, size = 24, sx = {} }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}`,
      lineHeight: 1,
      display: "inline-flex",
      ...sx,
    }}
  >
    {name}
  </span>
);

const formatCurrency = (value) => `₱${Number(value || 0).toFixed(2)}`;

const getTimestampDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getTimeAgo = (value) => {
  const date = getTimestampDate(value);
  if (!date) return "Just now";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 120) return "1 min ago";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
  if (seconds < 7200) return "1 hour ago";
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
};

const getOrderCode = (order) => {
  if (!order) return "ORD-000";
  return (
    order.orderNumber ||
    order.referenceCode ||
    order.code ||
    order.orderId ||
    `ORD-${String(order.id || "").slice(-3).padStart(3, "0")}`
  );
};

const getCustomerName = (order) => order?.customerName || order?.customer?.name || "Customer";

const getCustomerPhone = (order) =>
  order?.customerPhone || order?.phone || order?.contactNumber || order?.customer?.phone || "Not provided";

const getDeliveryAddress = (order) =>
  order?.deliveryAddress ||
  order?.address ||
  order?.shippingAddress ||
  order?.customerAddress ||
  "No delivery address provided";

const getPaymentMethod = (order) =>
  order?.paymentMethod || order?.paymentType || order?.payment?.method || "Cash on delivery";

const getItems = (order) => {
  if (Array.isArray(order?.items) && order.items.length > 0) return order.items;
  if (order?.productName) {
    return [
      {
        name: order.productName,
        quantity: order.quantity || 1,
        price: order.price || order.unitPrice || order.amount || order.total || 0,
      },
    ];
  }
  return [];
};

const getItemsSummary = (order) => {
  const items = getItems(order);
  if (items.length === 0) return "No item details";
  const first = items[0];
  const firstName = first?.name || first?.productName || "Item";
  const firstQty = first?.quantity || 1;
  return `${firstQty}x ${firstName}${items.length > 1 ? `, +${items.length - 1} more` : ""}`;
};

const getStatusMeta = (status) => {
  const normalized = normalizeMerchantOrderStatus(status);

  switch (normalized) {
    case MERCHANT_ORDER_STATUS.NEW:
      return { label: "NEW", bg: "#fef3c7", color: "#b45309", icon: "fiber_new" };
    case MERCHANT_ORDER_STATUS.ACCEPTED:
      return { label: "ACCEPTED", bg: "#dbeafe", color: "#1d4ed8", icon: "task_alt" };
    case MERCHANT_ORDER_STATUS.PREPARING:
      return { label: "PREPARING", bg: "#ede9fe", color: "#6d28d9", icon: "kitchen" };
    case MERCHANT_ORDER_STATUS.READY_FOR_PICKUP:
      return { label: "READY FOR PICKUP", bg: "#dcfce7", color: "#15803d", icon: "local_shipping" };
    case MERCHANT_ORDER_STATUS.ORDER_PICKED_UP:
    case MERCHANT_ORDER_STATUS.IN_DELIVERY:
      return { label: "IN DELIVERY", bg: "#dbeafe", color: "#1d4ed8", icon: "directions_car" };
    case MERCHANT_ORDER_STATUS.DELIVERED:
      return { label: "DELIVERED", bg: "#dcfce7", color: "#166534", icon: "verified" };
    case MERCHANT_ORDER_STATUS.CANCELLED:
      return { label: "CANCELLED", bg: "#fee2e2", color: "#b91c1c", icon: "cancel" };
    default:
      return { label: normalized || "ACTIVE", bg: "#f1f5f9", color: "#475569", icon: "receipt_long" };
  }
};

const orderSteps = [
  { key: MERCHANT_ORDER_STATUS.NEW, label: "Received" },
  { key: MERCHANT_ORDER_STATUS.ACCEPTED, label: "Accepted" },
  { key: MERCHANT_ORDER_STATUS.PREPARING, label: "Preparing" },
  { key: MERCHANT_ORDER_STATUS.READY_FOR_PICKUP, label: "Ready" },
  { key: MERCHANT_ORDER_STATUS.ORDER_PICKED_UP, label: "Picked up" },
  { key: MERCHANT_ORDER_STATUS.IN_DELIVERY, label: "In delivery" },
  { key: MERCHANT_ORDER_STATUS.DELIVERED, label: "Delivered" },
];

const getCurrentStepIndex = (status) => {
  const normalized = normalizeMerchantOrderStatus(status);
  const index = orderSteps.findIndex((step) => step.key === normalized);
  return index >= 0 ? index : 0;
};

const MerchantOrders = () => {
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState(() => {
    try {
      return auth.currentUser?.uid || localStorage.getItem("uid") || null;
    } catch (error) {
      return auth.currentUser?.uid || null;
    }
  });
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const uid = user?.uid || null;
      setMerchantId(uid || null);

      try {
        if (uid) localStorage.setItem("uid", uid);
      } catch (error) {
        // Ignore storage failures.
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!merchantId) return undefined;

    const unsubscribe = onSnapshot(
      query(collection(db, "orders"), where("merchantId", "==", merchantId)),
      (snapshot) => {
        const nextOrders = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
            status: normalizeMerchantOrderStatus(doc.data()?.status),
          }))
          .sort((a, b) => {
            const timeA = getTimestampDate(a.createdAt)?.getTime() || 0;
            const timeB = getTimestampDate(b.createdAt)?.getTime() || 0;
            return timeB - timeA;
          });

        setOrders(nextOrders);
      },
      (error) => {
        console.error("merchant orders listener failed", error);
        setSnack({ open: true, severity: "error", message: "Unable to load merchant orders." });
      }
    );

    return () => unsubscribe();
  }, [merchantId]);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find((order) => order.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);


  const counts = useMemo(
    () => ({
      new: orders.filter((order) => isMerchantOrderNew(order.status)).length,
      active: orders.filter(
        (order) =>
          isMerchantOrderPreparing(order.status) ||
          isMerchantOrderReady(order.status) ||
          isMerchantOrderInDelivery(order.status)
      ).length,
      completed: orders.filter((order) => isMerchantOrderCompleted(order.status)).length,
    }),
    [orders]
  );

  const callMerchantAction = async (orderId, action) => {
    if (!orderId) throw new Error("Order ID is required");

    const callableName = action === "accept" ? "merchantAcceptOrder" : "merchantRejectOrder";
    const fn = httpsCallable(functions, callableName);

    const result = await fn({ orderId });
    return result?.data;
  };

  const updateOrderStatusLocal = (orderId, status) => {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, status, updatedAt: new Date() } : order))
    );
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrderId(orderId);
  };

  const clearSelectedOrder = () => {
    setSelectedOrderId("");
  };

  const handleAcceptOrder = async () => {
    if (!selectedOrder?.id) return;

    setLoadingAction(true);
    try {
      await callMerchantAction(selectedOrder.id, "accept");
      updateOrderStatusLocal(selectedOrder.id, MERCHANT_ORDER_STATUS.ACCEPTED);
      setSnack({ open: true, severity: "success", message: "Order accepted." });
    } catch (error) {
      console.error("accept order failed", error);
      setSnack({ open: true, severity: "error", message: error?.message || "Failed to accept order." });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!selectedOrder?.id) return;

    setLoadingAction(true);
    try {
      await callMerchantAction(selectedOrder.id, "reject");
      updateOrderStatusLocal(selectedOrder.id, MERCHANT_ORDER_STATUS.CANCELLED);
      setSnack({ open: true, severity: "success", message: "Order rejected." });
    } catch (error) {
      console.error("reject order failed", error);
      setSnack({ open: true, severity: "error", message: error?.message || "Failed to reject order." });
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#f6f7f8",
        display: "flex",
        justifyContent: "center",
        px: 1,
        py: 1,
      }}
    >
      <Container
        maxWidth="sm"
        disableGutters
        sx={{
          minHeight: "100dvh",
          bgcolor: "#fff",
          boxShadow: { sm: "0 0 40px rgba(15, 23, 42, 0.12)" },
          position: "relative",
          pb: 12,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: 2,
            pt: 2,
            pb: 2.5,
            background: "linear-gradient(180deg, #eff6ff 0%, #ffffff 72%)",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Button
                onClick={() => navigate(-1)}
                sx={{
                  minWidth: 40,
                  width: 40,
                  height: 40,
                  p: 0,
                  borderRadius: "12px",
                  bgcolor: "#fff",
                  border: "1px solid #e2e8f0",
                  color: "#0f172a",
                  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
                }}
              >
                <MaterialIcon name="arrow_back_ios_new" size={18} />
              </Button>
              <Box>
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  Merchant Hub
                </Typography>
                <Typography sx={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
                  Orders
                </Typography>
              </Box>
            </Stack>

            <Chip
              icon={<MaterialIcon name="receipt_long" filled size={18} sx={{ color: "#2563eb" }} />}
              label={`${orders.length} Orders`}
              sx={{
                fontWeight: 800,
                bgcolor: "#dbeafe",
                color: "#1d4ed8",
                borderRadius: "999px",
                border: "1px solid rgba(148, 163, 184, 0.22)",
                "& .MuiChip-icon": { color: "#1d4ed8" },
              }}
            />
          </Stack>

          <Stack direction="row" spacing={1.25} sx={{ mt: 2 }}>
            <Paper elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: "16px", border: "1px solid #e2e8f0" }}>
              <Typography sx={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                New
              </Typography>
              <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>{counts.new}</Typography>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: "16px", border: "1px solid #e2e8f0" }}>
              <Typography sx={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                Active
              </Typography>
              <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>{counts.active}</Typography>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: "16px", border: "1px solid #e2e8f0" }}>
              <Typography sx={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                Done
              </Typography>
              <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>{counts.completed}</Typography>
            </Paper>
          </Stack>
        </Box>

        <Box sx={{ px: 2, pt: 2.25 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: "22px",
              border: "1px solid #e2e8f0",
              bgcolor: "#fff",
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: "#0f172a" }}>Order List</Typography>
                <Typography sx={{ fontSize: "0.85rem", color: "#64748b", mt: 0.3 }}>
                  Tap any order to open the order details view.
                </Typography>
              </Box>
              <MaterialIcon name="list_alt" filled size={24} sx={{ color: "#2563eb" }} />
            </Stack>

            {orders.length === 0 ? (
              <Box
                sx={{
                  p: 3,
                  borderRadius: "18px",
                  border: "1px dashed #cbd5e1",
                  textAlign: "center",
                  bgcolor: "#f8fafc",
                }}
              >
                <MaterialIcon name="receipt_long" size={34} sx={{ color: "#94a3b8" }} />
                <Typography sx={{ mt: 1.5, fontWeight: 800, color: "#0f172a" }}>No orders yet</Typography>
                <Typography sx={{ mt: 0.5, color: "#64748b", fontSize: "0.9rem" }}>
                  Incoming merchant orders will appear here as soon as customers place them.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.25}>
                {orders.map((order) => {
                  const active = order.id === selectedOrder?.id;
                  const meta = getStatusMeta(order.status);

                  return (
                    <Paper
                      key={order.id}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: "18px",
                        border: active ? "1px solid #2563eb" : "1px solid #e2e8f0",
                        bgcolor: active ? "#eff6ff" : "#fff",
                      }}
                    >
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography sx={{ fontWeight: 900, color: "#0f172a" }} noWrap>
                              #{getOrderCode(order)}
                            </Typography>
                            <Chip
                              size="small"
                              label={meta.label}
                              sx={{
                                fontWeight: 800,
                                bgcolor: meta.bg,
                                color: meta.color,
                                borderRadius: "999px",
                                height: 24,
                              }}
                            />
                          </Stack>

                          <Typography sx={{ fontSize: "0.82rem", color: "#64748b", mt: 0.4 }} noWrap>
                            {getCustomerName(order)} • {getItemsSummary(order)}
                          </Typography>
                          <Typography sx={{ fontSize: "0.82rem", color: "#64748b", mt: 0.2 }}>
                            {getTimeAgo(order.createdAt)}
                          </Typography>
                        </Box>

                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          <Typography sx={{ fontWeight: 900, color: "#0f172a" }}>
                            {formatCurrency(order.total || order.amount)}
                          </Typography>
                          <Button
                            size="small"
                            onClick={() => handleSelectOrder(order.id)}
                            sx={{
                              mt: 0.8,
                              px: 1.5,
                              py: 0.6,
                              borderRadius: "999px",
                              textTransform: "none",
                              fontWeight: 800,
                              color: "#2563eb",
                              bgcolor: "#dbeafe",
                              "&:hover": { bgcolor: "#bfdbfe" },
                            }}
                          >
                            Order Details
                          </Button>
                        </Box>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Paper>

          {!selectedOrder ? null : (
            <>
              <Paper
                elevation={0}
                sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: "22px",
                  border: "1px solid #dbeafe",
                  bgcolor: "#f8fbff",
                  boxShadow: "0 10px 28px rgba(37, 99, 235, 0.08)",
                }}
              >
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography
                      sx={{
                        fontSize: "0.74rem",
                        fontWeight: 800,
                        color: "#2563eb",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                      }}
                    >
                      Order Details
                    </Typography>
                    <Typography sx={{ fontSize: "1.45rem", fontWeight: 900, color: "#0f172a", lineHeight: 1.1, mt: 0.4 }}>
                      {getOrderCode(selectedOrder)}
                    </Typography>
                    <Typography sx={{ fontSize: "0.92rem", color: "#475569", mt: 0.8 }}>
                      {getCustomerName(selectedOrder)} • {getTimeAgo(selectedOrder?.createdAt)}
                    </Typography>
                  </Box>

                  <Stack alignItems="flex-end" spacing={1}>
                    <Chip
                      icon={<MaterialIcon name={getStatusMeta(selectedOrder?.status).icon} filled size={18} sx={{ color: getStatusMeta(selectedOrder?.status).color }} />}
                      label={getStatusMeta(selectedOrder?.status).label}
                      sx={{
                        fontWeight: 800,
                        bgcolor: getStatusMeta(selectedOrder?.status).bg,
                        color: getStatusMeta(selectedOrder?.status).color,
                        borderRadius: "999px",
                        border: "1px solid rgba(148, 163, 184, 0.22)",
                        "& .MuiChip-icon": { color: getStatusMeta(selectedOrder?.status).color },
                      }}
                    />
                    <Button
                      onClick={clearSelectedOrder}
                      sx={{
                        minWidth: "auto",
                        px: 1.5,
                        py: 0.7,
                        borderRadius: "999px",
                        textTransform: "none",
                        fontWeight: 800,
                        color: "#0f172a",
                        bgcolor: "#fff",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      Back to list
                    </Button>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1.25} sx={{ mt: 2, flexWrap: "wrap" }}>
                  <Paper elevation={0} sx={{ flex: "1 1 140px", p: 1.5, borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                      Total
                    </Typography>
                    <Typography sx={{ fontSize: "1.15rem", fontWeight: 900, color: "#0f172a" }}>
                      {formatCurrency(selectedOrder?.total || selectedOrder?.amount)}
                    </Typography>
                  </Paper>
                  <Paper elevation={0} sx={{ flex: "1 1 140px", p: 1.5, borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                    <Typography sx={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                      Items
                    </Typography>
                    <Typography sx={{ fontSize: "1.15rem", fontWeight: 900, color: "#0f172a" }}>
                      {getItems(selectedOrder).length || selectedOrder?.quantity || 0}
                    </Typography>
                  </Paper>
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: "22px",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#fff",
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: "#0f172a" }}>
                    Order Progress
                  </Typography>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: getStatusMeta(selectedOrder?.status).color }}>
                    {getStatusMeta(selectedOrder?.status).label}
                  </Typography>
                </Stack>

                <Stack spacing={1.25}>
                  {orderSteps.map((step, index) => {
                    const active = index === getCurrentStepIndex(selectedOrder?.status || MERCHANT_ORDER_STATUS.NEW);
                    const completed = index < getCurrentStepIndex(selectedOrder?.status || MERCHANT_ORDER_STATUS.NEW);
                    const cancelled = normalizeMerchantOrderStatus(selectedOrder?.status) === MERCHANT_ORDER_STATUS.CANCELLED;

                    return (
                      <Stack key={step.key} direction="row" alignItems="center" spacing={1.5}>
                        <Box
                          sx={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            bgcolor: cancelled ? "#fca5a5" : active ? "#2563eb" : completed ? "#22c55e" : "#e2e8f0",
                            boxShadow: active ? "0 0 0 6px rgba(37, 99, 235, 0.12)" : "none",
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: "0.92rem", fontWeight: active || completed ? 800 : 600, color: "#0f172a" }}>
                            {step.label}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: "0.8rem", color: completed ? "#16a34a" : "#94a3b8", fontWeight: 700 }}>
                          {completed ? "Done" : active ? "Now" : "Next"}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: "22px",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#fff",
                }}
              >
                <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: "#0f172a", mb: 1.5 }}>
                  Customer Details
                </Typography>

                <Stack spacing={1.25}>
                  <DetailRow icon="person" label="Name" value={getCustomerName(selectedOrder)} />
                  <DetailRow icon="call" label="Phone" value={getCustomerPhone(selectedOrder)} />
                  <DetailRow icon="location_on" label="Address" value={getDeliveryAddress(selectedOrder)} />
                  <DetailRow icon="payments" label="Payment" value={getPaymentMethod(selectedOrder)} />
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: "22px",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#fff",
                }}
              >
                <Typography sx={{ fontSize: "1rem", fontWeight: 900, color: "#0f172a", mb: 1.5 }}>
                  Items
                </Typography>

                {getItems(selectedOrder).length === 0 ? (
                  <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: "16px", textAlign: "center", color: "#64748b" }}>
                    No item details available for this order.
                  </Box>
                ) : (
                  <Stack spacing={1.25}>
                    {getItems(selectedOrder).map((item, index) => {
                      const name = item?.name || item?.productName || `Item ${index + 1}`;
                      const quantity = item?.quantity || 1;
                      const price = Number(item?.price || item?.subtotal || item?.unitPrice || 0);

                      return (
                        <Stack
                          key={`${name}-${index}`}
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          spacing={1.5}
                          sx={{
                            p: 1.5,
                            borderRadius: "16px",
                            bgcolor: "#f8fafc",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800, color: "#0f172a" }} noWrap>
                              {name}
                            </Typography>
                            <Typography sx={{ fontSize: "0.82rem", color: "#64748b" }}>
                              Qty {quantity}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontWeight: 900, color: "#0f172a", flexShrink: 0 }}>
                            {formatCurrency(price)}
                          </Typography>
                        </Stack>
                      );
                    })}
                  </Stack>
                )}
              </Paper>

              <Box sx={{ mt: 2, pb: 1 }}>
                {isMerchantOrderNew(selectedOrder.status) ? (
                  <Stack direction="row" spacing={1.25}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      onClick={handleRejectOrder}
                      disabled={loadingAction}
                      sx={{
                        py: 1.35,
                        borderRadius: "14px",
                        textTransform: "none",
                        fontWeight: 800,
                        borderWidth: 2,
                      }}
                    >
                      Reject Order
                    </Button>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleAcceptOrder}
                      disabled={loadingAction}
                      sx={{
                        py: 1.35,
                        borderRadius: "14px",
                        textTransform: "none",
                        fontWeight: 800,
                        bgcolor: "#2563eb",
                        boxShadow: "0 14px 30px rgba(37, 99, 235, 0.28)",
                        "&:hover": { bgcolor: "#1d4ed8" },
                      }}
                    >
                      Accept Order
                    </Button>
                  </Stack>
                ) : (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.75,
                      borderRadius: "18px",
                      border: "1px solid #e2e8f0",
                      bgcolor: "#f8fafc",
                      textAlign: "center",
                    }}
                  >
                    <Typography sx={{ fontSize: "0.92rem", color: "#475569", fontWeight: 700 }}>
                      This order is already in progress. Status updates are handled automatically.
                    </Typography>
                  </Paper>
                )}
              </Box>
            </>
          )}
        </Box>

        <Snackbar
          open={snack.open}
          autoHideDuration={3500}
          onClose={() => setSnack((current) => ({ ...current, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={snack.severity} variant="filled" sx={{ width: "100%" }}>
            {snack.message}
          </Alert>
        </Snackbar>

        <MerchantBottomNav activePath="/merchant/orders" />
      </Container>
    </Box>
  );
};

const DetailRow = ({ icon, label, value }) => (
  <Stack direction="row" alignItems="flex-start" spacing={1.25}>
    <Box
      sx={{
        width: 34,
        height: 34,
        borderRadius: "12px",
        bgcolor: "#eff6ff",
        color: "#2563eb",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        mt: 0.2,
      }}
    >
      <MaterialIcon name={icon} size={18} filled />
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography
        sx={{
          fontSize: "0.72rem",
          fontWeight: 800,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  </Stack>
);

export default MerchantOrders;
