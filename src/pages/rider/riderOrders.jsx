import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Assignment,
  Home,
  ReceiptLong,
  AccountBalanceWallet,
  Person,
} from "@mui/icons-material";
import { Box, Button, Card, CardContent, Chip, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { DELIVERY_STATUS, normalizeDeliveryStatus } from "./utils/deliveryStatus";

export default function RiderOrders() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setDeliveries([]);
        setLoading(false);
        navigate("/rider/login", { replace: true });
        return;
      }

      const q = query(collection(db, "deliveries"), where("riderId", "==", user.uid));
      const unsubDeliveries = onSnapshot(
        q,
        (snap) => {
          const mapped = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
          mapped.sort((a, b) => {
            const aMs = Date.parse(a.lastUpdated || a.updatedAt || a.createdAt || 0) || 0;
            const bMs = Date.parse(b.lastUpdated || b.updatedAt || b.createdAt || 0) || 0;
            return bMs - aMs;
          });
          setDeliveries(mapped);
          setLoading(false);
        },
        () => setLoading(false)
      );

      return () => unsubDeliveries();
    });

    return () => unsubAuth();
  }, [navigate]);

  const stats = useMemo(() => {
    const total = deliveries.length;
    const active = deliveries.filter((d) => {
      const status = normalizeDeliveryStatus(d.status);
      return status && status !== DELIVERY_STATUS.DELIVERED && status !== DELIVERY_STATUS.CANCELLED;
    }).length;
    const completed = deliveries.filter((d) => normalizeDeliveryStatus(d.status) === DELIVERY_STATUS.DELIVERED).length;
    return { total, active, completed };
  }, [deliveries]);

  const statusColor = (status) => {
    const normalized = normalizeDeliveryStatus(status);
    if (normalized === DELIVERY_STATUS.DELIVERED) return "success";
    if (normalized === DELIVERY_STATUS.CANCELLED) return "error";
    if (normalized === DELIVERY_STATUS.IN_DELIVERY || normalized === DELIVERY_STATUS.ORDER_PICKED_UP) return "info";
    return "warning";
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#f8fafc", pb: 12 }}>
      <Container maxWidth="sm" disableGutters sx={{ minHeight: "100dvh", bgcolor: "#fff" }}>
        <Paper sx={{ position: "sticky", top: 0, zIndex: 10, p: 2, borderRadius: 0, borderBottom: "1px solid #e2e8f0" }}>
          <Typography sx={{ fontSize: 20, fontWeight: 900 }}>My Orders</Typography>
          <Typography sx={{ fontSize: 12, color: "#64748b" }}>Track all assigned and completed deliveries</Typography>
        </Paper>

        <Box sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.2} sx={{ mb: 2 }}>
            <Card sx={{ flex: 1, borderRadius: 2.5 }}><CardContent sx={{ py: 1.6 }}><Typography sx={{ fontSize: 11, color: "#64748b" }}>TOTAL</Typography><Typography sx={{ fontSize: 22, fontWeight: 900 }}>{stats.total}</Typography></CardContent></Card>
            <Card sx={{ flex: 1, borderRadius: 2.5 }}><CardContent sx={{ py: 1.6 }}><Typography sx={{ fontSize: 11, color: "#64748b" }}>ACTIVE</Typography><Typography sx={{ fontSize: 22, fontWeight: 900, color: "#2563eb" }}>{stats.active}</Typography></CardContent></Card>
            <Card sx={{ flex: 1, borderRadius: 2.5 }}><CardContent sx={{ py: 1.6 }}><Typography sx={{ fontSize: 11, color: "#64748b" }}>DONE</Typography><Typography sx={{ fontSize: 22, fontWeight: 900, color: "#16a34a" }}>{stats.completed}</Typography></CardContent></Card>
          </Stack>

          {loading ? (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <CircularProgress size={30} />
            </Box>
          ) : deliveries.length === 0 ? (
            <Paper sx={{ p: 3, borderRadius: 2.5, textAlign: "center", color: "#64748b" }}>
              <Assignment sx={{ fontSize: 30, mb: 0.5 }} />
              <Typography>No delivery orders yet.</Typography>
            </Paper>
          ) : (
            <Stack spacing={1.2}>
              {deliveries.map((delivery) => (
                <Paper key={delivery.id} sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                      Order #{delivery.orderId || delivery.id.slice(0, 8)}
                    </Typography>
                    <Chip size="small" color={statusColor(delivery.status)} label={normalizeDeliveryStatus(delivery.status) || DELIVERY_STATUS.NEW} sx={{ fontWeight: 700 }} />
                  </Box>
                  <Typography sx={{ fontSize: 12, color: "#64748b" }}>Pickup: {delivery.pickupLocation?.address || "N/A"}</Typography>
                  <Typography sx={{ fontSize: 12, color: "#64748b" }}>Dropoff: {delivery.dropoffLocation?.address || "N/A"}</Typography>
                  <Typography sx={{ mt: 0.6, fontSize: 13, fontWeight: 800 }}>P{Number(delivery.deliveryFee || 0).toFixed(2)}</Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>

        <Box sx={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, width: "100%", maxWidth: 600, borderTop: "1px solid rgba(91,236,19,0.15)", bgcolor: "#fff", px: 1, pt: 1, pb: 1.8, zIndex: 30 }}>
          <Stack direction="row" spacing={0.3}>
            <Button onClick={() => navigate("/rider/dashboard")} sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><Home sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 700 }}>Home</Typography></Button>
            <Button onClick={() => navigate("/rider/orders")} sx={{ flex: 1, minWidth: 0, color: "#5bec13", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><ReceiptLong sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 900 }}>Orders</Typography></Button>
            <Button onClick={() => navigate("/rider/wallet")} sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><AccountBalanceWallet sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 700 }}>Wallet</Typography></Button>
            <Button onClick={() => navigate("/rider/profile")} sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><Person sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 700 }}>Profile</Typography></Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
