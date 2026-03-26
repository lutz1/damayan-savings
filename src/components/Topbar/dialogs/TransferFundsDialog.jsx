// src/components/TransferFundsDialog.jsx
import React, { useState, useEffect } from "react";
import {
  Dialog,
  Drawer,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Paper,
  Fade,
  Slide,
} from "@mui/material";
import { Send, CheckCircle, QrCode2, Share } from "@mui/icons-material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  limit,
} from "firebase/firestore";
import { sendTransferNotification } from "../../../utils/notifications";

const TransferFundsDialog = ({ open, onClose, userData, db, auth, onBalanceUpdate }) => {
  const safeUserData = userData || {};
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
  const [clientRequestId, setClientRequestId] = useState(null);
  const [sendMode, setSendMode] = useState("express");
  const [qrAmount, setQrAmount] = useState("");
  // 🎯 NEW STATE FOR EXPRESS SEND STEP FLOW
  const [expressStep, setExpressStep] = useState(0); // 0=mode, 1=recipient, 2=amount, 3=review, 4=receipt
  const [messageText, setMessageText] = useState("");
  const [confirmReview, setConfirmReview] = useState(false); // 🎯 Checkbox confirmation
  const walletBalance = Number(safeUserData.eWallet || 0);
  const currentUsername = safeUserData.username || "";

  // ✅ Real-time transfer logs
  useEffect(() => {
    if (!open || !auth?.currentUser) return;
    // Clear error when dialog opens
    setError("");
    const q = query(collection(db, "transferFunds"), where("senderId", "==", auth.currentUser.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logs = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
        setTransferLogs(logs);
      },
      () => {
        setTransferLogs([]);
      }
    );
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
        .filter((u) => u.username !== currentUsername);
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

  // 🎯 Move to Review step (Step 3) - validation only
  const handleSubmitRequest = () => {
    if (!recipientUsername || !amount) {
      setError("Please enter recipient username and amount.");
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount <= 0) {
      setError("Transfer amount must be greater than zero.");
      return;
    }

    const chargeAmount = numAmount * 0.02;
    const totalNeeded = numAmount + chargeAmount;
    if (totalNeeded > walletBalance) {
      setError(`Insufficient balance. You need ₱${totalNeeded.toFixed(2)} (including 2% charge).`);
      return;
    }

    // Clear errors before moving to review step
    setError("");
    setConfirmReview(false); // Reset checkbox
    setExpressStep(3); // Move to review step
  };

  // 🎯 Perform actual transfer from Review step (Step 3)
  const handleConfirmAndSend = async () => {
    if (loading) return;
    if (!confirmReview) {
      setError("Please confirm the transfer details.");
      return;
    }

    setLoading(true);

    try {
      const numAmount = parseFloat(amount);
      const requestId = `tf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      setClientRequestId(requestId);

      // Get user's ID token for authentication
      const idToken = await auth.currentUser.getIdToken();

      const response = await fetch("https://us-central1-amayan-savings.cloudfunctions.net/transferFunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipientUsername,
          amount: numAmount,
          clientRequestId: requestId,
          message: messageText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Transfer failed");
      }

      await sendTransferNotification({
        userId: auth.currentUser.uid,
        amount: numAmount,
        recipientUsername,
      });

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
        message: messageText,
      });

      setExpressStep(4); // Move to receipt step
      setAmount("");
      setRecipientUsername("");
      setMessageText("");
      setSearchResults([]);
      setClientRequestId(null);
    } catch (err) {
      console.error("Transfer request failed:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (loading) return;
    setConfirmDialog(false);
    setLoading(true);

    try {
      const numAmount = parseFloat(amount);
      const requestId = clientRequestId || `tf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      setClientRequestId(requestId);

      // Get user's ID token for authentication
      const idToken = await auth.currentUser.getIdToken();

      const response = await fetch("https://us-central1-amayan-savings.cloudfunctions.net/transferFunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipientUsername,
          amount: numAmount,
          clientRequestId: requestId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Transfer failed");
      }

      await sendTransferNotification({
        userId: auth.currentUser.uid,
        amount: numAmount,
        recipientUsername,
      });

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
      setClientRequestId(null);
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
    setClientRequestId(null);
    setSendMode("express");
    setQrAmount("");
    setExpressStep(0); // 🎯 Reset Express Send step
    setMessageText(""); // 🎯 Reset message text
    setConfirmReview(false); // 🎯 Reset confirmation checkbox
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

  const buildQrPayload = () => {
    const payload = {
      type: "damayan-request",
      user: safeUserData.username || "",
      name: safeUserData.name || "",
      mobile: safeUserData.contactNumber || safeUserData.mobileNo || safeUserData.phoneNumber || "",
      amount: Number(qrAmount) > 0 ? Number(qrAmount) : null,
      generatedAt: Date.now(),
    };
    return JSON.stringify(payload);
  };

  const qrData = encodeURIComponent(buildQrPayload());
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${qrData}`;

  const handleDownloadMyQr = async () => {
    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `MyQR_${safeUserData.username || "member"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download QR code.");
    }
  };

  const handleShareMyQr = async () => {
    const shareText = `Scan my Damayan QR\nName: ${safeUserData.name || ""}\nUser: @${safeUserData.username || ""}${qrAmount ? `\nAmount: ₱${Number(qrAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : ""}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "My Damayan QR",
          text: shareText,
          url: qrImageUrl,
        });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${qrImageUrl}`);
        alert("QR link copied. You can now paste and share it.");
      }
    } catch (_) {}
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
    ctx.fillText(`@${currentUsername || "-"}`, canvas.width - 60, 320);

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
      {/* 🔹 MAIN SEND DRAWER WITH ANIMATION */}
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(0, 0, 0, 0.4)",
            },
          },
        }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 430 },
            maxWidth: "100%",
            backgroundColor: "#f7f9fc",
            animation: open ? "slideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1)" : "slideOut 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "@keyframes slideIn": {
              "0%": {
                transform: "translateX(100%)",
              },
              "100%": {
                transform: "translateX(0)",
              },
            },
            "@keyframes slideOut": {
              "0%": {
                transform: "translateX(0)",
              },
              "100%": {
                transform: "translateX(100%)",
              },
            },
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Box
            sx={{
              minHeight: 70,
              px: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#fff",
              background: "linear-gradient(135deg,#0058c9,#0050b3)",
            }}
          >
            <IconButton
              onClick={() => {
                if (sendMode === "express" && expressStep > 0) {
                  setExpressStep(0); // Go back to mode selection
                } else {
                  handleClose(); // Close drawer
                }
              }}
              sx={{ color: "#fff" }}
            >
              <ArrowBackIosNewIcon />
            </IconButton>
            <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2, lineHeight: 1 }}>
              {sendMode === "express" && expressStep > 0 
                ? expressStep === 1 
                  ? "Recipient" 
                  : expressStep === 2 
                  ? "Send Details"
                  : expressStep === 3
                  ? "Review"
                  : "Receipt"
                : "Send"}
            </Typography>
            <IconButton sx={{ color: "#fff" }}>
              <InfoOutlinedIcon />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
            {/* 🎯 MODE SELECTION SCREEN (Step 0) */}
            {(sendMode !== "express" || expressStep === 0) ? (
              <Fade in={expressStep === 0} timeout={300}>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "#556070", mb: 1, fontWeight: 700 }}>
                    Send to any Bowners account
                  </Typography>
                  <Paper
                    onClick={() => {
                      setSendMode("express");
                      setExpressStep(1); // Go to step 1
                    }}
                    sx={{
                      mb: 1.5,
                      p: 1.6,
                      borderRadius: 2,
                      border: sendMode === "express" && expressStep > 0 ? "1.5px solid #105abf" : "1px solid #dbe2ef",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 1.3,
                      backgroundColor: "#fff",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: "0 4px 12px rgba(16, 90, 191, 0.15)",
                      },
                    }}
                  >
                    <Box sx={{ width: 44, height: 44, borderRadius: 1.5, backgroundColor: "rgba(16,90,191,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Send sx={{ color: "#105abf" }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 800, color: "#223047" }}>Express Send</Typography>
                      <Typography sx={{ fontSize: 12, color: "#7a8392" }}>Send money quickly</Typography>
                    </Box>
                    <ChevronRightIcon sx={{ color: "#105abf", opacity: 0.6 }} />
                  </Paper>

                  <Typography sx={{ fontSize: 12, color: "#556070", mb: 1, fontWeight: 700 }}>
                    Request money
                  </Typography>
                  <Paper
                    onClick={() => setSendMode("qr")}
                    sx={{
                      mb: 1.8,
                      p: 1.6,
                      borderRadius: 2,
                      border: sendMode === "qr" ? "1.5px solid #105abf" : "1px solid #dbe2ef",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 1.3,
                      backgroundColor: "#fff",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: "0 4px 12px rgba(16, 90, 191, 0.15)",
                      },
                    }}
                  >
                    <Box sx={{ width: 44, height: 44, borderRadius: 1.5, backgroundColor: "rgba(16,90,191,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <QrCode2 sx={{ color: "#105abf" }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 800, color: "#223047" }}>Generate QR</Typography>
                      <Typography sx={{ fontSize: 12, color: "#7a8392" }}>Request easily using your QR code</Typography>
                    </Box>
                    <ChevronRightIcon sx={{ color: "#105abf", opacity: 0.6 }} />
                  </Paper>

                  {/* 💰 Balance */}
                  <Box sx={{ textAlign: "center", mt: 2 }}>
                    <Send sx={{ fontSize: 40, color: "#105abf" }} />
                    <Typography variant="h6" sx={{ mt: 1, color: "#4e5663" }}>
                      Available Balance
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: "#105abf" }}>
                      ₱{walletBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Box>
              </Fade>
            ) : null}

            {/* ✅ Success */}
            {success ? (
              <Fade in={success} timeout={300}>
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <CheckCircle sx={{ fontSize: 50, color: "#4CAF50" }} />
                  <Typography sx={{ mt: 1, color: "#4CAF50", fontWeight: 600 }}>
                    Transfer Completed!
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: "#5e6673" }}>
                    Funds were sent successfully.
                  </Typography>
                </Box>
              </Fade>
            ) : (
              <>
                {error && (
                  <Alert
                    severity="error"
                    sx={{
                      mb: 2,
                      backgroundColor: "rgba(239,54,54,0.09)",
                      color: "#c62828",
                    }}
                  >
                    {error}
                  </Alert>
                )}

                {/* 🎯 EXPRESS SEND STEP 1: RECIPIENT SELECTION */}
                {sendMode === "express" && expressStep === 1 && (
                  <Fade in={expressStep === 1} timeout={300}>
                    <Box>
                      <Divider sx={{ my: 2, borderColor: "#e4e8f0" }} />
                      <Typography sx={{ fontSize: 12, color: "#556070", mb: 2, fontWeight: 700 }}>
                        Enter username or find a Bowner
                      </Typography>

                      {/* 🧑‍ Recipient Search */}
                      <Box sx={{ position: "relative", mb: 3 }}>
                        <TextField
                          fullWidth
                          autoFocus
                          placeholder="Search username..."
                          value={recipientUsername}
                          onChange={(e) => handleSearchUser(e.target.value)}
                          sx={{
                            "& .MuiInputBase-root": { color: "#1f2430", backgroundColor: "#fff" },
                            "& .MuiInputLabel-root": { color: "#6a7280" },
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: "#d8deea" },
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
                              bgcolor: "#fff",
                              color: "#1f2430",
                              mt: 1,
                              borderRadius: 2,
                              border: "1px solid #dbe2ef",
                              maxHeight: 200,
                              overflowY: "auto",
                            }}
                          >
                            {searchResults.map((u) => (
                              <ListItem
                                key={u.id}
                              >
                                <ListItemButton
                                  onClick={() => {
                                    handleSelectUser(u.username);
                                    setExpressStep(2); // Move to amount step
                                  }}
                                  sx={{ "&:hover": { background: "#f3f6fc" } }}
                                  disabled={loading}
                                >
                                  <ListItemText
                                    primary={u.username}
                                    secondary={u.name}
                                    secondaryTypographyProps={{ color: "#7a8392" }}
                                  />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </Paper>
                        )}
                      </Box>

                      {recipientUsername && !showResults && (
                        <Button
                          fullWidth
                          onClick={() => setExpressStep(2)}
                          variant="contained"
                          sx={{
                            borderRadius: 2,
                            textTransform: "none",
                            bgcolor: "#105abf",
                            color: "#fff",
                            fontWeight: 700,
                            py: 1.3,
                            "&:hover": { bgcolor: "#0b4eaa" },
                          }}
                        >
                          Done
                        </Button>
                      )}
                    </Box>
                  </Fade>
                )}

                {/* 🎯 EXPRESS SEND STEP 2: AMOUNT & MESSAGE */}
                {sendMode === "express" && expressStep === 2 && (
                  <Fade in={expressStep === 2} timeout={300}>
                    <Box>
                      <Divider sx={{ my: 2, borderColor: "#e4e8f0" }} />

                      {/* Display selected recipient */}
                      <Box sx={{ background: "#fff", borderRadius: 2, p: 2, mb: 2, border: "1px solid #dbe2ef" }}>
                        <Typography sx={{ fontSize: 11, color: "#556070", fontWeight: 700, mb: 0.5 }}>
                          Sending to
                        </Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#105abf" }}>
                          @{recipientUsername}
                        </Typography>
                      </Box>

                      {/* 💰 Available Balance */}
                      <Box sx={{ background: "rgba(16, 90, 191, 0.08)", borderRadius: 2, p: 1.5, mb: 2, border: "1px solid rgba(16, 90, 191, 0.2)" }}>
                        <Typography sx={{ fontSize: 11, color: "#556070", fontWeight: 700, mb: 0.3 }}>
                          Available Balance
                        </Typography>
                        <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#105abf" }}>
                          ₱{walletBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </Typography>
                      </Box>

                      {/* 💸 Amount */}
                      <Typography sx={{ fontSize: 12, color: "#556070", mb: 0.8, fontWeight: 700 }}>
                        Amount to Send
                      </Typography>
                      <TextField
                        type="number"
                        fullWidth
                        autoFocus
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        sx={{
                          mb: 2.5,
                          "& .MuiInputBase-root": { color: "#1f2430", backgroundColor: "#fff", fontSize: 18, fontWeight: 700 },
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#d8deea" },
                        }}
                      />

                      {amount && (
                        <Box sx={{ background: "#fff", borderRadius: 2, p: 1.5, mb: 2, border: "1px solid #e4e8f0" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                            <Typography sx={{ fontSize: 12, color: "#556070" }}>2% Service Charge:</Typography>
                            <Typography sx={{ fontSize: 12, color: "#FFB74D", fontWeight: 600 }}>
                              -₱{(amount * 0.02 || 0).toFixed(2)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography sx={{ fontSize: 12, color: "#556070", fontWeight: 700 }}>Net Amount:</Typography>
                            <Typography sx={{ fontSize: 14, color: "#81C784", fontWeight: 800 }}>
                              ₱{netAmount.toFixed(2)}
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Optional Message */}
                      <Typography sx={{ fontSize: 12, color: "#556070", mb: 0.8, fontWeight: 700 }}>
                        Add an optional message
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="Your message here..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        sx={{
                          mb: 2,
                          "& .MuiInputBase-root": { color: "#1f2430", backgroundColor: "#fff" },
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#d8deea" },
                        }}
                      />

                      {/* Next Button */}
                      <Button
                        fullWidth
                        onClick={handleSubmitRequest}
                        variant="contained"
                        disabled={loading || !amount || !recipientUsername}
                        sx={{
                          borderRadius: 2,
                          textTransform: "none",
                          bgcolor: "#105abf",
                          color: "#fff",
                          fontWeight: 700,
                          py: 1.3,
                          "&:hover": { bgcolor: "#0b4eaa" },
                          "&:disabled": { bgcolor: "rgba(16, 90, 191, 0.4)" },
                        }}
                      >
                        {loading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Next"}
                      </Button>
                    </Box>
                  </Fade>
                )}

                {/* 🎯 EXPRESS SEND STEP 3: REVIEW */}
                {sendMode === "express" && expressStep === 3 && (
                  <Fade in={expressStep === 3} timeout={300}>
                    <Box>
                      <Divider sx={{ my: 2, borderColor: "#e4e8f0" }} />

                      {/* You're about to send message */}
                      <Box sx={{ background: "rgba(16, 90, 191, 0.08)", borderRadius: 2, p: 2, mb: 2, border: "1px solid rgba(16, 90, 191, 0.2)", textAlign: "center" }}>
                        <Typography sx={{ fontSize: 14, color: "#556070", fontWeight: 700 }}>
                          You're about to send
                        </Typography>
                      </Box>

                      {/* Recipient Display */}
                      <Box sx={{ background: "#fff", borderRadius: 2, p: 2, mb: 2, border: "1px solid #dbe2ef" }}>
                        <Typography sx={{ fontSize: 11, color: "#556070", fontWeight: 700, mb: 0.5 }}>
                          To
                        </Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#105abf" }}>
                          @{recipientUsername}
                        </Typography>
                      </Box>

                      {/* Amount Summary */}
                      <Box sx={{ background: "#fff", borderRadius: 2, p: 2, mb: 2, border: "1px solid #dbe2ef" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.2 }}>
                          <Typography sx={{ fontSize: 12, color: "#556070" }}>Amount:</Typography>
                          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1f2430" }}>
                            ₱{parseFloat(amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.2 }}>
                          <Typography sx={{ fontSize: 12, color: "#556070" }}>2% Service Charge:</Typography>
                          <Typography sx={{ fontSize: 12, color: "#FFB74D", fontWeight: 600 }}>
                            -₱{(parseFloat(amount || 0) * 0.02).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Divider sx={{ my: 1.2, borderColor: "#e4e8f0" }} />
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography sx={{ fontSize: 13, color: "#556070", fontWeight: 700 }}>Total to Pay:</Typography>
                          <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#105abf" }}>
                            ₱{netAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Message Display (if any) */}
                      {messageText && (
                        <Box sx={{ background: "#fff", borderRadius: 2, p: 2, mb: 2, border: "1px solid #dbe2ef" }}>
                          <Typography sx={{ fontSize: 11, color: "#556070", fontWeight: 700, mb: 0.5 }}>
                            Message
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#1f2430", fontStyle: "italic" }}>
                            "{messageText}"
                          </Typography>
                        </Box>
                      )}

                      {/* Confirmation Checkbox */}
                      <Box sx={{ 
                        background: "#fff", 
                        borderRadius: 2, 
                        p: 2, 
                        mb: 2, 
                        border: "1px solid #dbe2ef",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.2,
                        cursor: "pointer"
                      }}
                      onClick={() => setConfirmReview(!confirmReview)}
                      >
                        <input
                          type="checkbox"
                          checked={confirmReview}
                          onChange={() => setConfirmReview(!confirmReview)}
                          style={{
                            width: 20,
                            height: 20,
                            cursor: "pointer",
                            marginTop: 2,
                            accentColor: "#105abf",
                          }}
                        />
                        <Box>
                          <Typography sx={{ fontSize: 12, color: "#1f2430", fontWeight: 700 }}>
                            I confirm the transaction details
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#7a8392", mt: 0.3 }}>
                            Please review all information carefully before confirming
                          </Typography>
                        </Box>
                      </Box>

                      {error && (
                        <Alert
                          severity="error"
                          sx={{
                            mb: 2,
                            backgroundColor: "rgba(239,54,54,0.09)",
                            color: "#c62828",
                          }}
                        >
                          {error}
                        </Alert>
                      )}

                      {/* Send Button - Enabled only after checkbox confirmed */}
                      <Button
                        fullWidth
                        onClick={handleConfirmAndSend}
                        variant="contained"
                        disabled={loading || !confirmReview}
                        sx={{
                          borderRadius: 2,
                          textTransform: "none",
                          bgcolor: "#105abf",
                          color: "#fff",
                          fontWeight: 700,
                          py: 1.3,
                          "&:hover": { bgcolor: "#0b4eaa" },
                          "&:disabled": { bgcolor: "rgba(16, 90, 191, 0.4)", cursor: "not-allowed" },
                        }}
                      >
                        {loading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Send Now"}
                      </Button>
                    </Box>
                  </Fade>
                )}

                {/* 🎯 EXPRESS SEND STEP 4: RECEIPT */}
                {sendMode === "express" && expressStep === 4 && (
                  <Fade in={expressStep === 4} timeout={300}>
                    <Box>
                      <Divider sx={{ my: 2, borderColor: "#e4e8f0" }} />

                      {/* Success Message */}
                      <Box sx={{ textAlign: "center", mb: 3 }}>
                        <CheckCircle sx={{ fontSize: 50, color: "#4CAF50", mb: 1 }} />
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#4CAF50" }}>
                          Transfer Successful!
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#7a8392", mt: 0.5 }}>
                          Your payment has been sent
                        </Typography>
                      </Box>

                      {/* Receipt Details */}
                      <Box sx={{ background: "#fff", borderRadius: 2, p: 2, mb: 2, border: "1px solid #dbe2ef" }}>
                        <Box sx={{ mb: 1.5 }}>
                          <Typography sx={{ fontSize: 11, color: "#556070", fontWeight: 700, mb: 0.3 }}>
                            Reference Number
                          </Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#105abf", fontFamily: "monospace" }}>
                            {receiptData?.referenceNumber || "-"}
                          </Typography>
                        </Box>
                        <Divider sx={{ my: 1.5, borderColor: "#e4e8f0" }} />
                        <Box sx={{ mb: 1 }}>
                          <Typography sx={{ fontSize: 11, color: "#556070", fontWeight: 700, mb: 0.3 }}>
                            Sent to
                          </Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#1f2430" }}>
                            @{receiptData?.recipient || "-"}
                          </Typography>
                        </Box>
                        <Divider sx={{ my: 1.5, borderColor: "#e4e8f0" }} />
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
                          <Typography sx={{ fontSize: 11, color: "#556070" }}>Amount:</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#1f2430" }}>
                            ₱{receiptData?.amount?.toLocaleString("en-PH", { minimumFractionDigits: 2 }) || "-"}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
                          <Typography sx={{ fontSize: 11, color: "#556070" }}>Service Charge:</Typography>
                          <Typography sx={{ fontSize: 11, color: "#FFB74D", fontWeight: 600 }}>
                            -₱{receiptData?.charge?.toLocaleString("en-PH", { minimumFractionDigits: 2 }) || "-"}
                          </Typography>
                        </Box>
                        <Divider sx={{ my: 1.5, borderColor: "#e4e8f0" }} />
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography sx={{ fontSize: 12, color: "#556070", fontWeight: 700 }}>Net Sent:</Typography>
                          <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#4CAF50" }}>
                            ₱{receiptData?.netAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 }) || "-"}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Date & Time */}
                      <Box sx={{ background: "#fff", borderRadius: 2, p: 2, mb: 2, border: "1px solid #dbe2ef" }}>
                        <Typography sx={{ fontSize: 11, color: "#556070", fontWeight: 700, mb: 0.3 }}>
                          Date & Time
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#1f2430" }}>
                          {receiptData?.date?.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) || "-"}
                        </Typography>
                      </Box>

                      {/* Action Buttons */}
                      <Box sx={{ display: "flex", gap: 1.2 }}>
                        <Button
                          fullWidth
                          onClick={handleDownloadReceipt}
                          variant="outlined"
                          startIcon={<DownloadIcon />}
                          sx={{
                            color: "#4FC3F7",
                            borderColor: "rgba(79,195,247,0.5)",
                            fontWeight: 700,
                            textTransform: "none",
                            borderRadius: 2,
                          }}
                        >
                          Download
                        </Button>
                        <Button
                          fullWidth
                          onClick={handleShareMyQr}
                          variant="outlined"
                          startIcon={<Share />}
                          sx={{
                            color: "#4FC3F7",
                            borderColor: "rgba(79,195,247,0.5)",
                            fontWeight: 700,
                            textTransform: "none",
                            borderRadius: 2,
                          }}
                        >
                          Share
                        </Button>
                      </Box>
                    </Box>
                  </Fade>
                )}

                {/* 🎯 GENERATE QR MODE */}
                {sendMode === "qr" && (
                  <Fade in={sendMode === "qr"} timeout={300}>
                    <Box>
                      <Divider sx={{ my: 2, borderColor: "#e4e8f0" }} />
                      <Typography sx={{ fontSize: 12, color: "#556070", mb: 1, fontWeight: 700 }}>
                        Request money
                      </Typography>
                      <Box sx={{ display: "flex", justifyContent: "center", mb: 1.2 }}>
                        <Box
                          sx={{
                            width: 220,
                            height: 220,
                            borderRadius: 2,
                            backgroundColor: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            p: 1,
                          }}
                        >
                          <img src={qrImageUrl} alt="My QR" width={200} height={200} />
                        </Box>
                      </Box>

                      <Typography sx={{ textAlign: "center", color: "#4FC3F7", fontWeight: 700, mb: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                        <QrCode2 fontSize="small" /> My QR
                      </Typography>

                      <Box sx={{ background: "#fff", borderRadius: 2, p: 1.5, mb: 1.5, border: "1px solid #dbe2ef" }}>
                        <Typography variant="body2" sx={{ color: "#243042", mb: 0.5 }}>
                          Display Name: {safeUserData.name || "-"}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#243042", mb: 0.5 }}>
                          Mobile No.: {safeUserData.contactNumber || safeUserData.mobileNo || safeUserData.phoneNumber || "-"}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#243042" }}>
                          User: @{safeUserData.username || "-"}
                        </Typography>
                      </Box>

                      <TextField
                        type="number"
                        fullWidth
                        label="Add an amount"
                        value={qrAmount}
                        onChange={(e) => setQrAmount(e.target.value)}
                        helperText="Specify an amount upon scanning your QR code"
                        sx={{
                          mb: 1,
                          "& .MuiInputBase-root": { color: "#1f2430", backgroundColor: "#fff" },
                          "& .MuiInputLabel-root": { color: "#6a7280" },
                          "& .MuiFormHelperText-root": { color: "#6f7785" },
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#d8deea" },
                        }}
                      />

                      <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                        <Button
                          fullWidth
                          onClick={handleDownloadMyQr}
                          variant="outlined"
                          startIcon={<DownloadIcon />}
                          sx={{ color: "#4FC3F7", borderColor: "rgba(79,195,247,0.5)" }}
                        >
                          Download
                        </Button>
                        <Button
                          fullWidth
                          onClick={handleShareMyQr}
                          variant="outlined"
                          startIcon={<Share />}
                          sx={{ color: "#4FC3F7", borderColor: "rgba(79,195,247,0.5)" }}
                        >
                          Share QR
                        </Button>
                      </Box>
                    </Box>
                  </Fade>
                )}
              </>
            )}

            {/* 📜 Logs - Show only in main/QR view */}
            {(sendMode !== "express" || expressStep === 0) && transferLogs.length > 0 && (
              <>
                <Divider sx={{ my: 2, borderColor: "#e4e8f0" }} />
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700, color: "#105abf" }}>
                  Transfer Logs
                </Typography>
                <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
                  {transferLogs.map((log) => (
                    <ListItem
                      key={log.id}
                      sx={{ borderBottom: "1px solid #eef2f7", py: 0.5 }}
                    >
                      <ListItemText
                        primary={`₱${log.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} → ${log.recipientUsername}`}
                        secondary={
                          log.createdAt
                            ? new Date(log.createdAt.seconds * 1000).toLocaleString("en-PH")
                            : "Pending..."
                        }
                        primaryTypographyProps={{ color: "#273142" }}
                        secondaryTypographyProps={{ color: "#7a8392", fontSize: 12 }}
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
          </Box>

        {/* 🔘 Actions */}
        <Box sx={{ px: 3, py: 2, backgroundColor: "#fff", borderTop: "1px solid #eceef1", display: "flex", justifyContent: "flex-end", gap: 1.2 }}>
          {success ? (
            <Button
              onClick={handleClose}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                color: "#fff",
                textTransform: "none",
                backgroundColor: "#105abf",
                px: 2.5,
                "&:hover": { backgroundColor: "#0b4eaa" },
              }}
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                onClick={() => {
                  if (sendMode === "express" && expressStep > 0) {
                    setExpressStep(0);
                  } else {
                    handleClose();
                  }
                }}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  color: "#105abf",
                  textTransform: "none",
                  backgroundColor: "rgba(16,90,191,0.08)",
                  px: 2.5,
                  "&:hover": { backgroundColor: "rgba(16,90,191,0.14)" },
                }}
              >
                {sendMode === "express" && expressStep > 0 ? "Back" : "Cancel"}
              </Button>

              {sendMode === "express" && expressStep === 4 && (
                <Button
                  onClick={handleClose}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    color: "#fff",
                    textTransform: "none",
                    backgroundColor: "#105abf",
                    px: 2.5,
                    "&:hover": { backgroundColor: "#0b4eaa" },
                  }}
                >
                  Done
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>
      </Drawer>

      {/* ⚠️ Confirm Transfer Dialog */}
      <Dialog
        open={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            backgroundColor: "#f7f9fc",
            boxShadow: "0 10px 28px rgba(25,28,30,0.14)",
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", pb: 1, color: "#fff", background: "linear-gradient(135deg,#003f8d,#0055ba)" }}>
          <Send sx={{ fontSize: 54, color: "#fff", mb: 0.8 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#fff" }}>
            Confirm Transfer
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)", mt: 1 }}>
            Please review the details before confirming
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ backgroundColor: "#f7f9fc" }}>
          <Box
            sx={{
              background: "#fff",
              borderRadius: 2,
              p: 3,
              border: "1px solid #dbe2ef",
            }}
          >
            {/* Transaction Details */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "#6c7380" }}>From:</Typography>
                <Typography sx={{ fontWeight: 700, color: "#1f2430" }}>@{currentUsername || "-"}</Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "#6c7380" }}>To:</Typography>
                <Typography sx={{ fontWeight: 700, color: "#1f2430" }}>@{recipientUsername}</Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: "#e4e8f0", mb: 2 }} />

            {/* Amount Details */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "#6c7380" }}>Amount:</Typography>
                <Typography sx={{ fontWeight: 700, color: "#1f2430" }}>
                  ₱{parseFloat(amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "#6c7380" }}>Service Charge (2%):</Typography>
                <Typography sx={{ fontWeight: 600, color: "#FFB74D" }}>
                  -₱{(parseFloat(amount || 0) * 0.02).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: "#dbe2ef", my: 1.5 }} />

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem" }}>Net Amount to Send:</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: "1.1rem", color: "#105abf" }}>
                  ₱{netAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                mt: 2,
                p: 1.5,
                background: "rgba(255, 193, 7, 0.11)",
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
              color: "#6f7785",
              mt: 2,
            }}
          >
            This transaction cannot be reversed once confirmed
          </Typography>
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 2, backgroundColor: "#fff", borderTop: "1px solid #eceef1" }}>
          <Button
            onClick={() => setConfirmDialog(false)}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              color: "#105abf",
              textTransform: "none",
              backgroundColor: "rgba(16,90,191,0.08)",
              px: 2.5,
              "&:hover": { backgroundColor: "rgba(16,90,191,0.14)" },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmTransfer}
            variant="contained"
            sx={{
              borderRadius: 2,
              bgcolor: "#105abf",
              color: "#fff",
              fontWeight: 700,
              px: 4,
              textTransform: "none",
              "&:hover": { bgcolor: "#0b4eaa" },
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
            overflow: "hidden",
            backgroundColor: "#f7f9fc",
            boxShadow: "0 10px 28px rgba(25,28,30,0.14)",
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", pb: 1, color: "#fff", background: "linear-gradient(135deg,#003f8d,#0055ba)" }}>
          <CheckCircle sx={{ fontSize: 54, color: "#fff", mb: 0.8 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#fff" }}>
            Transfer Successful!
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ backgroundColor: "#f7f9fc" }}>
          <Box
            sx={{
              background: "#fff",
              borderRadius: 2,
              p: 3,
              border: "1px solid #dbe2ef",
            }}
          >
            {/* Reference Number */}
            <Box sx={{ mb: 3, textAlign: "center" }}>
              <Typography variant="caption" sx={{ color: "#6c7380" }}>
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

            <Divider sx={{ borderColor: "#e4e8f0", mb: 2 }} />

            {/* Transaction Details */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "#6c7380" }}>Date & Time:</Typography>
                <Typography sx={{ fontWeight: 700, color: "#1f2430" }}>
                  {receiptData?.date.toLocaleString("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "#6c7380" }}>From:</Typography>
                <Typography sx={{ fontWeight: 700, color: "#1f2430" }}>@{currentUsername || "-"}</Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "#6c7380" }}>To:</Typography>
                <Typography sx={{ fontWeight: 700, color: "#1f2430" }}>@{receiptData?.recipient}</Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: "#e4e8f0", mb: 2 }} />

            {/* Amount Details */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "#6c7380" }}>Amount:</Typography>
                <Typography sx={{ fontWeight: 700, color: "#1f2430" }}>
                  ₱{receiptData?.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ color: "#6c7380" }}>Service Charge (2%):</Typography>
                <Typography sx={{ fontWeight: 600, color: "#FFB74D" }}>
                  -₱{receiptData?.charge.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: "#dbe2ef", my: 1.5 }} />

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem" }}>Net Amount Sent:</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: "1.1rem", color: "#105abf" }}>
                  ₱{receiptData?.netAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                mt: 2,
                p: 1.5,
                background: "rgba(76, 175, 80, 0.12)",
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
              color: "#6f7785",
              mt: 2,
            }}
          >
            Keep this reference number for your records
          </Typography>
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 2, backgroundColor: "#fff", borderTop: "1px solid #eceef1" }}>
          <Button
            onClick={handleDownloadReceipt}
            variant="outlined"
            startIcon={<DownloadIcon />}
            sx={{
              color: "#105abf",
              borderColor: "#105abf",
              "&:hover": {
                borderColor: "#0b4eaa",
                background: "rgba(16, 90, 191, 0.08)",
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
              bgcolor: "#105abf",
              color: "#fff",
              fontWeight: 700,
              textTransform: "none",
              "&:hover": { bgcolor: "#0b4eaa" },
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