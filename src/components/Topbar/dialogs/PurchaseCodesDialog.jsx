import React, { useEffect, useState } from "react";
import {
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  Checkbox,
  Alert,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import {
  CheckCircle,
  ErrorOutline,
  ConfirmationNumber,
  CardGiftcard,
  RocketLaunch,
  Share,
  ContentCopy,
  PictureAsPdf,
  ChevronRight,
  InfoOutlined,
} from "@mui/icons-material";
import { collection, query, where, onSnapshot } from "firebase/firestore";
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
  const [error, setError] = useState("");
  const [purchaseLogs, setPurchaseLogs] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [serverPricing, setServerPricing] = useState(null);
  const [purchaseStep, setPurchaseStep] = useState(0);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [confirmTerms, setConfirmTerms] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState(null);

  useEffect(() => {
    if (userData?.uid) cleanupOldNotifications(userData.uid);
  }, [userData?.uid]);

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
  const currentBalance = Number(userData?.eWallet || 0);

  const purchaseItems = [
    {
      id: "capital",
      eyebrow: "OFFICIAL PARTNER",
      title: resolvedCapitalLabel,
      subtitle: isCapitalRenewalEligible
        ? "Renew your capital share access instantly"
        : "Activate your capital share with one secure code",
      helper: isCapitalRenewalEligible ? "1 Year Renewal Access" : "New Member Activation",
      price: codePrices.capital,
      accent: "linear-gradient(135deg, #0d56cf 0%, #1f74f2 100%)",
      icon: <RocketLaunch sx={{ color: "#fff", fontSize: 20 }} />,
    },
    {
      id: "downline",
      eyebrow: "TEAM GROWTH",
      title: "Downline Code",
      subtitle: "Purchase a ready-to-use invite code for your next member",
      helper: "Referral Registration Access",
      price: codePrices.downline,
      accent: "linear-gradient(135deg, #12316d 0%, #0b1f5e 100%)",
      icon: <CardGiftcard sx={{ color: "#fff", fontSize: 20 }} />,
    },
  ];

  const selectedOffer = purchaseItems.find((item) => item.id === selectedOfferId) || purchaseItems[0];

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
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch purchase code pricing");
        }

        const pricing = await response.json();
        if (isMounted) {
          setServerPricing(pricing);
        }
      } catch (fetchError) {
        console.warn("[PurchaseCodesDialog] Pricing fetch failed. Using local fallback:", fetchError);
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
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPurchaseLogs(logs);
    });

    return () => unsubscribe();
  }, [open, auth, db]);

  const resetFlow = () => {
    setError("");
    setLoading(false);
    setConfirmDialog(false);
    setPurchaseStep(0);
    setSelectedOfferId("");
    setConfirmTerms(false);
    setPurchaseResult(null);
  };

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  const handleBack = () => {
    if (loading) return;
    setError("");

    if (purchaseStep === 0) {
      handleClose();
      return;
    }

    if (purchaseStep === 3) {
      setPurchaseStep(0);
      setPurchaseResult(null);
      setConfirmTerms(false);
      return;
    }

    setPurchaseStep((prev) => Math.max(prev - 1, 0));
  };

  const handleProceedToSelection = () => {
    if (!selectedOfferId) {
      setError("Please select a purchase code first.");
      return;
    }
    setError("");
    setPurchaseStep(1);
  };

  const handleReviewOrder = () => {
    if (!selectedOfferId) {
      setError("Please select a purchase code first.");
      return;
    }

    if (currentBalance < selectedOffer.price) {
      setConfirmDialog(true);
      return;
    }

    setError("");
    setPurchaseStep(2);
  };

  const buildReceiptText = () => {
    if (!purchaseResult) return "";

    return [
      "Purchase Successful",
      `Item: ${purchaseResult.title}`,
      `Code: ${purchaseResult.code}`,
      `Amount: ₱${Number(purchaseResult.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Purchased At: ${purchaseResult.purchasedAt?.toLocaleString("en-PH") || "-"}`,
    ].join("\n");
  };

  const handleShareReceipt = async () => {
    if (!purchaseResult) return;
    const text = buildReceiptText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Purchase Receipt", text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        window.alert("Purchase receipt copied to clipboard.");
      }
    } catch (_) {}
  };

  const handleCopyCode = async () => {
    if (!purchaseResult?.code) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(purchaseResult.code);
        window.alert("Purchase code copied.");
      }
    } catch (_) {}
  };

  const handleDownloadPdf = () => {
    if (!purchaseResult) return;
    const printWindow = window.open("", "_blank", "width=720,height=900");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #102042; }
            .card { border: 1px solid #d8e3f5; border-radius: 16px; padding: 20px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 12px; }
            .code { font-size: 28px; font-weight: bold; color: #0d56cf; letter-spacing: 1px; }
            .row { margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">Purchase Successful</div>
            <div class="row"><strong>Item:</strong> ${purchaseResult.title}</div>
            <div class="row"><strong>Amount:</strong> ₱${Number(purchaseResult.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="row"><strong>Purchase Code:</strong></div>
            <div class="code">${purchaseResult.code || "-"}</div>
            <div class="row"><strong>Date:</strong> ${purchaseResult.purchasedAt?.toLocaleString("en-PH") || "-"}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const performPurchase = async () => {
    if (loading) return;
    if (!selectedOfferId) {
      setError("Please select a purchase code first.");
      return;
    }
    if (!auth?.currentUser) {
      setError("Please log in again and retry.");
      return;
    }
    if (purchaseStep === 2 && !confirmTerms) {
      setError("Please confirm that the purchase code is non-refundable.");
      return;
    }
    if (currentBalance < selectedOffer.price) {
      setConfirmDialog(true);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const idToken = await auth.currentUser.getIdToken();
      const clientRequestId = `${auth.currentUser.uid}_${selectedOffer.id}_${Date.now()}`;

      const response = await fetch(
        "https://us-central1-amayan-savings.cloudfunctions.net/purchaseActivationCode",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            codeType: selectedOffer.id,
            clientRequestId,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Purchase failed");
      }

      if (selectedOffer.id === "capital") {
        await sendPurchaseNotification({
          userId: auth.currentUser.uid,
          codeType: resolvedCapitalLabel,
        });
      }

      if (onBalanceUpdate) onBalanceUpdate(result.newBalance);

      setPurchaseResult({
        ...result,
        title: selectedOffer.title,
        helper: selectedOffer.helper,
        amount: Number(result.amount || selectedOffer.price || 0),
        purchasedAt: new Date(),
      });
      setConfirmTerms(false);
      setPurchaseStep(3);
    } catch (purchaseError) {
      console.error("[PurchaseCodesDialog] Purchase failed:", purchaseError);
      setError(purchaseError.message || "Unable to complete purchase.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (String(status || "").toLowerCase()) {
      case "success":
        return "success";
      case "pending":
        return "warning";
      case "failed":
        return "error";
      default:
        return "default";
    }
  };

  const renderCatalogStep = () => (
    <>
      <Box
        sx={{
          borderRadius: 3,
          p: 2,
          mb: 1.6,
          background: selectedOffer.accent,
          color: "#fff",
          boxShadow: "0 16px 30px rgba(15,87,213,0.28)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.25 }}>
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, opacity: 0.82 }}>
              {selectedOffer.eyebrow}
            </Typography>
            <Typography sx={{ fontSize: 28, fontWeight: 900, lineHeight: 1.15, mt: 0.4 }}>
              {selectedOffer.title}
            </Typography>
            <Typography sx={{ fontSize: 12.2, mt: 0.6, color: "rgba(255,255,255,0.88)" }}>
              {selectedOffer.subtitle}
            </Typography>
          </Box>
          <Box sx={{ width: 44, height: 44, borderRadius: 2.2, bgcolor: "rgba(6,19,46,0.40)", border: "1px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {selectedOffer.icon}
          </Box>
        </Box>
        <Typography sx={{ fontSize: 11, mt: 1.2, color: "rgba(255,255,255,0.86)" }}>
          • Instant delivery via SMS/Email
        </Typography>
      </Box>

      <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, mb: 1.5, border: "1px solid #dbe2ef", boxShadow: "0 10px 18px rgba(6,18,45,0.08)" }}>
        <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "#7a8392" }}>
          AVAILABLE BALANCE
        </Typography>
        <Typography sx={{ fontSize: 31, fontWeight: 900, color: "#223047", mt: 0.5 }}>
          ₱{currentBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Typography>
      </Box>

      <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#fff", mb: 1.2 }}>Select Code Type</Typography>
      <Box sx={{ display: "grid", gap: 1.1 }}>
        {purchaseItems.map((item) => {
          const selected = selectedOfferId === item.id;
          return (
            <Box
              key={item.id}
              onClick={() => {
                setSelectedOfferId(item.id);
                setError("");
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.15,
                p: 1.2,
                borderRadius: 2.5,
                cursor: "pointer",
                background: selected ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.94)",
                border: selected ? "2px solid rgba(33,103,228,0.42)" : "1px solid #e5e9f0",
                boxShadow: selected ? "0 12px 22px rgba(13,86,207,0.12)" : "0 8px 18px rgba(6,18,45,0.06)",
              }}
            >
              <Box sx={{ width: 42, height: 42, borderRadius: 2, background: item.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {item.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#223047" }}>{item.title}</Typography>
                <Typography sx={{ fontSize: 10.5, color: "#7a8392" }}>{item.helper}</Typography>
              </Box>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 900, color: "#0d56cf" }}>
                  ₱{item.price.toLocaleString("en-PH")}
                </Typography>
                <Typography sx={{ fontSize: 10, color: "#7a8392" }}>{selected ? "Selected" : "Tap to select"}</Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {purchaseLogs.length > 0 && (
        <Box sx={{ mt: 1.6, background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, border: "1px solid #dbe2ef", boxShadow: "0 10px 18px rgba(6,18,45,0.08)" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.7 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.9, color: "#7a8392" }}>
              RECENT PURCHASES
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#105abf" }}>
              {purchaseLogs.length} total
            </Typography>
          </Box>
          <List dense disablePadding>
            {purchaseLogs.slice(0, 3).map((log, index) => (
              <ListItem key={log.id} disableGutters sx={{ py: 0.75, borderBottom: index === Math.min(purchaseLogs.length, 3) - 1 ? "none" : "1px solid #eef2f7" }}>
                <ListItemText
                  primary={log.type || "Purchase Code"}
                  secondary={log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleString("en-PH") : "Processing..."}
                  primaryTypographyProps={{ color: "#223047", fontWeight: 800, fontSize: 12.3 }}
                  secondaryTypographyProps={{ color: "#7a8392", fontSize: 10.3 }}
                />
                <Chip size="small" label={log.status || "Success"} color={getStatusColor(log.status)} sx={{ fontWeight: 700, fontSize: 10.2 }} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </>
  );

  const renderSelectionStep = () => (
    <>
      <Box sx={{ borderRadius: 3, p: 2, mb: 1.5, background: selectedOffer.accent, color: "#fff", boxShadow: "0 16px 30px rgba(15,87,213,0.28)" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.25 }}>
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, opacity: 0.82 }}>
              {selectedOffer.eyebrow}
            </Typography>
            <Typography sx={{ fontSize: 23, fontWeight: 900, lineHeight: 1.15, mt: 0.45 }}>
              {selectedOffer.title}
            </Typography>
            <Typography sx={{ fontSize: 12, mt: 0.5, color: "rgba(255,255,255,0.9)" }}>
              {selectedOffer.helper}
            </Typography>
          </Box>
          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: "rgba(6,19,46,0.42)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.22)" }}>
            {selectedOffer.icon}
          </Box>
        </Box>
      </Box>

      <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.6, p: 1.2, mb: 1.4, border: "1px solid #e4ebf5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>AVAILABLE BALANCE</Typography>
          <Typography sx={{ fontSize: 19, color: "#223047", fontWeight: 900 }}>₱{currentBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
        </Box>
        <Button onClick={() => navigate("/member/cash-in")} sx={{ textTransform: "none", fontWeight: 800, color: "#0d56cf" }}>Top Up</Button>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Select Amount</Typography>
        <Typography sx={{ fontSize: 11, color: "rgba(220,232,255,0.76)", fontWeight: 700 }}>All prices in PHP</Typography>
      </Box>

      <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.4, border: "2px solid rgba(13,86,207,0.42)", boxShadow: "0 10px 18px rgba(6,18,45,0.08)" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 28, fontWeight: 900, color: "#223047" }}>
              ₱{selectedOffer.price.toLocaleString("en-PH")}
            </Typography>
            <Typography sx={{ fontSize: 12.2, color: "#5f6b7a", fontWeight: 700 }}>
              {selectedOffer.helper}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: "#7a8392", mt: 0.3 }}>
              {selectedOffer.subtitle}
            </Typography>
          </Box>
          <CheckCircle sx={{ color: "#0d56cf", fontSize: 22 }} />
        </Box>
      </Box>

      <Box sx={{ mt: 1.4, borderRadius: 2.4, p: 1.35, background: "rgba(255,255,255,0.96)", border: "1px solid #e7edf6", display: "flex", gap: 1 }}>
        <InfoOutlined sx={{ color: "#6b7280", fontSize: 18, mt: 0.15 }} />
        <Typography sx={{ fontSize: 11.2, color: "#5f6b7a", lineHeight: 1.55 }}>
          Purchase codes are delivered instantly to your registered member account and are issued immediately after confirmation.
        </Typography>
      </Box>
    </>
  );

  const renderReviewStep = () => (
    <>
      <Typography sx={{ fontSize: 28, fontWeight: 900, color: "#ffffff", lineHeight: 1.1, mb: 0.6 }}>
        Confirm Your Selection
      </Typography>
      <Typography sx={{ fontSize: 12.2, color: "rgba(220,232,255,0.76)", mb: 1.5 }}>
        Review your gift code details before finalizing the transaction.
      </Typography>

      <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, mb: 1.3, border: "1px solid #dbe2ef" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 1.9, background: selectedOffer.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {selectedOffer.icon}
            </Box>
            <Box>
              <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>MERCHANT</Typography>
              <Typography sx={{ fontSize: 13, color: "#223047", fontWeight: 800 }}>Damayan</Typography>
            </Box>
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>STATUS</Typography>
            <Chip label="Pending Review" size="small" color="warning" sx={{ mt: 0.25, fontWeight: 700 }} />
          </Box>
        </Box>

        <Box sx={{ display: "grid", gap: 0.7 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: 12, color: "#6b7484" }}>Product</Typography>
            <Typography sx={{ fontSize: 12, color: "#223047", fontWeight: 800 }}>{selectedOffer.title}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: 12, color: "#6b7484" }}>Recipient</Typography>
            <Typography sx={{ fontSize: 12, color: "#223047", fontWeight: 800 }}>{userData?.name || userData?.username || "Member Account"}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: 12, color: "#6b7484" }}>Value</Typography>
            <Typography sx={{ fontSize: 12, color: "#223047", fontWeight: 800 }}>₱{selectedOffer.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: 12, color: "#6b7484" }}>Fee</Typography>
            <Typography sx={{ fontSize: 12, color: "#223047", fontWeight: 800 }}>₱0.00</Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 1.2, pt: 1.1, borderTop: "1px solid #e8edf6", display: "flex", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: 16, color: "#223047", fontWeight: 900 }}>Total Amount</Typography>
          <Typography sx={{ fontSize: 18, color: "#0d56cf", fontWeight: 900 }}>₱{selectedOffer.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
        </Box>
      </Box>

      <Box sx={{ borderRadius: 2.3, p: 1.2, mb: 1.25, background: "rgba(255,250,245,0.98)", border: "1px solid rgba(229,159,67,0.28)", display: "flex", gap: 1 }}>
        <InfoOutlined sx={{ color: "#b45309", fontSize: 18, mt: 0.15 }} />
        <Typography sx={{ fontSize: 11.2, color: "#8a4b0f", lineHeight: 1.55 }}>
          Digital codes are delivered instantly to your registered account and sent to your notifications. Please ensure your selection is correct.
        </Typography>
      </Box>

      <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.6, p: 1.2, border: "1px solid #dbe2ef", display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Checkbox checked={confirmTerms} onChange={(e) => setConfirmTerms(e.target.checked)} sx={{ p: 0.2, color: "#0d56cf" }} />
        <Typography sx={{ fontSize: 11.8, color: "#4a5568", fontWeight: 600, lineHeight: 1.55 }}>
          I confirm that the purchase code is non-refundable once generated.
        </Typography>
      </Box>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <Box sx={{ textAlign: "center", py: 1.4 }}>
        <Box sx={{ width: 72, height: 72, mx: "auto", mb: 1.1, borderRadius: "50%", bgcolor: "rgba(13,86,207,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle sx={{ fontSize: 38, color: "#0d56cf" }} />
        </Box>
        <Typography sx={{ fontSize: 18, color: "rgba(220,232,255,0.76)", fontWeight: 700 }}>Review Order</Typography>
        <Typography sx={{ fontSize: 34, fontWeight: 900, color: "#ffffff", lineHeight: 1.05, mt: 0.5 }}>Purchase Successful!</Typography>
        <Typography sx={{ fontSize: 12.2, color: "rgba(220,232,255,0.76)", mt: 0.5 }}>
          Your digital voucher is ready for use.
        </Typography>
      </Box>

      <Box sx={{ background: "rgba(255,255,255,0.98)", borderRadius: 2.8, p: 1.5, mb: 1.35, border: "1px solid #dbe2ef" }}>
        <Box sx={{ borderRadius: 2.4, p: 1.3, background: selectedOffer.accent, color: "#fff", mb: 1.2 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, opacity: 0.84 }}>GIFT CARD VALUE</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 900, mt: 0.35 }}>₱{Number(purchaseResult?.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.88)", mt: 0.35 }}>{purchaseResult?.title}</Typography>
        </Box>

        <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>PURCHASE CODE</Typography>
        <Box sx={{ mt: 0.6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, borderRadius: 2, background: "#f5f8fd", border: "1px solid #dbe2ef", p: 1.1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#0d56cf", letterSpacing: 0.8 }}>
              {purchaseResult?.code || "—"}
            </Typography>
            <Typography sx={{ fontSize: 10.4, color: "#7a8392" }}>Redeemable on your member account</Typography>
          </Box>
          <Button onClick={handleCopyCode} startIcon={<ContentCopy />} sx={{ textTransform: "none", fontWeight: 800, color: "#0d56cf" }}>
            Copy Code
          </Button>
        </Box>
      </Box>

      <Button fullWidth onClick={handleShareReceipt} variant="contained" startIcon={<Share />} sx={{ mb: 1, borderRadius: 2.2, textTransform: "none", fontWeight: 800, py: 1.2, bgcolor: "#0d56cf", "&:hover": { bgcolor: "#0b4eaa" } }}>
        Share Receipt
      </Button>
      <Button fullWidth onClick={handleDownloadPdf} variant="outlined" startIcon={<PictureAsPdf />} sx={{ mb: 1.25, borderRadius: 2.2, textTransform: "none", fontWeight: 800, py: 1.15, color: "#223047", borderColor: "#d5dfef", backgroundColor: "rgba(255,255,255,0.96)" }}>
        Download PDF
      </Button>

      <Box sx={{ borderRadius: 2.6, p: 1.35, background: "linear-gradient(135deg, rgba(232,239,255,0.98) 0%, rgba(247,249,255,0.98) 100%)", border: "1px solid rgba(137,170,239,0.28)", mb: 1.3 }}>
        <Typography sx={{ fontSize: 10, color: "#5771a0", fontWeight: 800, letterSpacing: 0.8 }}>NEXT STEP</Typography>
        <Typography sx={{ fontSize: 18, color: "#223047", fontWeight: 900, mt: 0.25 }}>Need another code?</Typography>
        <Typography sx={{ fontSize: 11.2, color: "#5f6b7a", mt: 0.4 }}>
          You can purchase more codes anytime from this secure page.
        </Typography>
      </Box>

      <Button fullWidth onClick={() => { setPurchaseStep(0); setPurchaseResult(null); setSelectedOfferId(""); setConfirmTerms(false); setError(""); }} sx={{ color: "#8ac7ff", textTransform: "none", fontWeight: 800 }}>
        Back to Shop <ChevronRight sx={{ fontSize: 18, ml: 0.5 }} />
      </Button>
    </>
  );

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
          <Box sx={{ minHeight: 70, px: 1, pt: "calc(env(safe-area-inset-top, 0px) + 10px)", pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff", background: "linear-gradient(135deg, rgba(6,19,46,0.98) 0%, rgba(13,47,118,0.96) 58%, rgba(37,101,214,0.90) 100%)", borderBottom: "1px solid rgba(138,199,255,0.16)" }}>
            <IconButton onClick={handleBack} sx={{ color: "#fff" }}>
              <ArrowBackIosNewIcon />
            </IconButton>
            <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>
              {purchaseStep >= 2 ? "Review Order" : "Purchase Codes"}
            </Typography>
            <Box sx={{ width: 40 }} />
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 1.4 }}>
                {error}
              </Alert>
            )}

            {purchaseStep === 0 && renderCatalogStep()}
            {purchaseStep === 1 && renderSelectionStep()}
            {purchaseStep === 2 && renderReviewStep()}
            {purchaseStep === 3 && renderSuccessStep()}
          </Box>

          {purchaseStep !== 3 && (
            <Box sx={{ p: 2, borderTop: "1px solid rgba(138,199,255,0.14)", background: "rgba(6,19,46,0.90)", backdropFilter: "blur(18px)" }}>
              {purchaseStep === 0 && (
                <Button
                  onClick={handleProceedToSelection}
                  variant="contained"
                  fullWidth
                  disabled={loading}
                  sx={{
                    py: 1.5,
                    fontWeight: 800,
                    fontSize: 15,
                    borderRadius: 2.1,
                    background: "linear-gradient(135deg, #0b1f5e 0%, #173a8a 100%)",
                    "&:hover": { background: "linear-gradient(135deg, #173a8a 0%, #0b1f5e 100%)" },
                    "&:disabled": { background: "#ccc" },
                  }}
                >
                  Proceed to Purchase
                </Button>
              )}

              {purchaseStep === 1 && (
                <Box sx={{ display: "flex", gap: 1.1 }}>
                  <Button onClick={handleBack} variant="outlined" fullWidth sx={{ py: 1.35, borderRadius: 2.1, textTransform: "none", color: "#d9e9ff", borderColor: "rgba(217,233,255,0.34)" }}>
                    Cancel
                  </Button>
                  <Button onClick={handleReviewOrder} variant="contained" fullWidth sx={{ py: 1.35, borderRadius: 2.1, textTransform: "none", fontWeight: 800, background: "linear-gradient(135deg, #0d56cf 0%, #1f74f2 100%)" }}>
                    Review Order
                  </Button>
                </Box>
              )}

              {purchaseStep === 2 && (
                <Button
                  onClick={performPurchase}
                  variant="contained"
                  fullWidth
                  disabled={loading || !confirmTerms}
                  sx={{
                    py: 1.45,
                    fontWeight: 800,
                    fontSize: 15,
                    borderRadius: 2.1,
                    background: "linear-gradient(135deg, #0b1f5e 0%, #173a8a 100%)",
                    "&:hover": { background: "linear-gradient(135deg, #173a8a 0%, #0b1f5e 100%)" },
                    "&:disabled": { background: "#cfd6e4", color: "#6b7484" },
                  }}
                >
                  {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Confirm Purchase"}
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Drawer>

      <Dialog
        open={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: "linear-gradient(180deg, rgba(6,19,46,0.98) 0%, rgba(13,47,118,0.92) 100%)",
            color: "#f8fbff",
            border: "1px solid rgba(138,199,255,0.14)",
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", fontWeight: 700, color: "#f8fbff" }}>
          <ErrorOutline sx={{ color: "#F44336", fontSize: 40, mb: 1 }} />
          Insufficient Balance
        </DialogTitle>
        <DialogContent>
          <Typography align="center" sx={{ mb: 2, color: "rgba(220,232,255,0.82)" }}>
            Your E-Wallet balance is not enough to complete this purchase. Would you like to top up now?
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
    </>
  );
};

export default PurchaseCodesDialog;