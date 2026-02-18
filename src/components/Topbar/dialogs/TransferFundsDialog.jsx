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
import DownloadIcon from "@mui/icons-material/Download";
import {
  collection,
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
  const [confirmDialog, setConfirmDialog] = useState(false); // ✅ Custom confirm dialog toggle
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // ✅ Real-time transfer logs
  useEffect(() => {
    if (!open || !auth?.currentUser) return;
    const q = query(collection(db, "transferFunds"), where("senderId", "==", auth.currentUser.uid));
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

  // ✅ Search usernames
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
        .filter((u) => u.username !== userData.username);
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

  const handleSubmitRequest = async () => {
    if (loading) return; // prevent double-submit while in-flight
    if (!recipientUsername || !amount) {
      setError("Please enter recipient username and amount.");
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount <= 0) return setError("Transfer amount must be greater than zero.");
    if (numAmount > userData.eWallet) return setError("Insufficient wallet balance.");
    if (numAmount < 50) return setError("Minimum transfer is ₱50.");

    setError("");
    setConfirmDialog(true); // ✅ Ask user permission before sending
  };

  const handleConfirmTransfer = async () => {
    setConfirmDialog(false);
    setLoading(true);

    try {
      const numAmount = parseFloat(amount);

      // Get user's ID token for authentication
      const idToken = await auth.currentUser.getIdToken();

      // Call secure backend endpoint
      const API_BASE = import.meta.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
      const response = await fetch(`${API_BASE}/api/transfer-funds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken,
          recipientUsername,
          amount: numAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Transfer failed");
      }

      // Update local balance
      if (onBalanceUpdate) onBalanceUpdate(data.newBalance);

      // Generate reference number
      const referenceNumber = `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Store receipt data
      setReceiptData({
        referenceNumber,
        amount: numAmount,
        charge: numAmount * 0.02,
        netAmount: numAmount - (numAmount * 0.02),
        recipient: recipientUsername,
        date: new Date(),
        transferId: data.transferId,
      });

      setSuccess(true);
      setReceiptDialog(true);
      setAmount("");
      setRecipientUsername("");
      setSearchResults([]);
    } catch (err) {
      console.error("Transfer request failed:", err);
      setError(err.message || "Something went wrong. Please try again.");
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
    setConfirmDialog(false);
    setReceiptDialog(false);
    setReceiptData(null);
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

  const handleDownloadReceipt = () => {
    if (!receiptData) return;

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#2d2d2d");
    gradient.addColorStop(1, "#1e1e1e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Header
    ctx.fillStyle = "#4CAF50";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText("✓ TRANSFER RECEIPT", canvas.width / 2, 80);

    // Divider
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 110);
    ctx.lineTo(canvas.width - 50, 110);
    ctx.stroke();

    // Reference Number
    ctx.fillStyle = "#9E9E9E";
    ctx.font = "14px Arial";
    ctx.fillText("Reference Number", canvas.width / 2, 145);
    
    ctx.fillStyle = "#4FC3F7";
    ctx.font = "bold 18px monospace";
    ctx.fillText(receiptData.referenceNumber, canvas.width / 2, 170);

    // Date & Time
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Date & Time:", 60, 220);
    ctx.textAlign = "right";
    ctx.fillText(
      receiptData.date.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      canvas.width - 60,
      220
    );

    // Divider
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 240);
    ctx.lineTo(canvas.width - 50, 240);
    ctx.stroke();

    // Transaction Details Header
    ctx.fillStyle = "#4FC3F7";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("TRANSACTION DETAILS", canvas.width / 2, 280);

    // From
    ctx.fillStyle = "#9E9E9E";
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    ctx.fillText("From:", 60, 320);
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "right";
    ctx.fillText(`@${userData.username}`, canvas.width - 60, 320);

    // To
    ctx.fillStyle = "#9E9E9E";
    ctx.textAlign = "left";
    ctx.fillText("To:", 60, 355);
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "right";
    ctx.fillText(`@${receiptData.recipient}`, canvas.width - 60, 355);

    // Divider
    ctx.strokeStyle = "#555";
    ctx.beginPath();
    ctx.moveTo(50, 380);
    ctx.lineTo(canvas.width - 50, 380);
    ctx.stroke();

    // Amount Details
    ctx.fillStyle = "#9E9E9E";
    ctx.textAlign = "left";
    ctx.fillText("Amount:", 60, 420);
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "right";
    ctx.fillText(
      `₱${receiptData.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      canvas.width - 60,
      420
    );

    // Service Charge
    ctx.fillStyle = "#9E9E9E";
    ctx.textAlign = "left";
    ctx.fillText("Service Charge (2%):", 60, 455);
    ctx.fillStyle = "#FFB74D";
    ctx.textAlign = "right";
    ctx.fillText(
      `-₱${receiptData.charge.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      canvas.width - 60,
      455
    );

    // Divider
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 480);
    ctx.lineTo(canvas.width - 50, 480);
    ctx.stroke();

    // Net Amount
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Net Amount Sent:", 60, 520);
    ctx.fillStyle = "#4CAF50";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "right";
    ctx.fillText(
      `₱${receiptData.netAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      canvas.width - 60,
      520
    );

    // Status Box
    ctx.fillStyle = "rgba(76, 175, 80, 0.2)";
    ctx.fillRect(60, 560, canvas.width - 120, 50);
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 560, canvas.width - 120, 50);
    
    ctx.fillStyle = "#4CAF50";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.fillText("✓ Status: Approved", canvas.width / 2, 592);

    // Footer
    ctx.fillStyle = "#9E9E9E";
    ctx.font = "12px Arial";
    ctx.fillText("Keep this receipt for your records", canvas.width / 2, 660);
    ctx.fillText("This is an official transaction receipt", canvas.width / 2, 680);

    // Timestamp
    ctx.font = "10px Arial";
    ctx.fillText(`Generated on ${new Date().toLocaleString("en-PH")}`, canvas.width / 2, 720);

    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Transfer_Receipt_${receiptData.referenceNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  };

  return (
    <>
      {/* 🔹 MAIN TRANSFER DIALOG */}
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
              ₱{userData.eWallet?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </Typography>
          </Box>

          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

          {/* ✅ Success */}
          {success ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <CheckCircle sx={{ fontSize: 50, color: "#4CAF50" }} />
              <Typography sx={{ mt: 1, color: "#4CAF50", fontWeight: 600 }}>
                Transfer Completed!
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: "rgba(255,255,255,0.7)" }}>
                Funds were sent successfully.
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
                        sx={{ "&:hover": { background: "rgba(255,255,255,0.1)" } }}
                      >
                        <ListItemText
                          primary={u.username}
                          secondary={u.name}
                          secondaryTypographyProps={{ color: "rgba(255,255,255,0.6)" }}
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

          {/* 📜 Logs */}
          {transferLogs.length > 0 && (
            <>
              <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600, color: "#90CAF9" }}>
                Transfer Logs
              </Typography>
              <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
                {transferLogs.map((log) => (
                  <ListItem
                    key={log.id}
                    sx={{ borderBottom: "1px solid rgba(255,255,255,0.1)", py: 0.5 }}
                  >
                    <ListItemText
                      primary={`₱${log.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} → ${log.recipientUsername}`}
                      secondary={
                        log.createdAt
                          ? new Date(log.createdAt.seconds * 1000).toLocaleString("en-PH")
                          : "Pending..."
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
              onClick={handleSubmitRequest}
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

      {/* ⚠️ Confirm Transfer Dialog */}
      <Dialog
        open={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(40,40,40,0.98) 0%, rgba(30,30,30,0.98) 100%)",
            color: "#fff",
            p: 2,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            border: "1px solid rgba(79, 195, 247, 0.3)",
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
          <Send sx={{ fontSize: 60, color: "#4FC3F7", mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#4FC3F7" }}>
            Confirm Transfer
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mt: 1 }}>
            Please review the details before confirming
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Box
            sx={{
              background: "rgba(79, 195, 247, 0.1)",
              borderRadius: 2,
              p: 3,
              border: "1px dashed rgba(79, 195, 247, 0.3)",
            }}
          >
            {/* Transaction Details */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>From:</Typography>
                <Typography sx={{ fontWeight: 600 }}>@{userData.username}</Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>To:</Typography>
                <Typography sx={{ fontWeight: 600 }}>@{recipientUsername}</Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", mb: 2 }} />

            {/* Amount Details */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>Amount:</Typography>
                <Typography sx={{ fontWeight: 600 }}>
                  ₱{parseFloat(amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>Service Charge (2%):</Typography>
                <Typography sx={{ fontWeight: 600, color: "#FFB74D" }}>
                  -₱{(parseFloat(amount || 0) * 0.02).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: "rgba(79, 195, 247, 0.3)", my: 1.5 }} />

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem" }}>Net Amount to Send:</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", color: "#4FC3F7" }}>
                  ₱{netAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                mt: 2,
                p: 1.5,
                background: "rgba(255, 193, 7, 0.15)",
                borderRadius: 1,
                textAlign: "center",
              }}
            >
              <Typography variant="body2" sx={{ color: "#FFB74D", fontWeight: 600 }}>
                ⚠️ Please verify all details before confirming
              </Typography>
            </Box>
          </Box>

          <Typography
            variant="caption"
            sx={{
              display: "block",
              textAlign: "center",
              color: "rgba(255,255,255,0.5)",
              mt: 2,
            }}
          >
            This transaction cannot be reversed once confirmed
          </Typography>
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 2 }}>
          <Button
            onClick={() => setConfirmDialog(false)}
            variant="outlined"
            color="inherit"
            sx={{
              color: "#fff",
              borderColor: "rgba(255,255,255,0.3)",
              "&:hover": {
                borderColor: "rgba(255,255,255,0.5)",
                background: "rgba(255,255,255,0.05)",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmTransfer}
            variant="contained"
            sx={{
              bgcolor: "#4FC3F7",
              color: "#000",
              fontWeight: 600,
              px: 4,
              "&:hover": { bgcolor: "#29B6F6" },
            }}
          >
            Confirm Transfer
          </Button>
        </DialogActions>
      </Dialog>

      {/* 🧾 Receipt Dialog */}
      <Dialog
        open={receiptDialog}
        onClose={() => setReceiptDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(40,40,40,0.98) 0%, rgba(30,30,30,0.98) 100%)",
            color: "#fff",
            p: 2,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            border: "1px solid rgba(76, 175, 80, 0.3)",
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
          <CheckCircle sx={{ fontSize: 60, color: "#4CAF50", mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#4CAF50" }}>
            Transfer Successful!
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Box
            sx={{
              background: "rgba(76, 175, 80, 0.1)",
              borderRadius: 2,
              p: 3,
              border: "1px dashed rgba(76, 175, 80, 0.3)",
            }}
          >
            {/* Reference Number */}
            <Box sx={{ mb: 3, textAlign: "center" }}>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                Reference Number
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: "monospace",
                  color: "#4FC3F7",
                  fontWeight: 700,
                  letterSpacing: 1,
                }}
              >
                {receiptData?.referenceNumber}
              </Typography>
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", mb: 2 }} />

            {/* Transaction Details */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>Date & Time:</Typography>
                <Typography sx={{ fontWeight: 600 }}>
                  {receiptData?.date.toLocaleString("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>From:</Typography>
                <Typography sx={{ fontWeight: 600 }}>@{userData.username}</Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>To:</Typography>
                <Typography sx={{ fontWeight: 600 }}>@{receiptData?.recipient}</Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", mb: 2 }} />

            {/* Amount Details */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>Amount:</Typography>
                <Typography sx={{ fontWeight: 600 }}>
                  ₱{receiptData?.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>Service Charge (2%):</Typography>
                <Typography sx={{ fontWeight: 600, color: "#FFB74D" }}>
                  -₱{receiptData?.charge.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: "rgba(76, 175, 80, 0.3)", my: 1.5 }} />

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem" }}>Net Amount Sent:</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", color: "#4CAF50" }}>
                  ₱{receiptData?.netAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                mt: 2,
                p: 1.5,
                background: "rgba(76, 175, 80, 0.15)",
                borderRadius: 1,
                textAlign: "center",
              }}
            >
              <Typography variant="body2" sx={{ color: "#4CAF50", fontWeight: 600 }}>
                ✓ Status: Approved
              </Typography>
            </Box>
          </Box>

          <Typography
            variant="caption"
            sx={{
              display: "block",
              textAlign: "center",
              color: "rgba(255,255,255,0.5)",
              mt: 2,
            }}
          >
            Keep this reference number for your records
          </Typography>
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 2 }}>
          <Button
            onClick={handleDownloadReceipt}
            variant="outlined"
            startIcon={<DownloadIcon />}
            sx={{
              color: "#4FC3F7",
              borderColor: "#4FC3F7",
              "&:hover": {
                borderColor: "#29B6F6",
                background: "rgba(79, 195, 247, 0.1)",
              },
            }}
          >
            Download Receipt
          </Button>
          <Button
            onClick={() => {
              setReceiptDialog(false);
              handleClose();
            }}
            variant="contained"
            sx={{
              bgcolor: "#4CAF50",
              color: "#fff",
              fontWeight: 600,
              "&:hover": { bgcolor: "#45A049" },
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TransferFundsDialog;