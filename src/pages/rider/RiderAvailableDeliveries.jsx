import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, functions } from "../../firebase";
import { httpsCallable } from "firebase/functions";
import { Box, Button, Paper, Stack, Typography, CircularProgress, Snackbar, Alert } from "@mui/material";
import { DELIVERY_STATUS } from "./utils/deliveryStatus";

export default function RiderAvailableDeliveries() {
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [snack, setSnack] = useState({ open: false, severity: "info", message: "" });
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    // Show deliveries where status is ASSIGNED and riderId is null, and this rider is a candidate
    const q = query(
      collection(db, "deliveries"),
      where("status", "==", DELIVERY_STATUS.ASSIGNED)
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Filter for candidateRiderIds containing this rider
      const filtered = all.filter((d) => Array.isArray(d.candidateRiderIds) && d.candidateRiderIds.includes(user.uid) && !d.riderId);
      setDeliveries(filtered);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleClaim = async (delivery) => {
    try {
      const fn = httpsCallable(functions, "riderClaimDelivery");
      const result = await fn({ deliveryId: delivery.id });
      if (result.data.success) {
        setSnack({ open: true, severity: "success", message: "Delivery assigned to you!" });
      } else {
        setSnack({ open: true, severity: "error", message: result.data.error || "Job already taken" });
      }
    } catch (err) {
      setSnack({ open: true, severity: "error", message: err.message || "Failed to claim delivery" });
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography sx={{ fontWeight: 900, fontSize: 18, mb: 2 }}>Available Deliveries</Typography>
      {loading ? (
        <CircularProgress />
      ) : deliveries.length === 0 ? (
        <Typography>No available deliveries right now.</Typography>
      ) : (
        <Stack spacing={2}>
          {deliveries.map((delivery) => (
            <Paper key={delivery.id} sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 700 }}>Order #{delivery.orderId || delivery.id.slice(0, 8)}</Typography>
              <Typography sx={{ fontSize: 13 }}>Pickup: {delivery.pickupLocation?.address || "N/A"}</Typography>
              <Typography sx={{ fontSize: 13 }}>Dropoff: {delivery.dropoffLocation?.address || "N/A"}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 800 }}>P{Number(delivery.deliveryFee || 0).toFixed(2)}</Typography>
              <Button
                variant="contained"
                color="success"
                sx={{ mt: 1.5, fontWeight: 700, borderRadius: 2 }}
                onClick={() => handleClaim(delivery)}
              >
                Swipe to Accept
              </Button>
            </Paper>
          ))}
        </Stack>
      )}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} sx={{ width: "100%" }}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
