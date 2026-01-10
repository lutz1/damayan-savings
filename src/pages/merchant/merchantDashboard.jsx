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

        setMerchantName(
          data.name || data.merchantProfile?.merchantName || "Merchant"
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

  // Revenue Insights
  const revenueInsights = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const todaySales = sales.filter(s => {
      const saleDate = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      return saleDate >= today;
    }).reduce((sum, s) => sum + Number(s.total || 0), 0);

    const weekSales = sales.filter(s => {
      const saleDate = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      return saleDate >= weekAgo;
    }).reduce((sum, s) => sum + Number(s.total || 0), 0);

    const monthSales = sales.filter(s => {
      const saleDate = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      return saleDate >= monthAgo;
    }).reduce((sum, s) => sum + Number(s.total || 0), 0);

    const avgOrderValue = sales.length > 0 ? totalSales / sales.length : 0;
    
    return {
      today: todaySales,
      week: weekSales,
      month: monthSales,
      avgOrder: avgOrderValue,
      totalOrders: sales.length,
    };
  }, [sales, totalSales]);

  // Customer Insights
  const customerInsights = useMemo(() => {
    const uniqueCustomers = new Set(sales.map(s => s.customerId)).size;
    const repeatCustomers = sales.reduce((acc, sale) => {
      acc[sale.customerId] = (acc[sale.customerId] || 0) + 1;
      return acc;
    }, {});
    const repeatCount = Object.values(repeatCustomers).filter(count => count > 1).length;
    
    return {
      total: uniqueCustomers,
      repeat: repeatCount,
      repeatRate: uniqueCustomers > 0 ? (repeatCount / uniqueCustomers * 100).toFixed(1) : 0,
    };
  }, [sales]);

  // Product Performance
  const productPerformance = useMemo(() => {
    const activeProducts = products.filter(p => p.status === 'active' || !p.status).length;
    const lowStock = products.filter(p => Number(p.stock || 0) < 10).length;
    
    return {
      active: activeProducts,
      lowStock,
    };
  }, [products]);

  /* ======================
     TIME-BASED GREETING
  ====================== */
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  /* ======================
     UI
  ====================== */
  return (
    <Box sx={{ pb: 10, px: 2, pt: 2, minHeight: "100vh", bgcolor: "#f5f5f5" }}>
      {/* Welcome Greeting Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          Welcome back, {merchantName || "Merchant"}
        </Typography>
        <Typography variant="h6" fontWeight="500" color="text.secondary" sx={{ mt: 0.5 }}>
          {getTimeBasedGreeting()} 👋
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
          Insights So You Can Keep Track of Your Revenue and Performance and watch your business grow.
        </Typography>
      </Box>

      {/* ===== Revenue Overview ===== */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        📊 Revenue Overview
      </Typography>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6}>
          <Card sx={{ bgcolor: '#e3f2fd' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Today</Typography>
              <Typography variant="h6" fontWeight="bold">₱{revenueInsights.today.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card sx={{ bgcolor: '#f3e5f5' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">This Week</Typography>
              <Typography variant="h6" fontWeight="bold">₱{revenueInsights.week.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card sx={{ bgcolor: '#e8f5e9' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">This Month</Typography>
              <Typography variant="h6" fontWeight="bold">₱{revenueInsights.month.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card sx={{ bgcolor: '#fff3e0' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
              <Typography variant="h6" fontWeight="bold">₱{totalSales.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ===== Performance Metrics ===== */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        📈 Performance Metrics
      </Typography>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Orders</Typography>
              <Typography variant="h5" fontWeight="bold">{revenueInsights.totalOrders}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Avg Order Value</Typography>
              <Typography variant="h5" fontWeight="bold">₱{revenueInsights.avgOrder.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Customers</Typography>
              <Typography variant="h5" fontWeight="bold">{customerInsights.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Repeat Rate</Typography>
              <Typography variant="h5" fontWeight="bold">{customerInsights.repeatRate}%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ===== Product Stats ===== */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        📦 Product Statistics
      </Typography>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Products</Typography>
              <Typography variant="h5" fontWeight="bold">{products.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Active</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">{productPerformance.active}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Low Stock</Typography>
              <Typography variant="h5" fontWeight="bold" color="error.main">{productPerformance.lowStock}</Typography>
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