import React, { useEffect, useState } from "react";
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
  IconButton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../firebase";
import bpiLogo from "../../assets/bpilogo.png";
import bpiQr from "../../assets/bpi.jpg";

const METHOD_ITEMS = [
  {
    id: "bank",
    title: "Local Banks",
    subtitle: "Transfer via InstaPay",
    screen: "banks",
    icon: <AccountBalanceIcon sx={{ color: "#2563eb", fontSize: 26 }} />,
  },
  {
    id: "ewallet",
    title: "E-Wallet",
    subtitle: "G-Cash, Maya & more",
    screen: "ewallet",
    icon: <AccountBalanceWalletIcon sx={{ color: "#2563eb", fontSize: 26 }} />,
  },
];

const INSTAPAY_BANKS = [{ id: "bpi", name: "BPI", initial: "B", bg: "#c0392b", logo: bpiLogo }];

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
  const navigate = useNavigate();
  const [screen, setScreen] = useState("main");
  const [bankTab, setBankTab] = useState(1); // 0=OTC, 1=Local Banks, 2=Global
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const [methodUnavailableOpen, setMethodUnavailableOpen] = useState(false);
  const [depositLogs, setDepositLogs] = useState([]);

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
    setError("");
    setSuccess(false);
    setReceiptFile(null);
    setReceiptPreviewUrl("");
  };

  const handleCloseDialog = () => {
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    setSelectedPartner(null);
    setAmount("");
    setError("");
    setSuccess(false);
    setReceiptFile(null);
    setReceiptPreviewUrl("");
  };

  const handleReceiptChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    setReceiptFile(file);
    setReceiptPreviewUrl(file ? URL.createObjectURL(file) : "");
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

      await addDoc(collection(db, "deposits"), {
        userId: auth.currentUser.uid,
        name: auth.currentUser.displayName || auth.currentUser.email || "Member",
        email: auth.currentUser.email || "",
        amount: Number(amount),
        status: "Pending",
        type: "Cash In Request",
        paymentMethod: selectedPartner.methodType === "bank" ? "Local Banks" : "E-Wallet",
        partner: selectedPartner.name,
        receiptUrl,
        receiptName: receiptFile.name,
        source: "manual",
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
      setAmount("");
    } catch (err) {
      setError(err.message || "Failed to submit request.");
    } finally {
      setProcessing(false);
    }
  };

  const AppHeader = () => (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 1,
        py: 1.2,
        background: "linear-gradient(135deg, #1266db 0%, #1a73e8 100%)",
        color: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      <IconButton onClick={handleBack} sx={{ color: "#fff" }}>
        <ArrowBackIosNewIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ flex: 1, fontSize: 17, fontWeight: 800 }}>Cash In</Typography>
      <IconButton sx={{ color: "#fff" }}>
        <HelpOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  const AmountDialog = () => (
    <Dialog open={!!selectedPartner} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, color: "#143b7d", pb: 0.5 }}>
        Send
      </DialogTitle>
      <DialogContent>
        {success ? (
          <Alert severity="success" sx={{ mt: 1 }}>
            Request submitted! It will be reviewed within 1 hour.
          </Alert>
        ) : (
          <>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
              <Box
                component="img"
                src={bpiQr}
                alt="BPI QR code"
                sx={{ width: 220, maxWidth: "100%", borderRadius: 2, border: "1px solid #e6ebf3" }}
              />
            </Box>
            <Typography sx={{ color: "#1a2f52", fontSize: 13, fontWeight: 700, mb: 0.75 }}>
              Send to BPI
            </Typography>
            <Typography sx={{ color: "#7a8faf", fontSize: 12.5, mb: 2, mt: 0.5 }}>
              Scan the QR code, send your payment, then enter the amount and upload the receipt.
            </Typography>
            <TextField
              fullWidth
              autoFocus
              type="number"
              label="Amount (PHP)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onWheel={(e) => e.target.blur()}
              inputProps={{ min: 1 }}
              sx={{
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
              }}
            />
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: 13, color: "#1a2f52", fontWeight: 700, mb: 1 }}>
                Upload Receipt
              </Typography>
              <Button component="label" variant="outlined" fullWidth sx={{ textTransform: "none", borderRadius: 2 }}>
                {receiptFile ? receiptFile.name : "Choose receipt image"}
                <input hidden type="file" accept="image/*" onChange={handleReceiptChange} />
              </Button>
              {receiptPreviewUrl && (
                <Box
                  component="img"
                  src={receiptPreviewUrl}
                  alt="Receipt preview"
                  sx={{
                    mt: 1.25,
                    width: "100%",
                    maxHeight: 220,
                    objectFit: "contain",
                    borderRadius: 2,
                    border: "1px solid #e6ebf3",
                    backgroundColor: "#f8fbff",
                  }}
                />
              )}
              <Typography sx={{ mt: 0.8, color: "#7a8faf", fontSize: 12 }}>
                Receipt upload is required before deposit.
              </Typography>
            </Box>
            {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCloseDialog} sx={{ textTransform: "none", color: "#5f7498" }}>
          {success ? "Close" : "Cancel"}
        </Button>
        {!success && (
          <Button
            variant="contained"
            onClick={handleSubmitCashIn}
            disabled={processing || !amount || Number(amount) <= 0 || !receiptFile}
            sx={{
              textTransform: "none",
              fontWeight: 800,
              borderRadius: 2,
              backgroundColor: "#1a73e8",
              "&:hover": { backgroundColor: "#0f62d5" },
            }}
          >
            {processing ? (
              <><CircularProgress size={16} sx={{ color: "#fff", mr: 1 }} />Submitting...</>
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
      <Box sx={{ minHeight: "100vh", backgroundColor: "#f4f7fb" }}>
        <Box sx={{ maxWidth: 460, mx: "auto", pb: 6 }}>
          <AppHeader />

          {/* Tabs */}
          <Box sx={{ backgroundColor: "#fff", borderBottom: "1px solid #e6ebf3" }}>
            <Tabs
              value={bankTab}
              onChange={(_, v) => setBankTab(v)}
              sx={{
                px: 1,
                "& .MuiTabs-indicator": { backgroundColor: "#1a73e8", height: 3 },
                "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13, color: "#7a8faf", minWidth: 0, px: 2 },
                "& .Mui-selected": { color: "#1a73e8", fontWeight: 800 },
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
                  <Typography sx={{ fontWeight: 800, color: "#1a2f52", fontSize: 14.5 }}>InstaPay Cash In</Typography>
                  <Chip
                    label="FAST"
                    size="small"
                    sx={{ backgroundColor: "#e6f9ee", color: "#1a9451", fontWeight: 800, fontSize: 10.5, height: 20 }}
                  />
                </Box>
                <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 1 }}>
                  {INSTAPAY_BANKS.map((bank) => (
                    <Box
                      key={bank.id}
                      onClick={() => openPartnerDialog(bank, "bank")}
                      sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.7, cursor: "pointer", minWidth: 58 }}
                    >
                      <Avatar sx={{ width: 52, height: 52, backgroundColor: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.13)" }}>
                        <Box component="img" src={bank.logo} alt={bank.name} sx={{ width: 34, height: 34, objectFit: "contain" }} />
                      </Avatar>
                      <Typography sx={{ fontSize: 11, color: "#1a2f52", fontWeight: 600, textAlign: "center" }}>
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
              <Typography sx={{ color: "#8aa0bf", fontSize: 14 }}>Coming soon.</Typography>
            </Box>
          )}
        </Box>
        <AmountDialog />
      </Box>
    );
  }

  // ── EWALLET SCREEN ────────────────────────────────────────────────────────
  // ── MAIN SCREEN ───────────────────────────────────────────────────────────
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#f4f7fb" }}>
      <Box sx={{ maxWidth: 460, mx: "auto", pb: 6 }}>
        <AppHeader />

        <Box sx={{ px: 2, pt: 2.5 }}>
          {/* How to Cash In */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.4 }}>
            <Typography sx={{ fontSize: 15.5, fontWeight: 800, color: "#143b7d" }}>How to Cash In</Typography>
            <Chip
              label="1 HOUR"
              size="small"
              sx={{ backgroundColor: "#fff3e0", color: "#e65100", fontWeight: 800, fontSize: 10.5, height: 22 }}
            />
          </Box>

          <Box sx={{ backgroundColor: "#fff", borderRadius: 2.5, overflow: "hidden", border: "1px solid #e6ebf3" }}>
            {METHOD_ITEMS.map((item, idx) => (
              <Box
                key={item.id}
                onClick={() => {
                  if (item.id === "ewallet") {
                    setMethodUnavailableOpen(true);
                    return;
                  }
                  setScreen(item.screen);
                }}
                sx={{
                  px: 2,
                  py: 1.8,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  cursor: "pointer",
                  borderBottom: idx === METHOD_ITEMS.length - 1 ? "none" : "1px solid #eef1f5",
                  "&:hover": { backgroundColor: "#f7faff" },
                }}
              >
                <Avatar sx={{ width: 44, height: 44, backgroundColor: "#eef5ff" }}>{item.icon}</Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, color: "#1a2f52", fontSize: 14.5 }}>{item.title}</Typography>
                  <Typography sx={{ color: "#7a8faf", fontSize: 12.5 }}>{item.subtitle}</Typography>
                </Box>
                <ChevronRightIcon sx={{ color: "#b0bdd0" }} />
              </Box>
            ))}
          </Box>

          {/* Recent Cash In */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 3, mb: 1.4 }}>
            <Typography sx={{ fontSize: 15.5, fontWeight: 800, color: "#143b7d" }}>Recent Cash In</Typography>
            <Typography sx={{ fontSize: 12.5, color: "#1a73e8", fontWeight: 700, cursor: "pointer" }}>See All</Typography>
          </Box>

          {depositLogs.length === 0 ? (
            <Box sx={{ backgroundColor: "#fff", borderRadius: 2.5, border: "1px solid #e6ebf3", p: 3, textAlign: "center" }}>
              <Typography sx={{ color: "#8aa0bf", fontSize: 13 }}>No cash in records yet.</Typography>
            </Box>
          ) : (
            <Box sx={{ backgroundColor: "#fff", borderRadius: 2.5, overflow: "hidden", border: "1px solid #e6ebf3" }}>
              {depositLogs.slice(0, 5).map((log, idx) => {
                const sc = statusColor(log.status);
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
                      borderBottom: idx === Math.min(depositLogs.length, 5) - 1 ? "none" : "1px solid #eef1f5",
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 42,
                        height: 42,
                        background: "linear-gradient(135deg, #1266db 0%, #38b2e8 100%)",
                        color: "#fff",
                        fontSize: 16,
                        fontWeight: 800,
                      }}
                    >
                      {initial}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, color: "#1a2f52", fontSize: 14 }}>
                        {log.partner || log.paymentMethod || "Bank"}
                      </Typography>
                      <Typography sx={{ color: "#9aafc9", fontSize: 12 }}>{formatDate(log.createdAt)}</Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontWeight: 800, color: "#1a2f52", fontSize: 14.5 }}>
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

        {/* Automate your savings banner */}
        <Box
          sx={{
            mx: 2,
            mt: 3,
            borderRadius: 2.5,
            background: "linear-gradient(135deg, #ff8c00 0%, #e65100 100%)",
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
              color: "#e65100",
              fontWeight: 800,
              textTransform: "none",
              borderRadius: 1.5,
              px: 2.2,
              fontSize: 12,
              "&:hover": { backgroundColor: "#fff3e0" },
            }}
          >
            GET STARTED
          </Button>
        </Box>
      </Box>

      <Dialog open={methodUnavailableOpen} onClose={() => setMethodUnavailableOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: "#143b7d" }}>E-Wallet</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#5f7498", fontSize: 14 }}>
            This payment method is not available right now.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMethodUnavailableOpen(false)} sx={{ textTransform: "none", fontWeight: 700 }}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <AmountDialog />
    </Box>
  );
};

export default MemberCashIn;