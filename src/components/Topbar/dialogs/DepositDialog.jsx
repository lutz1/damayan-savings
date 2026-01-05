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
import { Savings, CheckCircle, CloudUpload, HelpOutline } from "@mui/icons-material";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { app } from "../../../firebase";

// ✅ Reusable confirmation dialog
const ConfirmDepositDialog = ({ open, onConfirm, onCancel, amount, netAmount }) => (
  <Dialog
    open={open}
    onClose={onCancel}
    maxWidth="xs"
    fullWidth
    PaperProps={{
      sx: {
        borderRadius: 3,
        background: "rgba(25,25,25,0.95)",
        backdropFilter: "blur(20px)",
        color: "#fff",
        p: 1,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      },
    }}
  >
    <DialogTitle sx={{ textAlign: "center", fontWeight: 600 }}>
      Confirm Deposit
    </DialogTitle>
    <DialogContent sx={{ textAlign: "center" }}>
      <HelpOutline sx={{ fontSize: 48, color: "#FFD54F", mb: 1 }} />
      <Typography variant="body1" sx={{ mb: 1 }}>
        Are you sure you want to submit this deposit?
      </Typography>
      <Typography variant="body2" sx={{ color: "#FFB74D" }}>
        Amount: ₱{parseFloat(amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
      </Typography>
    </DialogContent>
    <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
      <Button
        onClick={onCancel}
        variant="outlined"
        color="inherit"
        sx={{
          borderColor: "rgba(255,255,255,0.3)",
          color: "#fff",
          "&:hover": { background: "rgba(255,255,255,0.1)" },
        }}
      >
        Cancel
      </Button>
      <Button
        onClick={onConfirm}
        variant="contained"
        sx={{
          bgcolor: "#81C784",
          color: "#000",
          fontWeight: 600,
          "&:hover": { bgcolor: "#66BB6A" },
        }}
      >
        Yes, Submit
      </Button>
    </DialogActions>
  </Dialog>
);

const DepositDialog = ({ open, onClose, userData, db }) => {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [depositLogs, setDepositLogs] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const auth = getAuth();
  const currentUser = auth.currentUser;
  const storage = getStorage(app);

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

  const handleReceiptUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceipt(file);
    setPreview(URL.createObjectURL(file));
  };

  // 🟡 Show confirmation dialog instead of direct submit
  const handleDepositRequest = () => {
    if (!amount || parseFloat(amount) <= 0)
      return setError("Please enter a valid deposit amount.");
    if (!receipt) return setError("Please upload a deposit receipt.");
    setError("");
    setConfirmOpen(true);
  };

  // ✅ Proceed after user confirmation
  const handleConfirmDeposit = async () => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      // 1. Upload receipt to Firebase Storage
      const storageRef = ref(storage, `receipts/${currentUser.uid}_${Date.now()}`);
      await uploadBytes(storageRef, receipt);
      const receiptUrl = await getDownloadURL(storageRef);

      // 2. Get ID token for secure backend call
      const idToken = await auth.currentUser.getIdToken();
      const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
      // 3. Call backend API to create deposit
      const depositName = userData?.name && userData?.name.trim() ? userData.name : (currentUser.displayName || currentUser.email || "Unknown User");
      const response = await fetch(`${API_BASE}/api/deposit-funds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          amount: parseFloat(amount),
          reference: reference || "",
          receiptUrl,
          name: depositName
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Deposit submission failed");

      setSuccess(true);
      setAmount("");
      setReference("");
      setReceipt(null);
      setPreview("");
      setShowReceiptForm(false);
    } catch (err) {
      console.error(err);
      setError("Deposit submission failed. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    setSuccess(false);
    setReceipt(null);
    setPreview("");
    setShowReceiptForm(false);
    onClose();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "success";
      case "rejected":
        return "error";
      default:
        return "warning";
    }
  };

  // Handle PayMongo payment
  const handlePayMongoPayment = async () => {
    try {
      if (!amount || parseFloat(amount) <= 0) {
        setError("Please enter a valid deposit amount.");
        return;
      }

      setProcessingPayment(true);
      setError("");

      const idToken = await auth.currentUser.getIdToken();
      const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
      const depositName = userData?.name && userData?.name.trim() 
        ? userData.name 
        : (currentUser.displayName || currentUser.email || "Unknown User");

      const response = await fetch(`${API_BASE}/api/create-payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          amount: parseFloat(amount),
          name: depositName,
          email: currentUser.email,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create payment");

      // Redirect to PayMongo checkout
      window.location.href = result.checkoutUrl;
    } catch (err) {
      console.error("PayMongo error:", err);
      setError("Payment creation failed. Please try again.");
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
                Deposit Submitted!
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, color: "rgba(255,255,255,0.7)" }}
              >
                Your deposit will be reviewed shortly by the admin.
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

              {!showReceiptForm && (
                <>
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
                        Processing...
                      </>
                    ) : (
                      "Proceed to Payment"
                    )}
                  </Button>

                  <Typography variant="caption" sx={{ display: "block", textAlign: "center", color: "rgba(255,255,255,0.6)", mt: 1 }}>
                    You will be redirected to secure PayMongo checkout
                  </Typography>
                </>
              )}

              {/* Removed showQR block - using PayMongo checkout instead */}

              {showReceiptForm && (
                <>
                  <TextField
                    fullWidth
                    type="number"
                    label="Deposit Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    sx={{
                      mb: 1,
                      "& .MuiInputBase-root": { color: "#fff" },
                      "& .MuiInputLabel-root": {
                        color: "rgba(255,255,255,0.7)",
                      },
                    }}
                  />

                  {/* Charges removed */}

                  <TextField
                    fullWidth
                    label="Reference Number (Optional)"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    sx={{
                      mb: 2,
                      "& .MuiInputBase-root": { color: "#fff" },
                      "& .MuiInputLabel-root": {
                        color: "rgba(255,255,255,0.7)",
                      },
                    }}
                  />

                  <Box
                    sx={{
                      mb: 2,
                      border: "1px dashed rgba(255,255,255,0.3)",
                      borderRadius: 2,
                      p: 2,
                      textAlign: "center",
                    }}
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt="Receipt"
                        style={{
                          width: "100%",
                          maxHeight: 150,
                          objectFit: "contain",
                          borderRadius: 8,
                        }}
                      />
                    ) : (
                      <>
                        <CloudUpload sx={{ fontSize: 40, color: "#81C784" }} />
                        <Typography
                          sx={{
                            mt: 1,
                            fontSize: 14,
                            color: "rgba(255,255,255,0.7)",
                          }}
                        >
                          Upload Deposit Receipt
                        </Typography>
                        <Button
                          component="label"
                          sx={{
                            mt: 1,
                            borderColor: "rgba(255,255,255,0.3)",
                            color: "#fff",
                            "&:hover": {
                              background: "rgba(255,255,255,0.1)",
                            },
                          }}
                        >
                          Choose File
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={handleReceiptUpload}
                          />
                        </Button>
                      </>
                    )}
                  </Box>
                </>
              )}
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
                      color={getStatusColor(log.status)}
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

          {!success && showReceiptForm && (
            <Button
              onClick={handleDepositRequest}
              variant="contained"
              disabled={loading}
              sx={{
                bgcolor: "#81C784",
                color: "#000",
                fontWeight: 600,
                "&:hover": { bgcolor: "#66BB6A" },
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: "#000" }} />
              ) : (
                "Deposit"
              )}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ✅ Custom Confirmation Dialog */}
      <ConfirmDepositDialog
        open={confirmOpen}
        onConfirm={handleConfirmDeposit}
        onCancel={() => setConfirmOpen(false)}
        amount={amount}
      />
    </>
  );
};

export default DepositDialog;