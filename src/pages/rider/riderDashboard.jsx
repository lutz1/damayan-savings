import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import Navbar from "../../components/Navbar";

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

  useEffect(() => {
    loadRiderData();
  }, []);

  const loadRiderData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Get rider profile
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setRiderData(userSnap.data());
      }

      // Get rider's deliveries
      const deliveriesRef = collection(db, "deliveries");
      const q = query(
        deliveriesRef,
        where("riderId", "==", user.uid)
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
      loadRiderData();
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

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Rider Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Welcome back, {riderData?.name || "Rider"}!
          </Typography>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Total Deliveries
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                      {stats.totalDeliveries}
                    </Typography>
                  </Box>
                  <LocalShippingIcon sx={{ fontSize: 40, color: "primary.main", opacity: 0.7 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Completed
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                      {stats.completedDeliveries}
                    </Typography>
                  </Box>
                  <CheckCircleIcon sx={{ fontSize: 40, color: "success.main", opacity: 0.7 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Pending
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                      {stats.pendingDeliveries}
                    </Typography>
                  </Box>
                  <PendingActionsIcon sx={{ fontSize: 40, color: "warning.main", opacity: 0.7 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Total Earnings
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                      ₱{stats.totalEarnings.toFixed(2)}
                    </Typography>
                  </Box>
                  <MonetizationOnIcon sx={{ fontSize: 40, color: "success.main", opacity: 0.7 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Deliveries List */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <AssignmentIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Recent Deliveries
            </Typography>
          </Box>

          {deliveries.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 3 }}>
              No deliveries assigned yet.
            </Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              {deliveries.map((delivery) => (
                <Card
                  key={delivery.id}
                  sx={{
                    mb: 2,
                    p: 2,
                    cursor: "pointer",
                    "&:hover": { boxShadow: 2 },
                    transition: "all 0.3s ease",
                  }}
                  onClick={() => handleDeliveryClick(delivery)}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Order #{delivery.orderId || delivery.id.slice(0, 8)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Pickup: {delivery.pickupLocation?.address || "N/A"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                        Dropoff: {delivery.dropoffLocation?.address || "N/A"}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Chip
                        label={delivery.status?.toUpperCase() || "PENDING"}
                        color={getStatusColor(delivery.status)}
                        size="small"
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        ₱{delivery.deliveryFee?.toFixed(2) || "0.00"}
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              ))}
            </Box>
          )}
        </Paper>
      </Container>

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
