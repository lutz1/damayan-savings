// src/components/Topbar/dialogs/WithdrawDialog.jsx
import React, { useState, useEffect } from "react";
import {
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  MenuItem,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { CheckCircle, UploadFile } from "@mui/icons-material";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  doc,
  runTransaction,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const WithdrawDialog = ({ open, onClose, userData, db, auth, onBalanceUpdate }) => {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [withdrawLogs, setWithdrawLogs] = useState([]);
  const [netAmount, setNetAmount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false); // ✅ Permission dialog
  const storage = getStorage();

  const getFriendlyWithdrawError = (rawMessage) => {
    const msg = String(rawMessage || "").toLowerCase();

    if (msg.includes("minimum withdrawal")) return "Minimum withdrawal is P100.";
    if (msg.includes("insufficient wallet") || msg.includes("insufficient balance")) {
      return "Insufficient wallet balance.";
    }
    if (msg.includes("unauthorized") || msg.includes("invalid token") || msg.includes("expired token")) {
      return "Your session has expired. Please log in again and retry.";
    }
    if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network request failed")) {
      return "Network issue detected. Please check your connection and try again.";
    }
    if (msg.includes("exists is not a function") || msg.includes("internal server error")) {
      return "Withdrawal service is temporarily unavailable. Please try again in a few minutes.";
    }

    return "Unable to process your withdrawal right now. Please try again later.";
  };

  // ✅ Live fetch withdrawal logs
  useEffect(() => {
    if (!open || !auth?.currentUser) return;

    const q = query(
      collection(db, "withdrawals"),
      where("userId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setWithdrawLogs(logs);
    });

    return () => unsubscribe();
  }, [open, auth, db]);

  // ✅ Recalculate net amount whenever amount or method changes
  useEffect(() => {
    const amt = parseFloat(amount) || 0;
    if (paymentMethod === "GCash" || paymentMethod === "Bank") {
      const fee = amt * 0.05;
      setNetAmount(amt - fee);
    } else {
      setNetAmount(amt);
    }
  }, [amount, paymentMethod]);

  const handleQrUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setQrFile(file);
      setQrPreview(URL.createObjectURL(file));
    }
  };

  // ✅ Main Withdraw Logic (called after user confirms)
  const performWithdraw = async () => {
    if (loading) return;
    setConfirmOpen(false);
    setError("");
    setLoading(true);

    try {
      const numAmount = parseFloat(amount);
      
      // 1️⃣ Upload QR file to Firebase Storage
      const qrRef = ref(
        storage,
        `withdrawals_qr/${auth.currentUser.uid}_${Date.now()}_${qrFile.name}`
      );
      await uploadBytes(qrRef, qrFile);
      const qrUrl = await getDownloadURL(qrRef);

      // 2️⃣ Call Cloud Function to process withdrawal
      const idToken = await auth.currentUser.getIdToken();
      const clientRequestId = `${auth.currentUser.uid}_${Date.now()}`;

      const response = await fetch(
        "https://us-central1-amayan-savings.cloudfunctions.net/createWithdrawal",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            amount: numAmount,
            paymentMethod,
            qrUrl,
            clientRequestId,
          }),
        }
      );

      if (!response.ok) {
        let serverMessage = "Withdrawal failed";
        try {
          const errorData = await response.json();
          serverMessage = errorData?.error || errorData?.message || serverMessage;
        } catch (_parseErr) {
          // Non-JSON error body from server; keep fallback message.
        }
        throw new Error(serverMessage);
      }

      const result = await response.json();
      
      if (onBalanceUpdate) onBalanceUpdate(result.newBalance);

      setSuccess(true);
      setAmount("");
      setPaymentMethod("");
      setQrFile(null);
      setQrPreview("");
    } catch (err) {
      console.error("Withdraw failed:", err);
      setError(getFriendlyWithdrawError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  // ✅ Ask for permission first
  const handleWithdraw = () => {
    if (!amount || !paymentMethod || !qrFile) {
      setError("Please fill out all fields and upload your QR code.");
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount <= 0) {
      setError("Withdrawal amount must be greater than zero.");
      return;
    }
    if (numAmount > userData.eWallet) {
      setError("Insufficient wallet balance.");
      return;
    }
    if (numAmount < 100) {
      setError("Minimum withdrawal is ₱100.");
      return;
    }

    setError("");
    setConfirmOpen(true); // ✅ Open confirmation dialog
  };

  const handleClose = () => {
    setError("");
    setSuccess(false);
    setQrPreview("");
    setQrFile(null);
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
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        ModalProps={{ keepMounted: true }}
        transitionDuration={{ enter: 360, exit: 260 }}
        slotProps={{ backdrop: { sx: { backgroundColor: "rgba(0,0,0,0.4)" } } }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 430 },
            maxWidth: "100%",
            background: "linear-gradient(180deg, rgba(4,12,30,0.98) 0%, rgba(8,23,52,0.98) 44%, rgba(15,42,99,0.97) 100%)",
            color: "#f8fbff",
            borderLeft: "1px solid rgba(138,199,255,0.14)",
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Header */}
          <Box sx={{ minHeight: 70, px: 1, pt: "calc(env(safe-area-inset-top, 0px) + 10px)", pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff", background: "linear-gradient(135deg, rgba(6,19,46,0.98) 0%, rgba(13,47,118,0.96) 58%, rgba(37,101,214,0.90) 100%)", borderBottom: "1px solid rgba(138,199,255,0.16)" }}>
            <IconButton onClick={handleClose} sx={{ color: "#fff" }}>
              <ArrowBackIosNewIcon />
            </IconButton>
            <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>
              Withdraw Funds
            </Typography>
            <Box sx={{ width: 40 }} />
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
            {/* 💰 Wallet Balance */}
            <Box sx={{ background: "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(241,246,255,0.98) 100%)", borderRadius: 2.5, p: 2, mb: 2, textAlign: "center", border: "1px solid rgba(138,199,255,0.18)", boxShadow: "0 12px 24px rgba(2,10,24,0.16)" }}>
              <Typography variant="body2" sx={{ color: "#4f6589", mb: 0.5, fontWeight: 600 }}>Available Balance</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#0b1f5e" }}>
                ₱{userData.eWallet?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </Typography>
            </Box>

          {success ? (
            <Box sx={{ textAlign: "center", py: 4, px: 2, borderRadius: 2.5, background: "rgba(22, 88, 48, 0.18)", border: "1px solid rgba(110, 214, 151, 0.24)" }}>
              <CheckCircle sx={{ fontSize: 50, color: "#7ae3a7" }} />
              <Typography sx={{ mt: 1, color: "#4CAF50", fontWeight: 600 }}>
                Withdrawal Request Sent!
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: "#666" }}>
                Please wait for admin approval.
              </Typography>
            </Box>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* 🧾 Input Fields */}
              <TextField
                type="number"
                fullWidth
                label="Withdrawal Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": { background: "rgba(255,255,255,0.96)", borderRadius: 1.6 },
                  "& .MuiInputLabel-root": { color: "#4f6589", fontSize: 12 },
                }}
              />

              <TextField
                select
                fullWidth
                label="Payment Method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": { background: "rgba(255,255,255,0.96)", borderRadius: 1.6 },
                  "& .MuiInputLabel-root": { color: "#4f6589", fontSize: 12 },
                }}
              >
                <MenuItem value="GCash">GCash (5% charge)</MenuItem>
                <MenuItem value="Bank">Bank ATM (5% charge)</MenuItem>
              </TextField>

              <Box
                sx={{
                  mb: 2,
                  border: "1px dashed rgba(23,58,138,0.38)",
                  borderRadius: 2.2,
                  p: 2,
                  textAlign: "center",
                  background: "rgba(255,255,255,0.96)",
                  boxShadow: "0 10px 22px rgba(2,10,24,0.10)",
                }}
              >
                {qrPreview ? (
                  <img
                    src={qrPreview}
                    alt="QR Preview"
                    style={{
                      width: "100%",
                      maxHeight: 150,
                      objectFit: "contain",
                      borderRadius: 8,
                    }}
                  />
                ) : (
                  <Typography variant="body2" sx={{ color: "#666" }}>
                    Upload your {paymentMethod || "GCash / Bank"} QR Code
                  </Typography>
                )}
                <Button
                  component="label"
                  startIcon={<UploadFile />}
                  sx={{ mt: 1, bgcolor: "#f0f4ff", color: "#173a8a", "&:hover": { bgcolor: "#dde8ff" } }}
                >
                  Upload QR
                  <input type="file" accept="image/*" hidden onChange={handleQrUpload} />
                </Button>
              </Box>

              {(paymentMethod === "GCash" || paymentMethod === "Bank") && (
                <Typography variant="body2" sx={{ mb: 1, color: "#e65100", fontWeight: 600 }}>
                  {paymentMethod} Charge (5%): ₱{(amount * 0.05 || 0).toFixed(2)}
                </Typography>
              )}

              {amount && (
                <Typography variant="body2" sx={{ color: "#2e7d32", fontWeight: 600, mb: 2 }}>
                  Net Amount You’ll Receive: ₱{netAmount.toFixed(2)}
                </Typography>
              )}
            </>
          )}

          {/* 🧾 Withdrawal Logs */}
          {withdrawLogs.length > 0 && (
            <Box sx={{ background: "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(241,246,255,0.98) 100%)", borderRadius: 2.5, p: 2, border: "1px solid rgba(138,199,255,0.18)", boxShadow: "0 12px 24px rgba(2,10,24,0.16)" }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: "#0b1f5e" }}>
                Withdrawal Logs
              </Typography>
              <List dense>
                {withdrawLogs.map((log) => (
                  <ListItem key={log.id} sx={{ borderBottom: "1px solid #f0f0f0", py: 0.5 }}>
                    <ListItemText
                      primary={`₱${log.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} • ${log.paymentMethod}`}
                      secondary={
                        log.createdAt
                          ? new Date(log.createdAt.seconds * 1000).toLocaleString("en-PH")
                          : "Pending..."
                      }
                      primaryTypographyProps={{ color: "#0b1f5e", fontWeight: 600 }}
                      secondaryTypographyProps={{ color: "#666", fontSize: 12 }}
                    />
                    <Chip
                      size="small"
                      label={log.status}
                      color={getStatusColor(log.status)}
                      sx={{ textTransform: "capitalize", fontWeight: 600, fontSize: 11 }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          </Box>

          {/* Footer */}
          {!success && (
            <Box sx={{ p: 2, borderTop: "1px solid rgba(138,199,255,0.14)", background: "rgba(6,19,46,0.90)", backdropFilter: "blur(18px)" }}>
              <Button
                onClick={handleWithdraw}
                variant="contained"
                fullWidth
                disabled={loading}
                sx={{
                  py: 1.5,
                  fontWeight: 700,
                  fontSize: 16,
                  background: "linear-gradient(135deg, #0b1f5e 0%, #173a8a 100%)",
                  "&:hover": { background: "linear-gradient(135deg, #173a8a 0%, #0b1f5e 100%)" },
                  "&:disabled": { background: "#ccc" },
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Withdraw"}
              </Button>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* ✅ Permission Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: "linear-gradient(180deg, rgba(6,19,46,0.98) 0%, rgba(13,47,118,0.92) 100%)",
            color: "#fff",
            border: "1px solid rgba(138,199,255,0.14)",
            p: 2,
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", fontWeight: 600 }}>
          Confirm Withdrawal
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          <Typography sx={{ mb: 1 }}>
            Withdraw <strong>₱{amount}</strong> via{" "}
            <strong>{paymentMethod}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
            Once submitted, your withdrawal request will be reviewed by admin.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
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
            onClick={performWithdraw}
            variant="contained"
            disabled={loading}
            sx={{
              bgcolor: "#FF7043",
              color: "#000",
              fontWeight: 600,
              "&:hover": { bgcolor: "#F4511E" },
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WithdrawDialog;