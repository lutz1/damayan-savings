import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Avatar,
  Paper,
  Container,
  IconButton,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, storage, functions } from "../../firebase";
import {
  MERCHANT_ORDER_STATUS,
  normalizeMerchantOrderStatus,
  isMerchantOrderNew,
  isMerchantOrderPreparing,
  isMerchantOrderReady,
  isMerchantOrderInDelivery,
  isMerchantOrderCompleted,
} from "./lib/merchantOrderFlow";
import MerchantBottomNav from "./components/MerchantBottomNav";

// Material Symbols Icon Component
const MaterialIcon = ({ name, filled = false, weight = 400, size = 24, sx = {} }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}`,
      ...sx,
    }}
  >
    {name}
  </span>
);

const MerchantOrders = () => {
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState(() => {
    try {
      return auth.currentUser?.uid || localStorage.getItem("uid") || null;
    } catch (err) {
      return auth.currentUser?.uid || null;
    }
  });
  const [sales, setSales] = useState([]);
  const [detailOrder, setDetailOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [snack, setSnack] = useState({ open: false, severity: "error", message: "" });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const uid = user?.uid || null;

      setMerchantId((current) => {
        if (uid) return uid;
        try {
          return current || localStorage.getItem("uid") || null;
        } catch (err) {
          return current || null;
        }
      });

      try {
        if (uid) {
          localStorage.setItem("uid", uid);
        }
      } catch (err) {
        // Ignore storage access issues and continue with auth state only.
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!merchantId) return undefined;

    const unsubSales = onSnapshot(
      query(
        collection(db, "orders"),
        where("merchantId", "==", merchantId)
      ),
      (snap) => {
        const nextSales = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
            status: normalizeMerchantOrderStatus(d.data()?.status) || d.data()?.status || MERCHANT_ORDER_STATUS.NEW,
          }))
          .sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          });

        setSales(nextSales);
      },
      (err) => {
        console.error("Sales listener error:", err);
        setSnack({ open: true, severity: "error", message: "Unable to load orders." });
      }
    );

    return () => unsubSales();
  }, [merchantId]);

  const newOrders = useMemo(() => sales.filter((s) => isMerchantOrderNew(s.status)), [sales]);
  const preparingOrders = useMemo(() => sales.filter((s) => isMerchantOrderPreparing(s.status)), [sales]);
  const readyOrders = useMemo(() => sales.filter((s) => isMerchantOrderReady(s.status)), [sales]);
  const deliveryOrders = useMemo(() => sales.filter((s) => isMerchantOrderInDelivery(s.status)), [sales]);
  const completedOrders = useMemo(() => sales.filter((s) => isMerchantOrderCompleted(s.status)), [sales]);

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 120) return "1 min ago";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
    if (seconds < 7200) return "1 hour ago";
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  const getCountdown = (timestamp, minutes = 10) => {
    if (!timestamp) return "05:00";
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const deadline = new Date(date.getTime() + minutes * 60000);
    const diff = Math.max(0, Math.floor((deadline - new Date()) / 1000));
    const mm = String(Math.floor(diff / 60)).padStart(2, "0");
    const ss = String(diff % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const getItemsPreview = (order) => {
    if (Array.isArray(order.items) && order.items.length > 0) {
      const first = order.items[0];
      const firstName = first.name || first.productName || "Item";
      const firstQty = first.quantity || 1;
      const rest = order.items.length - 1;
      return `${firstQty}x ${firstName}${rest > 0 ? `, +${rest} more` : ""}`;
    }
    const productName = order.productName || "Items";
    const qty = order.quantity || 1;
    return `${qty}x ${productName}`;
  };

  const renderStatusChip = (status) => {
    const value = normalizeMerchantOrderStatus(status);
    if (value === MERCHANT_ORDER_STATUS.NEW) return { label: "NEW", bgcolor: "#fef3c7", color: "#d97706" };
    if (value === MERCHANT_ORDER_STATUS.ACCEPTED) return { label: "ACCEPTED", bgcolor: "#e0f2fe", color: "#0369a1" };
    if (value === MERCHANT_ORDER_STATUS.PREPARING) return { label: "PREPARING", bgcolor: "#ede9fe", color: "#6d28d9" };
    if (value === MERCHANT_ORDER_STATUS.READY_FOR_PICKUP) return { label: "READY FOR PICKUP", bgcolor: "#dcfce7", color: "#15803d" };
    if (value === MERCHANT_ORDER_STATUS.ORDER_PICKED_UP || value === MERCHANT_ORDER_STATUS.IN_DELIVERY) {
      return { label: "IN DELIVERY", bgcolor: "#dbeafe", color: "#1d4ed8" };
    }
    if (value === MERCHANT_ORDER_STATUS.DELIVERED) return { label: "DELIVERED", bgcolor: "#dcfce7", color: "#166534" };
    if (value === MERCHANT_ORDER_STATUS.CANCELLED) return { label: "CANCELLED", bgcolor: "#fee2e2", color: "#b91c1c" };
    return { label: value || "ACTIVE", bgcolor: "#f1f5f9", color: "#64748b" };
  };

  const updateOrderStatusLocal = (orderId, status) => {
    setSales((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status, updatedAt: new Date() } : order
      )
    );
  };

  // Use Firebase callable functions for merchant actions
  const callMerchantAction = async (orderId, action) => {
    console.log("callMerchantAction invoked", { orderId, action });
    if (!orderId) throw new Error("Order ID required");
    
    let fn;
    if (action === "accept") {
      fn = httpsCallable(functions, "merchantAcceptOrder");
    } else if (action === "reject") {
      fn = httpsCallable(functions, "merchantRejectOrder");
    } else {
      throw new Error("Unsupported action");
    }
    
    try {
      const result = await fn({ orderId });
      console.log("Cloud function result", { action, result });
      return result.data;
    } catch (err) {
      console.error("Cloud function error", {
        action,
        code: err.code,
        message: err.message,
        details: err.details,
      });
      
      // Extract the actual error message from Firebase error
      const errorMessage = err.message || err.details || "Action failed";
      throw new Error(errorMessage);
    }
  };

  const handleAcceptOrder = async (order) => {
    if (!order?.id) return;
    console.log("handleAcceptOrder called", { orderId: order.id, status: order.status });
    setActionLoading((prev) => ({ ...prev, [order.id]: "accept" }));
    try {
      await callMerchantAction(order.id, "accept");
      updateOrderStatusLocal(order.id, MERCHANT_ORDER_STATUS.ACCEPTED);
      setSnack({ open: true, severity: "success", message: "Order accepted!" });
    } catch (err) {
      console.error("handleAcceptOrder error", err);
      setSnack({ open: true, severity: "error", message: err.message || "Failed to accept order" });
    } finally {
      setActionLoading((prev) => {
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });
    }
  };

  const handleViewDetails = (order) => {
    setDetailOrder(order || null);
  };

  const handleRejectOrder = async (order) => {
    if (!order?.id) return;
    setActionLoading((prev) => ({ ...prev, [order.id]: "reject" }));
    try {
      await callMerchantAction(order.id, "reject");
      updateOrderStatusLocal(order.id, MERCHANT_ORDER_STATUS.CANCELLED);
      setSnack({ open: true, severity: "success", message: "Order rejected" });
    } catch (err) {
      setSnack({ open: true, severity: "error", message: err.message || "Failed to reject order" });
    } finally {
      setActionLoading((prev) => {
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });
    }
  };

  const handleStartPreparing = async (order) => {
    if (!order?.id) return;
    setActionLoading((prev) => ({ ...prev, [order.id]: "preparing" }));
    try {
      await callMerchantAction(order.id, "prepare");
      updateOrderStatusLocal(order.id, MERCHANT_ORDER_STATUS.PREPARING);
      setSnack({ open: true, severity: "success", message: "Order moved to preparing" });
    } catch (err) {
      setSnack({ open: true, severity: "error", message: err.message || "Failed to start preparing" });
    } finally {
      setActionLoading((prev) => {
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });
    }
  };

  const handleReadyForPickup = async (order) => {
    if (!order?.id) return;
    setActionLoading((prev) => ({ ...prev, [order.id]: "ready" }));
    try {
      await callMerchantAction(order.id, "ready");
      updateOrderStatusLocal(order.id, MERCHANT_ORDER_STATUS.READY_FOR_PICKUP);
      setSnack({ open: true, severity: "success", message: "Marked as ready for pickup" });
    } catch (err) {
      setSnack({ open: true, severity: "error", message: err.message || "Failed to mark ready for pickup" });
    } finally {
      setActionLoading((prev) => {
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#f6f7f8",
        display: "flex",
        justifyContent: "center",
        pb: 12,
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
      }}
    >
      <Container
        maxWidth="sm"
        disableGutters
        sx={{
          bgcolor: "white",
          minHeight: "100dvh",
          boxShadow: { sm: "0 0 40px rgba(0,0,0,0.1)" },
        }}
      >
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            bgcolor: "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid",
            borderColor: "divider",
            px: 2,
            py: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <IconButton
                onClick={() => navigate(-1)}
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: "#f8fafc",
                  color: "#64748b",
                }}
              >
                <MaterialIcon name="arrow_back_ios_new" size={18} />
              </IconButton>
              <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
                Live Orders
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.5,
                bgcolor: "#dcfce7",
                borderRadius: "9999px",
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "#22c55e",
                  animation: "pulseSoft 2s ease-in-out infinite",
                  "@keyframes pulseSoft": {
                    "0%, 100%": { opacity: 1 },
                    "50%": { opacity: 0.5 },
                  },
                }}
              />
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "#16a34a",
                }}
              >
                Online
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Box sx={{ px: 2, pt: 3, pb: 2 }}>
          {/* New Orders */}
          <Box sx={{ mb: 3 }}>
            <Typography
              sx={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 1.5,
              }}
            >
              New Orders ({newOrders.length})
            </Typography>

            {newOrders.length === 0 ? (
              <Box
                sx={{
                  p: 3,
                  borderRadius: "16px",
                  border: "1px dashed #cbd5e1",
                  textAlign: "center",
                  color: "#94a3b8",
                }}
              >
                <MaterialIcon name="receipt_long" size={32} sx={{ color: "#cbd5e1" }} />
                <Typography sx={{ mt: 1 }}>No new orders</Typography>
              </Box>
            ) : (
              newOrders.slice(0, 2).map((order) => (
                <Box
                  key={order.id}
                  sx={{
                    borderRadius: "16px",
                    border: "2px solid rgba(43, 124, 238, 0.6)",
                    bgcolor: "rgba(43, 124, 238, 0.05)",
                    p: 2,
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "#2b7cee",
                        }}
                      >
                        New Order Received
                      </Typography>
                      <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>
                        #{order.id?.slice(-6) || "ORDER"}
                      </Typography>
                      <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>
                        {getItemsPreview(order)} • P{Number(order.total || 0).toFixed(2)}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#2b7cee" }}>
                        {getCountdown(order.createdAt)}
                      </Typography>
                      <Typography sx={{ fontSize: "0.625rem", color: "#64748b" }}>
                        Mins left to accept
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.5, borderTop: "1px solid rgba(43, 124, 238, 0.1)", borderBottom: "1px solid rgba(43, 124, 238, 0.1)", mb: 2 }}>
                    <MaterialIcon name="list_alt" size={16} sx={{ color: "#2b7cee" }} />
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 500 }}>
                      {getItemsPreview(order)}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      onClick={() => handleRejectOrder(order)}
                      disabled={Boolean(actionLoading[order.id])}
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        py: 1.2,
                        borderRadius: "12px",
                        textTransform: "none",
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => handleAcceptOrder(order)}
                      disabled={Boolean(actionLoading[order.id])}
                      sx={{
                        bgcolor: "#2b7cee",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        py: 1.2,
                        borderRadius: "12px",
                        boxShadow: "0 10px 24px rgba(43, 124, 238, 0.3)",
                        textTransform: "none",
                        "&:hover": { bgcolor: "#2566c8" },
                        "&:active": { transform: "scale(0.98)" },
                      }}
                    >
                      Accept Order
                    </Button>
                  </Stack>
                </Box>
              ))
            )}
          </Box>

          {/* Preparing */}
          <Box sx={{ mb: 3 }}>
            <Typography
              sx={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 1.5,
              }}
            >
              Preparing ({preparingOrders.length})
            </Typography>

            <Stack spacing={2}>
              {preparingOrders.length === 0 ? (
                <Box
                  sx={{
                    p: 3,
                    borderRadius: "12px",
                    border: "1px dashed #e2e8f0",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  <Typography>No orders in preparation</Typography>
                </Box>
              ) : (
                preparingOrders.slice(0, 2).map((order) => (
                  <Box
                    key={order.id}
                    sx={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      bgcolor: "white",
                      p: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                      <Box>
                        <Typography sx={{ fontSize: "0.875rem", fontWeight: 700 }}>
                          #{order.id?.slice(-6) || "ORDER"}
                        </Typography>
                        <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>{getItemsPreview(order)}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>
                        P{Number(order.total || 0).toFixed(2)}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={() => handleStartPreparing(order)}
                        disabled={Boolean(actionLoading[order.id]) || normalizeMerchantOrderStatus(order.status) === MERCHANT_ORDER_STATUS.PREPARING}
                        sx={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          borderRadius: "10px",
                          textTransform: "none",
                        }}
                      >
                        Start Preparing
                      </Button>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => handleReadyForPickup(order)}
                        disabled={Boolean(actionLoading[order.id])}
                        sx={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          borderRadius: "10px",
                          textTransform: "none",
                          bgcolor: "#2b7cee",
                          "&:hover": { bgcolor: "#2566c8" },
                        }}
                      >
                        Ready for Pickup
                      </Button>
                    </Stack>
                  </Box>
                ))
              )}
            </Stack>
          </Box>

          {/* Ready For Pickup */}
          <Box sx={{ mb: 3 }}>
            <Typography
              sx={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 1.5,
              }}
            >
              Ready For Pickup ({readyOrders.length})
            </Typography>

            <Stack spacing={2}>
              {readyOrders.length === 0 ? (
                <Box
                  sx={{
                    p: 3,
                    borderRadius: "12px",
                    border: "1px dashed #e2e8f0",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  <Typography>No ready orders yet</Typography>
                </Box>
              ) : (
                readyOrders.slice(0, 2).map((order) => {
                  const timeAgo = getTimeAgo(order.createdAt);
                  const overdue = timeAgo.includes("days") || timeAgo.includes("hours");
                  return (
                    <Box
                      key={order.id}
                      sx={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        bgcolor: "white",
                        p: 2,
                        opacity: overdue ? 0.8 : 1,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 40,
                              height: 40,
                              bgcolor: "#f1f5f9",
                              color: "#64748b",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                            }}
                          >
                            {getInitials(order.customerName || "Customer")}
                          </Avatar>
                          <Box>
                            <Typography sx={{ fontSize: "0.875rem", fontWeight: 700 }}>
                              {order.customerName || "Customer"}
                            </Typography>
                            <Typography sx={{ fontSize: "0.6875rem", color: "#64748b" }}>
                              Order #{order.id?.slice(-6)} • {timeAgo}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography
                            sx={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: overdue ? "#64748b" : "#f97316",
                            }}
                          >
                            {overdue ? "Overdue" : getCountdown(order.createdAt, 15)}
                          </Typography>
                          <Typography sx={{ fontSize: "0.625rem", color: "#94a3b8" }}>
                            {overdue ? "Time exceeded" : "Remaining"}
                          </Typography>
                        </Box>
                      </Box>

                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button
                          variant="outlined"
                          fullWidth
                          onClick={() => handleViewDetails(order)}
                          sx={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            borderRadius: "10px",
                            textTransform: "none",
                          }}
                        >
                          View Details
                        </Button>
                        <Chip
                          label="Waiting for rider pickup"
                          size="small"
                          sx={{
                            alignSelf: "center",
                            mt: 0.5,
                            fontWeight: 700,
                            bgcolor: "#dcfce7",
                            color: "#166534",
                          }}
                        />
                      </Stack>
                    </Box>
                  );
                })
              )}
            </Stack>
          </Box>

          {/* In Delivery */}
          <Box sx={{ mb: 3 }}>
            <Typography
              sx={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 1.5,
              }}
            >
              In Delivery ({deliveryOrders.length})
            </Typography>
            <Stack spacing={1.5}>
              {deliveryOrders.length === 0 ? (
                <Box sx={{ p: 3, borderRadius: "12px", border: "1px dashed #e2e8f0", textAlign: "center", color: "#94a3b8" }}>
                  <Typography>No deliveries in progress</Typography>
                </Box>
              ) : (
                deliveryOrders.slice(0, 2).map((order) => (
                  <Box key={order.id} sx={{ borderRadius: "12px", border: "1px solid #e2e8f0", bgcolor: "white", p: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 700 }}>#{order.id?.slice(-6)}</Typography>
                      <Chip size="small" label={renderStatusChip(order.status).label} sx={{ fontWeight: 700, bgcolor: renderStatusChip(order.status).bgcolor, color: renderStatusChip(order.status).color }} />
                    </Box>
                    <Typography sx={{ mt: 0.8, fontSize: "0.8rem", color: "#64748b" }}>{getItemsPreview(order)}</Typography>
                  </Box>
                ))
              )}
            </Stack>
          </Box>

          {/* Completed */}
          <Box sx={{ mb: 3 }}>
            <Typography
              sx={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 1.5,
              }}
            >
              Completed ({completedOrders.length})
            </Typography>
            <Stack spacing={1.5}>
              {completedOrders.length === 0 ? (
                <Box sx={{ p: 3, borderRadius: "12px", border: "1px dashed #e2e8f0", textAlign: "center", color: "#94a3b8" }}>
                  <Typography>No completed deliveries yet</Typography>
                </Box>
              ) : (
                completedOrders.slice(0, 3).map((order) => (
                  <Box key={order.id} sx={{ borderRadius: "12px", border: "1px solid #e2e8f0", bgcolor: "white", p: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 700 }}>#{order.id?.slice(-6)}</Typography>
                      <Typography sx={{ fontWeight: 700, color: "#166534" }}>P{Number(order.total || 0).toFixed(2)}</Typography>
                    </Box>
                  </Box>
                ))
              )}
            </Stack>
          </Box>

          <Divider sx={{ mt: 2 }} />
        </Box>

        <Dialog
          open={Boolean(detailOrder)}
          onClose={() => setDetailOrder(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ fontWeight: 700 }}>
            Order Details
          </DialogTitle>
          <DialogContent dividers>
            {detailOrder ? (
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Order ID
                  </Typography>
                  <Typography fontWeight={600}>#{detailOrder.id}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Customer
                  </Typography>
                  <Typography fontWeight={600}>
                    {detailOrder.customerName || "Customer"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Chip
                    label={normalizeMerchantOrderStatus(detailOrder.status) || "ACTIVE"}
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total
                  </Typography>
                  <Typography fontWeight={700}>
                    P{Number(detailOrder.total || 0).toFixed(2)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Items
                  </Typography>
                  <Typography>
                    {getItemsPreview(detailOrder)}
                  </Typography>
                </Box>
              </Stack>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailOrder(null)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snack.open}
          autoHideDuration={3500}
          onClose={() => setSnack({ ...snack, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={snack.severity} variant="filled">
            {snack.message}
          </Alert>
        </Snackbar>

        <MerchantBottomNav activePath="/merchant/orders" />
      </Container>
    </Box>
  );
};

export default MerchantOrders;
