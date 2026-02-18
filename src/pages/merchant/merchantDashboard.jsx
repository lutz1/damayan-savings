// src/pages/merchant/merchantDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  IconButton,
  LinearProgress,
  Chip,
  Divider,
  Stack,
  Paper,
  Container,
  Snackbar,
  Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
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

// Material Symbols Icon Component
const MaterialIcon = ({ name, filled = false, weight = 400, size = 24, sx = {} }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}`,
      ...sx
    }}
  >
    {name}
  </span>
);

const MerchantDashboard = () => {
  const navigate = useNavigate();
  const merchantId = localStorage.getItem("uid");

  const [merchantName, setMerchantName] = useState("");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [period, setPeriod] = useState("monthly");
  const [snack, setSnack] = useState({ open: false, severity: "error", message: "" });

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
          data.name || data.merchantProfile?.merchantName || "Merchant"
        );
      } else {
        console.warn("User doc not found:", merchantId);
      }
    },
    (err) => {
      console.error("User snapshot error:", err);
      setSnack({ open: true, severity: "error", message: "Failed to load merchant profile." });
    }
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
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Products listener error:", err);
        setSnack({ open: true, severity: "error", message: "Unable to load products." });
      }
    );

    const unsubSales = onSnapshot(
      query(
        collection(db, "sales"),
        where("merchantId", "==", merchantId),
        orderBy("createdAt", "desc")
      ),
      (snap) =>
        setSales(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Sales listener error:", err);
        setSnack({ open: true, severity: "error", message: "Unable to load orders/sales." });
      }
    );

    const unsubFeedback = onSnapshot(
      query(
        collection(db, "feedback"),
        where("merchantId", "==", merchantId),
        orderBy("createdAt", "desc")
      ),
      (snap) =>
        setFeedbacks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Feedback listener error:", err);
        setSnack({ open: true, severity: "error", message: "Unable to load feedback." });
      }
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

  // Helper to get initials from name
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  // Format time ago
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

  // Calculate daily goal (you can adjust this)
  const dailyGoal = 1650;
  const todayProgress = Math.min((revenueInsights.today / dailyGoal) * 100, 100);

  /* ======================
     UI
  ====================== */
  return (
    <Box sx={{ 
      minHeight: "100vh", 
      bgcolor: "#f6f7f8",
      display: 'flex',
      justifyContent: 'center',
      pb: 12
    }}>
      <Container 
        maxWidth="sm" 
        disableGutters
        sx={{ 
          bgcolor: 'white',
          minHeight: '100vh',
          boxShadow: { sm: '0 0 40px rgba(0,0,0,0.1)' }
        }}
      >
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: 2,
            py: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar 
                  sx={{ 
                    width: 40, 
                    height: 40,
                    border: '2px solid rgba(43, 124, 238, 0.1)'
                  }}
                >
                  {getInitials(merchantName)}
                </Avatar>
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    bgcolor: '#4ade80',
                    borderRadius: '50%',
                    border: '2px solid white'
                  }}
                />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>
                  Welcome back,
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.2, color: '#0f172a' }}>
                  {merchantName || "Merchant"}
                </Typography>
              </Box>
            </Box>
            <IconButton 
              sx={{ 
                bgcolor: '#f8fafc',
                width: 40,
                height: 40,
                '&:hover': { 
                  bgcolor: 'rgba(43, 124, 238, 0.1)',
                  color: '#2b7cee'
                }
              }}
            >
              <MaterialIcon name="notifications" size={22} sx={{ color: '#64748b' }} />
            </IconButton>
          </Box>
        </Paper>

        {/* Main Content */}
        <Box sx={{ px: 2, pt: 3 }}>
          {/* Summary Metrics Section */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
              {/* Large Primary Card - Today's Sales */}
              <Card 
                sx={{ 
                  gridColumn: 'span 2',
                  border: '1px solid rgba(43, 124, 238, 0.2)',
                  bgcolor: 'rgba(43, 124, 238, 0.05)',
                  boxShadow: 'none'
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: '#2b7cee', 
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontSize: '0.875rem'
                      }}
                    >
                      Today's Sales
                    </Typography>
                    <Chip
                      icon={<MaterialIcon name="trending_up" size={14} sx={{ color: '#16a34a' }} />}
                      label="+12%"
                      size="small"
                      sx={{
                        height: 20,
                        bgcolor: '#dcfce7',
                        color: '#16a34a',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        '& .MuiChip-icon': { ml: 0.5 }
                      }}
                    />
                  </Box>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 800, 
                      mb: 1.5,
                      color: '#0f172a',
                      fontSize: '2rem'
                    }}
                  >
                    ₱{revenueInsights.today.toFixed(2)}
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={todayProgress}
                    sx={{
                      height: 6,
                      borderRadius: 999,
                      bgcolor: '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: '#2b7cee',
                        borderRadius: 999
                      }
                    }}
                  />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#64748b', 
                      fontSize: '0.6875rem',
                      mt: 1,
                      display: 'block'
                    }}
                  >
                    {todayProgress.toFixed(0)}% of daily goal reached
                  </Typography>
                </CardContent>
              </Card>

              {/* Small Secondary Cards */}
              <Card sx={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      width: 32,
                      height: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      bgcolor: '#eff6ff',
                      mb: 1
                    }}
                  >
                    <MaterialIcon name="shopping_cart" size={20} sx={{ color: '#3b82f6' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.75rem' }}>
                    Active Orders
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.5 }}>
                    {revenueInsights.totalOrders}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      width: 32,
                      height: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      bgcolor: '#fff7ed',
                      mb: 1
                    }}
                  >
                    <MaterialIcon name="local_shipping" size={20} sx={{ color: '#f97316' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, fontSize: '0.75rem' }}>
                    Pending Deliveries
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.5 }}>
                    {sales.filter(s => s.status === 'pending' || s.status === 'processing').length}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Recent Orders Section */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700, 
                  fontSize: '1.25rem',
                  color: '#0f172a'
                }}
              >
                Recent Orders
              </Typography>
              <Typography
                onClick={() => navigate('/merchant/orders')}
                sx={{
                  color: '#2b7cee',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                View All
              </Typography>
            </Box>

            <Stack divider={<Divider />} sx={{ bgcolor: 'white' }}>
              {sales.slice(0, 4).length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <MaterialIcon name="receipt_long" size={48} sx={{ color: '#cbd5e1', mb: 2 }} />
                  <Typography color="text.secondary">No orders yet</Typography>
                </Box>
              ) : (
                sales.slice(0, 4).map((sale) => (
                  <Box
                    key={sale.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 2,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#f8fafc' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar
                        sx={{
                          width: 48,
                          height: 48,
                          bgcolor: '#f1f5f9',
                          color: '#64748b',
                          fontWeight: 700
                        }}
                      >
                        {getInitials(sale.customerName || "Customer")}
                      </Avatar>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>
                          {sale.customerName || "Customer"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                          Order #{sale.id.slice(-4)} • {getTimeAgo(sale.createdAt)}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
                        ₱{Number(sale.total || 0).toFixed(2)}
                      </Typography>
                      <Chip
                        label={sale.status === 'completed' ? 'Ready' : sale.status === 'pending' ? 'In Progress' : 'Scheduled'}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          ...(sale.status === 'completed' && {
                            bgcolor: '#dcfce7',
                            color: '#16a34a'
                          }),
                          ...(sale.status === 'pending' && {
                            bgcolor: '#fef3c7',
                            color: '#d97706'
                          }),
                          ...(!sale.status && {
                            bgcolor: '#f1f5f9',
                            color: '#64748b'
                          })
                        }}
                      />
                    </Box>
                  </Box>
                ))
              )}
            </Stack>
          </Box>
        </Box>

        {/* Bottom Navigation */}
        <BottomNav />

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

export default MerchantDashboard;