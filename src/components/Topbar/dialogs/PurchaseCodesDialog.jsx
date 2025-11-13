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
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";
import { Wallet, CheckCircle, ErrorOutline } from "@mui/icons-material";
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
import DepositDialog from "./DepositDialog";

const PurchaseCodesDialog = ({
  open,
  onClose,
  userData,
  db,
  auth,
  onBalanceUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [codeType, setCodeType] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [purchaseLogs, setPurchaseLogs] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  const codePrices = {
    capital: 500,
    downline: 600,
  };

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
    if (!codeType) {
      return;
    }

    const amount = codePrices[codeType];
    if (userData.eWallet < amount) {
      setConfirmDialog(true); // show insufficient balance prompt
      return;
    }

    await performPurchase(amount);
  };

  const performPurchase = async (amount) => {
    setLoading(true);
    try {
      const randomCode =
        "TCLC-" + Math.random().toString(36).substring(2, 10).toUpperCase();

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

      const userRef = doc(db, "users", auth.currentUser.uid);
      const newBalance = userData.eWallet - amount;
      await updateDoc(userRef, { eWallet: newBalance });
      if (onBalanceUpdate) onBalanceUpdate(newBalance);

      setSuccessMessage(
        codeType === "capital"
          ? "Capital Share Activation Code purchased!"
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

  const handleDepositClose = () => {
    setDepositOpen(false);
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
              sx={{
                mb: 2,
                "& .MuiInputBase-root": { color: "#fff" },
                "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
              }}
            >
              <MenuItem value="capital">
                Capital Share Activation Code — ₱500
              </MenuItem>
              <MenuItem value="downline">
                Downline Code — ₱600
              </MenuItem>
            </TextField>
          )}

          {purchaseLogs.length > 0 && (
            <>
              <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />
              <Typography
                variant="subtitle1"
                sx={{ mb: 1, fontWeight: 600, color: "#90CAF9" }}
              >
                Purchase Code Logs
              </Typography>
              <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
                {purchaseLogs.map((log) => (
                  <ListItem
                    key={log.id}
                    sx={{ borderBottom: "1px solid rgba(255,255,255,0.1)", py: 0.5 }}
                  >
                    <ListItemText
                      primary={`${log.code} (${log.type})`}
                      secondary={
                        log.createdAt
                          ? new Date(log.createdAt.seconds * 1000).toLocaleString("en-PH")
                          : "Processing..."
                      }
                      primaryTypographyProps={{ color: "#fff" }}
                      secondaryTypographyProps={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}
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
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            color="inherit"
            sx={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff", "&:hover": { background: "rgba(255,255,255,0.1)" } }}
          >
            {successMessage ? "Close" : "Cancel"}
          </Button>

          {!successMessage && (
            <Button
              onClick={handlePurchase}
              variant="contained"
              disabled={loading}
              sx={{ bgcolor: "#4FC3F7", color: "#000", fontWeight: 600, "&:hover": { bgcolor: "#29B6F6" } }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: "#000" }} /> : "Purchase"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

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
              setDepositOpen(true); // Redirect to DepositDialog
            }}
            variant="contained"
            color="primary"
          >
            Top Up
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deposit Dialog */}
      <DepositDialog
        open={depositOpen}
        onClose={handleDepositClose}
        userData={userData}
        db={db}
        auth={auth}
        onDepositSuccess={() => {
          handleDepositClose();
          if (onBalanceUpdate) onBalanceUpdate();
        }}
      />
    </>
  );
};

export default PurchaseCodesDialog;