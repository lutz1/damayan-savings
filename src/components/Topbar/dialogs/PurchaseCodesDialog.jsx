import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Divider,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";
import { Wallet, CheckCircle } from "@mui/icons-material";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

const PurchaseCodesDialog = ({
  open,
  onClose,
  userData,
  availableCodes,
  db,
  auth,
  onBalanceUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [codeType, setCodeType] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [purchaseLogs, setPurchaseLogs] = useState([]);

  // Define code prices
  const codePrices = {
    capital: 500,
    downline: 600,
  };

  // ✅ Real-time purchase logs
  useEffect(() => {
    if (!open || !auth?.currentUser) return;

    const q = query(
      collection(db, "purchaseCodes"),
      where("userId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setPurchaseLogs(logs);
    });

    return () => unsubscribe();
  }, [open, auth, db]);

  const handlePurchase = async () => {
    try {
      if (!codeType) return alert("Please select a code type.");

      const amount = codePrices[codeType];
      if (userData.eWallet < amount)
        return alert("Insufficient eWallet balance.");

      setLoading(true);

      // Generate random code
      const randomCode =
        "TCLC-" + Math.random().toString(36).substring(2, 10).toUpperCase();

      // Store code purchase in Firestore
      await addDoc(collection(db, "purchaseCodes"), {
        userId: auth.currentUser.uid,
        name: userData.name,
        email: userData.email,
        code: randomCode,
        type:
          codeType === "capital"
            ? "Activate Capital Share"
            : "Downline Code",
        amount,
        used: false,
        status: "Success",
        createdAt: serverTimestamp(),
      });

      // Deduct balance
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        eWallet: userData.eWallet - amount,
      });

      // ✅ Instantly update topbar balance
      if (onBalanceUpdate) onBalanceUpdate(userData.eWallet - amount);

      setSuccessMessage(
        codeType === "capital"
          ? "Capital Share Activation Code purchased!"
          : "Downline Code purchased!"
      );
      setSnackbarOpen(true);
      setCodeType("");
    } catch (err) {
      console.error("Purchase failed:", err);
      alert("Failed to purchase code. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccessMessage("");
    onClose();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Success":
        return "success";
      case "Pending":
        return "warning";
      case "Failed":
        return "error";
      default:
        return "default";
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
          Purchase Codes
        </DialogTitle>

        <DialogContent>
          {/* 💰 Wallet Info */}
          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Wallet sx={{ fontSize: 40, color: "#4FC3F7" }} />
            <Typography variant="h6" sx={{ mt: 1 }}>
              Available Balance
            </Typography>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, color: "#4CAF50" }}
            >
              ₱
              {userData.eWallet?.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </Box>

          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

          {/* ✅ Success State */}
          {successMessage ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <CheckCircle sx={{ fontSize: 50, color: "#4CAF50" }} />
              <Typography
                sx={{ mt: 1, color: "#4CAF50", fontWeight: 600 }}
              >
                {successMessage}
              </Typography>
            </Box>
          ) : (
            <>
              {/* 🧾 Code Type Select */}
              <TextField
                select
                fullWidth
                label="Select Code Type"
                value={codeType}
                onChange={(e) => setCodeType(e.target.value)}
                sx={{
                  mb: 2,
                  "& .MuiInputBase-root": { color: "#fff" },
                  "& .MuiInputLabel-root": {
                    color: "rgba(255,255,255,0.7)",
                  },
                }}
              >
                <MenuItem value="capital">
                  Capital Share Activation Code — ₱500
                </MenuItem>
                <MenuItem value="downline">
                  Downline Code — ₱600
                </MenuItem>
              </TextField>
            </>
          )}

          {/* 📜 Purchase Logs */}
          {purchaseLogs.length > 0 && (
            <>
              <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />
              <Typography
                variant="subtitle1"
                sx={{ mb: 1, fontWeight: 600, color: "#90CAF9" }}
              >
                Purchase Codes Logs
              </Typography>
              <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
                {purchaseLogs.map((log) => (
                  <ListItem
                    key={log.id}
                    sx={{
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      py: 0.5,
                    }}
                  >
                    <ListItemText
                      primary={`${log.code} (${log.type})`}
                      secondary={
                        log.createdAt
                          ? new Date(
                              log.createdAt.seconds * 1000
                            ).toLocaleString("en-PH")
                          : "Processing..."
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
            {successMessage ? "Close" : "Cancel"}
          </Button>

          {!successMessage && (
            <Button
              onClick={handlePurchase}
              variant="contained"
              disabled={loading}
              sx={{
                bgcolor: "#4FC3F7",
                color: "#000",
                fontWeight: 600,
                "&:hover": { bgcolor: "#29B6F6" },
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: "#000" }} />
              ) : (
                "Purchase"
              )}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ✅ Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2500}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          sx={{ width: "100%" }}
        >
          Balance updated!
        </Alert>
      </Snackbar>
    </>
  );
};

export default PurchaseCodesDialog;