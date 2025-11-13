// src/components/Topbar/dialogs/WithdrawDialog.jsx
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
  MenuItem,
} from "@mui/material";
import { MonetizationOn, CheckCircle, UploadFile } from "@mui/icons-material";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  onSnapshot,
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
    setConfirmOpen(false);
    setError("");
    setLoading(true);

    try {
      const numAmount = parseFloat(amount);
      const qrRef = ref(
        storage,
        `withdrawals_qr/${auth.currentUser.uid}_${Date.now()}_${qrFile.name}`
      );
      await uploadBytes(qrRef, qrFile);
      const qrUrl = await getDownloadURL(qrRef);

      const charge = numAmount * 0.05;
      const finalAmount = numAmount - charge;

      await addDoc(collection(db, "withdrawals"), {
        userId: auth.currentUser.uid,
        name: userData.name,
        email: userData.email,
        amount: numAmount,
        paymentMethod,
        charge,
        netAmount: finalAmount,
        qrUrl,
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      if (onBalanceUpdate) onBalanceUpdate(userData.eWallet - numAmount);

      setSuccess(true);
      setAmount("");
      setPaymentMethod("");
      setQrFile(null);
      setQrPreview("");
    } catch (err) {
      console.error("Withdraw failed:", err);
      setError("Something went wrong. Please try again.");
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
      {/* 🧾 Withdraw Form Dialog */}
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
          Withdraw Funds
        </DialogTitle>

        <DialogContent>
          {/* 💰 Wallet Balance */}
          <Box sx={{ textAlign: "center", mt: 2 }}>
            <MonetizationOn sx={{ fontSize: 40, color: "#FF7043" }} />
            <Typography variant="h6" sx={{ mt: 1 }}>
              Available Balance
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#4CAF50" }}>
              ₱
              {userData.eWallet?.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </Box>

          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

          {success ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <CheckCircle sx={{ fontSize: 50, color: "#4CAF50" }} />
              <Typography sx={{ mt: 1, color: "#4CAF50", fontWeight: 600 }}>
                Withdrawal Request Sent!
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, color: "rgba(255,255,255,0.7)" }}
              >
                Please wait for admin approval.
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

              {/* 🧾 Input Fields */}
              <TextField
                type="number"
                fullWidth
                label="Withdrawal Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                sx={{
                  mb: 2,
                  "& .MuiInputBase-root": { color: "#fff" },
                  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
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
                  "& .MuiInputBase-root": { color: "#fff" },
                  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
                }}
              >
                <MenuItem value="GCash">GCash (5% charge)</MenuItem>
                <MenuItem value="Bank">Bank ATM (5% charge)</MenuItem>
              </TextField>

              <Box
                sx={{
                  mb: 2,
                  border: "1px dashed rgba(255,255,255,0.3)",
                  borderRadius: 2,
                  p: 2,
                  textAlign: "center",
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
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    Upload your {paymentMethod || "GCash / Bank"} QR Code
                  </Typography>
                )}
                <Button
                  component="label"
                  startIcon={<UploadFile />}
                  sx={{
                    mt: 1,
                    bgcolor: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
                  }}
                >
                  Upload QR
                  <input type="file" accept="image/*" hidden onChange={handleQrUpload} />
                </Button>
              </Box>

              {(paymentMethod === "GCash" || paymentMethod === "Bank") && (
                <Typography variant="body2" sx={{ mb: 1, color: "#FFB74D" }}>
                  {paymentMethod} Charge (5%): ₱{(amount * 0.05 || 0).toFixed(2)}
                </Typography>
              )}

              {amount && (
                <Typography variant="body2" sx={{ color: "#81C784" }}>
                  Net Amount You’ll Receive: ₱{netAmount.toFixed(2)}
                </Typography>
              )}
            </>
          )}

          {/* 🧾 Withdrawal Logs */}
          {withdrawLogs.length > 0 && (
            <>
              <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />
              <Typography
                variant="subtitle1"
                sx={{ mb: 1, fontWeight: 600, color: "#90CAF9" }}
              >
                Withdrawal Logs
              </Typography>
              <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
                {withdrawLogs.map((log) => (
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
                      })} • ${log.paymentMethod}`}
                      secondary={
                        log.createdAt
                          ? new Date(log.createdAt.seconds * 1000).toLocaleString("en-PH")
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

          {!success && (
            <Button
              onClick={handleWithdraw}
              variant="contained"
              disabled={loading}
              sx={{
                bgcolor: "#FF7043",
                color: "#000",
                fontWeight: 600,
                "&:hover": { bgcolor: "#F4511E" },
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: "#000" }} />
              ) : (
                "Withdraw"
              )}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ✅ Permission Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: "rgba(20,20,20,0.95)",
            color: "#fff",
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