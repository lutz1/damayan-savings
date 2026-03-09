import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Paper,
  Container,
  IconButton,
  Stack,
  Chip,
  Card,
  CardContent,
  CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { createFirebaseClients } from "../../../shared/firebase/firebaseClient";
import Topbar from "../components/Topbar";
import AppBottomNav from "../components/AppBottomNav";
import bgImage from "../assets/bg.jpg";

const { auth, db } = createFirebaseClients("RiderApp");

const formatAmount = (value) => `₱${Number(value || 0).toFixed(2)}`;

const toDateSafe = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
  const date = toDateSafe(value);
  if (!date) return "—";
  return date.toLocaleString();
};

const getStatusColor = (status) => {
  const normalized = (status || "").toUpperCase();
  if (["PENDING", "NEW"].includes(normalized)) return { bg: "#fef3c7", fg: "#92400e" };
  if (["ACCEPTED", "CONFIRMED", "PREPARING"].includes(normalized)) return { bg: "#dbeafe", fg: "#1d4ed8" };
  if (["OUT_FOR_DELIVERY", "RIDER_ASSIGNED", "PICKED_UP"].includes(normalized)) return { bg: "#e0f2fe", fg: "#0369a1" };
  if (["DELIVERED", "COMPLETED"].includes(normalized)) return { bg: "#dcfce7", fg: "#166534" };
  if (["CANCELLED", "REJECTED"].includes(normalized)) return { bg: "#fee2e2", fg: "#b91c1c" };
  return { bg: "#e2e8f0", fg: "#334155" };
};

export default function MemberOrders() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  useEffect(() => {
    const uid = auth.currentUser?.uid || localStorage.getItem("uid");
    if (!uid) {
      setOrders([]);
      setLoading(false);
      return undefined;
    }

    const unsub = onSnapshot(
      query(collection(db, "orders"), where("customerId", "==", uid)),
      (snap) => {
        const mapped = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        mapped.sort((a, b) => {
          const aTime = toDateSafe(a.createdAt)?.getTime() || 0;
          const bTime = toDateSafe(b.createdAt)?.getTime() || 0;
          return bTime - aTime;
        });
        setOrders(mapped);
        setLoading(false);
      },
      () => {
        setOrders([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const totalSpent = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [orders]
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.35)",
          zIndex: 0,
        }}
      />

      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      <Box sx={{ zIndex: 5, position: isMobile ? "fixed" : "relative", height: "100%" }}>
        <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 3 },
          mt: 1,
          pb: { xs: 12, sm: 12, md: 12 },
          color: "white",
          zIndex: 1,
          width: "100%",
          overflowX: "hidden",
        }}
      >
        <Toolbar />

        <Container maxWidth="md" disableGutters>
          <Typography
            variant={isMobile ? "h6" : "h5"}
            sx={{ fontWeight: 700, mb: 2, textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}
          >
            My Orders
          </Typography>

          <Paper
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 2,
              background: "rgba(255,255,255,0.14)",
              backdropFilter: "blur(12px)",
              color: "white",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Orders</Typography>
                <Typography variant="h6" fontWeight={700}>{orders.length}</Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Spent</Typography>
                <Typography variant="h6" fontWeight={700}>{formatAmount(totalSpent)}</Typography>
              </Box>
            </Stack>
          </Paper>

          {loading ? (
            <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
              <CircularProgress color="inherit" />
            </Box>
          ) : orders.length === 0 ? (
            <Paper
              sx={{
                p: 4,
                borderRadius: 2,
                textAlign: "center",
                background: "rgba(255,255,255,0.14)",
                backdropFilter: "blur(12px)",
                color: "white",
              }}
            >
              <Typography variant="h6" fontWeight={700}>No orders yet</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
                Your placed orders will appear here.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              {orders.map((order) => {
                const status = (order.status || "PENDING").toUpperCase();
                const statusColor = getStatusColor(status);
                const itemsCount = Array.isArray(order.items)
                  ? order.items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 1), 0)
                  : Number(order.quantity || 1);

                return (
                  <Card
                    key={order.id}
                    sx={{
                      borderRadius: 2,
                      background: "rgba(255,255,255,0.14)",
                      backdropFilter: "blur(12px)",
                      color: "white",
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Order #{order.id.slice(-8).toUpperCase()}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.85 }}>
                            {formatDateTime(order.createdAt)}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={status}
                          sx={{
                            bgcolor: statusColor.bg,
                            color: statusColor.fg,
                            fontWeight: 700,
                          }}
                        />
                      </Stack>

                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.2 }}>
                        <Typography variant="body2" sx={{ opacity: 0.92 }}>
                          Items: {itemsCount}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.92 }}>
                          {formatAmount(order.total || 0)}
                        </Typography>
                      </Stack>

                      <Typography variant="body2" sx={{ mt: 1, opacity: 0.92 }}>
                        {order.deliveryAddress || "No delivery address"}
                      </Typography>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Container>
      </Box>
    </Box>
  );
}
