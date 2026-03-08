import React, { useEffect, useMemo, useState } from "react";
import { Box, Container, Paper, Typography, Stack, Card, CardContent } from "@mui/material";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import BottomNav from "../../components/BottomNav";
import { isMerchantOrderCompleted } from "../../utils/merchantOrderFlow";

const currency = (value) => `P${Number(value || 0).toFixed(2)}`;

const MaterialIcon = ({ name, size = 24 }) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: size, fontVariationSettings: "'FILL' 1, 'wght' 500" }}
  >
    {name}
  </span>
);

const MerchantReports = () => {
  const navigate = useNavigate();
  const merchantId = localStorage.getItem("uid");
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!merchantId) return undefined;

    const unsub = onSnapshot(
      query(collection(db, "orders"), where("merchantId", "==", merchantId), orderBy("createdAt", "desc")),
      (snap) => setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Merchant reports listener error:", err)
    );

    return () => unsub();
  }, [merchantId]);

  const metrics = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay.getTime() - (now.getDay() || 7) * 24 * 60 * 60 * 1000);

    const completed = orders.filter((s) => isMerchantOrderCompleted(s.status));

    const dailySales = completed
      .filter((s) => {
        const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || 0);
        return date >= startOfDay;
      })
      .reduce((sum, s) => sum + Number(s.total || 0), 0);

    const weeklySales = completed
      .filter((s) => {
        const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || 0);
        return date >= startOfWeek;
      })
      .reduce((sum, s) => sum + Number(s.total || 0), 0);

    const itemCount = {};
    for (const sale of completed) {
      const items = Array.isArray(sale.items) ? sale.items : [];
      for (const item of items) {
        const name = String(item.name || item.productName || "Item");
        itemCount[name] = (itemCount[name] || 0) + Number(item.quantity || 1);
      }
    }

    const topSellingItems = Object.entries(itemCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    return {
      dailySales,
      weeklySales,
      totalOrders: orders.length,
      completedOrders: completed.length,
      topSellingItems,
    };
  }, [orders]);

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#f8fafc", display: "flex", justifyContent: "center", pb: 12 }}>
      <Container maxWidth="sm" disableGutters sx={{ bgcolor: "white", minHeight: "100dvh" }}>
        <Paper sx={{ position: "sticky", top: 0, zIndex: 10, p: 2, borderRadius: 0, borderBottom: "1px solid #e2e8f0" }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box onClick={() => navigate(-1)} sx={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
              <MaterialIcon name="arrow_back_ios_new" size={18} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.1rem" }}>Sales Reports</Typography>
          </Stack>
        </Paper>

        <Box sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Card><CardContent><Typography variant="caption">Daily Sales</Typography><Typography sx={{ fontWeight: 800, fontSize: "1.5rem" }}>{currency(metrics.dailySales)}</Typography></CardContent></Card>
            <Card><CardContent><Typography variant="caption">Weekly Sales</Typography><Typography sx={{ fontWeight: 800, fontSize: "1.5rem" }}>{currency(metrics.weeklySales)}</Typography></CardContent></Card>
            <Card><CardContent><Typography variant="caption">Total Orders</Typography><Typography sx={{ fontWeight: 800, fontSize: "1.5rem" }}>{metrics.totalOrders}</Typography></CardContent></Card>
            <Card><CardContent><Typography variant="caption">Completed Orders</Typography><Typography sx={{ fontWeight: 800, fontSize: "1.5rem" }}>{metrics.completedOrders}</Typography></CardContent></Card>

            <Card>
              <CardContent>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Top Selling Items</Typography>
                {metrics.topSellingItems.length === 0 ? (
                  <Typography sx={{ color: "#64748b", fontSize: "0.9rem" }}>No completed sales yet.</Typography>
                ) : (
                  <Stack spacing={0.8}>
                    {metrics.topSellingItems.map((item) => (
                      <Stack key={item.name} direction="row" justifyContent="space-between">
                        <Typography sx={{ fontSize: "0.9rem" }}>{item.name}</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{item.qty}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Box>

        <BottomNav />
      </Container>
    </Box>
  );
};

export default MerchantReports;
