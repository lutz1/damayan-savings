// src/components/TransferFundsDialog.jsx
import React, { useState, useEffect, useRef } from "react";
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
  Avatar,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Paper,
  Fade,
  Slide,
  InputAdornment,
} from "@mui/material";
import { Send, CheckCircle, QrCode2, Share, Search as SearchIcon } from "@mui/icons-material";
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
import { getUserAvatarInitial, getUserAvatarUrl } from "../../../utils/userAvatar";

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
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const allContactsRef = useRef(null);
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
    setNetAmount(amt);
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
        .map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            ...data,
            profilePicture: getUserAvatarUrl(data),
          };
        })
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

  const clearRecipientPicker = () => {
    setRecipientUsername("");
    setSearchResults([]);
    setShowResults(false);
    setSearching(false);
  };

  const handleViewAllRecipients = () => {
    clearRecipientPicker();
    requestAnimationFrame(() => {
      allContactsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSendBack = () => {
    if (sendMode === "express") {
      if (expressStep === 0) {
        handleClose();
        return;
      }

      if (expressStep === 1) {
        clearRecipientPicker();
        setExpressStep(0);
        return;
      }

      if (expressStep === 2) {
        clearRecipientPicker();
        setExpressStep(1);
        return;
      }

      if (expressStep === 3) {
        setExpressStep(2);
        return;
      }

      if (expressStep === 4) {
        setExpressStep(0);
        return;
      }
    }

    if (sendMode === "qr") {
      setSendMode("express");
      setQrAmount("");
      setExpressStep(0);
      return;
    }

    handleClose();
  };

  useEffect(() => {
    if (!open || !db) return;

    let active = true;

    const loadContacts = async () => {
      try {
        const snap = await getDocs(query(collection(db, "users"), limit(200)));
        if (!active) return;

        const contacts = snap.docs
          .map((doc) => {
            const data = doc.data() || {};
            return {
              id: doc.id,
              ...data,
              profilePicture: getUserAvatarUrl(data),
            };
          })
          .filter((user) => user.username && user.username !== currentUsername);

        setAllContacts(contacts);
      } catch (err) {
        console.error("Failed to load contacts:", err);
        if (active) setAllContacts([]);
      }
    };

    loadContacts();

    return () => {
      active = false;
    };
  }, [open, db, currentUsername]);

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
        netAmount: numAmount,
        totalDeduction: numAmount + numAmount * 0.02,
        recipient: recipientUsername,
        recipientName: selectedRecipient?.name || recipientUsername,
        recipientProfilePicture: getUserAvatarUrl(selectedRecipient),
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
        netAmount: numAmount,
        totalDeduction: numAmount + numAmount * 0.02,
        recipient: recipientUsername,
        recipientName: selectedRecipient?.name || recipientUsername,
        recipientProfilePicture: getUserAvatarUrl(selectedRecipient),
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
    setInfoDialogOpen(false);
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
  const previewTransferLogs = transferLogs.slice(0, 3);
  const selectedRecipient =
    allContacts.find((user) => user.username === recipientUsername) ||
    searchResults.find((user) => user.username === recipientUsername) ||
    null;
  const amountValue = parseFloat(amount) || 0;
  const transferFee = amountValue * 0.02;
  const totalToDeduct = amountValue + transferFee;
  const recipientDirectory = recipientUsername.trim() ? searchResults : allContacts;
  const recipientLookup = new Map(allContacts.map((user) => [user.username, user]));
  const getLogRecipient = (log) => {
    const matchedContact = recipientLookup.get(log?.recipientUsername);
    return {
      username: log?.recipientUsername || matchedContact?.username || "",
      name: matchedContact?.name || log?.recipientName || log?.recipientUsername || "User",
      profilePicture: getUserAvatarUrl({
        ...matchedContact,
        profilePicture: log?.recipientProfilePicture || matchedContact?.profilePicture || log?.profilePicture || "",
      }),
    };
  };
  const recentRecipients = Array.from(
    new Map(
      transferLogs
        .filter((log) => log?.recipientUsername)
        .map((log) => {
          const recipient = getLogRecipient(log);
          return [recipient.username, recipient];
        })
    ).values()
  ).slice(0, 6);
  const featuredRecipients = recentRecipients.length > 0 ? recentRecipients : allContacts.slice(0, 6);

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

  const buildReceiptCanvas = () => {
    if (!receiptData) return null;

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1680;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const totalAmount = Number(receiptData.amount || 0) + Number(receiptData.charge || 0);
    const receiptDate = receiptData?.date ? new Date(receiptData.date) : new Date();
    const recipientLabel = receiptData?.recipientName || receiptData?.recipient || "Recipient";
    const recipientHandle = `@${receiptData?.recipient || "member"}`;
    const initials = (recipientLabel || "R").charAt(0).toUpperCase();

    ctx.fillStyle = "#eef2f8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#0f57d5";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 120, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px Arial";
    ctx.textAlign = "center";
    ctx.fillText("✓", canvas.width / 2, 132);

    ctx.fillStyle = "#1e2430";
    ctx.font = "bold 50px Arial";
    ctx.fillText("Transfer Successful!", canvas.width / 2, 230);

    ctx.fillStyle = "#6e7787";
    ctx.font = "26px Arial";
    ctx.fillText("Your funds have been sent securely.", canvas.width / 2, 276);

    const cardX = 90;
    const cardY = 335;
    const cardW = canvas.width - 180;
    const cardH = 940;

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, cardX, cardY, cardW, cardH, 28, true, false);

    ctx.fillStyle = "#7a8191";
    ctx.font = "bold 18px Arial";
    ctx.fillText("TOTAL AMOUNT", canvas.width / 2, cardY + 70);

    ctx.fillStyle = "#0f57d5";
    ctx.font = "bold 66px Arial";
    ctx.fillText(`₱${totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, canvas.width / 2, cardY + 140);

    roundRect(ctx, cardX + 40, cardY + 190, cardW - 80, 120, 22, true, false, "#f4f6fa");
    ctx.fillStyle = "#12284c";
    ctx.beginPath();
    ctx.arc(cardX + 94, cardY + 250, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Arial";
    ctx.fillText(initials, cardX + 94, cardY + 259);

    ctx.fillStyle = "#7a8191";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.fillText("RECIPIENT", cardX + 145, cardY + 230);
    ctx.fillStyle = "#1e2430";
    ctx.font = "bold 30px Arial";
    ctx.fillText(recipientLabel, cardX + 145, cardY + 268);
    ctx.fillStyle = "#6e7787";
    ctx.font = "22px Arial";
    ctx.fillText(`${recipientHandle} • ${receiptData?.transferId || receiptData?.referenceNumber || "TRANSFER"}`, cardX + 145, cardY + 298);

    ctx.fillStyle = "#7a8191";
    ctx.font = "bold 16px Arial";
    ctx.fillText("REF NUMBER", cardX + 40, cardY + 370);
    ctx.fillStyle = "#1e2430";
    ctx.font = "bold 26px monospace";
    ctx.fillText(receiptData.referenceNumber || "-", cardX + 40, cardY + 410);

    roundRect(ctx, cardX + cardW - 150, cardY + 352, 110, 42, 18, true, false, "#ecf3ff");
    ctx.fillStyle = "#0f57d5";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Copy", cardX + cardW - 95, cardY + 380);

    ctx.textAlign = "left";
    ctx.fillStyle = "#7a8191";
    ctx.font = "bold 16px Arial";
    ctx.fillText("DATE", cardX + 40, cardY + 490);
    ctx.fillText("TIME", cardX + cardW - 210, cardY + 490);

    ctx.fillStyle = "#1e2430";
    ctx.font = "bold 24px Arial";
    ctx.fillText(receiptDate.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }), cardX + 40, cardY + 530);
    ctx.fillText(receiptDate.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }), cardX + cardW - 210, cardY + 530);

    ctx.fillStyle = "#7a8191";
    ctx.font = "bold 16px Arial";
    ctx.fillText("SUMMARY", cardX + 40, cardY + 620);

    const summaryRows = [
      ["Amount", `₱${Number(receiptData.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
      ["Service Fee", `₱${Number(receiptData.charge || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
      ["Total", `₱${totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
    ];

    summaryRows.forEach(([label, value], index) => {
      const y = cardY + 675 + index * 62;
      ctx.fillStyle = "#6e7787";
      ctx.font = "22px Arial";
      ctx.fillText(label, cardX + 40, y);
      ctx.fillStyle = index === 2 ? "#0f57d5" : "#1e2430";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "right";
      ctx.fillText(value, cardX + cardW - 40, y);
      ctx.textAlign = "left";

      if (index < summaryRows.length - 1) {
        ctx.strokeStyle = "#e8edf5";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cardX + 40, y + 22);
        ctx.lineTo(cardX + cardW - 40, y + 22);
        ctx.stroke();
      }
    });

    return canvas;
  };

  const roundRect = (ctx, x, y, width, height, radius, fill, stroke, fillColor) => {
    if (fillColor) ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  };

  const canvasToBlob = (canvas) =>
    new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });

  const handleDownloadReceipt = async () => {
    if (!receiptData) return;

    try {
      const canvas = buildReceiptCanvas();
      if (!canvas) return;
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error("Failed to create receipt image.");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Transfer_Receipt_${receiptData.referenceNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Receipt save failed:", err);
      setError("Failed to save receipt.");
    }
  };

  const handleShareReceipt = async () => {
    if (!receiptData) return;

    try {
      const canvas = buildReceiptCanvas();
      if (!canvas) return;
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error("Failed to create receipt image.");

      const totalAmount = Number(receiptData.amount || 0) + Number(receiptData.charge || 0);
      const shareText = `Transfer receipt\nReference: ${receiptData.referenceNumber}\nRecipient: @${receiptData.recipient}\nTotal: ₱${totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
      const file = new File([blob], `Transfer_Receipt_${receiptData.referenceNumber}.png`, { type: "image/png" });

      if (navigator.share) {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: "Transfer Receipt",
            text: shareText,
            files: [file],
          });
        } else {
          await navigator.share({
            title: "Transfer Receipt",
            text: shareText,
          });
        }
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        if (typeof window !== "undefined") {
          window.alert("Receipt details copied to clipboard. You can now paste and share it.");
        }
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Receipt share failed:", err);
        setError("Failed to share receipt.");
      }
    }
  };

  const handleCopyReceiptReference = async () => {
    if (!receiptData?.referenceNumber || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(receiptData.referenceNumber);
    } catch (err) {
      console.error("Failed to copy reference number:", err);
    }
  };

  return (
    <>
      {/* 🔹 MAIN SEND DRAWER WITH ANIMATION */}
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        ModalProps={{ keepMounted: true }}
        transitionDuration={{ enter: 360, exit: 260 }}
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
            background: "linear-gradient(180deg, rgba(4,12,30,0.98) 0%, rgba(8,23,52,0.98) 44%, rgba(15,42,99,0.97) 100%)",
            color: "#f8fbff",
            borderLeft: "1px solid rgba(138,199,255,0.14)",
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
              pt: "calc(env(safe-area-inset-top, 0px) + 10px)",
              pb: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#fff",
              background: "linear-gradient(135deg, rgba(6,19,46,0.98) 0%, rgba(13,47,118,0.96) 58%, rgba(37,101,214,0.90) 100%)",
              borderBottom: "1px solid rgba(138,199,255,0.16)",
            }}
          >
            <IconButton onClick={handleSendBack} sx={{ color: "#fff" }}>
              <ArrowBackIosNewIcon />
            </IconButton>
            <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2, lineHeight: 1 }}>
              {sendMode === "express" && expressStep > 0
                ? expressStep === 1
                  ? "Select Recipient"
                  : expressStep === 2
                  ? "Send Details"
                  : expressStep === 3
                  ? "Review Transfer"
                  : "Receipt"
                : sendMode === "qr"
                ? "Scan To Pay"
                : "Send"}
            </Typography>
            <IconButton
              onClick={() => setInfoDialogOpen(true)}
              sx={{
                color: "#fff",
                backgroundColor: "rgba(138,199,255,0.12)",
                border: "1px solid rgba(138,199,255,0.20)",
                "&:hover": { backgroundColor: "rgba(138,199,255,0.20)" },
              }}
            >
              <InfoOutlinedIcon />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
            {/* 🎯 MODE SELECTION SCREEN (Step 0) */}
            {(sendMode !== "express" || expressStep === 0) ? (
              <Fade in={expressStep === 0} timeout={300}>
                <Box>
                  <Box
                    sx={{
                      mb: 1.7,
                      borderRadius: 3.5,
                      p: 2,
                      color: "#fff",
                      background: "linear-gradient(145deg, rgba(8,23,52,0.98) 0%, rgba(16,42,99,0.95) 52%, rgba(33,86,201,0.88) 100%)",
                      border: "1px solid rgba(138,199,255,0.16)",
                      boxShadow: "0 18px 38px rgba(2, 14, 38, 0.34)",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.2 }}>
                      <Box>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.1, color: "rgba(255,255,255,0.78)" }}>
                          AVAILABLE BALANCE
                        </Typography>
                        <Typography sx={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, letterSpacing: -0.4, mt: 0.3 }}>
                          ₱{walletBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          px: 1.1,
                          py: 0.45,
                          borderRadius: 999,
                          backgroundColor: "rgba(255,255,255,0.16)",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 0.7,
                          whiteSpace: "nowrap",
                        }}
                      >
                        VERIFIED ACCOUNT
                      </Box>
                    </Box>

                    <Box sx={{ mt: 2.2 }}>
                      <Typography sx={{ fontSize: 9.5, color: "rgba(255,255,255,0.74)", letterSpacing: 1 }}>
                        ACCOUNT HOLDER
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, mt: 0.35 }}>
                        {safeUserData.name || safeUserData.username || "Member"}
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 1.2,
                      mb: 1.8,
                    }}
                  >
                    <Paper
                      onClick={() => {
                        setSendMode("express");
                        setExpressStep(1);
                      }}
                      sx={{
                        p: 1.5,
                        minHeight: 132,
                        borderRadius: 3,
                        cursor: "pointer",
                        background: "linear-gradient(145deg, rgba(8,23,52,0.94) 0%, rgba(15,42,99,0.90) 100%)",
                        border: "1px solid rgba(138,199,255,0.12)",
                        boxShadow: "0 12px 22px rgba(2,10,24,0.18)",
                        transition: "all 0.2s ease",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 16px 28px rgba(2,10,24,0.24)",
                        },
                      }}
                    >
                      <Box sx={{ width: 52, height: 52, borderRadius: 2.2, backgroundColor: "rgba(138,199,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", mb: 1.1 }}>
                        <Send sx={{ color: "#8ac7ff", fontSize: 28 }} />
                      </Box>
                      <Typography sx={{ fontWeight: 800, color: "#f8fbff", fontSize: 14, lineHeight: 1.2 }}>
                        Express
                        <br />
                        Send
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "rgba(220,232,255,0.72)", mt: 0.55 }}>
                        Instant transfer
                      </Typography>
                    </Paper>

                    <Paper
                      onClick={() => setSendMode("qr")}
                      sx={{
                        p: 1.5,
                        minHeight: 132,
                        borderRadius: 3,
                        cursor: "pointer",
                        background: "linear-gradient(145deg, rgba(8,23,52,0.94) 0%, rgba(15,42,99,0.90) 100%)",
                        border: "1px solid rgba(138,199,255,0.12)",
                        boxShadow: "0 12px 22px rgba(2,10,24,0.18)",
                        transition: "all 0.2s ease",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 16px 28px rgba(2,10,24,0.24)",
                        },
                      }}
                    >
                      <Box sx={{ width: 52, height: 52, borderRadius: 2.2, backgroundColor: "rgba(138,199,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", mb: 1.1 }}>
                        <QrCode2 sx={{ color: "#8ac7ff", fontSize: 28 }} />
                      </Box>
                      <Typography sx={{ fontWeight: 800, color: "#f8fbff", fontSize: 14, lineHeight: 1.2 }}>
                        Scan To Pay
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "rgba(220,232,255,0.72)", mt: 0.55 }}>
                        Generate QR
                      </Typography>
                    </Paper>
                  </Box>

                  <Box
                    sx={{
                      borderRadius: 3,
                      p: 1.4,
                      background: "linear-gradient(145deg, rgba(8,23,52,0.94) 0%, rgba(15,42,99,0.90) 100%)",
                      border: "1px solid rgba(138,199,255,0.12)",
                      boxShadow: "0 12px 22px rgba(2,10,24,0.18)",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.8 }}>
                      <Typography sx={{ fontWeight: 800, color: "#f8fbff", fontSize: 14 }}>
                        Transfer Logs
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#105abf", fontWeight: 700 }}>
                        View All
                      </Typography>
                    </Box>

                    {previewTransferLogs.length > 0 ? (
                      <List dense disablePadding>
                        {previewTransferLogs.map((log, index) => {
                          const logRecipient = getLogRecipient(log);

                          return (
                            <ListItem
                              key={log.id}
                              disableGutters
                              sx={{
                                py: 0.9,
                                borderBottom: index === previewTransferLogs.length - 1 ? "none" : "1px solid rgba(16,90,191,0.08)",
                                gap: 1,
                              }}
                            >
                              <Avatar
                                src={logRecipient.profilePicture || undefined}
                                sx={{
                                  width: 34,
                                  height: 34,
                                  bgcolor: "rgba(16,90,191,0.10)",
                                  color: "#105abf",
                                  fontWeight: 800,
                                  fontSize: 12,
                                  flexShrink: 0,
                                }}
                              >
                                {getUserAvatarInitial(logRecipient, log.recipientUsername || "U")}
                              </Avatar>
                              <ListItemText
                                primary={logRecipient.name}
                                secondary={
                                  log.createdAt
                                    ? `@${logRecipient.username} • ${new Date(log.createdAt.seconds * 1000).toLocaleString("en-PH", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })}`
                                    : `@${logRecipient.username || "user"} • Processing...`
                                }
                                primaryTypographyProps={{ color: "#f8fbff", fontWeight: 700, fontSize: 13 }}
                                secondaryTypographyProps={{ color: "rgba(220,232,255,0.72)", fontSize: 10.5 }}
                              />
                              <Box sx={{ textAlign: "right", minWidth: 70 }}>
                                <Typography sx={{ fontWeight: 800, color: "#f8fbff", fontSize: 13 }}>
                                  -₱{Number(log.totalDeduction ?? (Number(log.amount || 0) + Number(log.charge || 0))).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                </Typography>
                                <Typography sx={{ fontSize: 10, fontWeight: 800, color: log.status === "Approved" ? "#2eaf72" : "#f0a63a" }}>
                                  {String(log.status || "Pending").toUpperCase()}
                                </Typography>
                              </Box>
                            </ListItem>
                          );
                        })}
                      </List>
                    ) : (
                      <Typography sx={{ fontSize: 11.5, color: "#7a8392", py: 1 }}>
                        No transfers yet.
                      </Typography>
                    )}
                  </Box>

                  <Box
                    sx={{
                      mt: 1.8,
                      borderRadius: 3,
                      p: 1.5,
                      background: "linear-gradient(145deg, rgba(11,31,94,0.96) 0%, rgba(18,56,135,0.90) 62%, rgba(45,110,225,0.82) 100%)",
                      border: "1px solid rgba(138,199,255,0.14)",
                    }}
                  >
                    <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: "rgba(220,232,255,0.74)", mb: 0.4 }}>
                      GROWTH INSIGHTS
                    </Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#f8fbff", lineHeight: 1.25, mb: 1 }}>
                      Maximize your savings with Vaults
                    </Typography>
                    <Box
                      sx={{
                        display: "inline-flex",
                        px: 1.3,
                        py: 0.5,
                        borderRadius: 999,
                        backgroundColor: "#105abf",
                        color: "#fff",
                        fontSize: 10.5,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                      }}
                    >
                      LEARN MORE
                    </Box>
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
                      <Box sx={{ mb: 2.2 }}>
                        <TextField
                          fullWidth
                          autoFocus
                          placeholder="Enter username or find a Bowner"
                          value={recipientUsername}
                          onChange={(e) => handleSearchUser(e.target.value)}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon sx={{ color: "#8ca2c8", fontSize: 20 }} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            "& .MuiInputBase-root": {
                              color: "#1f2430",
                              backgroundColor: "rgba(255,255,255,0.98)",
                              borderRadius: 999,
                              height: 46,
                            },
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: "#d8deea" },
                          }}
                        />
                        {searching && (
                          <CircularProgress size={18} sx={{ mt: 1, ml: 1, color: "#8ac7ff" }} />
                        )}
                      </Box>

                      {featuredRecipients.length > 0 && (
                        <Box sx={{ mb: 2.2 }}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "rgba(240,247,255,0.96)" }}>
                              Recent Recipients
                            </Typography>
                            <Button
                              onClick={handleViewAllRecipients}
                              sx={{ minWidth: 0, p: 0, fontSize: 11, color: "#8ac7ff", fontWeight: 700, textTransform: "none" }}
                            >
                              View All
                            </Button>
                          </Box>

                          <Box
                            sx={{
                              display: "flex",
                              gap: 1.2,
                              overflowX: "auto",
                              pb: 0.5,
                              "&::-webkit-scrollbar": { height: 6 },
                              "&::-webkit-scrollbar-thumb": {
                                backgroundColor: "rgba(138,199,255,0.28)",
                                borderRadius: 999,
                              },
                            }}
                          >
                            {featuredRecipients.map((user) => (
                              <Box
                                key={user.username}
                                onClick={() => {
                                  handleSelectUser(user.username);
                                  setExpressStep(2);
                                }}
                                sx={{ minWidth: 70, textAlign: "center", cursor: "pointer" }}
                              >
                                <Avatar
                                  src={getUserAvatarUrl(user) || undefined}
                                  sx={{
                                    width: 54,
                                    height: 54,
                                    mx: "auto",
                                    mb: 0.7,
                                    bgcolor: "rgba(138,199,255,0.16)",
                                    color: "#0b1f5e",
                                    fontWeight: 800,
                                    border: "2px solid rgba(255,255,255,0.88)",
                                  }}
                                >
                                  {getUserAvatarInitial(user)}
                                </Avatar>
                                <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "rgba(240,247,255,0.96)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {(user.name || user.username || "User").split(" ")[0]}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}

                      <Box ref={allContactsRef}>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "rgba(240,247,255,0.96)", mb: 1 }}>
                          All Contacts
                        </Typography>

                        {recipientDirectory.length > 0 ? (
                          <Box sx={{ display: "grid", gap: 1 }}>
                            {recipientDirectory.slice(0, 10).map((user) => (
                              <Paper
                                key={user.id || user.username}
                                onClick={() => {
                                  handleSelectUser(user.username);
                                  setExpressStep(2);
                                }}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1.1,
                                  p: 1.1,
                                  borderRadius: 2.4,
                                  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,248,255,0.98) 100%)",
                                  border: "1px solid rgba(16,90,191,0.10)",
                                  boxShadow: "0 10px 18px rgba(6,18,45,0.08)",
                                  cursor: "pointer",
                                  "&:hover": { background: "#f7faff" },
                                }}
                              >
                                <Avatar
                                  src={getUserAvatarUrl(user) || undefined}
                                  sx={{ width: 42, height: 42, bgcolor: "rgba(16,90,191,0.12)", color: "#105abf", fontWeight: 800 }}
                                >
                                  {getUserAvatarInitial(user)}
                                </Avatar>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#223047", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {user.name || user.username}
                                  </Typography>
                                  <Typography sx={{ fontSize: 11, color: "#7a8392", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    @{user.username}
                                  </Typography>
                                </Box>
                                <ChevronRightIcon sx={{ color: "#8da8d6", fontSize: 18 }} />
                              </Paper>
                            ))}
                          </Box>
                        ) : (
                          <Paper
                            sx={{
                              p: 1.4,
                              borderRadius: 2.4,
                              background: "rgba(255,255,255,0.96)",
                              border: "1px solid rgba(16,90,191,0.10)",
                            }}
                          >
                            <Typography sx={{ fontSize: 12, color: "#6f7f9b" }}>
                              {recipientUsername.trim() ? "No matching members found." : "No contacts available yet."}
                            </Typography>
                          </Paper>
                        )}
                      </Box>
                    </Box>
                  </Fade>
                )}

                {/* 🎯 EXPRESS SEND STEP 2: AMOUNT & MESSAGE */}
                {sendMode === "express" && expressStep === 2 && (
                  <Fade in={expressStep === 2} timeout={300}>
                    <Box>
                      <Divider sx={{ my: 2, borderColor: "#e4e8f0" }} />

                      <Box
                        sx={{
                          background: "rgba(255,255,255,0.98)",
                          borderRadius: 2.6,
                          p: 1.4,
                          mb: 2,
                          border: "1px solid rgba(16,90,191,0.10)",
                          boxShadow: "0 10px 18px rgba(6,18,45,0.08)",
                          display: "flex",
                          alignItems: "center",
                          gap: 1.1,
                        }}
                      >
                        <Avatar
                          src={getUserAvatarUrl(selectedRecipient) || undefined}
                          sx={{
                            width: 48,
                            height: 48,
                            bgcolor: "rgba(16,90,191,0.12)",
                            color: "#105abf",
                            fontWeight: 800,
                          }}
                        >
                          {getUserAvatarInitial(selectedRecipient, recipientUsername || "U")}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontSize: 9.5, color: "#7a8392", fontWeight: 800, letterSpacing: 0.9 }}>
                            SENDING TO
                          </Typography>
                          <Typography sx={{ fontSize: 17, fontWeight: 800, color: "#223047", lineHeight: 1.1 }}>
                            {selectedRecipient?.name || recipientUsername}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#7a8392" }}>
                            @{recipientUsername}
                          </Typography>
                        </Box>
                        <Button
                          onClick={() => {
                            clearRecipientPicker();
                            setExpressStep(1);
                          }}
                          sx={{
                            minWidth: 0,
                            px: 1.2,
                            py: 0.45,
                            borderRadius: 999,
                            textTransform: "none",
                            fontSize: 10.5,
                            fontWeight: 800,
                            color: "#105abf",
                            backgroundColor: "rgba(16,90,191,0.08)",
                            "&:hover": { backgroundColor: "rgba(16,90,191,0.14)" },
                          }}
                        >
                          Change
                        </Button>
                      </Box>

                      <Typography sx={{ textAlign: "center", fontSize: 11, color: "rgba(220,232,255,0.72)", fontWeight: 800, letterSpacing: 1, mb: 1 }}>
                        ENTER AMOUNT (PHP)
                      </Typography>
                      <TextField
                        type="number"
                        fullWidth
                        autoFocus
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#9aa8c4" }}>₱</Typography>
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          mb: 1.5,
                          "& .MuiInputBase-root": {
                            color: "#dfe8ff",
                            backgroundColor: "transparent",
                            fontSize: 30,
                            fontWeight: 900,
                          },
                          "& .MuiInputBase-input": {
                            textAlign: "center",
                            color: "#dfe8ff",
                            py: 1,
                          },
                          "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(138,199,255,0.18)" },
                        }}
                      />

                      <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mb: 2 }}>
                        {[500, 1000, 5000].map((quickAmount) => (
                          <Button
                            key={quickAmount}
                            onClick={() => setAmount(String((parseFloat(amount) || 0) + quickAmount))}
                            sx={{
                              minWidth: 0,
                              px: 1.15,
                              py: 0.45,
                              borderRadius: 999,
                              backgroundColor: "rgba(255,255,255,0.08)",
                              color: "#d7e4ff",
                              fontSize: 10.5,
                              fontWeight: 800,
                              textTransform: "none",
                              border: "1px solid rgba(138,199,255,0.14)",
                              "&:hover": { backgroundColor: "rgba(255,255,255,0.14)" },
                            }}
                          >
                            +₱{quickAmount.toLocaleString("en-PH")}
                          </Button>
                        ))}
                      </Box>

                      <Box
                        sx={{
                          background: "rgba(255,255,255,0.98)",
                          borderRadius: 2.6,
                          p: 1.4,
                          mb: 2,
                          border: "1px solid rgba(16,90,191,0.10)",
                          boxShadow: "0 10px 18px rgba(6,18,45,0.08)",
                        }}
                      >
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#556070", mb: 0.7 }}>
                          Purpose of Transfer
                        </Typography>
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          placeholder={`Add an optional note for ${selectedRecipient?.name || recipientUsername}...`}
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          sx={{
                            "& .MuiInputBase-root": { color: "#1f2430", backgroundColor: "#f8fbff", borderRadius: 1.8 },
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: "#d8deea" },
                          }}
                        />
                      </Box>

                      <Box
                        sx={{
                          background: "rgba(255,255,255,0.98)",
                          borderRadius: 2.6,
                          p: 1.4,
                          mb: 2,
                          border: "1px solid rgba(16,90,191,0.10)",
                          boxShadow: "0 10px 18px rgba(6,18,45,0.08)",
                        }}
                      >
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#556070", mb: 1 }}>
                          Summary
                        </Typography>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
                          <Typography sx={{ fontSize: 11.5, color: "#6b7484" }}>Transfer Fee</Typography>
                          <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "#f0a63a" }}>+₱{transferFee.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
                          <Typography sx={{ fontSize: 11.5, color: "#6b7484" }}>Exchange Rate</Typography>
                          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#223047" }}>1 PHP = 1 PHP</Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.1 }}>
                          <Typography sx={{ fontSize: 11.5, color: "#6b7484" }}>Processing Time</Typography>
                          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#223047" }}>Instant</Typography>
                        </Box>
                        <Divider sx={{ my: 1.1, borderColor: "#e4e8f0" }} />
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography sx={{ fontSize: 11.5, color: "#6b7484", fontWeight: 800 }}>TOTAL TO DEDUCT</Typography>
                          <Typography sx={{ fontSize: 21, fontWeight: 900, color: "#105abf" }}>
                            ₱{totalToDeduct.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          p: 1.25,
                          mb: 2,
                          borderRadius: 2.2,
                          background: "rgba(138,199,255,0.10)",
                          border: "1px solid rgba(138,199,255,0.14)",
                        }}
                      >
                        <InfoOutlinedIcon sx={{ color: "#8ac7ff", fontSize: 18, mt: 0.2 }} />
                        <Box>
                          <Typography sx={{ fontSize: 11.2, color: "#f8fbff", fontWeight: 800 }}>
                            Bowners Financial Security Protocol
                          </Typography>
                          <Typography sx={{ fontSize: 10.8, color: "rgba(220,232,255,0.74)", lineHeight: 1.5, mt: 0.25 }}>
                            This transaction is secured by BOWNERS system encryption. Transfer funds only to trusted recipients.
                          </Typography>
                        </Box>
                      </Box>

                      <Button
                        fullWidth
                        onClick={handleSubmitRequest}
                        variant="contained"
                        disabled={loading || !amount || !recipientUsername}
                        endIcon={<ChevronRightIcon />}
                        sx={{
                          borderRadius: 2.4,
                          textTransform: "none",
                          bgcolor: "#105abf",
                          color: "#fff",
                          fontWeight: 800,
                          py: 1.35,
                          fontSize: 14,
                          "&:hover": { bgcolor: "#0b4eaa" },
                          "&:disabled": { bgcolor: "rgba(16, 90, 191, 0.4)" },
                        }}
                      >
                        {loading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Review Transfer"}
                      </Button>
                    </Box>
                  </Fade>
                )}

                {/* 🎯 EXPRESS SEND STEP 3: REVIEW */}
                {sendMode === "express" && expressStep === 3 && (
                  <Fade in={expressStep === 3} timeout={300}>
                    <Box>
                      <Divider sx={{ my: 2, borderColor: "#e4e8f0" }} />

                      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.9, color: "#8ac7ff", mb: 0.4 }}>
                        REVIEW TRANSACTION
                      </Typography>
                      <Typography sx={{ fontSize: 29, fontWeight: 900, color: "#f8fbff", lineHeight: 1.15, mb: 2 }}>
                        Confirm your transfer
                      </Typography>

                      <Box
                        sx={{
                          mb: 2,
                          borderRadius: 3,
                          p: 2,
                          background: "linear-gradient(135deg, #0f57d5 0%, #1d67eb 100%)",
                          color: "#fff",
                          boxShadow: "0 16px 30px rgba(15, 87, 213, 0.28)",
                        }}
                      >
                        <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.78)", fontWeight: 700, mb: 0.35 }}>
                          Total amount to send
                        </Typography>
                        <Typography sx={{ fontSize: 31, fontWeight: 900, lineHeight: 1.1 }}>
                          ₱{amountValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          <Typography component="span" sx={{ ml: 0.4, fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>
                            PHP
                          </Typography>
                        </Typography>
                      </Box>

                      <Box sx={{ background: "#fff", borderRadius: 2.6, p: 1.5, mb: 1.5, border: "1px solid #dbe2ef" }}>
                        <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8, mb: 0.55 }}>
                          RECIPIENT
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.1 }}>
                          <Avatar
                            src={getUserAvatarUrl(selectedRecipient) || undefined}
                            sx={{ width: 44, height: 44, bgcolor: "rgba(16,90,191,0.12)", color: "#105abf", fontWeight: 800 }}
                          >
                            {getUserAvatarInitial(selectedRecipient, recipientUsername || "R")}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#223047", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {selectedRecipient?.name || recipientUsername}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: "#6f7f9b" }}>
                              @{recipientUsername}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.2, mb: 1.5 }}>
                        <Box sx={{ background: "#fff", borderRadius: 2.4, p: 1.4, border: "1px solid #dbe2ef" }}>
                          <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.7, mb: 0.4 }}>
                            DELIVERY DATE
                          </Typography>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#223047" }}>
                            {new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#6f7f9b" }}>Instant Transfer</Typography>
                        </Box>
                        <Box sx={{ background: "#fff", borderRadius: 2.4, p: 1.4, border: "1px solid #dbe2ef" }}>
                          <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.7, mb: 0.4 }}>
                            TRANSFER FEE
                          </Typography>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#223047" }}>
                            ₱{transferFee.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#2eaf72", fontWeight: 700 }}>BOWNERS Fee</Typography>
                        </Box>
                      </Box>

                      <Box sx={{ background: "#fff", borderRadius: 2.6, p: 1.5, mb: 1.5, border: "1px solid #dbe2ef", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                        <Box>
                          <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.7, mb: 0.3 }}>
                            FROM ACCOUNT
                          </Typography>
                          <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#223047" }}>
                            E-Wallet • @{currentUsername || "member"}
                          </Typography>
                        </Box>
                        <ChevronRightIcon sx={{ color: "#8da8d6", fontSize: 18 }} />
                      </Box>

                      {messageText && (
                        <Box sx={{ background: "#fff", borderRadius: 2.6, p: 1.4, mb: 1.5, border: "1px solid #dbe2ef" }}>
                          <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.7, mb: 0.4 }}>
                            NOTE
                          </Typography>
                          <Typography sx={{ fontSize: 12.5, color: "#223047" }}>
                            {messageText}
                          </Typography>
                        </Box>
                      )}

                      <Box
                        sx={{
                          background: "#fff",
                          borderRadius: 2.6,
                          p: 1.5,
                          mb: 1.5,
                          border: "1px solid #dbe2ef",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 1.1,
                          cursor: "pointer",
                        }}
                        onClick={() => setConfirmReview(!confirmReview)}
                      >
                        <input
                          type="checkbox"
                          checked={confirmReview}
                          onChange={() => setConfirmReview(!confirmReview)}
                          style={{ width: 18, height: 18, cursor: "pointer", marginTop: 2, accentColor: "#105abf" }}
                        />
                        <Typography sx={{ fontSize: 12, color: "#4a5568", lineHeight: 1.55, fontWeight: 600 }}>
                          I confirm the transaction details are correct and authorize BOWNERS to proceed with this transfer.
                        </Typography>
                      </Box>

                      {error && (
                        <Alert
                          severity="error"
                          sx={{
                            mb: 1.5,
                            backgroundColor: "rgba(239,54,54,0.09)",
                            color: "#c62828",
                          }}
                        >
                          {error}
                        </Alert>
                      )}

                      <Button
                        fullWidth
                        onClick={handleConfirmAndSend}
                        variant="contained"
                        disabled={loading || !confirmReview}
                        endIcon={<ChevronRightIcon />}
                        sx={{
                          borderRadius: 2.4,
                          textTransform: "none",
                          bgcolor: "#105abf",
                          color: "#fff",
                          fontWeight: 800,
                          py: 1.35,
                          fontSize: 14,
                          "&:hover": { bgcolor: "#0b4eaa" },
                          "&:disabled": { bgcolor: "rgba(16, 90, 191, 0.4)", cursor: "not-allowed" },
                        }}
                      >
                        {loading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Confirm Transfer"}
                      </Button>

                      <Button
                        fullWidth
                        onClick={handleClose}
                        sx={{
                          mt: 0.6,
                          color: "rgba(220,232,255,0.82)",
                          textTransform: "none",
                          fontWeight: 700,
                        }}
                      >
                        Cancel Transaction
                      </Button>
                    </Box>
                  </Fade>
                )}

                {/* 🎯 EXPRESS SEND STEP 4: RECEIPT */}
                {sendMode === "express" && expressStep === 4 && (
                  <Fade in={expressStep === 4} timeout={300}>
                    <Box>
                      <Divider sx={{ my: 2, borderColor: "#e4e8f0" }} />

                      <Box sx={{ textAlign: "center", mb: 2.2 }}>
                        <Box sx={{ width: 60, height: 60, mx: "auto", mb: 1.1, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0f57d5", boxShadow: "0 14px 28px rgba(15,87,213,0.24)" }}>
                          <CheckCircle sx={{ fontSize: 34, color: "#fff" }} />
                        </Box>
                        <Typography sx={{ fontSize: 27, fontWeight: 900, color: "#f8fbff" }}>
                          Transfer Successful!
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "rgba(220,232,255,0.76)", mt: 0.4 }}>
                          Your funds have been sent securely.
                        </Typography>
                      </Box>

                      <Box sx={{ background: "#fff", borderRadius: 2.8, p: 1.8, mb: 2, border: "1px solid #dbe2ef", boxShadow: "0 14px 26px rgba(6,18,45,0.10)" }}>
                        <Typography sx={{ textAlign: "center", fontSize: 10.5, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>
                          TOTAL AMOUNT
                        </Typography>
                        <Typography sx={{ textAlign: "center", fontSize: 33, fontWeight: 900, color: "#105abf", mb: 1.4 }}>
                          ₱{(Number(receiptData?.amount || 0) + Number(receiptData?.charge || 0)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </Typography>

                        <Box sx={{ background: "#f4f6fa", borderRadius: 2.2, p: 1.2, mb: 1.4, display: "flex", alignItems: "center", gap: 1 }}>
                          <Avatar
                            src={receiptData?.recipientProfilePicture || undefined}
                            sx={{ width: 42, height: 42, bgcolor: "#12284c", color: "#fff", fontWeight: 800 }}
                          >
                            {getUserAvatarInitial({ name: receiptData?.recipientName, username: receiptData?.recipient }, "R")}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>
                              RECIPIENT
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#223047", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {receiptData?.recipientName || receiptData?.recipient || "-"}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: "#6f7f9b" }}>
                              @{receiptData?.recipient || "-"}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.1 }}>
                          <Box>
                            <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>
                              REF NUMBER
                            </Typography>
                            <Typography sx={{ fontSize: 12.5, color: "#223047", fontWeight: 800, fontFamily: "monospace" }}>
                              {receiptData?.referenceNumber || "-"}
                            </Typography>
                          </Box>
                          <Button
                            onClick={handleCopyReceiptReference}
                            sx={{ minWidth: 0, px: 1.1, py: 0.45, borderRadius: 999, textTransform: "none", fontSize: 10.5, fontWeight: 800, color: "#105abf", backgroundColor: "#ecf3ff" }}
                          >
                            Copy
                          </Button>
                        </Box>

                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.2, mb: 1.2 }}>
                          <Box>
                            <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>DATE</Typography>
                            <Typography sx={{ fontSize: 12.5, color: "#223047", fontWeight: 700 }}>
                              {receiptData?.date?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) || "-"}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>TIME</Typography>
                            <Typography sx={{ fontSize: 12.5, color: "#223047", fontWeight: 700 }}>
                              {receiptData?.date?.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) || "-"}
                            </Typography>
                          </Box>
                        </Box>

                        <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8, mb: 0.65 }}>
                          SUMMARY
                        </Typography>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.55 }}>
                          <Typography sx={{ fontSize: 12, color: "#6b7484" }}>Amount</Typography>
                          <Typography sx={{ fontSize: 12, color: "#223047", fontWeight: 700 }}>
                            ₱{Number(receiptData?.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.55 }}>
                          <Typography sx={{ fontSize: 12, color: "#6b7484" }}>Service Fee</Typography>
                          <Typography sx={{ fontSize: 12, color: "#223047", fontWeight: 700 }}>
                            ₱{Number(receiptData?.charge || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Divider sx={{ my: 0.9, borderColor: "#e4e8f0" }} />
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography sx={{ fontSize: 12.5, color: "#6b7484", fontWeight: 800 }}>Total</Typography>
                          <Typography sx={{ fontSize: 14, color: "#105abf", fontWeight: 900 }}>
                            ₱{(Number(receiptData?.amount || 0) + Number(receiptData?.charge || 0)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                      </Box>

                      <Button
                        fullWidth
                        onClick={handleClose}
                        variant="contained"
                        sx={{
                          borderRadius: 2.4,
                          textTransform: "none",
                          bgcolor: "#105abf",
                          color: "#fff",
                          fontWeight: 800,
                          py: 1.25,
                          mb: 1.2,
                          fontSize: 14,
                          "&:hover": { bgcolor: "#0b4eaa" },
                        }}
                      >
                        Back to Home
                      </Button>

                      <Box sx={{ display: "flex", gap: 1.2 }}>
                        <Button
                          fullWidth
                          onClick={handleDownloadReceipt}
                          variant="outlined"
                          startIcon={<DownloadIcon />}
                          sx={{
                            color: "#223047",
                            borderColor: "#d5dfef",
                            backgroundColor: "rgba(255,255,255,0.96)",
                            fontWeight: 700,
                            textTransform: "none",
                            borderRadius: 2,
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          fullWidth
                          onClick={handleShareReceipt}
                          variant="outlined"
                          startIcon={<Share />}
                          sx={{
                            color: "#223047",
                            borderColor: "#d5dfef",
                            backgroundColor: "rgba(255,255,255,0.96)",
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

            {/* 📜 Logs - Show only in QR view */}
            {sendMode === "qr" && transferLogs.length > 0 && (
              <>
                <Divider sx={{ my: 2, borderColor: "#e4e8f0" }} />
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700, color: "#105abf" }}>
                  Transfer Logs
                </Typography>
                <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
                  {transferLogs.map((log) => {
                    const logRecipient = getLogRecipient(log);

                    return (
                      <ListItem
                        key={log.id}
                        sx={{ borderBottom: "1px solid #eef2f7", py: 0.5, gap: 1 }}
                      >
                        <Avatar
                          src={logRecipient.profilePicture || undefined}
                          sx={{ width: 34, height: 34, bgcolor: "rgba(16,90,191,0.12)", color: "#105abf", fontWeight: 800, fontSize: 12 }}
                        >
                          {getUserAvatarInitial(logRecipient, log.recipientUsername || "U")}
                        </Avatar>
                        <ListItemText
                          primary={logRecipient.name}
                          secondary={
                            log.createdAt
                              ? `₱${Number(log.totalDeduction ?? (Number(log.amount || 0) + Number(log.charge || 0))).toLocaleString("en-PH", { minimumFractionDigits: 2 })} • ${new Date(log.createdAt.seconds * 1000).toLocaleString("en-PH")}`
                              : `₱${Number(log.totalDeduction ?? (Number(log.amount || 0) + Number(log.charge || 0))).toLocaleString("en-PH", { minimumFractionDigits: 2 })} • Pending...`
                          }
                          primaryTypographyProps={{ color: "#273142", fontWeight: 700 }}
                          secondaryTypographyProps={{ color: "#7a8392", fontSize: 12 }}
                        />
                        <Chip
                          size="small"
                          label={log.status}
                          color={getStatusColor(log.status)}
                          sx={{ textTransform: "capitalize", fontWeight: 600, fontSize: 11 }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </>
            )}
          </Box>

        {/* 🔘 Actions */}
        <Box sx={{ px: 3, py: 2, background: "rgba(6,19,46,0.90)", borderTop: "1px solid rgba(138,199,255,0.14)", display: "flex", justifyContent: "flex-end", gap: 1.2, backdropFilter: "blur(18px)" }}>
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
              <Button onClick={handleSendBack}
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

      <Drawer
        anchor="right"
        open={infoDialogOpen}
        onClose={() => setInfoDialogOpen(false)}
        ModalProps={{ keepMounted: true }}
        transitionDuration={{ enter: 320, exit: 220 }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 420 },
            maxWidth: "100%",
            background: "linear-gradient(180deg, rgba(4,12,30,0.98) 0%, rgba(8,23,52,0.98) 44%, rgba(15,42,99,0.97) 100%)",
            color: "#f8fbff",
            borderLeft: "1px solid rgba(138,199,255,0.14)",
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Box
            sx={{
              minHeight: 70,
              px: 1,
              pt: "calc(env(safe-area-inset-top, 0px) + 10px)",
              pb: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#fff",
              background: "linear-gradient(135deg, rgba(6,19,46,0.98) 0%, rgba(13,47,118,0.96) 58%, rgba(37,101,214,0.90) 100%)",
              borderBottom: "1px solid rgba(138,199,255,0.16)",
            }}
          >
            <IconButton onClick={() => setInfoDialogOpen(false)} sx={{ color: "#fff" }}>
              <ArrowBackIosNewIcon />
            </IconButton>
            <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>
              Send Guide
            </Typography>
            <Box sx={{ width: 40 }} />
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "grid", gap: 1.3 }}>
            {[
              {
                title: "Express Send",
                desc: "Transfer directly to another member using their username for instant wallet delivery.",
              },
              {
                title: "Service Charge",
                desc: "Every send transaction includes a 2% service charge before confirmation.",
              },
              {
                title: "Scan To Pay",
                desc: "Generate your QR code so others can send to you or scan your payment request.",
              },
              {
                title: "Safety Reminder",
                desc: "Always verify the recipient and amount before you continue the transfer.",
              },
            ].map((item, index) => (
              <Box
                key={index}
                sx={{
                  p: 1.4,
                  borderRadius: 2.4,
                  background: "linear-gradient(145deg, rgba(8,23,52,0.94) 0%, rgba(15,42,99,0.90) 100%)",
                  border: "1px solid rgba(138,199,255,0.12)",
                  boxShadow: "0 12px 22px rgba(2,10,24,0.18)",
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#f8fbff", mb: 0.55 }}>
                  {item.title}
                </Typography>
                <Typography sx={{ fontSize: 12.2, color: "rgba(220,232,255,0.78)", lineHeight: 1.55 }}>
                  {item.desc}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ p: 2, borderTop: "1px solid rgba(138,199,255,0.14)", background: "rgba(6,19,46,0.90)" }}>
            <Button
              onClick={() => setInfoDialogOpen(false)}
              fullWidth
              variant="contained"
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 700,
                bgcolor: "#105abf",
                py: 1.2,
                "&:hover": { bgcolor: "#0b4eaa" },
              }}
            >
              Close Guide
            </Button>
          </Box>
        </Box>
      </Drawer>

      {/* ⚠️ Confirm Transfer Dialog */}
      <Dialog
        ModalProps={{ keepMounted: true }}
        transitionDuration={{ enter: 360, exit: 260 }}
        open={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            background: "linear-gradient(180deg, rgba(6,19,46,0.98) 0%, rgba(13,47,118,0.92) 100%)",
            boxShadow: "0 10px 28px rgba(25,28,30,0.24)",
            border: "1px solid rgba(138,199,255,0.14)",
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

        <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 2, background: "rgba(6,19,46,0.88)", borderTop: "1px solid rgba(138,199,255,0.14)" }}>
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
            background: "linear-gradient(180deg, rgba(6,19,46,0.98) 0%, rgba(13,47,118,0.92) 100%)",
            boxShadow: "0 10px 28px rgba(25,28,30,0.24)",
            border: "1px solid rgba(138,199,255,0.14)",
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

        <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 2, background: "rgba(6,19,46,0.88)", borderTop: "1px solid rgba(138,199,255,0.14)" }}>
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
            Save Receipt
          </Button>
          <Button
            onClick={handleShareReceipt}
            variant="outlined"
            startIcon={<Share />}
            sx={{
              color: "#105abf",
              borderColor: "#105abf",
              "&:hover": {
                borderColor: "#0b4eaa",
                background: "rgba(16, 90, 191, 0.08)",
              },
            }}
          >
            Share Receipt
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