import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Divider,
  IconButton,
  Tab,
  Tabs,
  TextField,
  Typography,
  InputAdornment,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DownloadIcon from "@mui/icons-material/Download";
import ShareIcon from "@mui/icons-material/Share";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import jsQR from "jsqr";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { keyframes } from "@mui/system";
import { auth, db, storage } from "../../firebase";
import bpiLogo from "../../assets/bpilogo.png";
import bpiQr from "../../assets/bpi.jpg";
import gotymeLogo from "../../assets/gotymelogo.png";
import gotymeQr from "../../assets/gotymeqr.png";
import { memberStickyHeaderInset, memberShellBackground, memberGlassPanelSx, memberHeroBackground } from "./memberLayout";

const METHOD_ITEMS = [
  {
    id: "bank",
    title: "Local Banks",
    subtitle: "Transfer via InstaPay",
    screen: "banks",
    icon: <AccountBalanceIcon sx={{ color: "#ffffff", fontSize: 26 }} />,
  },
  {
    id: "ewallet",
    title: "E-Wallet",
    subtitle: "G-Cash, Maya & more",
    screen: "ewallet",
    icon: <AccountBalanceWalletIcon sx={{ color: "#ffffff", fontSize: 26 }} />,
  },
];

const INSTAPAY_BANKS = [{ id: "bpi", name: "BPI", initial: "B", bg: "#c0392b", logo: bpiLogo, qr: bpiQr }];

const EWALLET_OPTIONS = [
  {
    id: "gotyme",
    name: "GoTyme Bank",
    subtitle: "Digital banking partner",
    shortLabel: "GoTyme",
    bg: "#0d1726",
    color: "#d8ff6a",
    popular: true,
    available: true,
    logo: gotymeLogo,
    qr: gotymeQr,
    badgeFontSize: 9,
  },
  { id: "gcash", name: "G-Cash", subtitle: "Mobile wallet", shortLabel: "GCash", bg: "#05070c", color: "#facc15", popular: true, badgeFontSize: 10, available: false },
  { id: "maya", name: "Maya", subtitle: "Digital bank", shortLabel: "M", bg: "#05070c", color: "#e2fbe8", popular: true, badgeFontSize: 18, available: false },
  { id: "coins", name: "Coins.ph", subtitle: "Crypto wallet", shortLabel: "Coins.ph", bg: "#ffffff", color: "#10b981", border: "1px solid rgba(16,24,40,0.08)", popular: true, badgeFontSize: 8.5, available: false },
  { id: "grabpay", name: "GrabPay", subtitle: "Payments", shortLabel: "GrabPay", bg: "#166534", color: "#dcfce7", popular: true, badgeFontSize: 8.5, available: false },
  { id: "alipay", name: "Alipay", subtitle: "Global Payments", shortLabel: "A", bg: "#eaf2ff", color: "#2563eb", group: "A-E", available: false },
  { id: "beep", name: "Beep", subtitle: "Transport & Retail", shortLabel: "B", bg: "#eaf2ff", color: "#2563eb", group: "A-E", available: false },
  { id: "home-credit", name: "Home Credit", subtitle: "Financing & Payments", shortLabel: "H", bg: "#eaf2ff", color: "#2563eb", group: "F-L", available: false },
  { id: "lazada-wallet", name: "Lazada Wallet", subtitle: "E-commerce credits", shortLabel: "L", bg: "#eaf2ff", color: "#2563eb", group: "F-L", available: false },
  { id: "shopeepay", name: "ShopeePay", subtitle: "Marketplace wallet", shortLabel: "S", bg: "#eaf2ff", color: "#2563eb", group: "P-S", available: false },
  { id: "starbucks-cards", name: "Starbucks Cards", subtitle: "Rewards & Payments", shortLabel: "★", bg: "#eaf2ff", color: "#2563eb", group: "P-S", available: false },
];

const EWALLET_GROUPS = ["A-E", "F-L", "P-S"];

const receiptScanSweep = keyframes`
  0% {
    top: 0;
    opacity: 0.42;
  }
  50% {
    opacity: 1;
  }
  100% {
    top: calc(100% - 3px);
    opacity: 0.42;
  }
`;

const receiptScanGlow = keyframes`
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 0.9;
  }
`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const statusColor = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "approved") return { bg: "#e6f9ee", color: "#1a9451" };
  if (s === "rejected" || s === "declined") return { bg: "#fde8e8", color: "#c0392b" };
  return { bg: "#fff3e0", color: "#e65100" };
};

