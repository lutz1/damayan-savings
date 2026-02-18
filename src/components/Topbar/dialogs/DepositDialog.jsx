// src/components/DepositDialog.jsx
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Typography,
  Button,
  CircularProgress,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";
import { Savings, CheckCircle } from "@mui/icons-material";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const DepositDialog = ({ open, onClose, userData, db }) => {
  const [amount, setAmount] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [depositLogs, setDepositLogs] = useState([]);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);

  const auth = getAuth();
  const currentUser = auth.currentUser;

  // 🔁 Real-time deposit logs
  useEffect(() => {
    if (!open || !currentUser?.uid) return;
    const q = query(collection(db, "deposits"), where("userId", "==", currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setDepositLogs(logs);
    });
    return () => unsubscribe();
  }, [open, currentUser?.uid, db]);

  const handleClose = () => {
    setError("");
    setSuccess(false);
    setAmount("");
    onClose();
  };

  // Handle PayMongo payment
  const handlePayMongoPayment = async () => {
    try {
      if (!amount || parseFloat(amount) <= 0) {
        setError("Please enter a valid deposit amount.");
        return;
      }

      setProcessingPayment(true);
      setServerWaking(false);
      setError("");

      // Show "waking server" message after 3 seconds
      const wakeTimer = setTimeout(() => {
        setServerWaking(true);
      }, 3000);

      const idToken = await auth.currentUser.getIdToken();
      const API_BASE = import.meta.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
      const depositName = userData?.name && userData?.name.trim() 
        ? userData.name 
        : (currentUser.displayName || currentUser.email || "Unknown User");

      // Add timeout to the fetch request (30 seconds for Render cold start)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE}/api/create-payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          amount: parseFloat(amount),
          name: depositName,
          email: currentUser.email,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      clearTimeout(wakeTimer);

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create payment");

      // Store checkoutId in sessionStorage so success page can retrieve it
      if (result.checkoutId) {
        sessionStorage.setItem("paymongo_checkout_id", result.checkoutId);
        console.log("[DepositDialog] Stored checkoutId:", result.checkoutId);
      }

      // Redirect to PayMongo checkout
      window.location.href = result.checkoutUrl;
    } catch (err) {
      console.error("PayMongo error:", err);
      
      if (err.name === 'AbortError') {
        setError("Request timeout. The server might be waking up. Please try again in a moment.");
      } else {
        setError(err.message || "Payment creation failed. Please try again.");
      }
      
      setServerWaking(false);
    } finally {
      setProcessingPayment(false);
    }
  };



  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: "rgba(30,30,30,0.9)",
            backdropFilter: "blur(20px)",
            color: "#fff",
            p: 1,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          },
        }}
      >
        <DialogTitle
          sx={{
            textAlign: "center",
            fontWeight: 600,
            borderBottom: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          Deposit Funds
        </DialogTitle>

        <DialogContent>
          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Savings sx={{ fontSize: 40, color: "#81C784" }} />
            <Typography variant="h6" sx={{ mt: 1 }}>
              Current Wallet Balance
            </Typography>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, color: "#4CAF50" }}
            >
              ₱
              {userData?.eWallet?.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </Box>

          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

          {success ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <CheckCircle sx={{ fontSize: 50, color: "#4CAF50" }} />
              <Typography sx={{ mt: 1, color: "#4CAF50", fontWeight: 600 }}>
                Payment Submitted!
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, color: "rgba(255,255,255,0.7)" }}
              >
                Your payment is awaiting admin approval. You will be notified once it's confirmed.
              </Typography>
            </Box>
          ) : (
            <>
              {error && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 2,
                    background: "rgba(255,82,82,0.15)",
                    color: "#FF8A80",
                  }}
                >
                  {error}
                </Alert>
              )}

              <Typography variant="subtitle2" sx={{ mb: 2, color: "#FFD54F", fontWeight: 600 }}>
                💳 Fast & Secure Payment
              </Typography>
              <TextField
                fullWidth
                type="number"
                label="Deposit Amount (₱)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                sx={{
                  mb: 2,
                  "& .MuiInputBase-root": { color: "#fff" },
                  "& .MuiInputLabel-root": {
                    color: "rgba(255,255,255,0.7)",
                  },
                }}
              />
              
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mb: 1.5 }}>
                ✅ Supports GCash, Credit Cards & Bank Transfer
              </Typography>

              <Button
                variant="contained"
                fullWidth
                disabled={processingPayment || !amount || parseFloat(amount) <= 0}
                sx={{
                  bgcolor: "#81C784",
                  color: "#000",
                  fontWeight: 600,
                  mb: 1,
                  "&:hover": { bgcolor: "#66BB6A" },
                  "&.Mui-disabled": { opacity: 0.6 },
                }}
                onClick={handlePayMongoPayment}
              >
                {processingPayment ? (
                  <>
                    <CircularProgress size={20} sx={{ color: "#000", mr: 1 }} />
                    {serverWaking ? "Waking server..." : "Processing..."}
                  </>
                ) : (
                  "Proceed to Payment"
                )}
              </Button>

              {serverWaking && (
                <Alert
                  severity="info"
                  sx={{
                    mb: 1,
                    background: "rgba(33,150,243,0.15)",
                    color: "#90CAF9",
                    fontSize: 12,
                  }}
                >
                  ⏳ Server is waking up (Render free tier). This may take 30-50 seconds. Please wait...
                </Alert>
              )}

              <Typography variant="caption" sx={{ display: "block", textAlign: "center", color: "rgba(255,255,255,0.6)", mt: 1 }}>
                You will be redirected to secure PayMongo checkout
              </Typography>
            </>
          )}

          {depositLogs.length > 0 && (
            <>
              <Divider
                sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }}
              />
              <Typography
                variant="subtitle1"
                sx={{
                  mb: 1,
                  fontWeight: 600,
                  color: "#90CAF9",
                }}
              >
                Deposit Logs
              </Typography>
              <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
                {depositLogs.map((log) => (
                  <ListItem
                    key={log.id}
                    sx={{
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      py: 0.5,
                    }}
                  >
                    <ListItemText
                      primary={`₱${log.amount.toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })} • Ref: ${log.reference || "—"}`}
                      secondary={
                        log.createdAt
                          ? new Date(
                              log.createdAt.seconds * 1000
                            ).toLocaleString("en-PH")
                          : "Pending..."
                      }
                      primaryTypographyProps={{ color: "#fff" }}
                      secondaryTypographyProps={{
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 12,
                      }}
                    />
                    <Chip
                      size="small"
                      label={log.status}
                      color={log.status?.toLowerCase() === "approved" ? "success" : log.status?.toLowerCase() === "rejected" ? "error" : "warning"}
                      sx={{
                        textTransform: "capitalize",
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            color="inherit"
            sx={{
              borderColor: "rgba(255,255,255,0.3)",
              color: "#fff",
              "&:hover": { background: "rgba(255,255,255,0.1)" },
            }}
          >
            {success ? "Close" : "Cancel"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DepositDialog;