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
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { auth, db } from "../../firebase";
import BottomNav from "../../components/BottomNav";

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
  const merchantId = localStorage.getItem("uid");
  const [sales, setSales] = useState([]);
  const [detailOrder, setDetailOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [snack, setSnack] = useState({ open: false, severity: "error", message: "" });

  useEffect(() => {
    if (!merchantId) return undefined;

    const unsubSales = onSnapshot(
      query(
        collection(db, "sales"),
        where("merchantId", "==", merchantId),
        orderBy("createdAt", "desc")
      ),
      (snap) => setSales(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Sales listener error:", err);
        setSnack({ open: true, severity: "error", message: "Unable to load orders." });
      }
    );

    return () => unsubSales();
  }, [merchantId]);

  const normalizeStatus = (status) => (status || "").toString().toUpperCase();

  const upcomingStatuses = new Set([
    "NEW",
    "PENDING",
    "ACCEPTED",
    "CONFIRMED",
  ]);

  const preparingStatuses = new Set([
    "PREPARING",
    "READY_FOR_PICKUP",
  ]);

  const deliveryStatuses = new Set([
    "RIDER_ASSIGNED",
    "OUT_FOR_PICKUP",
    "PICKED_UP",
    "OUT_FOR_DELIVERY",
    "ARRIVING",
  ]);

  const isUpcoming = (status) => upcomingStatuses.has(normalizeStatus(status));
  const isDelivery = (status) => deliveryStatuses.has(normalizeStatus(status));
  const isPreparing = (status) => preparingStatuses.has(normalizeStatus(status));

  const upcomingOrders = useMemo(() => sales.filter((s) => isUpcoming(s.status)), [sales]);
  const deliveryOrders = useMemo(() => sales.filter((s) => isDelivery(s.status)), [sales]);
  const preparingOrders = useMemo(
    () => sales.filter((s) => !isUpcoming(s.status) && !isDelivery(s.status) && isPreparing(s.status)),
    [sales]
  );

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
    const value = normalizeStatus(status);
    if (value.includes("ready")) return { label: "Ready", bgcolor: "#dcfce7", color: "#16a34a" };
    if (value.includes("pending") || value.includes("new"))
      return { label: "In Progress", bgcolor: "#fef3c7", color: "#d97706" };
    if (value.includes("scheduled"))
      return { label: "Scheduled", bgcolor: "#f1f5f9", color: "#64748b" };
    return { label: status || "Active", bgcolor: "#f1f5f9", color: "#64748b" };
  };

  const updateOrderStatusLocal = (orderId, status) => {
    setSales((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status, updatedAt: new Date() } : order
      )
    );
  };

  const callMerchantAction = async (orderId, action) => {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be signed in to perform this action.");

    const idToken = await user.getIdToken();
    const API_BASE = import.meta.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
    const response = await fetch(`${API_BASE}/api/v1/merchant/orders/${orderId}/${action}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    let result = null;
    try {
      result = await response.json();
    } catch (err) {
      if (!response.ok) throw new Error("Server error: Invalid response");
    }

    if (!response.ok) throw new Error(result?.error || "Request failed");
    return result;
  };

  const handleAcceptOrder = async (order) => {
    if (!order?.id) return;
    setActionLoading((prev) => ({ ...prev, [order.id]: "accept" }));
    try {
      await callMerchantAction(order.id, "accept");
      updateOrderStatusLocal(order.id, "ACCEPTED");
    } catch (err) {
      alert(err.message || "Failed to accept order");
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

  const handleReadyForPickup = async (order) => {
    if (!order?.id) return;
    setActionLoading((prev) => ({ ...prev, [order.id]: "ready" }));
    try {
      await callMerchantAction(order.id, "ready");
      updateOrderStatusLocal(order.id, "READY_FOR_PICKUP");
    } catch (err) {
      alert(err.message || "Failed to mark ready for pickup");
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
        minHeight: "100vh",
        bgcolor: "#f6f7f8",
        display: "flex",
        justifyContent: "center",
        pb: 12,
      }}
    >
      <Container
        maxWidth="sm"
        disableGutters
        sx={{
          bgcolor: "white",
          minHeight: "100vh",
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
          {/* Upcoming Orders */}
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
              Upcoming Orders ({upcomingOrders.length})
            </Typography>

            {upcomingOrders.length === 0 ? (
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
                <Typography sx={{ mt: 1 }}>No upcoming orders</Typography>
              </Box>
            ) : (
              upcomingOrders.slice(0, 1).map((order) => (
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

                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => handleAcceptOrder(order)}
                    disabled={Boolean(actionLoading[order.id])}
                    sx={{
                      bgcolor: "#2b7cee",
                      fontWeight: 700,
                      fontSize: "1rem",
                      py: 1.5,
                      borderRadius: "12px",
                      boxShadow: "0 10px 24px rgba(43, 124, 238, 0.3)",
                      textTransform: "none",
                      "&:hover": { bgcolor: "#2566c8" },
                      "&:active": { transform: "scale(0.98)" },
                    }}
                  >
                    Accept Order
                  </Button>
                </Box>
              ))
            )}
          </Box>

          {/* In Delivery Process */}
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
              In Delivery Process
            </Typography>

            <Stack spacing={2}>
              {deliveryOrders.length === 0 ? (
                <Box
                  sx={{
                    p: 3,
                    borderRadius: "12px",
                    border: "1px dashed #e2e8f0",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  <Typography>No deliveries in progress</Typography>
                </Box>
              ) : (
                deliveryOrders.slice(0, 2).map((order) => (
                  <Box
                    key={order.id}
                    sx={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      bgcolor: "white",
                      p: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                      <Box>
                        <Typography sx={{ fontSize: "0.875rem", fontWeight: 700 }}>
                          #{order.id?.slice(-6) || "ORDER"}
                        </Typography>
                        <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {order.status || "In delivery"}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>
                        P{Number(order.total || 0).toFixed(2)}
                      </Typography>
                    </Box>

                    {order.riderName ? (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          p: 2,
                          border: "1px solid #e2e8f0",
                          borderRadius: "10px",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Box sx={{ position: "relative" }}>
                            <Avatar src={order.riderPhoto || ""} sx={{ width: 40, height: 40 }}>
                              {getInitials(order.riderName)}
                            </Avatar>
                            <Box
                              sx={{
                                position: "absolute",
                                bottom: -2,
                                right: -2,
                                width: 16,
                                height: 16,
                                bgcolor: "#22c55e",
                                borderRadius: "50%",
                                border: "2px solid white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <MaterialIcon name="check" size={10} sx={{ color: "white" }} />
                            </Box>
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: "0.875rem", fontWeight: 700 }}>
                              {order.riderName}
                            </Typography>
                            <Typography sx={{ fontSize: "0.625rem", color: "#64748b" }}>
                              {order.riderVehicle || "Rider en route"}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#2b7cee" }}>
                            {order.eta || "5 mins away"}
                          </Typography>
                          <Typography sx={{ fontSize: "0.625rem", color: "#94a3b8" }}>
                            Heading to store
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          p: 2,
                          bgcolor: "rgba(43, 124, 238, 0.08)",
                          borderRadius: "10px",
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: "9999px",
                            bgcolor: "rgba(43, 124, 238, 0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <MaterialIcon name="motorcycle" size={20} sx={{ color: "#2563eb" }} />
                        </Box>
                        <Box>
                          <Typography
                            sx={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              color: "#2563eb",
                            }}
                          >
                            Searching for nearby rider...
                          </Typography>
                          <Typography sx={{ fontSize: "0.6875rem", color: "#64748b" }}>
                            Delivery partners notified
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                ))
              )}
            </Stack>
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
                preparingOrders.slice(0, 2).map((order) => {
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
                  );
                })
              )}
            </Stack>
          </Box>

          <Divider sx={{ mt: 2 }} />
        </Box>

        <BottomNav />

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
                    label={normalizeStatus(detailOrder.status) || "ACTIVE"}
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
      </Container>
    </Box>
  );
};

export default MerchantOrders;