const formatDate = (ts) => {
  if (!ts) return "";
  const date = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const MemberCashIn = () => {
  const memberPalette = {
    navy: "#0a1f44",
    royal: "#0f4ea8",
    azure: "#2f7de1",
    cloud: "#d9e9ff",
    softText: "rgba(217,233,255,0.78)",
    gold: "#d4af37",
    softGold: "#f2de9c",
  };

  const navigate = useNavigate();
  const allWalletsRef = useRef(null);
  const [screen, setScreen] = useState("main");
  const [bankTab, setBankTab] = useState(1); // 0=OTC, 1=Local Banks, 2=Global
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [amount, setAmount] = useState("");
  const [receiptReference, setReceiptReference] = useState("");
  const [detectedReceiptPartner, setDetectedReceiptPartner] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [receiptScanValid, setReceiptScanValid] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [depositReceiptData, setDepositReceiptData] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const [methodUnavailableOpen, setMethodUnavailableOpen] = useState(false);
  const [cashInInfoOpen, setCashInInfoOpen] = useState(false);
  const [cashInHistoryOpen, setCashInHistoryOpen] = useState(false);
  const [unavailableWalletName, setUnavailableWalletName] = useState("");
  const [depositLogs, setDepositLogs] = useState([]);
  const [ewalletSearch, setEwalletSearch] = useState("");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const depositsQ = query(collection(db, "deposits"), where("userId", "==", uid));
    const unsub = onSnapshot(depositsQ, (snapshot) => {
      const logs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setDepositLogs(logs);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  const handleBack = () => {
    if (screen !== "main") setScreen("main");
    else navigate("/member/dashboard");
  };

  const openPartnerDialog = (partner, methodType) => {
    setSelectedPartner({ ...partner, methodType });
    setAmount("");
    setReceiptReference("");
    setDetectedReceiptPartner(partner?.name || "");
    setScanStatus("");
    setReceiptScanValid(false);
    setScanProgress(0);
    setError("");
    setSuccess(false);
    setDepositReceiptData(null);
    setReceiptFile(null);
    setReceiptPreviewUrl("");
  };

  const handleWalletSelect = (wallet) => {
    if (wallet?.available) {
      openPartnerDialog(wallet, "ewallet");
      return;
    }

    setUnavailableWalletName(wallet?.name || "This e-wallet");
    setMethodUnavailableOpen(true);
  };

  const handleCloseDialog = () => {
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    setSelectedPartner(null);
    setAmount("");
    setReceiptReference("");
    setDetectedReceiptPartner("");
    setScanStatus("");
    setReceiptScanValid(false);
    setScanProgress(0);
    setError("");
    setSuccess(false);
    setDepositReceiptData(null);
    setReceiptFile(null);
    setReceiptPreviewUrl("");
  };

  const loadTesseract = async () => {
    if (typeof window === "undefined") return null;
    if (window.Tesseract) return window.Tesseract;

    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-tesseract="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load OCR.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.async = true;
      script.dataset.tesseract = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load OCR."));
      document.body.appendChild(script);
    });

    return window.Tesseract || null;
  };

  const parseReceiptDetails = (text, qrPayload = "") => {
    const combined = `${text || ""}\n${qrPayload || ""}`;
    const normalized = combined.replace(/\s+/g, " ");

    const amountMatch =
      normalized.match(/(?:amount|total|paid|payment|debited)\D{0,12}(?:php|₱)?\s*([0-9][0-9,]*\.?[0-9]{0,2})/i) ||
      normalized.match(/(?:php|₱)\s*([0-9][0-9,]*\.?[0-9]{0,2})/i);

    const referenceMatch =
      normalized.match(/(?:reference(?:\s*number|\s*no\.?)*|ref\.?\s*(?:no\.?|number)?|rrn|trace\s*(?:no\.?|number)?|transaction\s*(?:id|no\.?)|txn\s*(?:id|no\.?))\D{0,8}([A-Z0-9-]{6,})/i);

    const detectedPartner = [...INSTAPAY_BANKS, ...EWALLET_OPTIONS].find((partner) => {
      const name = String(partner.name || "").toLowerCase();
      return name && normalized.toLowerCase().includes(name.replace(/\s+/g, " "));
    });

    return {
      amount: amountMatch?.[1] ? amountMatch[1].replace(/,/g, "") : "",
      referenceNumber: referenceMatch?.[1] || "",
      partnerName: detectedPartner?.name || "",
    };
  };

  const decodeReceiptQr = async (file) => {
    if (!file) return "";

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read receipt image."));
        reader.readAsDataURL(file);
      });

      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to load receipt image."));
        image.src = dataUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(imageData.data, imageData.width, imageData.height);
      return qr?.data || "";
    } catch {
      return "";
    }
  };

  const scanReceiptFile = async (file) => {
    if (!file) return;

    const scanStartedAt = Date.now();
    let lastProgressBucket = 0;
    let lastStatusMessage = "";
    const updateStatus = (nextStatus) => {
      if (nextStatus && nextStatus !== lastStatusMessage) {
        lastStatusMessage = nextStatus;
        setScanStatus(nextStatus);
      }
    };

    setScanningReceipt(true);
    setReceiptScanValid(false);
    setScanProgress(8);
    updateStatus("AI scanning started. Reading the uploaded receipt...");

    try {
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
      }
      await wait(220);

      const qrPayload = await decodeReceiptQr(file);
      setScanProgress(28);
      updateStatus(
        qrPayload
          ? "QR detected. AI is extracting the amount and reference number..."
          : "No QR found yet. AI is extracting the amount and reference number..."
      );

      await wait(140);

      const Tesseract = await loadTesseract();
      let text = "";

      if (Tesseract?.recognize) {
        const result = await Tesseract.recognize(file, "eng", {
          logger: ({ status, progress }) => {
            if (typeof progress === "number") {
              const nextProgress = Math.min(92, Math.max(32, Math.round((progress * 100) / 5) * 5));
              if (nextProgress >= lastProgressBucket + 5) {
                lastProgressBucket = nextProgress;
                setScanProgress((prev) => (nextProgress > prev ? nextProgress : prev));
              }

              if (nextProgress >= 35 && nextProgress < 95) {
                updateStatus(`AI scanning receipt... ${nextProgress}% complete`);
              }
            }

            if (status) {
              const normalizedStatus = String(status).replace(/_/g, " ");
              if (/loading|initializing/i.test(normalizedStatus)) {
                updateStatus("AI scanner is loading receipt analysis tools...");
              } else if (/recognizing/i.test(normalizedStatus) && typeof progress !== "number") {
                updateStatus("AI scanning receipt...");
              }
            }
          },
        });
        text = result?.data?.text || "";
      }

      setScanProgress(94);
      updateStatus("Reviewing detected details for better accuracy...");

      const minimumScanDuration = 2600;
      const remainingScanTime = minimumScanDuration - (Date.now() - scanStartedAt);
      if (remainingScanTime > 0) {
        await wait(remainingScanTime);
      }

      setScanProgress(96);
      updateStatus("Finalizing detected receipt details...");

      const parsed = parseReceiptDetails(text, qrPayload);
      const hasDetectedAmount = Boolean(parsed.amount);
      const hasDetectedReference = Boolean(parsed.referenceNumber);
      const isValidReceipt = hasDetectedAmount && hasDetectedReference;

      if (parsed.amount) {
        setAmount(parsed.amount);
      }
      if (parsed.referenceNumber) {
        setReceiptReference(parsed.referenceNumber);
      }
      if (parsed.partnerName) {
        setDetectedReceiptPartner(parsed.partnerName);
      }

      setReceiptScanValid(isValidReceipt);
      setScanProgress(100);

      if (isValidReceipt) {
        setError("");
        updateStatus("AI scan complete. Receipt details were auto-filled.");
      } else {
        setError("Invalid receipt upload. Please use a clearer receipt that shows both the amount and reference number.");
        updateStatus("AI scan incomplete. Upload a clearer receipt that shows the amount and reference number.");
      }
    } catch (scanError) {
      console.error("Receipt scan failed:", scanError);
      setReceiptScanValid(false);
      setScanProgress(100);
      setError("Invalid receipt upload. Please use a clearer receipt that shows both the amount and reference number.");
      updateStatus("Receipt uploaded. AI scan could not read the amount and reference number.");
    } finally {
      setScanningReceipt(false);
    }
  };

  const handleReceiptChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    setReceiptFile(file);
    setReceiptPreviewUrl(file ? URL.createObjectURL(file) : "");
    setAmount("");
    setReceiptReference("");
    setDetectedReceiptPartner(selectedPartner?.name || "");
    setReceiptScanValid(false);
    setScanProgress(file ? 5 : 0);
    setError("");
    setScanStatus(file ? "Preparing AI receipt scan..." : "");
    if (file) {
      scanReceiptFile(file);
    }
  };

  const buildDepositReceiptCanvas = () => {
    if (!depositReceiptData) return null;

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1560;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const drawRoundedRect = (x, y, width, height, radius, fillStyle) => {
      ctx.fillStyle = fillStyle;
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
      ctx.fill();
    };

    ctx.fillStyle = "#eef2f8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawRoundedRect(80, 110, 920, 1240, 30, "#ffffff");

    ctx.fillStyle = "#0f57d5";
    ctx.beginPath();
    ctx.arc(540, 190, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.fillText("✓", 540, 203);

    ctx.fillStyle = "#1e2430";
    ctx.font = "bold 48px Arial";
    ctx.fillText("Deposit Submitted!", 540, 290);
    ctx.fillStyle = "#6e7787";
    ctx.font = "24px Arial";
    ctx.fillText("Your cash-in request is pending review.", 540, 332);

    ctx.fillStyle = "#7a8191";
    ctx.font = "bold 18px Arial";
    ctx.fillText("TOTAL AMOUNT", 540, 410);
    ctx.fillStyle = "#0f57d5";
    ctx.font = "bold 62px Arial";
    ctx.fillText(`₱${Number(depositReceiptData.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, 540, 482);

    drawRoundedRect(130, 540, 820, 120, 20, "#f4f6fa");
    ctx.fillStyle = "#1e2430";
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "left";
    ctx.fillText(depositReceiptData.partnerName || "Cash In Partner", 170, 595);
    ctx.fillStyle = "#6e7787";
    ctx.font = "22px Arial";
    ctx.fillText(depositReceiptData.qrName || depositReceiptData.partnerName || "QR Partner", 170, 630);

    const details = [
      ["Reference Number", depositReceiptData.referenceNumber || "-"],
      ["Request ID", depositReceiptData.requestId || "-"],
      ["Date", depositReceiptData.date?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) || "-"],
      ["Time", depositReceiptData.date?.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) || "-"],
      ["Status", depositReceiptData.status || "PENDING REVIEW"],
    ];

    details.forEach(([label, value], index) => {
      const y = 760 + index * 92;
      ctx.fillStyle = "#7a8191";
      ctx.font = "bold 18px Arial";
      ctx.fillText(label, 140, y);
      ctx.fillStyle = "#1e2430";
      ctx.font = "bold 28px Arial";
      ctx.fillText(String(value), 140, y + 35);
      ctx.strokeStyle = "#e8edf5";
      ctx.beginPath();
      ctx.moveTo(140, y + 54);
      ctx.lineTo(940, y + 54);
      ctx.stroke();
    });

    return canvas;
  };

  const canvasToBlob = (canvas) => new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));

  const handleDownloadDepositReceipt = async () => {
    if (!depositReceiptData) return;
    try {
      const canvas = buildDepositReceiptCanvas();
      if (!canvas) return;
      const blob = await canvasToBlob(canvas);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Deposit_Receipt_${depositReceiptData.referenceNumber || Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error("Deposit receipt save failed:", downloadError);
    }
  };

  const handleShareDepositReceipt = async () => {
    if (!depositReceiptData) return;
    try {
      const canvas = buildDepositReceiptCanvas();
      if (!canvas) return;
      const blob = await canvasToBlob(canvas);
      if (!blob) return;
      const file = new File([blob], `Deposit_Receipt_${depositReceiptData.referenceNumber || Date.now()}.png`, { type: "image/png" });
      const shareText = `Deposit receipt\nReference: ${depositReceiptData.referenceNumber}\nPartner: ${depositReceiptData.partnerName}\nAmount: ₱${Number(depositReceiptData.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "Deposit Receipt", text: shareText, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: "Deposit Receipt", text: shareText });
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        console.error("Deposit receipt share failed:", shareError);
      }
    }
  };

  const handleSubmitCashIn = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!receiptFile) {
      setError("Please upload your receipt before depositing.");
      return;
    }
    if (scanningReceipt) {
      setError("Please wait for the AI receipt scan to finish.");
      return;
    }
    if (!receiptScanValid || !receiptReference?.trim()) {
      setError("Invalid receipt upload. The receipt must clearly show both the amount and reference number before you can deposit.");
      return;
    }
    if (!auth.currentUser) {
      setError("Session expired. Please log in again.");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      const receiptRef = ref(
        storage,
        `receipts/${auth.currentUser.uid}/${Date.now()}_${receiptFile.name}`
      );
      await uploadBytes(receiptRef, receiptFile);
      const receiptUrl = await getDownloadURL(receiptRef);

      const fallbackReference = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const depositReference = receiptReference || fallbackReference;
      const resolvedQrName = detectedReceiptPartner || selectedPartner?.name || "Cash In Partner";

      const docRef = await addDoc(collection(db, "deposits"), {
        userId: auth.currentUser.uid,
        name: auth.currentUser.displayName || auth.currentUser.email || "Member",
        email: auth.currentUser.email || "",
        amount: Number(amount),
        status: "Pending",
        type: "Cash In Request",
        paymentMethod: selectedPartner.methodType === "bank" ? "Local Banks" : "E-Wallet",
        partner: selectedPartner.name,
        referenceNumber: depositReference,
        qrName: resolvedQrName,
        receiptUrl,
        receiptName: receiptFile.name,
        source: "manual",
        createdAt: serverTimestamp(),
      });

      setDepositReceiptData({
        amount: Number(amount),
        partnerName: selectedPartner?.name || "Cash In Partner",
        qrName: resolvedQrName,
        referenceNumber: depositReference,
        receiptName: receiptFile?.name || "Receipt",
        date: new Date(),
        requestId: docRef.id,
        status: "PENDING REVIEW",
      });
      setSuccess(true);
      setScanStatus("Deposit submitted successfully.");
    } catch (err) {
      setError(err.message || "Failed to submit request.");
    } finally {
      setProcessing(false);
    }
  };

  const headerTitle = screen === "banks" ? "Local Banks" : screen === "ewallet" ? "E-Wallet" : "Cash In";
  const isDepositReady = Boolean(
    receiptFile &&
    !scanningReceipt &&
    receiptScanValid &&
    receiptReference?.trim() &&
    amount &&
    Number(amount) > 0
  );
  const filteredWallets = EWALLET_OPTIONS.filter((wallet) => {
    const term = ewalletSearch.trim().toLowerCase();
    if (!term) return true;
    return `${wallet.name} ${wallet.subtitle}`.toLowerCase().includes(term);
  });
  const popularWallets = filteredWallets.filter((wallet) => wallet.popular);
  const groupedWallets = EWALLET_GROUPS.map((group) => ({
    group,
    items: filteredWallets.filter((wallet) => wallet.group === group),
  })).filter((section) => section.items.length > 0);
  const visibleDepositLogs = depositLogs.filter((log) => {
    const paymentMethod = String(log.paymentMethod || "").toLowerCase();
    const type = String(log.type || "").toLowerCase();
    const source = String(log.source || "").toLowerCase();

    return (
      paymentMethod === "local banks" ||
      paymentMethod === "e-wallet" ||
      type.includes("cash in") ||
      source === "manual"
    );
  });
  const resolveCashInPartner = (name) => {
    const normalized = String(name || "").trim().toLowerCase();
    return (
      INSTAPAY_BANKS.find((bank) => bank.name.toLowerCase() === normalized) ||
      EWALLET_OPTIONS.find((wallet) => wallet.name.toLowerCase() === normalized) ||
      null
    );
  };

  const handleShowAllWallets = () => {
    setEwalletSearch("");
    requestAnimationFrame(() => {
      allWalletsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const renderWalletBadge = (wallet, size = 48) => (
    <Avatar
      src={wallet.logo || undefined}
      alt={wallet.name}
      sx={{
        width: size,
        height: size,
        bgcolor: wallet.bg,
        color: wallet.color,
        border: wallet.border || "none",
        fontWeight: 800,
        boxShadow: size > 44 ? "0 8px 18px rgba(15,23,42,0.12)" : "none",
        overflow: "hidden",
        p: wallet.logo ? 0.28 : 0,
        "& .MuiAvatar-img": {
          objectFit: "contain",
          transform: "none",
        },
      }}
    >
      {!wallet.logo ? (
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: wallet.badgeFontSize || (size > 44 ? 11 : 13),
            lineHeight: 1,
            letterSpacing: -0.2,
          }}
        >
          {wallet.shortLabel}
        </Typography>
      ) : null}
    </Avatar>
  );

  const AppHeader = () => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 1,
        pt: memberStickyHeaderInset,
        pb: 1.2,
        background: memberHeroBackground,
        borderBottom: "1px solid rgba(217,233,255,0.2)",
        color: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      <IconButton onClick={handleBack} sx={{ color: "#fff" }}>
        <ArrowBackIosNewIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ flex: 1, fontSize: 17, fontWeight: 800 }}>{headerTitle}</Typography>
      <IconButton onClick={() => setCashInInfoOpen(true)} sx={{ color: "#fff" }}>
        <HelpOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  const CashInInfoDialog = () => (
    <Drawer
      anchor="right"
      open={cashInInfoOpen}
      onClose={() => setCashInInfoOpen(false)}
      ModalProps={{ keepMounted: true }}
      SlideProps={{ appear: true }}
      transitionDuration={{ enter: 360, exit: 260 }}
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
          <IconButton onClick={() => setCashInInfoOpen(false)} sx={{ color: "#fff" }}>
            <ArrowBackIosNewIcon />
          </IconButton>
          <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>
            Cash In Guide
          </Typography>
          <Box sx={{ width: 40 }} />
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "grid", gap: 1.3 }}>
          {[
            {
              title: "Choose Your Partner",
              desc: "Use Local Banks InstaPay or GoTyme Bank to start a secure cash-in request.",
            },
            {
              title: "Auto Receipt Scan",
              desc: "After you upload the receipt image, the system attempts to read the amount, reference number, and QR partner automatically.",
            },
            {
              title: "Pending Review",
              desc: "Submitted deposits are reviewed within around 1 hour before the balance is credited.",
            },
            {
              title: "Receipt Tools",
              desc: "Once submitted, you can save or share the deposit receipt for your records.",
            },
          ].map((item) => (
            <Box
              key={item.title}
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
            onClick={() => setCashInInfoOpen(false)}
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
  );

  const CashInHistoryDrawer = () => (
    <Drawer
      anchor="right"
      open={cashInHistoryOpen}
      onClose={() => setCashInHistoryOpen(false)}
      ModalProps={{ keepMounted: true }}
      SlideProps={{ appear: true }}
      transitionDuration={{ enter: 360, exit: 260 }}
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
          <IconButton onClick={() => setCashInHistoryOpen(false)} sx={{ color: "#fff" }}>
            <ArrowBackIosNewIcon />
          </IconButton>
          <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>
            All Cash In Records
          </Typography>
          <Box sx={{ width: 40 }} />
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "grid", gap: 1 }}>
          {visibleDepositLogs.length === 0 ? (
            <Box sx={{ p: 2, borderRadius: 2.4, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(138,199,255,0.12)" }}>
              <Typography sx={{ fontSize: 12.5, color: "rgba(220,232,255,0.76)" }}>
                No cash in records yet.
              </Typography>
            </Box>
          ) : (
            visibleDepositLogs.map((log) => {
              const sc = statusColor(log.status);
              const partner = resolveCashInPartner(log.partner || log.paymentMethod);
              const initial = (log.partner || log.paymentMethod || "C").charAt(0).toUpperCase();

              return (
                <Box
                  key={log.id}
                  sx={{
                    p: 1.2,
                    borderRadius: 2.4,
                    background: "linear-gradient(145deg, rgba(8,23,52,0.94) 0%, rgba(15,42,99,0.90) 100%)",
                    border: "1px solid rgba(138,199,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Avatar
                    src={partner?.logo || undefined}
                    alt={log.partner || log.paymentMethod || "Cash In"}
                    sx={{
                      width: 42,
                      height: 42,
                      backgroundColor: partner?.logo ? "#ffffff" : "rgba(255,255,255,0.12)",
                      color: "#fff",
                      p: partner?.logo ? 0.32 : 0,
                      "& .MuiAvatar-img": { objectFit: "contain" },
                    }}
                  >
                    {!partner?.logo ? initial : null}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#f8fbff" }}>
                      {log.partner || log.paymentMethod || "Cash In"}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "rgba(220,232,255,0.72)" }}>
                      {formatDate(log.createdAt)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#fff" }}>
                      ₱{Number(log.amount || 0).toLocaleString("en-PH")}
                    </Typography>
                    <Chip
                      label={(log.status || "PENDING").toUpperCase()}
                      size="small"
                      sx={{
                        mt: 0.4,
                        height: 18,
                        backgroundColor: sc.bg,
                        color: sc.color,
                        fontWeight: 800,
                        fontSize: 10,
                        "& .MuiChip-label": { px: 0.8 },
                      }}
                    />
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </Drawer>
  );

  const AmountDialog = () => (
    <Dialog
      open={!!selectedPartner}
      onClose={handleCloseDialog}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          background: "linear-gradient(150deg, rgba(8,26,62,0.96) 0%, rgba(13,44,102,0.92) 100%)",
          border: "1px solid rgba(217,233,255,0.22)",
          borderRadius: 3,
          color: "#fff",
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 800, color: "#fff", pb: 0.5 }}>
        Cash In
      </DialogTitle>
      <DialogContent>
        {success && depositReceiptData ? (
          <Box sx={{ pt: 1 }}>
            <Box sx={{ textAlign: "center", mb: 2.2 }}>
              <Box sx={{ width: 60, height: 60, mx: "auto", mb: 1.1, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0f57d5", boxShadow: "0 14px 28px rgba(15,87,213,0.24)" }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 34, color: "#fff" }} />
              </Box>
              <Typography sx={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>
                Deposit Submitted!
              </Typography>
              <Typography sx={{ fontSize: 12, color: "rgba(220,232,255,0.76)", mt: 0.4 }}>
                Your cash-in request is now pending review.
              </Typography>
            </Box>

            <Box sx={{ background: "#fff", borderRadius: 2.8, p: 1.8, mb: 2, border: "1px solid #dbe2ef", boxShadow: "0 14px 26px rgba(6,18,45,0.10)" }}>
              <Typography sx={{ textAlign: "center", fontSize: 10.5, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>
                TOTAL AMOUNT
              </Typography>
              <Typography sx={{ textAlign: "center", fontSize: 33, fontWeight: 900, color: "#105abf", mb: 1.4 }}>
                ₱{Number(depositReceiptData.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </Typography>

              <Box sx={{ background: "#f4f6fa", borderRadius: 2.2, p: 1.2, mb: 1.4, display: "flex", alignItems: "center", gap: 1 }}>
                {renderWalletBadge({
                  name: depositReceiptData.partnerName,
                  logo: resolveCashInPartner(depositReceiptData.partnerName)?.logo,
                  bg: resolveCashInPartner(depositReceiptData.partnerName)?.bg || "#12284c",
                  color: resolveCashInPartner(depositReceiptData.partnerName)?.color || "#fff",
                  border: resolveCashInPartner(depositReceiptData.partnerName)?.border,
                  shortLabel: depositReceiptData.partnerName?.charAt(0) || "C",
                }, 42)}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 10, color: "#7a8392", fontWeight: 800, letterSpacing: 0.8 }}>
                    CASH IN PARTNER
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#223047", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {depositReceiptData.partnerName}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: "#6f7f9b" }}>
                    {depositReceiptData.qrName || depositReceiptData.partnerName}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "grid", gap: 0.7 }}>
                {[
                  ["Reference Number", depositReceiptData.referenceNumber],
                  ["Request ID", depositReceiptData.requestId],
                  ["Receipt File", depositReceiptData.receiptName],
                  ["Status", depositReceiptData.status],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                    <Typography sx={{ fontSize: 12, color: "#6b7484" }}>{label}</Typography>
                    <Typography sx={{ fontSize: 12, color: "#223047", fontWeight: 700, textAlign: "right" }}>{value}</Typography>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 1.1, borderColor: "#e4e8f0" }} />
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                <Button
                  onClick={handleDownloadDepositReceipt}
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  sx={{ textTransform: "none", borderRadius: 2, fontWeight: 800 }}
                >
                  Save
                </Button>
                <Button
                  onClick={handleShareDepositReceipt}
                  variant="contained"
                  startIcon={<ShareIcon />}
                  sx={{ textTransform: "none", borderRadius: 2, fontWeight: 800, bgcolor: "#105abf", "&:hover": { bgcolor: "#0b4eaa" } }}
                >
                  Share
                </Button>
              </Box>
            </Box>
          </Box>
        ) : (
          <>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
              {selectedPartner?.methodType === "bank" || selectedPartner?.qr ? (
                <Box sx={{ width: 220, maxWidth: "100%" }}>
                  {selectedPartner?.methodType === "ewallet" && selectedPartner ? (
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 1 }}>
                      {renderWalletBadge(selectedPartner, 42)}
                      <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>
                        {selectedPartner.name}
                      </Typography>
                    </Box>
                  ) : null}
                  <Box
                    component="img"
                    src={selectedPartner?.methodType === "bank" ? bpiQr : selectedPartner?.qr}
                    alt={`${selectedPartner?.name || "Wallet"} QR code`}
                    sx={{
                      width: 220,
                      maxWidth: "100%",
                      borderRadius: 2,
                      border: "1px solid rgba(217,233,255,0.28)",
                      backgroundColor: "#fff",
                      objectFit: "contain",
                    }}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    width: 220,
                    maxWidth: "100%",
                    borderRadius: 2.5,
                    border: "1px solid rgba(217,233,255,0.18)",
                    background: "linear-gradient(135deg, rgba(7,22,52,0.88) 0%, rgba(16,59,138,0.72) 100%)",
                    p: 2.2,
                    textAlign: "center",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
                    {selectedPartner ? renderWalletBadge(selectedPartner, 62) : null}
                  </Box>
                  <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>
                    {selectedPartner?.name || "E-Wallet"}
                  </Typography>
                  <Typography sx={{ color: memberPalette.softText, fontSize: 12, mt: 0.6, lineHeight: 1.5 }}>
                    Use this wallet to complete your cash-in, then upload the receipt below for verification.
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography sx={{ color: "#fff", fontSize: 13, fontWeight: 700, mb: 0.75 }}>
              Send to {selectedPartner?.name || "BPI"}
            </Typography>
            <Typography sx={{ color: memberPalette.softText, fontSize: 12.5, mb: 2, mt: 0.5 }}>
              {selectedPartner?.methodType === "bank"
                ? "Scan the QR code, send your payment, then enter the amount and upload the receipt."
                : `Open ${selectedPartner?.name || "your e-wallet"}, complete the payment, then submit the receipt for review.`}
            </Typography>
            <Box sx={{ mt: 0.4 }}>
              <Typography sx={{ fontSize: 13, color: "#fff", fontWeight: 700, mb: 1 }}>
                1. Upload Receipt First
              </Typography>
              <Button
                component="label"
                variant="outlined"
                fullWidth
                sx={{ textTransform: "none", borderRadius: 2, borderColor: "rgba(217,233,255,0.42)", color: memberPalette.cloud }}
              >
                {receiptFile ? receiptFile.name : "Choose receipt image"}
                <input hidden type="file" accept="image/*" onChange={handleReceiptChange} />
              </Button>
              {(scanStatus || receiptReference || detectedReceiptPartner || scanningReceipt) && (
                <Box
                  sx={{
                    mt: 1.2,
                    p: 1.25,
                    borderRadius: 2.2,
                    background: scanningReceipt
                      ? "linear-gradient(145deg, rgba(7,26,61,0.96) 0%, rgba(13,47,118,0.92) 100%)"
                      : "rgba(255,255,255,0.06)",
                    border: scanningReceipt
                      ? "1px solid rgba(138,199,255,0.34)"
                      : "1px solid rgba(217,233,255,0.14)",
                    boxShadow: scanningReceipt ? "0 12px 28px rgba(7,25,67,0.24)" : "none",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.9 }}>
                    {scanningReceipt ? (
                      <CircularProgress size={18} thickness={5} sx={{ color: "#8ac7ff" }} />
                    ) : (
                      <CheckCircleOutlineIcon sx={{ fontSize: 18, color: "#8ac7ff" }} />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 11, color: "#8ac7ff", fontWeight: 800 }}>
                        {scanningReceipt ? "AI SCANNING IN PROGRESS" : "AUTO SCAN RESULT"}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: memberPalette.softText, lineHeight: 1.45 }}>
                        {scanningReceipt
                          ? "Please wait while the system reads the receipt image and extracts the payment details."
                          : "Receipt image analyzed. Review the detected fields below."}
                      </Typography>
                    </Box>
                    {scanProgress > 0 ? (
                      <Chip
                        label={`${Math.max(scanProgress, 5)}%`}
                        size="small"
                        sx={{
                          height: 22,
                          backgroundColor: "rgba(138,199,255,0.16)",
                          color: "#d9e9ff",
                          fontWeight: 800,
                          "& .MuiChip-label": { px: 0.9 },
                        }}
                      />
                    ) : null}
                  </Box>

                  {scanStatus ? (
                    <Typography sx={{ fontSize: 11.5, color: memberPalette.softText, mb: 0.9 }}>
                      {scanStatus}
                    </Typography>
                  ) : null}

                  {(scanningReceipt || scanProgress > 0) && (
                    <Box
                      sx={{
                        height: 6,
                        borderRadius: 999,
                        overflow: "hidden",
                        backgroundColor: "rgba(217,233,255,0.12)",
                        mb: scanningReceipt ? 1 : 0.9,
                      }}
                    >
                      <Box
                        sx={{
                          height: "100%",
                          width: `${scanningReceipt ? Math.max(scanProgress, 10) : 100}%`,
                          background: "linear-gradient(90deg, #5fa8ff 0%, #8ac7ff 55%, #d9e9ff 100%)",
                          transition: "width 180ms ease",
                        }}
                      />
                    </Box>
                  )}

                  {scanningReceipt && (
                    <Box sx={{ display: "grid", gap: 0.45, mb: 0.9 }}>
                      {[
                        { label: "Image loaded", done: scanProgress >= 10 },
                        { label: "QR / wallet check", done: scanProgress >= 28 },
                        { label: "Amount & reference extraction", done: scanProgress >= 60 },
                      ].map((step) => (
                        <Typography key={step.label} sx={{ fontSize: 11.2, color: step.done ? "#d9e9ff" : "rgba(217,233,255,0.68)" }}>
                          {step.done ? "✓" : "•"} {step.label}
                        </Typography>
                      ))}
                    </Box>
                  )}

                  <Box sx={{ display: "grid", gap: 0.45 }}>
                    <Typography sx={{ fontSize: 11.5, color: "#fff" }}>
                      Amount: <Box component="span" sx={{ color: "#8ac7ff", fontWeight: 700 }}>{amount || (scanningReceipt ? "Detecting..." : "-")}</Box>
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: "#fff" }}>
                      Reference No: <Box component="span" sx={{ color: "#8ac7ff", fontWeight: 700 }}>{receiptReference || (scanningReceipt ? "Detecting..." : "-")}</Box>
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: "#fff" }}>
                      QR / Wallet Name: <Box component="span" sx={{ color: "#8ac7ff", fontWeight: 700 }}>{detectedReceiptPartner || selectedPartner?.name || (scanningReceipt ? "Detecting..." : "-")}</Box>
                    </Typography>
                  </Box>
                </Box>
              )}
              {receiptPreviewUrl && (
                <Box
                  sx={{
                    mt: 1.25,
                    position: "relative",
                    width: "100%",
                    height: 220,
                    maxHeight: 220,
                    overflow: "hidden",
                    borderRadius: 2,
                    border: "1px solid rgba(217,233,255,0.28)",
                    backgroundColor: "rgba(6,20,52,0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Box
                    component="img"
                    src={receiptPreviewUrl}
                    alt="Receipt preview"
                    sx={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />

                  {scanningReceipt && (
                    <>
                      <Box
                        sx={{
                          position: "absolute",
                          inset: 0,
                          background: "linear-gradient(180deg, rgba(28,255,190,0.03) 0%, rgba(28,255,190,0.10) 50%, rgba(28,255,190,0.03) 100%)",
                          animation: `${receiptScanGlow} 1.35s ease-in-out infinite`,
                          pointerEvents: "none",
                          willChange: "opacity",
                          transform: "translateZ(0)",
                        }}
                      />
                      <Box
                        sx={{
                          position: "absolute",
                          top: 10,
                          right: 10,
                          px: 1,
                          py: 0.45,
                          borderRadius: 99,
                          fontSize: 10.5,
                          fontWeight: 800,
                          letterSpacing: 0.3,
                          color: "#d7fff3",
                          backgroundColor: "rgba(7,26,61,0.72)",
                          border: "1px solid rgba(75,255,206,0.32)",
                          boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
                          transform: "translateZ(0)",
                        }}
                      >
                        AI SCANNING
                      </Box>
                      <Box
                        sx={{
                          position: "absolute",
                          left: 8,
                          right: 8,
                          top: 16,
                          bottom: 16,
                          pointerEvents: "none",
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: 0,
                            height: 3,
                            borderRadius: 999,
                            background: "linear-gradient(90deg, rgba(67,243,196,0) 0%, rgba(67,243,196,0.95) 18%, #c5fff1 50%, rgba(67,243,196,0.95) 82%, rgba(67,243,196,0) 100%)",
                            boxShadow: "0 0 18px rgba(67,243,196,0.85)",
                            animation: `${receiptScanSweep} 2.15s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate`,
                            willChange: "top, opacity",
                            transform: "translateZ(0)",
                            backfaceVisibility: "hidden",
                          }}
                        />
                      </Box>
                      <Box
                        sx={{
                          position: "absolute",
                          left: 8,
                          top: "18%",
                          bottom: "18%",
                          width: 16,
                          borderLeft: "2px solid rgba(67,243,196,0.9)",
                          borderTop: "2px solid rgba(67,243,196,0.9)",
                          borderBottom: "2px solid rgba(67,243,196,0.9)",
                          borderRadius: "10px 0 0 10px",
                          opacity: 0.8,
                          transform: "translateZ(0)",
                        }}
                      />
                      <Box
                        sx={{
                          position: "absolute",
                          right: 8,
                          top: "18%",
                          bottom: "18%",
                          width: 16,
                          borderRight: "2px solid rgba(67,243,196,0.9)",
                          borderTop: "2px solid rgba(67,243,196,0.9)",
                          borderBottom: "2px solid rgba(67,243,196,0.9)",
                          borderRadius: "0 10px 10px 0",
                          opacity: 0.8,
                          transform: "translateZ(0)",
                        }}
                      />
                    </>
                  )}
                </Box>
              )}
              {!scanningReceipt && receiptFile && !receiptScanValid && (
                <Alert
                  severity="warning"
                  sx={{
                    mt: 1.1,
                    borderRadius: 2,
                    backgroundColor: "rgba(255,193,7,0.12)",
                    color: "#fff3cd",
                    border: "1px solid rgba(255,193,7,0.22)",
                    "& .MuiAlert-icon": { color: "#ffd54f" },
                  }}
                >
                  Invalid receipt upload. The image must clearly show the amount and reference number.
                </Alert>
              )}
              <Typography sx={{ mt: 0.8, color: memberPalette.softText, fontSize: 12 }}>
                Receipt upload is required before the amount field is enabled, and the receipt must clearly show the amount and reference number.
              </Typography>
            </Box>

            <TextField
              fullWidth
              autoFocus={!!receiptFile}
              type="number"
              label="2. Amount (PHP)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onWheel={(e) => e.target.blur()}
              inputProps={{ min: 1 }}
              disabled={!receiptFile}
              helperText={
                receiptFile
                  ? "Review or edit the scanned amount before submitting."
                  : "Upload the receipt first to enable the amount field."
              }
              sx={{
                mt: 2,
                "& input[type=number]": {
                  MozAppearance: "textfield",
                },
                "& input[type=number]::-webkit-outer-spin-button": {
                  WebkitAppearance: "none",
                  margin: 0,
                },
                "& input[type=number]::-webkit-inner-spin-button": {
                  WebkitAppearance: "none",
                  margin: 0,
                },
                "& .MuiInputLabel-root": { color: "rgba(217,233,255,0.72)" },
                "& .MuiFormHelperText-root": { color: receiptFile ? "#8ac7ff" : "rgba(217,233,255,0.72)" },
                "& .MuiOutlinedInput-root": {
                  color: "#fff",
                  backgroundColor: receiptFile ? "rgba(6,20,52,0.42)" : "rgba(255,255,255,0.06)",
                  "& fieldset": { borderColor: "rgba(217,233,255,0.28)" },
                  "&:hover fieldset": { borderColor: "rgba(217,233,255,0.52)" },
                  "&.Mui-focused fieldset": { borderColor: memberPalette.cloud },
                },
              }}
            />
            {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, borderTop: "1px solid rgba(217,233,255,0.14)" }}>
        <Button onClick={handleCloseDialog} sx={{ textTransform: "none", color: memberPalette.cloud }}>
          {success ? "Close" : "Cancel"}
        </Button>
        {!success && (
          <Button
            variant="contained"
            onClick={handleSubmitCashIn}
            disabled={processing || !isDepositReady}
            sx={{
              textTransform: "none",
              fontWeight: 800,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${memberPalette.azure}, ${memberPalette.royal})`,
              "&:hover": { background: "linear-gradient(135deg, #3b8cf2, #1a5fc5)" },
            }}
          >
            {processing ? (
              <><CircularProgress size={16} sx={{ color: "#fff", mr: 1 }} />Submitting...</>
            ) : scanningReceipt ? (
              <><CircularProgress size={16} sx={{ color: "#fff", mr: 1 }} />AI Scanning...</>
            ) : (
              "Deposit"
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

  // ── BANKS SCREEN ──────────────────────────────────────────────────────────
  if (screen === "banks") {
    return (
      <Box sx={{ minHeight: "100vh", background: memberShellBackground }}>
        <Box sx={{ maxWidth: 460, mx: "auto", pb: 6 }}>
          <AppHeader />

          {/* Tabs */}
          <Box sx={{ ...memberGlassPanelSx, borderRadius: 0, borderBottom: "1px solid rgba(217,233,255,0.15)" }}>
            <Tabs
              value={bankTab}
              onChange={(_, v) => setBankTab(v)}
              sx={{
                px: 1,
                "& .MuiTabs-indicator": { backgroundColor: memberPalette.cloud, height: 3 },
                "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13, color: "rgba(217,233,255,0.62)", minWidth: 0, px: 2 },
                "& .Mui-selected": { color: "#fff", fontWeight: 800 },
              }}
            >
              <Tab label="Over-the-Counter" />
              <Tab label="Local Banks" />
              <Tab label="Global" />
            </Tabs>
          </Box>

          {bankTab === 1 && (
            <Box>
              {/* InstaPay Cash In */}
              <Box sx={{ px: 2, mt: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 800, color: "#fff", fontSize: 14.5 }}>InstaPay Cash In</Typography>
                  <Chip
                    label="FAST"
                    size="small"
                    sx={{ backgroundColor: "rgba(171,235,196,0.2)", color: "#abebc4", fontWeight: 800, fontSize: 10.5, height: 20 }}
                  />
                </Box>
                <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 1 }}>
                  {INSTAPAY_BANKS.map((bank) => (
                    <Box
                      key={bank.id}
                      onClick={() => openPartnerDialog(bank, "bank")}
                      sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.7, cursor: "pointer", minWidth: 58 }}
                    >
                      <Avatar
                        src={bank.logo}
                        alt={bank.name}
                        sx={{
                          width: 52,
                          height: 52,
                          backgroundColor: "#ffffff",
                          border: "1px solid rgba(217,233,255,0.2)",
                          boxShadow: "0 6px 14px rgba(3,12,30,0.35)",
                          p: 0.35,
                          "& .MuiAvatar-img": {
                            objectFit: "contain",
                            transform: "none",
                          },
                        }}
                      />
                      <Typography sx={{ fontSize: 11, color: memberPalette.cloud, fontWeight: 600, textAlign: "center" }}>
                        {bank.name}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}

          {bankTab !== 1 && (
            <Box sx={{ p: 5, textAlign: "center" }}>
              <Typography sx={{ color: memberPalette.softText, fontSize: 14 }}>Coming soon.</Typography>
            </Box>
          )}
        </Box>
        <CashInInfoDialog />
        <AmountDialog />
      </Box>
    );
  }

  // ── EWALLET SCREEN ────────────────────────────────────────────────────────
  if (screen === "ewallet") {
    return (
      <Box sx={{ minHeight: "100vh", background: memberShellBackground }}>
        <Box sx={{ maxWidth: 460, mx: "auto", pb: 4 }}>
          <AppHeader />

          <Box sx={{ px: 2, pt: 2.2 }}>
            <Box
              sx={{
                ...memberGlassPanelSx,
                borderRadius: 3,
                p: 1,
                mb: 2,
                border: "1px solid rgba(217,233,255,0.14)",
              }}
            >
              <TextField
                fullWidth
                placeholder="Search e-wallets..."
                value={ewalletSearch}
                onChange={(e) => setEwalletSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon sx={{ color: "rgba(217,233,255,0.72)", fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    color: "#ffffff",
                    "& fieldset": { borderColor: "rgba(217,233,255,0.14)" },
                  },
                  "& .MuiInputBase-input::placeholder": { color: "rgba(217,233,255,0.62)", opacity: 1 },
                }}
              />
            </Box>

            <Box
              sx={{
                borderRadius: 3,
                p: 1.6,
                mb: 2,
                background: "linear-gradient(145deg, rgba(8,23,52,0.94) 0%, rgba(15,42,99,0.90) 100%)",
                border: "1px solid rgba(138,199,255,0.12)",
                boxShadow: "0 12px 22px rgba(2,10,24,0.18)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.2 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#f8fbff" }}>Popular E-Wallets</Typography>
                <Typography
                  onClick={handleShowAllWallets}
                  sx={{ fontSize: 11.5, color: "#8ac7ff", fontWeight: 700, cursor: "pointer" }}
                >
                  See All
                </Typography>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.3 }}>
                {popularWallets.map((wallet) => (
                  <Box
                    key={wallet.id}
                    onClick={() => handleWalletSelect(wallet)}
                    sx={{
                      borderRadius: 2.6,
                      p: 1.5,
                      minHeight: 116,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                      background: wallet.available
                        ? "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(245,248,255,0.98) 100%)"
                        : "linear-gradient(145deg, rgba(12,28,61,0.82) 0%, rgba(16,39,85,0.78) 100%)",
                      border: wallet.available ? "1px solid rgba(138,199,255,0.16)" : "1px solid rgba(138,199,255,0.10)",
                      boxShadow: "0 8px 18px rgba(2,10,24,0.16)",
                      cursor: "pointer",
                    }}
                  >
                    {renderWalletBadge(wallet, 46)}
                    <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: wallet.available ? "#111827" : "#f8fbff" }}>
                      {wallet.name}
                    </Typography>
                    {!wallet.available ? (
                      <Typography sx={{ fontSize: 10, color: "rgba(220,232,255,0.68)", fontWeight: 700 }}>
                        COMING SOON
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Box>
            </Box>

            <Box
              ref={allWalletsRef}
              sx={{
                borderRadius: 3,
                p: 1.6,
                mb: 2,
                background: "linear-gradient(145deg, rgba(8,23,52,0.94) 0%, rgba(15,42,99,0.90) 100%)",
                border: "1px solid rgba(138,199,255,0.12)",
                boxShadow: "0 12px 22px rgba(2,10,24,0.18)",
              }}
            >
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#f8fbff", mb: 1.2 }}>All E-Wallets</Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.3 }}>
                {groupedWallets.map((section) => (
                  <Box key={section.group}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#8ac7ff", mb: 0.8 }}>{section.group}</Typography>
                    <Box sx={{ backgroundColor: "rgba(255,255,255,0.98)", borderRadius: 2.5, overflow: "hidden", boxShadow: "0 4px 14px rgba(15,23,42,0.05)" }}>
                      {section.items.map((wallet, index) => (
                        <Box
                          key={wallet.id}
                          onClick={() => handleWalletSelect(wallet)}
                          sx={{
                            px: 1.5,
                            py: 1.25,
                            display: "flex",
                            alignItems: "center",
                            gap: 1.1,
                            cursor: "pointer",
                            borderBottom: index === section.items.length - 1 ? "none" : "1px solid #eef2f7",
                          }}
                        >
                          {renderWalletBadge(wallet, 34)}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>{wallet.name}</Typography>
                            <Typography sx={{ fontSize: 10.5, color: "#667085" }}>
                              {wallet.available ? wallet.subtitle : `${wallet.subtitle} • Coming soon`}
                            </Typography>
                          </Box>
                          <ChevronRightIcon sx={{ color: "#98a2b3", fontSize: 18 }} />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box
              sx={{
                borderRadius: 3,
                p: 1.8,
                background: "linear-gradient(145deg, rgba(11,31,94,0.96) 0%, rgba(18,56,135,0.90) 62%, rgba(45,110,225,0.82) 100%)",
                border: "1px solid rgba(138,199,255,0.14)",
                boxShadow: "0 12px 26px rgba(19,88,216,0.22)",
                color: "#fff",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.3 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 0.45 }}>Need another wallet?</Typography>
                  <Typography sx={{ fontSize: 11.5, opacity: 0.92, lineHeight: 1.5, mb: 1.3 }}>
                    For now, cash in with GoTyme Bank or use Local Banks InstaPay while more wallets are being added.
                  </Typography>
                  <Button
                    onClick={() => {
                      setUnavailableWalletName("");
                      setMethodUnavailableOpen(true);
                    }}
                    sx={{
                      textTransform: "none",
                      borderRadius: 1.8,
                      backgroundColor: "#ffffff",
                      color: "#0f4ea8",
                      fontWeight: 800,
                      px: 1.8,
                      py: 0.7,
                      "&:hover": { backgroundColor: "#eef4ff" },
                    }}
                  >
                    Request Support
                  </Button>
                </Box>
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 2,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    p: 0.8,
                  }}
                >
                  <Box component="img" src={gotymeLogo} alt="GoTyme" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        <Dialog
          open={methodUnavailableOpen}
          onClose={() => {
            setMethodUnavailableOpen(false);
            setUnavailableWalletName("");
          }}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              background: "linear-gradient(150deg, rgba(8,26,62,0.96) 0%, rgba(13,44,102,0.92) 100%)",
              border: "1px solid rgba(217,233,255,0.22)",
              borderRadius: 3,
            },
          }}
        >
          <DialogTitle sx={{ fontWeight: 800, color: "#fff" }}>
            {unavailableWalletName ? "Coming Soon" : "Request Support"}
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ color: memberPalette.softText, fontSize: 14 }}>
              {unavailableWalletName
                ? `${unavailableWalletName} cash in is coming soon. For now, please use GoTyme Bank or Local Banks InstaPay.`
                : "More e-wallet partners are being added soon. Please contact support if your preferred wallet is not listed yet."}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, borderTop: "1px solid rgba(217,233,255,0.14)" }}>
            <Button
              onClick={() => {
                setMethodUnavailableOpen(false);
                setUnavailableWalletName("");
              }}
              sx={{ textTransform: "none", fontWeight: 700, color: memberPalette.cloud }}
            >
              OK
            </Button>
          </DialogActions>
        </Dialog>

        <CashInInfoDialog />
        <AmountDialog />
      </Box>
    );
  }

  // ── MAIN SCREEN ───────────────────────────────────────────────────────────
  return (
    <Box sx={{ minHeight: "100vh", background: memberShellBackground }}>
      <Box sx={{ maxWidth: 460, mx: "auto", pb: 6 }}>
        <AppHeader />

        <Box sx={{ px: 2, pt: 2.5 }}>
          {/* How to Cash In */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.4 }}>
            <Typography sx={{ fontSize: 15.5, fontWeight: 800, color: "#fff" }}>How to Cash In</Typography>
            <Chip
              label="1 HOUR"
              size="small"
              sx={{ backgroundColor: "rgba(255,218,145,0.2)", color: "#ffd483", fontWeight: 800, fontSize: 10.5, height: 22 }}
            />
          </Box>

          <Box sx={{ ...memberGlassPanelSx, borderRadius: 2.5, overflow: "hidden" }}>
            {METHOD_ITEMS.map((item, idx) => (
              <Box
                key={item.id}
                onClick={() => setScreen(item.screen)}
                sx={{
                  px: 2,
                  py: 1.8,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  cursor: "pointer",
                  borderBottom: idx === METHOD_ITEMS.length - 1 ? "none" : "1px solid rgba(217,233,255,0.14)",
                  "&:hover": { backgroundColor: "rgba(18,56,118,0.42)" },
                }}
              >
                <Avatar sx={{ width: 44, height: 44, backgroundColor: "rgba(8,26,62,0.7)", border: "1px solid rgba(217,233,255,0.2)" }}>{item.icon}</Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, color: "#fff", fontSize: 14.5 }}>{item.title}</Typography>
                  <Typography sx={{ color: memberPalette.softText, fontSize: 12.5 }}>{item.subtitle}</Typography>
                </Box>
                <ChevronRightIcon sx={{ color: "rgba(217,233,255,0.68)" }} />
              </Box>
            ))}
          </Box>

          {/* Recent Cash In */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 3, mb: 1.4 }}>
            <Typography sx={{ fontSize: 15.5, fontWeight: 800, color: "#fff" }}>Recent Cash In</Typography>
            <Typography
              onClick={() => setCashInHistoryOpen(true)}
              sx={{ fontSize: 12.5, color: memberPalette.cloud, fontWeight: 700, cursor: "pointer" }}
            >
              See All
            </Typography>
          </Box>

          {visibleDepositLogs.length === 0 ? (
            <Box sx={{ ...memberGlassPanelSx, borderRadius: 2.5, p: 3, textAlign: "center" }}>
              <Typography sx={{ color: memberPalette.softText, fontSize: 13 }}>No cash in records yet.</Typography>
            </Box>
          ) : (
            <Box sx={{ ...memberGlassPanelSx, borderRadius: 2.5, overflow: "hidden" }}>
              {visibleDepositLogs.slice(0, 5).map((log, idx) => {
                const sc = statusColor(log.status);
                const partner = resolveCashInPartner(log.partner || log.paymentMethod);
                const initial = (log.partner || log.paymentMethod || "B").charAt(0).toUpperCase();
                return (
                  <Box
                    key={log.id}
                    sx={{
                      px: 2,
                      py: 1.6,
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      borderBottom: idx === Math.min(visibleDepositLogs.length, 5) - 1 ? "none" : "1px solid rgba(217,233,255,0.14)",
                    }}
                  >
                    <Avatar
                      src={partner?.logo || undefined}
                      alt={log.partner || log.paymentMethod || "Cash In"}
                      sx={{
                        width: 42,
                        height: 42,
                        background: partner?.logo
                          ? "#ffffff"
                          : `linear-gradient(135deg, ${memberPalette.navy} 0%, ${memberPalette.royal} 65%, ${memberPalette.gold} 100%)`,
                        color: "#fff",
                        fontSize: 16,
                        fontWeight: 800,
                        border: partner?.logo ? "1px solid rgba(217,233,255,0.2)" : "none",
                        p: partner?.logo ? 0.35 : 0,
                        "& .MuiAvatar-img": {
                          objectFit: "contain",
                          transform: "none",
                        },
                      }}
                    >
                      {!partner?.logo ? initial : null}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>
                        {log.partner || log.paymentMethod || "Bank"}
                      </Typography>
                      <Typography sx={{ color: memberPalette.softText, fontSize: 12 }}>{formatDate(log.createdAt)}</Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontWeight: 800, color: "#fff", fontSize: 14.5 }}>
                        ₱{Number(log.amount || 0).toLocaleString("en-PH")}
                      </Typography>
                      <Chip
                        label={(log.status || "PENDING").toUpperCase()}
                        size="small"
                        sx={{
                          mt: 0.4,
                          height: 18,
                          backgroundColor: sc.bg,
                          color: sc.color,
                          fontWeight: 800,
                          fontSize: 10,
                          "& .MuiChip-label": { px: 0.8 },
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <CashInInfoDialog />
        <CashInHistoryDrawer />

        {/* Automate your savings banner */}
        <Box
          sx={{
            mx: 2,
            mt: 3,
            borderRadius: 2.5,
            background: memberHeroBackground,
            border: "1px solid rgba(217,233,255,0.2)",
            p: 2.5,
            color: "#fff",
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: 15.5, mb: 0.5 }}>Automate your savings</Typography>
          <Typography sx={{ fontSize: 12.5, mb: 2, opacity: 0.92, lineHeight: 1.55 }}>
            Set up recurring cash-ins and watch your wealth grow.
          </Typography>
          <Button
            variant="contained"
            size="small"
            disableElevation
            sx={{
              backgroundColor: "#fff",
              color: memberPalette.navy,
              fontWeight: 800,
              textTransform: "none",
              borderRadius: 1.5,
              px: 2.2,
              fontSize: 12,
              "&:hover": { backgroundColor: memberPalette.cloud },
            }}
          >
            GET STARTED
          </Button>
        </Box>
      </Box>

      <AmountDialog />
    </Box>
  );
};

export default MemberCashIn;