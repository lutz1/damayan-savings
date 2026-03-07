import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
} from "@mui/material";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../../firebase";
import AssignmentIcon from "@mui/icons-material/Assignment";
import NavigationIcon from "@mui/icons-material/Navigation";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import HomeIcon from "@mui/icons-material/Home";
import ExploreIcon from "@mui/icons-material/Explore";
import PersonIcon from "@mui/icons-material/Person";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import { useNavigate } from "react-router-dom";

const RiderDashboard = () => {
  const [riderData, setRiderData] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    completedDeliveries: 0,
    pendingDeliveries: 0,
    totalEarnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [deliveryDialog, setDeliveryDialog] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [updateNote, setUpdateNote] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setRiderData(null);
        setDeliveries([]);
        setStats({
          totalDeliveries: 0,
          completedDeliveries: 0,
          pendingDeliveries: 0,
          totalEarnings: 0,
        });
        setLoading(false);
        return;
      }

      loadRiderData(user.uid);
    });

    return () => unsubscribe();
  }, []);

  const loadRiderData = async (uid) => {
    try {
      setLoading(true);
      if (!uid) {
        setLoading(false);
        return;
      }

      // Get rider profile
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setRiderData(userSnap.data());
      }

      // Get rider's deliveries
      const deliveriesRef = collection(db, "deliveries");
      const q = query(
        deliveriesRef,
        where("riderId", "==", uid)
      );
      const querySnapshot = await getDocs(q);
      const deliveriesList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setDeliveries(deliveriesList);

      // Calculate stats
      const completed = deliveriesList.filter((d) => d.status === "completed").length;
      const pending = deliveriesList.filter((d) => d.status === "pending" || d.status === "assigned").length;
      const totalEarnings = deliveriesList
        .filter((d) => d.status === "completed")
        .reduce((sum, d) => sum + (d.deliveryFee || 0), 0);

      setStats({
        totalDeliveries: deliveriesList.length,
        completedDeliveries: completed,
        pendingDeliveries: pending,
        totalEarnings: totalEarnings,
      });

      setLoading(false);
    } catch (error) {
      console.error("Error loading rider data:", error);
      setLoading(false);
    }
  };

  const handleDeliveryClick = (delivery) => {
    setSelectedDelivery(delivery);
    setDeliveryDialog(true);
  };

  const handleUpdateDelivery = async (newStatus) => {
    try {
      if (!selectedDelivery) return;

      const deliveryRef = doc(db, "deliveries", selectedDelivery.id);
      await updateDoc(deliveryRef, {
        status: newStatus,
        [`status_${newStatus}_at`]: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: updateNote || selectedDelivery.notes || "",
      });

      setDeliveryDialog(false);
      setUpdateNote("");
      loadRiderData(auth.currentUser?.uid);
    } catch (error) {
      console.error("Error updating delivery:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "success";
      case "in_transit":
        return "info";
      case "assigned":
        return "warning";
      case "pending":
        return "secondary";
      default:
        return "default";
    }
  };

  const formatCurrency = (value) => `P${Number(value || 0).toFixed(2)}`;

  const metricCircle = (label, value, color, progress) => (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: 78,
          height: 78,
          borderRadius: "50%",
          bgcolor: "#fff",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 10px rgba(15,23,42,0.08)",
        }}
      >
        <CircularProgress
          variant="determinate"
          value={100}
          size={78}
          thickness={4}
          sx={{ color: `${color}33`, position: "absolute", inset: 0 }}
        />
        <CircularProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, progress))}
          size={78}
          thickness={4}
          sx={{ color, position: "absolute", inset: 0 }}
        />
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{value}</Typography>
      </Box>
      <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: "#64748b" }}>
        {label}
      </Typography>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ minHeight: "100dvh", bgcolor: "#f6f8f6", display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: "center", width: "100%", maxWidth: 380 }}>
          <CircularProgress size={40} sx={{ mb: 2, color: "#5bec13" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Loading Rider Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Fetching your profile and deliveries...
          </Typography>
        </Paper>
      </Box>
    );
  }

  const onlineHours = isOnline ? "Online" : "Offline";

  return (
    <>
      <Box sx={{ minHeight: "100dvh", bgcolor: "#f6f8f6", color: "#0f172a" }}>
        <Box sx={{ maxWidth: 430, mx: "auto", minHeight: "100dvh", bgcolor: "#f6f8f6", position: "relative", boxShadow: "0 10px 30px rgba(15,23,42,0.10)" }}>
          <Box
            sx={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 1.5,
              backdropFilter: "blur(8px)",
              bgcolor: "rgba(255,255,255,0.85)",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Welcome back,</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{riderData?.name || "Rider"}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: 0.8 }}>
                {isOnline ? "ONLINE" : "OFFLINE"}
              </Typography>
              <Switch checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#5bec13" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#5bec13" } }} />
            </Box>
          </Box>

          <Box sx={{ px: 2, pt: 2, pb: 18 }}>
            <Card sx={{ bgcolor: "#0f172a", color: "#fff", borderRadius: 3, p: 2, mb: 2.5, position: "relative", overflow: "hidden" }}>
              <Box sx={{ position: "absolute", right: -18, top: -18, opacity: 0.08, fontSize: 120, fontWeight: 700 }}>$</Box>
              <Box sx={{ position: "relative", zIndex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <AccountBalanceWalletIcon sx={{ color: "#5bec13", fontSize: 20 }} />
                  <Typography sx={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>Wallet Balance</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "end", justifyContent: "space-between" }}>
                  <Typography sx={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>{formatCurrency(stats.totalEarnings)}</Typography>
                  <Button sx={{ bgcolor: "#5bec13", color: "#0f172a", fontWeight: 800, borderRadius: 2, px: 2, py: 1, "&:hover": { bgcolor: "#4dd90f" } }}>
                    Cash Out
                  </Button>
                </Box>
              </Box>
            </Card>

            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 1.5 }}>Today's Performance</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1.2 }}>
                {metricCircle("EARNINGS", formatCurrency(stats.totalEarnings), "#5bec13", Math.min(100, stats.totalEarnings > 0 ? 78 : 8))}
                {metricCircle("ORDERS", String(stats.totalDeliveries), "#3b82f6", Math.min(100, stats.totalDeliveries * 10 || 8))}
                {metricCircle("STATUS", onlineHours, "#f59e0b", isOnline ? 72 : 20)}
              </Box>
            </Box>

            <Box sx={{ mb: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 800 }}>Demand Map</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.7, bgcolor: "#ffedd5", px: 1.2, py: 0.5, borderRadius: 1.2 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#f97316" }} />
                  <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#c2410c" }}>HOT ZONES</Typography>
                </Box>
              </Box>
              <Box sx={{ height: 240, borderRadius: 3, overflow: "hidden", position: "relative", border: "1px solid #e2e8f0", bgcolor: "#cbd5e1" }}>
                <Box sx={{ position: "absolute", inset: 0, backgroundImage: "url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=430&h=300&auto=format&fit=crop')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.58, filter: "grayscale(1)" }} />
                <Box sx={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 40%, rgba(255,165,0,0.4) 0%, transparent 40%), radial-gradient(circle at 70% 60%, rgba(255,165,0,0.28) 0%, transparent 35%)" }} />
                <Box sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#5bec13", boxShadow: "0 0 0 10px rgba(91,236,19,0.25), 0 0 0 22px rgba(91,236,19,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <NavigationIcon sx={{ fontSize: 14, color: "#0f172a" }} />
                  </Box>
                </Box>
                <Chip label="High Demand" size="small" sx={{ position: "absolute", top: 52, left: 16, bgcolor: "#f97316", color: "#fff", fontWeight: 700, fontSize: 11 }} />
                <Chip label="Surge +P2.00" size="small" sx={{ position: "absolute", right: 16, bottom: 32, bgcolor: "#f97316", color: "#fff", fontWeight: 700, fontSize: 11 }} />
              </Box>
            </Box>

            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
                <AssignmentIcon sx={{ mr: 1, color: "#334155" }} />
                <Typography sx={{ fontSize: 16, fontWeight: 800 }}>Recent Deliveries</Typography>
              </Box>

              {deliveries.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 2 }}>
                  No deliveries assigned yet.
                </Typography>
              ) : (
                <Box>
                  {deliveries.map((delivery) => (
                    <Card
                      key={delivery.id}
                      sx={{ mb: 1.3, p: 1.5, cursor: "pointer", borderRadius: 2, "&:hover": { boxShadow: 2 }, transition: "all 0.2s ease" }}
                      onClick={() => handleDeliveryClick(delivery)}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 1.2 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Order #{delivery.orderId || delivery.id.slice(0, 8)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.3 }}>
                            Pickup: {delivery.pickupLocation?.address || "N/A"}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                            Dropoff: {delivery.dropoffLocation?.address || "N/A"}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          <Chip label={delivery.status?.toUpperCase() || "PENDING"} color={getStatusColor(delivery.status)} size="small" sx={{ mb: 0.8 }} />
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {formatCurrency(delivery.deliveryFee)}
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>

          <Box sx={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 88, width: "90%", maxWidth: 380, zIndex: 35 }}>
            <Box sx={{ bgcolor: "rgba(91,236,19,0.95)", borderRadius: 2.5, px: 2, py: 1.2, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 8px 22px rgba(91,236,19,0.28)", border: "1px solid rgba(255,255,255,0.4)" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <RadioButtonCheckedIcon sx={{ fontSize: 12, color: "#0f172a" }} />
                <Typography sx={{ color: "#0f172a", fontSize: 13, fontWeight: 800 }}>
                  {isOnline ? "Ready for orders" : "Currently offline"}
                </Typography>
              </Box>
              <ExploreIcon sx={{ color: "#0f172a", fontSize: 20 }} />
            </Box>
          </Box>

          <Box sx={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, width: "100%", maxWidth: 430, bgcolor: "rgba(255,255,255,0.96)", borderTop: "1px solid #e2e8f0", px: 1.5, pt: 1, pb: 2, zIndex: 30 }}>
            <Box sx={{ display: "flex", justifyContent: "space-around" }}>
              <Button onClick={() => navigate("/rider/dashboard")} sx={{ minWidth: 0, color: "#5bec13", display: "flex", flexDirection: "column", gap: 0.2 }}>
                <HomeIcon sx={{ fontSize: 28 }} />
                <Typography sx={{ fontSize: 10, fontWeight: 800, textTransform: "none" }}>Home</Typography>
              </Button>
              <Button sx={{ minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2 }}>
                <ExploreIcon sx={{ fontSize: 28 }} />
                <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: "none" }}>Explore</Typography>
              </Button>
              <Button sx={{ minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2 }}>
                <AccountBalanceWalletIcon sx={{ fontSize: 28 }} />
                <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: "none" }}>Earnings</Typography>
              </Button>
              <Button onClick={() => navigate("/rider/profile")} sx={{ minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2 }}>
                <PersonIcon sx={{ fontSize: 28 }} />
                <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: "none" }}>Profile</Typography>
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Delivery Details Dialog */}
      <Dialog open={deliveryDialog} onClose={() => setDeliveryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Delivery #{selectedDelivery?.orderId || selectedDelivery?.id?.slice(0, 8)}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedDelivery && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Status: <Chip label={selectedDelivery.status?.toUpperCase() || "PENDING"} size="small" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Pickup:</strong> {selectedDelivery.pickupLocation?.address || "N/A"}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Dropoff:</strong> {selectedDelivery.dropoffLocation?.address || "N/A"}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Delivery Fee:</strong> ₱{selectedDelivery.deliveryFee?.toFixed(2) || "0.00"}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Add Notes"
                value={updateNote}
                onChange={(e) => setUpdateNote(e.target.value)}
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeliveryDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => handleUpdateDelivery("in_transit")}
            disabled={selectedDelivery?.status === "in_transit" || selectedDelivery?.status === "completed"}
          >
            Mark In Transit
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => handleUpdateDelivery("completed")}
            disabled={selectedDelivery?.status === "completed"}
          >
            Complete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RiderDashboard;
