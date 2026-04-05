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
  Divider,
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
  const [withdrawStep, setWithdrawStep] = useState(0); // 0=form, 1=review, 2=success
  const [paymentGroup, setPaymentGroup] = useState("");
  const [confirmReview, setConfirmReview] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
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

  // ✅ Recalculate amount preview whenever amount or method changes
  useEffect(() => {
    const amt = parseFloat(amount) || 0;
    setNetAmount(amt);
  }, [amount, paymentMethod]);

  const handleQrUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setQrFile(file);
      setQrPreview(URL.createObjectURL(file));
    }
  };

  // ✅ Main Withdraw Logic (called from the review screen)
  const performWithdraw = async () => {
    if (loading) return;
    if (!confirmReview) {
      setError("Please confirm the withdrawal details first.");
      return;
    }

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
            paymentCategory: paymentGroup,
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
        } catch (_parseErr) {}
        throw new Error(serverMessage);
      }

      const result = await response.json();
      if (onBalanceUpdate) onBalanceUpdate(result.newBalance);

      const referenceNumber = `TXN-REF-${String(Date.now()).slice(-5)}`;
      const charge = Number(result?.charge ?? feeAmount);
      const totalDeduction = Number(result?.totalDeduction ?? (numAmount + charge));
      const submittedAt = new Date();

      setReceiptData({
        referenceNumber,
        amount: numAmount,
        charge,
        totalDeduction,
        paymentMethod,
        paymentCategory: paymentGroup,
        receiverFileName: qrFile?.name || "Uploaded QR",
        date: submittedAt,
        withdrawalId: result?.withdrawalId,
      });

      setSuccess(true);
      setWithdrawStep(2);
    } catch (err) {
      console.error("Withdraw failed:", err);
      setError(getFriendlyWithdrawError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = () => {
    if (!amount || !paymentGroup || !paymentMethod || !qrFile) {
      setError("Please enter the amount, choose a payout option, and upload your QR code.");
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount <= 0) {
      setError("Withdrawal amount must be greater than zero.");
      return;
    }
    if (numAmount < 100) {
      setError("Minimum withdrawal is ₱100.");
      return;
    }
    if (totalDeductionAmount > availableBalance) {
      setError(`Insufficient wallet balance. You need ₱${totalDeductionAmount.toFixed(2)} including service fee.`);
      return;
    }

    setError("");
    setConfirmReview(false);
    setWithdrawStep(1);
  };

  const handleClose = () => {
    setError("");
    setSuccess(false);
    setAmount("");
    setPaymentMethod("");
    setPaymentGroup("");
    setQrPreview("");
    setQrFile(null);
    setConfirmReview(false);
    setReceiptData(null);
    setWithdrawStep(0);
    onClose();
  };

  const handleBack = () => {
    if (loading) return;
    if (withdrawStep === 2) {
      handleClose();
      return;
    }
    if (withdrawStep === 1) {
      setError("");
      setWithdrawStep(0);
      return;
    }
    handleClose();
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

  const availableBalance = Number(userData?.eWallet || 0);
  const amountValue = parseFloat(amount) || 0;
  const feeAmount = paymentMethod ? amountValue * 0.05 : 0;
  const totalDeductionAmount = amountValue + feeAmount;
  const paymentGroups = [
    {
      value: "E-Wallet",
      label: "E-Wallet",
      caption: "Select your preferred e-wallet",
      badge: "₱",
      badgeBg: "#eaf2ff",
      badgeColor: "#105abf",
      options: [
        { value: "GCash", label: "GCash", caption: "Instant transfer", badge: "G", badgeBg: "#eaf2ff", badgeColor: "#105abf" },
        { value: "Maya", label: "Maya", caption: "Digital wallet payout", badge: "M", badgeBg: "#ecfbf0", badgeColor: "#2eaf72" },
        { value: "GoTyme", label: "GoTyme", caption: "Savings wallet transfer", badge: "Go", badgeBg: "#fff3e4", badgeColor: "#c27600" },
        { value: "Coins.ph", label: "Coins.ph", caption: "Crypto wallet cashout", badge: "C", badgeBg: "#eef2ff", badgeColor: "#4f46e5" },
      ],
    },
    {
      value: "Bank Transfer",
      label: "Bank Transfer",
      caption: "Choose your receiving bank",
      badge: "B",
      badgeBg: "#f2f4f7",
      badgeColor: "#1f2937",
      options: [
        { value: "BPI", label: "BPI", caption: "Bank of the Philippine Islands", badge: "BP", badgeBg: "#feecec", badgeColor: "#b42318" },
        { value: "BDO", label: "BDO", caption: "Banco de Oro", badge: "BD", badgeBg: "#eef4ff", badgeColor: "#105abf" },
        { value: "Metrobank", label: "Metrobank", caption: "Metrobank account", badge: "MB", badgeBg: "#ecfbf0", badgeColor: "#2e7d32" },
        { value: "LandBank", label: "LandBank", caption: "Land Bank of the Philippines", badge: "LB", badgeBg: "#fff7e8", badgeColor: "#b26a00" },
        { value: "UnionBank", label: "UnionBank", caption: "UnionBank account", badge: "UB", badgeBg: "#f2ecff", badgeColor: "#6d28d9" },
        { value: "RCBC", label: "RCBC", caption: "RCBC account", badge: "RC", badgeBg: "#fff0f6", badgeColor: "#be185d" },
      ],
    },
  ];
  const selectedGroup = paymentGroups.find((group) => group.value === paymentGroup) || null;
  const selectedPaymentOption = paymentGroups.flatMap((group) => group.options).find((option) => option.value === paymentMethod) || null;

  const buildReceiptMessage = () => {
    if (!receiptData) return "";
    return [
      "Withdrawal Successful",
      `Reference: ${receiptData.referenceNumber}`,
      `Method: ${receiptData.paymentMethod}`,
      `Withdrawal Amount: ₱${Number(receiptData.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Service Fee: ₱${Number(receiptData.charge || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Total Deduction: ₱${Number(receiptData.totalDeduction || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Date: ${receiptData.date?.toLocaleString("en-PH") || "-"}`,
    ].join("\n");
  };

  const handleShareReceipt = async () => {
    if (!receiptData) return;
    const text = buildReceiptMessage();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Withdrawal Receipt", text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch (_) {}
  };

  const handleDownloadReceipt = () => {
    if (!receiptData) return;
    const blob = new Blob([buildReceiptMessage()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${receiptData.referenceNumber || "withdrawal_receipt"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
            <IconButton onClick={handleBack} sx={{ color: "#fff" }}>
              <ArrowBackIosNewIcon />
            </IconButton>
            <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>
              {withdrawStep === 1 ? "Review Withdrawal" : withdrawStep === 2 ? "Success" : "Withdraw Funds"}
            </Typography>
            <Box sx={{ width: 40 }} />
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflowY: "auto", p: 1.6 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 1.4 }}>
                {error}
              </Alert>
            )}

            {withdrawStep === 0 && (
              <>
                <Box
                  sx={{
                    borderRadius: 3,
                    p: 2,
                    mb: 1.6,
                    background: "linear-gradient(145deg, #0d56cf 0%, #1f74f2 100%)",
                    boxShadow: "0 16px 30px rgba(15,87,213,0.28)",
                    color: "#fff",
                  }}
                >
                  <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "rgba(255,255,255,0.76)" }}>
                    AVAILABLE BALANCE
                  </Typography>
                  <Typography sx={{ fontSize: 31, fontWeight: 900, lineHeight: 1.15, mt: 0.6 }}>
                    ₱{availableBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>

                <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, mb: 1.4, border: "1px solid #dbe2ef", boxShadow: "0 10px 18px rgba(6,18,45,0.08)" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.9 }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.9, color: "#7a8392" }}>
                      ENTER AMOUNT
                    </Typography>
                    <Button
                      onClick={() => setAmount(availableBalance > 0 ? availableBalance.toFixed(2) : "")}
                      sx={{ minWidth: 0, p: 0, color: "#105abf", fontSize: 10.5, fontWeight: 800, textTransform: "none" }}
                    >
                      WITHDRAW ALL
                    </Button>
                  </Box>

                  <TextField
                    type="number"
                    fullWidth
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    InputProps={{
                      startAdornment: <Typography sx={{ mr: 1, fontSize: 25, fontWeight: 800, color: "#8f98a8" }}>₱</Typography>,
                    }}
                    sx={{
                      "& .MuiInputBase-root": {
                        backgroundColor: "#fff",
                        borderRadius: 2,
                        fontSize: 28,
                        fontWeight: 900,
                        color: "#1e2430",
                      },
                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "#d8deea" },
                      "& .MuiInputBase-input": { py: 1.05 },
                    }}
                  />
                </Box>

                <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, mb: 1.4, border: "1px solid #dbe2ef", boxShadow: "0 10px 18px rgba(6,18,45,0.08)" }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.9, color: "#7a8392", mb: 1 }}>
                    PAYMENT METHOD
                  </Typography>

                  <Box sx={{ display: "grid", gap: 0.9 }}>
                    {paymentGroups.map((group) => {
                      const selected = paymentGroup === group.value;
                      return (
                        <Box key={group.value}>
                          <Box
                            onClick={() => {
                              setPaymentGroup(group.value);
                              setPaymentMethod("");
                            }}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              p: 1.15,
                              borderRadius: 2.2,
                              cursor: "pointer",
                              background: selected ? "rgba(16,90,191,0.08)" : "#fff",
                              border: selected ? "1px solid rgba(16,90,191,0.28)" : "1px solid #e5e9f0",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <Box sx={{ width: 34, height: 34, borderRadius: 1.8, backgroundColor: group.badgeBg, color: group.badgeColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                              {group.badge}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#223047" }}>
                                {group.label}
                              </Typography>
                              <Typography sx={{ fontSize: 10.5, color: "#7a8392" }}>
                                {group.caption}
                              </Typography>
                            </Box>
                            <Box sx={{ width: 18, height: 18, borderRadius: "50%", border: selected ? "5px solid #105abf" : "2px solid #d0d7e4", flexShrink: 0 }} />
                          </Box>

                          {selected && (
                            <Box sx={{ display: "grid", gap: 0.75, mt: 0.9, pl: 1 }}>
                              {group.options.map((option) => {
                                const optionSelected = paymentMethod === option.value;
                                return (
                                  <Box
                                    key={option.value}
                                    onClick={() => setPaymentMethod(option.value)}
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                      p: 1,
                                      borderRadius: 2,
                                      cursor: "pointer",
                                      background: optionSelected ? "rgba(16,90,191,0.10)" : "#f8fbff",
                                      border: optionSelected ? "1px solid rgba(16,90,191,0.28)" : "1px solid #e7edf6",
                                    }}
                                  >
                                    <Box sx={{ width: 30, height: 30, borderRadius: 1.6, backgroundColor: option.badgeBg, color: option.badgeColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11.5, flexShrink: 0 }}>
                                      {option.badge}
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#223047" }}>{option.label}</Typography>
                                      <Typography sx={{ fontSize: 10.2, color: "#7a8392" }}>{option.caption}</Typography>
                                    </Box>
                                  </Box>
                                );
                              })}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>

                <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, mb: 1.4, border: "1px solid #dbe2ef", boxShadow: "0 10px 18px rgba(6,18,45,0.08)" }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.9, color: "#7a8392", mb: 1 }}>
                    RECEIVER IDENTITY
                  </Typography>

                  <Box sx={{ border: "1px dashed rgba(16,90,191,0.28)", borderRadius: 2.2, p: 1.5, textAlign: "center", background: "#f8fbff", mb: 1 }}>
                    {qrPreview ? (
                      <img
                        src={qrPreview}
                        alt="QR Preview"
                        style={{ width: "100%", maxHeight: 155, objectFit: "contain", borderRadius: 10 }}
                      />
                    ) : (
                      <>
                        <UploadFile sx={{ fontSize: 28, color: "#105abf", mb: 0.4 }} />
                        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#223047" }}>
                          Upload Receiver QR Code
                        </Typography>
                        <Typography sx={{ fontSize: 10.5, color: "#7a8392", mt: 0.35 }}>
                          Accepted formats: PNG / JPG up to 5MB
                        </Typography>
                      </>
                    )}
                  </Box>

                  <Button
                    component="label"
                    fullWidth
                    startIcon={<UploadFile />}
                    sx={{
                      borderRadius: 2,
                      bgcolor: "#eef4ff",
                      color: "#105abf",
                      textTransform: "none",
                      fontWeight: 800,
                      py: 1.05,
                      "&:hover": { bgcolor: "#dde8ff" },
                    }}
                  >
                    {qrPreview ? "Change QR Image" : "Upload QR"}
                    <input type="file" accept="image/*" hidden onChange={handleQrUpload} />
                  </Button>
                </Box>

                {(paymentMethod || amount) && (
                  <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, mb: 1.4, border: "1px solid #dbe2ef", boxShadow: "0 10px 18px rgba(6,18,45,0.08)" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.7 }}>
                      <Typography sx={{ fontSize: 11.5, color: "#6b7484" }}>Service Fee (5%)</Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#f0a63a", fontWeight: 800 }}>
                        ₱{feeAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 11.5, color: "#6b7484", fontWeight: 800 }}>TOTAL DEDUCTION</Typography>
                      <Typography sx={{ fontSize: 18, color: "#105abf", fontWeight: 900 }}>
                        ₱{totalDeductionAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                )}

                <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, border: "1px solid #dbe2ef", boxShadow: "0 10px 18px rgba(6,18,45,0.08)" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.9, color: "#7a8392" }}>
                      RECENT LOGS
                    </Typography>
                    <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#105abf" }}>
                      {withdrawLogs.length} total
                    </Typography>
                  </Box>

                  {withdrawLogs.length > 0 ? (
                    <List dense disablePadding>
                      {withdrawLogs.slice(0, 5).map((log, index) => (
                        <ListItem key={log.id} disableGutters sx={{ py: 0.75, borderBottom: index === Math.min(withdrawLogs.length, 5) - 1 ? "none" : "1px solid #eef2f7" }}>
                          <ListItemText
                            primary={`₱${Number(log.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
                            secondary={log.createdAt ? `${log.paymentMethod || "Method"} • ${new Date(log.createdAt.seconds * 1000).toLocaleString("en-PH")}` : `${log.paymentMethod || "Method"} • Pending...`}
                            primaryTypographyProps={{ color: "#223047", fontWeight: 800, fontSize: 12.5 }}
                            secondaryTypographyProps={{ color: "#7a8392", fontSize: 10.5 }}
                          />
                          <Chip
                            size="small"
                            label={log.status || "Pending"}
                            color={getStatusColor(log.status)}
                            sx={{ textTransform: "capitalize", fontWeight: 700, fontSize: 10.5 }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography sx={{ fontSize: 11.5, color: "#7a8392" }}>
                      No withdrawal requests yet.
                    </Typography>
                  )}
                </Box>
              </>
            )}

            {withdrawStep === 1 && (
              <>
                <Typography sx={{ fontSize: 10, color: "rgba(220,232,255,0.76)", fontWeight: 800, letterSpacing: 1, mb: 0.6 }}>
                  SUMMARY
                </Typography>
                <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, mb: 1.4, border: "1px solid #dbe2ef" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography sx={{ color: "#6b7484", fontSize: 12 }}>Withdrawal Amount</Typography>
                    <Typography sx={{ color: "#223047", fontWeight: 800, fontSize: 14 }}>₱{amountValue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography sx={{ color: "#6b7484", fontSize: 12 }}>Service Fee</Typography>
                    <Typography sx={{ color: "#223047", fontWeight: 800, fontSize: 14 }}>₱{feeAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
                  </Box>
                  <Divider sx={{ my: 1, borderColor: "#e5e9f0" }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography sx={{ color: "#105abf", fontSize: 15, fontWeight: 900 }}>Total Deduction</Typography>
                    <Typography sx={{ color: "#105abf", fontWeight: 900, fontSize: 18 }}>₱{totalDeductionAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
                  </Box>
                </Box>

                <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#ffffff", mb: 1 }}>Withdrawal Details</Typography>
                <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, mb: 1.2, border: "1px solid #dbe2ef" }}>
                  <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 1, mb: 0.8 }}>METHOD</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: 1.8, backgroundColor: selectedPaymentOption?.badgeBg || "#eef4ff", color: selectedPaymentOption?.badgeColor || "#105abf", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>
                      {selectedPaymentOption?.badge || "₱"}
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#223047" }}>{paymentMethod}</Typography>
                      <Typography sx={{ fontSize: 10.5, color: "#7a8392" }}>Instant Transfer</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, mb: 1.3, border: "1px solid #dbe2ef" }}>
                  <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 1, mb: 0.8 }}>RECEIVER IDENTITY</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 42, height: 42, borderRadius: 1.8, backgroundColor: "#111", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {qrPreview ? <img src={qrPreview} alt="Receiver QR" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <UploadFile sx={{ color: "#fff", fontSize: 18 }} />}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12.2, fontWeight: 800, color: "#223047", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{qrFile?.name || "Uploaded QR"}</Typography>
                      <Typography sx={{ fontSize: 10.2, color: "#7a8392" }}>Uploaded today, {new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.6, p: 1.4, border: "1px solid #dbe2ef", display: "flex", alignItems: "flex-start", gap: 1 }}>
                  <input
                    type="checkbox"
                    checked={confirmReview}
                    onChange={() => setConfirmReview((prev) => !prev)}
                    style={{ width: 18, height: 18, marginTop: 2, accentColor: "#105abf" }}
                  />
                  <Typography sx={{ fontSize: 12, color: "#4a5568", fontWeight: 600, lineHeight: 1.55 }}>
                    I confirm that the withdrawal details and the uploaded QR code are correct.
                  </Typography>
                </Box>

                <Typography sx={{ textAlign: "center", fontSize: 10.5, color: "rgba(220,232,255,0.72)", mt: 1.5 }}>
                  Funds typically arrive in 1-5 minutes
                </Typography>
              </>
            )}

            {withdrawStep === 2 && receiptData && (
              <>
                <Box sx={{ textAlign: "center", mb: 2.1 }}>
                  <Box sx={{ width: 72, height: 72, mx: "auto", mb: 1.1, borderRadius: "50%", bgcolor: "#0d56cf", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 28px rgba(13,86,207,0.24)" }}>
                    <CheckCircle sx={{ fontSize: 38, color: "#fff" }} />
                  </Box>
                  <Typography sx={{ fontSize: 27, fontWeight: 900, color: "#ffffff" }}>Withdrawal Successful!</Typography>
                  <Typography sx={{ fontSize: 12.2, color: "rgba(220,232,255,0.76)", mt: 0.35 }}>
                    Your funds are being processed
                  </Typography>
                </Box>

                <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.6, mb: 1.4, border: "1px solid #dbe2ef" }}>
                  <Typography sx={{ textAlign: "center", fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "#7a8392" }}>AMOUNT WITHDRAWN</Typography>
                  <Typography sx={{ textAlign: "center", fontSize: 31, fontWeight: 900, color: "#223047", mt: 0.5 }}>
                    ₱{Number(receiptData.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>

                <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.6, mb: 1.4, border: "1px solid #dbe2ef" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 1.2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.9 }}>
                      <Box sx={{ width: 34, height: 34, borderRadius: 1.6, backgroundColor: selectedPaymentOption?.badgeBg || "#eef4ff", color: selectedPaymentOption?.badgeColor || "#105abf", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11 }}>
                        {selectedPaymentOption?.badge || "₱"}
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 9.5, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>METHOD</Typography>
                        <Typography sx={{ fontSize: 12.5, color: "#223047", fontWeight: 800 }}>{receiptData.paymentMethod}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontSize: 9.5, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>REFERENCE</Typography>
                      <Typography sx={{ fontSize: 12.5, color: "#223047", fontWeight: 800 }}>{receiptData.referenceNumber}</Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: 10.5, color: "#7a8392", fontWeight: 700 }}>
                    {receiptData.date?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} • {receiptData.date?.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
                  </Typography>
                </Box>

                <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.6, mb: 1.4, border: "1px solid #dbe2ef" }}>
                  <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 1, mb: 1 }}>TRANSACTION SUMMARY</Typography>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.7 }}>
                    <Typography sx={{ fontSize: 12, color: "#6b7484" }}>Withdrawal Amount</Typography>
                    <Typography sx={{ fontSize: 12, color: "#223047", fontWeight: 800 }}>₱{Number(receiptData.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.7 }}>
                    <Typography sx={{ fontSize: 12, color: "#6b7484" }}>Service Fee</Typography>
                    <Typography sx={{ fontSize: 12, color: "#223047", fontWeight: 800 }}>₱{Number(receiptData.charge || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
                  </Box>
                  <Divider sx={{ my: 0.9, borderColor: "#e5e9f0" }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography sx={{ fontSize: 15, color: "#105abf", fontWeight: 900 }}>Total Deduction</Typography>
                    <Typography sx={{ fontSize: 17, color: "#105abf", fontWeight: 900 }}>₱{Number(receiptData.totalDeduction || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
                  </Box>
                </Box>

                <Button
                  fullWidth
                  onClick={handleShareReceipt}
                  variant="contained"
                  sx={{ mb: 1, borderRadius: 2.2, textTransform: "none", fontWeight: 800, py: 1.25, bgcolor: "#0d56cf", "&:hover": { bgcolor: "#0b4eaa" } }}
                >
                  Share Receipt
                </Button>
                <Button
                  fullWidth
                  onClick={handleDownloadReceipt}
                  variant="outlined"
                  sx={{ mb: 1.2, borderRadius: 2.2, textTransform: "none", fontWeight: 800, py: 1.15, color: "#223047", borderColor: "#d5dfef", backgroundColor: "rgba(255,255,255,0.96)" }}
                >
                  Download Receipt
                </Button>
                <Button
                  fullWidth
                  onClick={handleClose}
                  sx={{ color: "#8ac7ff", textTransform: "none", fontWeight: 800 }}
                >
                  Back to Home
                </Button>
              </>
            )}
          </Box>

          {/* Footer */}
          {withdrawStep !== 2 && (
            <Box sx={{ p: 2, borderTop: "1px solid rgba(138,199,255,0.14)", background: "rgba(6,19,46,0.90)", backdropFilter: "blur(18px)" }}>
              <Button
                onClick={withdrawStep === 1 ? performWithdraw : handleWithdraw}
                variant="contained"
                fullWidth
                disabled={loading || (withdrawStep === 1 && !confirmReview)}
                sx={{
                  py: 1.5,
                  fontWeight: 800,
                  fontSize: 15,
                  borderRadius: 2.2,
                  background: "linear-gradient(135deg, #0b1f5e 0%, #173a8a 100%)",
                  "&:hover": { background: "linear-gradient(135deg, #173a8a 0%, #0b1f5e 100%)" },
                  "&:disabled": { background: "#cfd6e4", color: "#7a8392" },
                }}
              >
                {loading
                  ? <CircularProgress size={24} sx={{ color: "#fff" }} />
                  : withdrawStep === 1
                    ? "CONFIRM WITHDRAWAL"
                    : "WITHDRAW"}
              </Button>
            </Box>
          )}
        </Box>
      </Drawer>
    </>
  );
};

export default WithdrawDialog;