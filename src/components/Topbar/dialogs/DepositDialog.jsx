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
import { Savings, CheckCircle, CloudUpload } from "@mui/icons-material";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import gcashImage from "../../../assets/gcash.jpg";
import { app } from "../../../firebase"; // your Firebase app

const DepositDialog = ({ open, onClose, userData, db }) => {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [depositLogs, setDepositLogs] = useState([]);

  const chargeRate = 0.02; // 2% deposit charge
  const chargeAmount = amount ? parseFloat(amount) * chargeRate : 0;
  const calculatedNet = amount ? parseFloat(amount) - chargeAmount : 0;

  const auth = getAuth();
  const currentUser = auth.currentUser;
  const storage = getStorage(app);

  // Fetch deposit logs live
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

  const handleDeposit = async () => {
    if (!currentUser) {
      setError("You must be logged in to deposit.");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid deposit amount.");
      return;
    }
    if (!receipt) {
      setError("Please upload a deposit receipt.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Upload receipt to Firebase Storage
      const storageRef = ref(storage, `receipts/${currentUser.uid}_${Date.now()}`);
      await uploadBytes(storageRef, receipt);
      const receiptUrl = await getDownloadURL(storageRef);

      // Save deposit record in Firestore
      await addDoc(collection(db, "deposits"), {
        userId: currentUser.uid,
        name: userData?.name || "",
        amount: parseFloat(amount),
        charge: parseFloat(chargeAmount.toFixed(2)),
        netAmount: parseFloat(calculatedNet.toFixed(2)),
        reference: reference || "",
        receiptUrl,
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      setAmount("");
      setReference("");
      setReceipt(null);
      setPreview("");
      setShowQR(false);
      setShowReceiptForm(false);
    } catch (err) {
      console.error(err);
      setError("Failed to submit deposit. Please check your permissions and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    setSuccess(false);
    setReceipt(null);
    setPreview("");
    setShowQR(false);
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

  return (
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
      <DialogTitle sx={{ textAlign: "center", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
        Deposit Funds
      </DialogTitle>

      <DialogContent>
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Savings sx={{ fontSize: 40, color: "#81C784" }} />
          <Typography variant="h6" sx={{ mt: 1 }}>Current Wallet Balance</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#4CAF50" }}>
            ₱{userData?.eWallet?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </Typography>
        </Box>

        <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

        {success ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <CheckCircle sx={{ fontSize: 50, color: "#4CAF50" }} />
            <Typography sx={{ mt: 1, color: "#4CAF50", fontWeight: 600 }}>Deposit Submitted!</Typography>
            <Typography variant="body2" sx={{ mt: 1, color: "rgba(255,255,255,0.7)" }}>
              Your deposit will be reviewed shortly by the admin.
            </Typography>
          </Box>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2, background: "rgba(255,82,82,0.15)", color: "#FF8A80" }}>{error}</Alert>}

            {!showQR && (
              <Button variant="contained" fullWidth sx={{ mb: 2, bgcolor: "#81C784", "&:hover": { bgcolor: "#66BB6A" } }} onClick={() => setShowQR(true)}>
                Scan QR to Deposit
              </Button>
            )}

            {showQR && !showReceiptForm && (
              <Box sx={{ textAlign: "center", mb: 2 }}>
                <img src={gcashImage} alt="GCash QR" style={{ width: "100%", borderRadius: 12 }} />
                <Button variant="outlined" fullWidth sx={{ mt: 2, borderColor: "#fff", color: "#fff" }} onClick={() => setShowReceiptForm(true)}>
                  Proceed to Upload Receipt
                </Button>
              </Box>
            )}

            {showReceiptForm && (
              <>
                <TextField
                  fullWidth
                  type="number"
                  label="Deposit Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  sx={{ mb: 1, "& .MuiInputBase-root": { color: "#fff" }, "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" } }}
                />

                {amount && parseFloat(amount) > 0 && (
                  <Typography variant="body2" sx={{ mb: 2, color: "#FFB74D" }}>
                    Charge (2%): ₱{chargeAmount.toFixed(2)} • Net Deposit: ₱{calculatedNet.toFixed(2)}
                  </Typography>
                )}

                <TextField
                  fullWidth
                  label="Reference Number (Optional)"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  sx={{ mb: 2, "& .MuiInputBase-root": { color: "#fff" }, "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" } }}
                />

                <Box sx={{ mb: 2, border: "1px dashed rgba(255,255,255,0.3)", borderRadius: 2, p: 2, textAlign: "center" }}>
                  {preview ? (
                    <img src={preview} alt="Receipt" style={{ width: "100%", maxHeight: 150, objectFit: "contain", borderRadius: 8 }} />
                  ) : (
                    <>
                      <CloudUpload sx={{ fontSize: 40, color: "#81C784" }} />
                      <Typography sx={{ mt: 1, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Upload Deposit Receipt</Typography>
                      <Button component="label" sx={{ mt: 1, borderColor: "rgba(255,255,255,0.3)", color: "#fff", "&:hover": { background: "rgba(255,255,255,0.1)" } }}>
                        Choose File
                        <input type="file" accept="image/*" hidden onChange={handleReceiptUpload} />
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
            <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600, color: "#90CAF9" }}>Deposit Logs</Typography>
            <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
              {depositLogs.map((log) => (
                <ListItem key={log.id} sx={{ borderBottom: "1px solid rgba(255,255,255,0.1)", py: 0.5 }}>
                  <ListItemText
                    primary={`₱${log.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} • Ref: ${log.reference || "—"}`}
                    secondary={log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleString("en-PH") : "Pending..."}
                    primaryTypographyProps={{ color: "#fff" }}
                    secondaryTypographyProps={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}
                  />
                  <Chip size="small" label={log.status} color={getStatusColor(log.status)} sx={{ textTransform: "capitalize", fontWeight: 600, fontSize: 11 }} />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit" sx={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff", "&:hover": { background: "rgba(255,255,255,0.1)" } }}>
          {success ? "Close" : "Cancel"}
        </Button>

        {!success && showReceiptForm && (
          <Button onClick={handleDeposit} variant="contained" disabled={loading} sx={{ bgcolor: "#81C784", color: "#000", fontWeight: 600, "&:hover": { bgcolor: "#66BB6A" } }}>
            {loading ? <CircularProgress size={24} sx={{ color: "#000" }} /> : "Deposit"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DepositDialog;