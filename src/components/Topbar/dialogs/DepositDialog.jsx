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
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import gcashImage from "../../../assets/bpii.jpg";
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
        Amount: ₱{parseFloat(amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}<br />
        Net After 2% Charge: ₱{parseFloat(netAmount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
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
  const [showQR, setShowQR] = useState(false);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [depositLogs, setDepositLogs] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false); // 🟢 Confirmation dialog state
  const [qrDownloaded, setQrDownloaded] = useState(false); // Track if QR is downloaded

  const chargeRate = 0.02;
  const chargeAmount = amount ? parseFloat(amount) * chargeRate : 0;
  const calculatedNet = amount ? parseFloat(amount) - chargeAmount : 0;

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
      const storageRef = ref(storage, `receipts/${currentUser.uid}_${Date.now()}`);
      await uploadBytes(storageRef, receipt);
      const receiptUrl = await getDownloadURL(storageRef);

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

  const handleOpenGCash = () => {
    // GCash app deep link (opens app if installed, otherwise opens web)
    const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
    if (!isMobile) {
      window.open("https://m.gcash.com", "_blank");
      return;
    }

    // iOS deep link
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      window.location.href = "gcash://";
    }
    // Android intent
    else if (/Android/.test(navigator.userAgent)) {
      window.location.href = "intent://com.globe.gcash.android#Intent;scheme=gcash;action=android.intent.action.VIEW;end";
    }
  };

  const handleOpenPaymentApp = (appType) => {
    const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
    
    const appLinks = {
      gcash: {
        ios: "gcash://",
        android: "intent://com.globe.gcash.android#Intent;scheme=gcash;action=android.intent.action.VIEW;end",
        web: "https://m.gcash.com"
      },
      bdo: {
        ios: "bdo://",
        android: "intent://com.bdo.mobile://Intent;scheme=bdo;action=android.intent.action.VIEW;end",
        web: "https://www.bdo.com.ph/personal"
      },
      bpi: {
        ios: "bpi://",
        android: "intent://com.bpi.bpimobile://Intent;scheme=bpi;action=android.intent.action.VIEW;end",
        web: "https://www.bpi.com.ph/personal"
      },
      maya: {
        ios: "maya://",
        android: "intent://com.maya.app://Intent;scheme=maya;action=android.intent.action.VIEW;end",
        web: "https://www.mayaapp.com"
      }
    };

    const links = appLinks[appType];
    if (!links) return;

    if (!isMobile) {
      window.open(links.web, "_blank");
      return;
    }

    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      window.location.href = links.ios;
    } else if (/Android/.test(navigator.userAgent)) {
      window.location.href = links.android;
    }
  };

  const handleDownloadQR = () => {
    const canvas = document.querySelector("canvas[data-qr-canvas]");
    if (!canvas) {
      // If canvas not found, try to download from the img element
      const qrImg = document.querySelector("img[alt='GCash QR']");
      if (qrImg) {
        const link = document.createElement("a");
        link.href = qrImg.src;
        link.download = `GCash_QR_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setQrDownloaded(true);
      }
      return;
    }

    // Download canvas as image
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `GCash_QR_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setQrDownloaded(true);
    });
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

              {!showQR && (
                <>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      mb: 2,
                      bgcolor: "#81C784",
                      "&:hover": { bgcolor: "#66BB6A" },
                    }}
                    onClick={() => setShowQR(true)}
                  >
                    Download QR Code
                  </Button>
                  <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.2)" }} />
                  <Typography variant="body2" sx={{ mb: 1, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                    Or open payment app:
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 2 }}>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!qrDownloaded}
                      sx={{
                        bgcolor: "#0066CC",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        "&:hover": { bgcolor: "#0052A3" },
                        "&:disabled": { bgcolor: "rgba(0,102,204,0.5)", color: "rgba(255,255,255,0.5)" },
                      }}
                      onClick={() => handleOpenPaymentApp("gcash")}
                    >
                      {qrDownloaded ? "GCash" : "GCash"}
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!qrDownloaded}
                      sx={{
                        bgcolor: "#003DA5",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        "&:hover": { bgcolor: "#002D7F" },
                        "&:disabled": { bgcolor: "rgba(0,61,165,0.5)", color: "rgba(255,255,255,0.5)" },
                      }}
                      onClick={() => handleOpenPaymentApp("bdo")}
                    >
                      BDO
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!qrDownloaded}
                      sx={{
                        bgcolor: "#E60000",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        "&:hover": { bgcolor: "#CC0000" },
                        "&:disabled": { bgcolor: "rgba(230,0,0,0.5)", color: "rgba(255,255,255,0.5)" },
                      }}
                      onClick={() => handleOpenPaymentApp("bpi")}
                    >
                      BPI
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!qrDownloaded}
                      sx={{
                        bgcolor: "#8B3DFF",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        "&:hover": { bgcolor: "#6B2FCC" },
                        "&:disabled": { bgcolor: "rgba(139,61,255,0.5)", color: "rgba(255,255,255,0.5)" },
                      }}
                      onClick={() => handleOpenPaymentApp("maya")}
                    >
                      Maya
                    </Button>
                  </Box>
                  {!qrDownloaded && (
                    <Alert severity="info" sx={{ background: "rgba(25,118,210,0.15)", color: "#64B5F6", mt: 1 }}>
                      📝 Download QR Code first before opening payment apps
                    </Alert>
                  )}
                </>
              )}

              {showQR && !showReceiptForm && (
                <Box sx={{ textAlign: "center", mb: 2 }}>
                  <img
                    src={gcashImage}
                    alt="GCash QR"
                    data-qr-canvas
                    style={{ width: "100%", borderRadius: 12 }}
                  />
                  <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                    <Button
                      variant="contained"
                      fullWidth
                      sx={{
                        bgcolor: "#81C784",
                        "&:hover": { bgcolor: "#66BB6A" },
                      }}
                      onClick={handleDownloadQR}
                    >
                      Download QR
                    </Button>
                    <Button
                      variant="outlined"
                      fullWidth
                      sx={{
                        borderColor: "#fff",
                        color: "#fff",
                      }}
                      onClick={() => setShowReceiptForm(true)}
                    >
                      Proceed to Upload Receipt
                    </Button>
                  </Box>
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
                    sx={{
                      mb: 1,
                      "& .MuiInputBase-root": { color: "#fff" },
                      "& .MuiInputLabel-root": {
                        color: "rgba(255,255,255,0.7)",
                      },
                    }}
                  />

                  {amount && parseFloat(amount) > 0 && (
                    <Typography
                      variant="body2"
                      sx={{ mb: 2, color: "#FFB74D" }}
                    >
                      Charge (2%): ₱{chargeAmount.toFixed(2)} • Net Deposit: ₱
                      {calculatedNet.toFixed(2)}
                    </Typography>
                  )}

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
        netAmount={calculatedNet}
      />
    </>
  );
};

export default DepositDialog;