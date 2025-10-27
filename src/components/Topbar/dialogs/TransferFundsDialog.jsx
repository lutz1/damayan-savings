// src/components/TransferFundsDialog.jsx
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
  Paper,
} from "@mui/material";
import { Send, CheckCircle } from "@mui/icons-material";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  getDocs,
  limit,
} from "firebase/firestore";

const TransferFundsDialog = ({ open, onClose, userData, db, auth, onBalanceUpdate }) => {
  const [recipientUsername, setRecipientUsername] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [transferLogs, setTransferLogs] = useState([]);
  const [netAmount, setNetAmount] = useState(0);
  const [searching, setSearching] = useState(false);

  // ✅ Real-time transfer logs for this user
  useEffect(() => {
    if (!open || !auth?.currentUser) return;
    const q = query(
      collection(db, "transferFunds"),
      where("senderId", "==", auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setTransferLogs(logs);
    });
    return () => unsubscribe();
  }, [open, auth, db]);

  // ✅ Compute net amount (after 2% charge)
  useEffect(() => {
    const amt = parseFloat(amount) || 0;
    setNetAmount(amt - amt * 0.02);
  }, [amount]);

  // ✅ Search usernames from Firestore
  const handleSearchUser = async (val) => {
    setRecipientUsername(val);
    if (!val.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", ">=", val), where("username", "<=", val + "\uf8ff"), limit(5));

    try {
      const snap = await getDocs(q);
      const results = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.username !== userData.username); // exclude self
      setSearchResults(results);
      setShowResults(true);
    } catch (err) {
      console.error("Search failed:", err);
      setError("Failed to search usernames.");
    }
    setSearching(false);
  };

  const handleSelectUser = (username) => {
    setRecipientUsername(username);
    setShowResults(false);
  };

  const handleTransferRequest = async () => {
    if (!recipientUsername || !amount) {
      setError("Please enter recipient username and amount.");
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount <= 0) return setError("Transfer amount must be greater than zero.");
    if (numAmount > userData.eWallet) return setError("Insufficient wallet balance.");
    if (numAmount < 50) return setError("Minimum transfer is ₱50.");

    setError("");
    setLoading(true);

    try {
      const charge = numAmount * 0.02;
      const netTransfer = numAmount - charge;

      await addDoc(collection(db, "transferFunds"), {
        senderId: auth.currentUser.uid,
        senderName: userData.name,
        senderEmail: userData.email,
        recipientUsername,
        amount: numAmount,
        charge,
        netAmount: netTransfer,
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      if (onBalanceUpdate) onBalanceUpdate(userData.eWallet - numAmount);

      setSuccess(true);
      setAmount("");
      setRecipientUsername("");
      setSearchResults([]);
    } catch (err) {
      console.error("Transfer request failed:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    setSuccess(false);
    setRecipientUsername("");
    setAmount("");
    setSearchResults([]);
    onClose();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Approved":
        return "success";
      case "Rejected":
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
      {/* 🧾 Title */}
      <DialogTitle
        sx={{
          textAlign: "center",
          fontWeight: 600,
          borderBottom: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        Transfer Funds
      </DialogTitle>

      <DialogContent>
        {/* 💰 Balance */}
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Send sx={{ fontSize: 40, color: "#4FC3F7" }} />
          <Typography variant="h6" sx={{ mt: 1 }}>
            Available Balance
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#81C784" }}>
            ₱
            {userData.eWallet?.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </Typography>
        </Box>

        <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

        {/* ✅ Success */}
        {success ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <CheckCircle sx={{ fontSize: 50, color: "#4CAF50" }} />
            <Typography sx={{ mt: 1, color: "#4CAF50", fontWeight: 600 }}>
              Transfer Request Sent!
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
            {/* ⚠️ Error */}
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

            {/* 🧑‍ Recipient Search */}
            <Box sx={{ position: "relative", mb: 2 }}>
              <TextField
                fullWidth
                label="Recipient Username"
                value={recipientUsername}
                onChange={(e) => handleSearchUser(e.target.value)}
                sx={{
                  "& .MuiInputBase-root": { color: "#fff" },
                  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
                }}
              />
              {searching && (
                <CircularProgress
                  size={20}
                  sx={{ position: "absolute", right: 10, top: 15, color: "#4FC3F7" }}
                />
              )}

              {showResults && searchResults.length > 0 && (
                <Paper
                  sx={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 5,
                    bgcolor: "rgba(40,40,40,0.95)",
                    color: "#fff",
                    mt: 1,
                    borderRadius: 2,
                    maxHeight: 160,
                    overflowY: "auto",
                  }}
                >
                  {searchResults.map((u) => (
                    <ListItem
                      key={u.id}
                      button
                      onClick={() => handleSelectUser(u.username)}
                      sx={{
                        "&:hover": { background: "rgba(255,255,255,0.1)" },
                      }}
                    >
                      <ListItemText
                        primary={u.username}
                        secondary={u.name}
                        secondaryTypographyProps={{
                          color: "rgba(255,255,255,0.6)",
                        }}
                      />
                    </ListItem>
                  ))}
                </Paper>
              )}
            </Box>

            {/* 💸 Amount */}
            <TextField
              type="number"
              fullWidth
              label="Amount to Transfer"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              sx={{
                mb: 2,
                "& .MuiInputBase-root": { color: "#fff" },
                "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
              }}
            />

            {amount && (
              <>
                <Typography variant="body2" sx={{ color: "#FFB74D", mb: 0.5 }}>
                  2% Service Charge: ₱{(amount * 0.02 || 0).toFixed(2)}
                </Typography>
                <Typography variant="body2" sx={{ color: "#81C784" }}>
                  Net Amount to Send: ₱{netAmount.toFixed(2)}
                </Typography>
              </>
            )}
          </>
        )}

        {/* 📜 Transfer Logs */}
        {transferLogs.length > 0 && (
          <>
            <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />
            <Typography
              variant="subtitle1"
              sx={{ mb: 1, fontWeight: 600, color: "#90CAF9" }}
            >
              Transfer Logs
            </Typography>
            <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
              {transferLogs.map((log) => (
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
                    })} → ${log.recipientUsername}`}
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

      {/* 🔘 Actions */}
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
            onClick={handleTransferRequest}
            variant="contained"
            disabled={loading}
            sx={{
              bgcolor: "#4FC3F7",
              color: "#000",
              fontWeight: 600,
              "&:hover": { bgcolor: "#29B6F6" },
            }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: "#000" }} /> : "Submit Request"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TransferFundsDialog;