// src/pages/merchant/merchantDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Fab,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  List,
  ListItem,
  ListItemText,
  Avatar,
} from "@mui/material";
import { Add } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { ResponsiveBar } from "@nivo/bar";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc, 
} from "firebase/firestore";
import { db } from "../../firebase";
import BottomNav from "../../components/BottomNav";

const MerchantDashboard = () => {
  const navigate = useNavigate();
  const merchantId = localStorage.getItem("uid");

  const [merchantName, setMerchantName] = useState("");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [period, setPeriod] = useState("monthly");

 /* ======================
   LOAD MERCHANT NAME
====================== */
useEffect(() => {
  if (!merchantId) return;

  const unsub = onSnapshot(
    doc(db, "users", merchantId),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        console.log("User doc:", data);

        setMerchantName(
          data.merchantProfile?.merchantName || "Merchant"
        );
      } else {
        console.warn("User doc not found:", merchantId);
      }
    },
    (err) => console.error("User snapshot error:", err)
  );

  return () => unsub();
}, [merchantId]);

  /* ======================
     FIRESTORE LISTENERS
  ====================== */
  useEffect(() => {
    if (!merchantId) return;

    const unsubProducts = onSnapshot(
      query(collection(db, "products"), where("merchantId", "==", merchantId)),
      (snap) =>
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubSales = onSnapshot(
      query(
        collection(db, "sales"),
        where("merchantId", "==", merchantId),
        orderBy("createdAt", "desc")
      ),
      (snap) =>
        setSales(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubFeedback = onSnapshot(
      query(
        collection(db, "feedback"),
        where("merchantId", "==", merchantId),
        orderBy("createdAt", "desc")
      ),
      (snap) =>
        setFeedbacks(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubProducts();
      unsubSales();
      unsubFeedback();
    };
  }, [merchantId]);

  /* ======================
     ANALYTICS
  ====================== */
  const totalSales = useMemo(
    () => sales.reduce((sum, s) => sum + Number(s.total || 0), 0),
    [sales]
  );

  const productSalesData = useMemo(() => {
    const map = {};
    sales.forEach((s) => {
      map[s.productName] =
        (map[s.productName] || 0) + Number(s.total || 0);
    });
    return Object.keys(map).map((k) => ({
      product: k,
      sales: map[k],
    }));
  }, [sales]);

  const topProducts = [...productSalesData]
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  /* ======================
     UI
  ====================== */
  return (
    <Box sx={{ pb: 10, px: 2, pt: 2, minHeight: "100vh", bgcolor: "#f5f5f5" }}>
      {/* Header */}
      <Typography variant="h5" fontWeight="bold" mb={2}>
        {merchantName || "Merchant"} Dashboard
      </Typography>

      {/* ===== Stats ===== */}
      <Grid container spacing={2} mb={2}>
        <Grid item xs={6}>
          <Card>
            <CardContent>
              <Typography variant="body2">Products</Typography>
              <Typography variant="h5">{products.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card>
            <CardContent>
              <Typography variant="body2">Total Sales</Typography>
              <Typography variant="h5">₱{totalSales}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ===== Period Toggle ===== */}
      <ToggleButtonGroup
        fullWidth
        size="small"
        value={period}
        exclusive
        onChange={(_, v) => v && setPeriod(v)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="weekly">Weekly</ToggleButton>
        <ToggleButton value="monthly">Monthly</ToggleButton>
        <ToggleButton value="annual">Annual</ToggleButton>
      </ToggleButtonGroup>

      {/* ===== Sales Chart ===== */}
      <Card sx={{ height: 260, mb: 3 }}>
        <CardContent>
          <Typography fontWeight={600} mb={1}>
            Product Sales Analytics
          </Typography>
          <ResponsiveBar
            data={productSalesData}
            keys={["sales"]}
            indexBy="product"
            margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
            padding={0.3}
            axisBottom={{ tickRotation: -30 }}
            enableLabel={false}
          />
        </CardContent>
      </Card>

      {/* ===== Top Products ===== */}
      <Typography fontWeight={600} mb={1}>
        Top Trending Products
      </Typography>
      {topProducts.map((p) => (
        <Chip
          key={p.product}
          label={`${p.product} ₱${p.sales}`}
          sx={{ mr: 1, mb: 1 }}
          color="success"
        />
      ))}

      <Divider sx={{ my: 2 }} />

      {/* ===== Purchase Logs ===== */}
      <Typography fontWeight={600}>Purchase Logs</Typography>
      <List>
        {sales.slice(0, 5).map((s) => (
          <ListItem key={s.id}>
            <Avatar sx={{ mr: 2 }}>
              {s.customerName?.[0] || "C"}
            </Avatar>
            <ListItemText
              primary={`${s.customerName} purchased ${s.productName}`}
              secondary={`x${s.quantity} ₱${s.price} = ₱${s.total}`}
            />
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />

      {/* ===== Feedback ===== */}
      <Typography fontWeight={600}>Customer Feedback</Typography>
      {feedbacks.length === 0 ? (
        <Typography color="gray">No feedback yet</Typography>
      ) : (
        <List>
          {feedbacks.slice(0, 5).map((f) => (
            <ListItem key={f.id}>
              <ListItemText
                primary={`${f.customerName} — ⭐ ${f.rating}`}
                secondary={`${f.productName}: ${f.comment}`}
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* ===== Floating Add ===== */}
      <Fab
        color="success"
        sx={{ position: "fixed", bottom: 90, right: 16 }}
        onClick={() => navigate("/merchant/add-product")}
      >
        <Add />
      </Fab>

      <BottomNav />
    </Box>
  );
};

export default MerchantDashboard;