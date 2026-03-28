import React, { useState, useEffect } from "react";
import {
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  IconButton,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { CheckCircle, ErrorOutline } from "@mui/icons-material";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";


import { sendPurchaseNotification, cleanupOldNotifications } from "../../../utils/notifications";

const PURCHASE_CODE_PRICE_ENDPOINT =
  "https://us-central1-amayan-savings.cloudfunctions.net/getPurchaseCodePricing";

const getDateValue = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    return value.toDate();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const PurchaseCodesDialog = ({
  open,
  onClose,
  userData,
  db,
  auth,
  onBalanceUpdate,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Clean up old notifications on mount
  useEffect(() => {
    if (userData?.uid) cleanupOldNotifications(userData.uid);
  }, [userData?.uid]);
  const [codeType, setCodeType] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [purchaseLogs, setPurchaseLogs] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [purchaseConfirmOpen, setPurchaseConfirmOpen] = useState(false);
  const [serverPricing, setServerPricing] = useState(null);

  const activatedAt = getDateValue(userData?.capitalActivatedAt);
  const oneYearAfterActivation = activatedAt
    ? new Date(activatedAt.getFullYear() + 1, activatedAt.getMonth(), activatedAt.getDate())
    : null;
  const isCapitalRenewalEligible = Boolean(
    activatedAt && oneYearAfterActivation && new Date() >= oneYearAfterActivation
  );

  const capitalPrice = isCapitalRenewalEligible ? 500 : 6000;
  const capitalLabel = isCapitalRenewalEligible
    ? "Capital Share Renewal Code"
    : "Capital Share Activation Code";

  const codePrices = {
    capital: Number(serverPricing?.capitalPrice ?? capitalPrice),
    downline: Number(serverPricing?.downlinePrice ?? 1000),
  };

  const resolvedCapitalLabel = serverPricing?.capitalLabel || capitalLabel;

  useEffect(() => {
    let isMounted = true;

    const loadPricing = async () => {
      if (!open || !auth?.currentUser) return;
      setServerPricing(null);

      try {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch(PURCHASE_CODE_PRICE_ENDPOINT, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch purchase code pricing");
        }

        const pricing = await response.json();
        if (isMounted) {
          setServerPricing(pricing);
        }
      } catch (error) {
        console.warn("[PurchaseCodesDialog] Pricing fetch failed. Using local fallback:", error);
      }
    };

    loadPricing();

    return () => {
      isMounted = false;
    };
  }, [open, auth]);

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

  const handlePurchase = () => {
  if (!codeType) return;

  const amount = codePrices[codeType];

  if (userData.eWallet < amount) {
    setConfirmDialog(true); // insufficient balance prompt
    return;
  }

  // Ask for confirmation before performing purchase
  setPurchaseConfirmOpen(true);
};

  const performPurchase = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Get Firebase ID token
      const idToken = await auth.currentUser.getIdToken();
      const clientRequestId = `${auth.currentUser.uid}_${Date.now()}`;

      // Call Cloud Function
      const response = await fetch(
        "https://us-central1-amayan-savings.cloudfunctions.net/purchaseActivationCode",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            codeType,
            clientRequestId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Purchase failed");
      }

      const result = await response.json();

      // Send notification for capital share activation code
      if (codeType === "capital") {
        await sendPurchaseNotification({ userId: auth.currentUser.uid, codeType: resolvedCapitalLabel });
      }

      if (onBalanceUpdate) onBalanceUpdate(result.newBalance);

      setSuccessMessage(
        codeType === "capital"
          ? `${resolvedCapitalLabel} purchased!`
          : "Downline Code purchased!"
      );

      setCodeType("");
    } catch (err) {
      console.error("❌ Purchase failed:", err);
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
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        ModalProps={{ keepMounted: true }}
        transitionDuration={{ enter: 360, exit: 260 }}
        slotProps={{ backdrop: { sx: { backgroundColor: "rgba(0,0,0,0.4)" } } }}
        PaperProps={{ sx: { width: { xs: "100%", sm: 430 }, maxWidth: "100%", backgroundColor: "#f7f9fc" } }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Header */}
          <Box sx={{ minHeight: 70, px: 1, display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff", background: "linear-gradient(135deg, #0b1f5e 0%, #173a8a 55%, #d4af37 100%)" }}>
            <IconButton onClick={handleClose} sx={{ color: "#fff" }}>
              <ArrowBackIosNewIcon />
            </IconButton>
            <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>Purchase Codes</Typography>
            <Box sx={{ width: 40 }} />
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
            {/* 💰 Wallet Balance */}
            <Box sx={{ background: "#fff", borderRadius: 2, p: 2, mb: 2, textAlign: "center", boxShadow: "0 1px 4px rgba(11,31,94,0.08)" }}>
              <Typography variant="body2" sx={{ color: "#666", mb: 0.5 }}>Available Balance</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#0b1f5e" }}>
                ₱{userData.eWallet?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </Typography>
            </Box>

            {successMessage ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <CheckCircle sx={{ fontSize: 50, color: "#4CAF50" }} />
                <Typography sx={{ mt: 1, color: "#4CAF50", fontWeight: 600 }}>
                  {successMessage}
                </Typography>
              </Box>
            ) : (
              <TextField
                select
                fullWidth
                label="Select Code Type"
                value={codeType}
                onChange={(e) => setCodeType(e.target.value)}
                sx={{ mb: 2, background: "#fff", borderRadius: 1 }}
              >
                <MenuItem value="capital">
                  {resolvedCapitalLabel} — ₱{codePrices.capital}
                </MenuItem>
                <MenuItem value="downline">
                  Downline Code — ₱{codePrices.downline}
                </MenuItem>
              </TextField>
            )}

            {purchaseLogs.length > 0 && (
              <Box sx={{ background: "#fff", borderRadius: 2, p: 2, boxShadow: "0 1px 4px rgba(11,31,94,0.08)" }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: "#0b1f5e" }}>
                  Purchase Code Logs
                </Typography>
                <List dense>
                  {purchaseLogs.map((log) => (
                    <ListItem key={log.id} sx={{ borderBottom: "1px solid #f0f0f0", py: 0.5 }}>
                      <ListItemText
                        primary={`${log.code} (${log.type})`}
                        secondary={
                          log.createdAt
                            ? new Date(log.createdAt.seconds * 1000).toLocaleString("en-PH")
                            : "Processing..."
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
          {!successMessage && (
            <Box sx={{ p: 2, borderTop: "1px solid #e8eaf6" }}>
              <Button
                onClick={handlePurchase}
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
                {loading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Purchase"}
              </Button>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Insufficient Balance Prompt */}
      <Dialog
        open={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: "center", fontWeight: 600 }}>
          <ErrorOutline sx={{ color: "#F44336", fontSize: 40, mb: 1 }} />
          Insufficient Balance
        </DialogTitle>
        <DialogContent>
          <Typography align="center" sx={{ mb: 2 }}>
            Your eWallet balance is not enough to complete this purchase.
            Would you like to top up now?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
          <Button onClick={() => setConfirmDialog(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            onClick={() => {
              setConfirmDialog(false);
              onClose();
              navigate("/member/cash-in");
            }}
            variant="contained"
            color="primary"
          >
            Top Up
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
  open={purchaseConfirmOpen}
  onClose={() => setPurchaseConfirmOpen(false)}
  maxWidth="xs"
  fullWidth
  PaperProps={{
    sx: {
      borderRadius: 3,
      background: "rgba(30,30,30,0.95)",
      backdropFilter: "blur(16px)",
      color: "#fff",
      p: 2,
      textAlign: "center",
    },
  }}
>
  <DialogTitle sx={{ fontWeight: 600 }}>Confirm Purchase</DialogTitle>
  <DialogContent>
    <Typography sx={{ mt: 1 }}>
      Are you sure you want to purchase this {codeType === "capital" ? resolvedCapitalLabel : "Downline Code"} for ₱{codePrices[codeType]}?
    </Typography>
  </DialogContent>
  <DialogActions sx={{ justifyContent: "center", mt: 1 }}>
    <Button
      onClick={() => setPurchaseConfirmOpen(false)}
      variant="outlined"
      color="inherit"
      sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}
    >
      Cancel
    </Button>
    <Button
  onClick={async () => {
    setPurchaseConfirmOpen(false);
    await performPurchase(); // ✅ purchase runs only once here
  }}
  variant="contained"
  disabled={loading}
  sx={{ bgcolor: "#4FC3F7", color: "#000", "&:hover": { bgcolor: "#29B6F6" } }}
>
  {loading ? <CircularProgress size={20} sx={{ color: "#000" }} /> : "Confirm"}
</Button>
  </DialogActions>
</Dialog>

    </>
  );
};

export default PurchaseCodesDialog;