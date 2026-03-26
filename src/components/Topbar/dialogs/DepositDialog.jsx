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
import { addDoc, collection, query, where, onSnapshot, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const DepositDialog = ({ open, onClose, userData, db }) => {
  const [amount, setAmount] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [depositLogs, setDepositLogs] = useState([]);
  const [processingPayment, setProcessingPayment] = useState(false);

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

  const handleSubmitCashIn = async () => {
    try {
      if (!amount || parseFloat(amount) <= 0) {
        setError("Please enter a valid deposit amount.");
        return;
      }
      if (!currentUser?.uid) {
        setError("Session expired. Please log in again.");
        return;
      }

      setProcessingPayment(true);
      setError("");

      const depositName = userData?.name && userData?.name.trim() 
        ? userData.name 
        : (currentUser.displayName || currentUser.email || "Unknown User");

      await addDoc(collection(db, "deposits"), {
        userId: currentUser.uid,
        name: depositName,
        email: currentUser.email || "",
        amount: Number(amount),
        status: "Pending",
        type: "Cash In Request",
        paymentMethod: "Manual",
        source: "manual",
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      setAmount("");
    } catch (err) {
      setError(err.message || "Cash in request failed. Please try again.");
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
                Cash in Request
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
                Submit your request. Admin will review and confirm your cash in.
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
                onClick={handleSubmitCashIn}
              >
                {processingPayment ? (
                  <>
                    <CircularProgress size={20} sx={{ color: "#000", mr: 1 }} />
                    Processing...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
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