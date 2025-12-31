// src/pages/member/MemberPayback.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Toolbar,
  Typography,
  useMediaQuery,
  Grid,
  Card,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import bgImage from "../../assets/bg.jpg";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import PaybackTransactions from "./components/paybackTransactions";
import AddPaybackEntryDialog from "../../components/dialogs/AddPaybackEntryDialog";
import { db, auth } from "../../firebase";


const MemberPayback = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // States
  // const [events, setEvents] = useState([]); // Removed: no longer used
  const [paybackEntries, setPaybackEntries] = useState([]);
  const [totalContribution, setTotalContribution] = useState(0);
  const [totalPassiveIncome, setTotalPassiveIncome] = useState(0);
  // Animated count-up states
  const [displayContribution, setDisplayContribution] = useState(100);
  const [displayPassiveIncome, setDisplayPassiveIncome] = useState(100);

  // Animate count-up for Total Contribution
  useEffect(() => {
    let frame;
    let start = 100;
    let end = totalContribution;
    let duration = 800;
    let startTime;
    function animate(ts) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const value = start + (end - start) * progress;
      setDisplayContribution(progress === 1 ? Math.round(end) : value);
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    if (start !== end) frame = requestAnimationFrame(animate);
    return () => frame && cancelAnimationFrame(frame);
  }, [totalContribution]);

  // Animate count-up for Total Passive Income
  useEffect(() => {
    let frame;
    let start = 100;
    let end = totalPassiveIncome;
    let duration = 800;
    let startTime;
    function animate(ts) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const value = start + (end - start) * progress;
      setDisplayPassiveIncome(progress === 1 ? Math.round(end) : value);
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    if (start !== end) frame = requestAnimationFrame(animate);
    return () => frame && cancelAnimationFrame(frame);
  }, [totalPassiveIncome]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferSuccessDialog, setTransferSuccessDialog] = useState(false);
  const [lastTransferReceipt, setLastTransferReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add Payback Dialog
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [uplineUsername, setUplineUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  // Removed: confirmDialogOpen (unused)
  const [addReceiptDialog, setAddReceiptDialog] = useState(false);
  const [lastAddReceipt, setLastAddReceipt] = useState(null);
  // Removed: receiptImageUrl (unused)

  // View Entry Dialog
  // const [viewDialogOpen, setViewDialogOpen] = useState(false); // Removed: no longer used
  // const [selectedEntry, setSelectedEntry] = useState(null); // Removed: no longer used

  // Expired Notification (removed: no popup for expired entries)

  // History
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

// ===================== Upline ₱65 Reward Logic (Stored in Override) =====================

const handleUplineReward = useCallback(async (entries) => {
  // TODO: Replace moment with native Date if needed
  const today = new Date();
  console.log("🟡 Checking for expired payback entries eligible for ₱65 upline reward...");
  console.log("📅 Today's Date:", today.toISOString().slice(0, 10));
  console.log("📄 Total entries to check:", entries.length);

  for (const entry of entries) {
    // TODO: Replace moment with native Date if needed
    const dueDate = new Date(entry.expirationDate);
    console.log(`🔹 Entry: ${entry.id} | Expiration: ${entry.expirationDate} | RewardGiven: ${entry.rewardGiven}`);

    // Only process if the entry is due and not yet rewarded
    if (today >= dueDate && !entry.rewardGiven) {
      try {
        const q = query(collection(db, "users"), where("username", "==", entry.uplineUsername));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const uplineDoc = snap.docs[0];
          const uplineData = uplineDoc.data();

          // ✅ Store ₱65 in override (not credited yet)
          const overrideRef = await addDoc(collection(db, "override"), {
            uplineId: uplineDoc.id,
            uplineUsername: uplineData.username,
            memberId: entry.userId,
            memberUsername: entry.memberUsername || "",
            paybackEntryId: entry.id,
            amount: 65,
            credited: false, // not yet credited
            createdAt: new Date().toISOString(),
            expirationDate: entry.expirationDate, // for reference
            type: "UplineReward",
          });

          console.log(`💰 ₱65 override created for upline: ${uplineData.username} | Override ID: ${overrideRef.id}`);

          // ✅ Mark payback entry as rewarded so it won’t repeat
          const entryRef = doc(db, "paybackEntries", entry.id);
          await updateDoc(entryRef, { rewardGiven: true });
          console.log(`✅ Entry ${entry.id} marked as rewarded.`);
        }
      } catch (err) {
        console.error("Error creating upline override reward:", err);
      }
    } else {
      console.log("⏩ Entry not yet due or already rewarded. Skipping...");
    }
  }
  console.log("🟢 Upline reward checking completed.");
}, []);

  // ===================== Fetch Payback Data =====================
const fetchPaybackData = useCallback(async (userId) => {
  try {
    setLoading(true);
    const paybackQ = query(collection(db, "paybackEntries"), where("userId", "==", userId));
    const transferQ = query(collection(db, "passiveTransfers"), where("userId", "==", userId));

    const [paybackSnap, transferSnap] = await Promise.all([
      getDocs(paybackQ),
      getDocs(transferQ),
    ]);

    const entries = paybackSnap.docs.map((d) => {
      const data = d.data();
      const expirationDate =
        // TODO: Replace moment with native Date if needed
        data.expirationDate || new Date(new Date(data.date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      // TODO: Replace moment with native Date if needed
      const isExpired = new Date() > new Date(expirationDate);
      return { id: d.id, ...data, expirationDate, isExpired };
    });

    const totalContributionAmount = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalPassive = entries
      // TODO: Replace moment with native Date if needed
      .filter((e) => new Date() >= new Date(e.expirationDate))
      .reduce((sum, e) => sum + (e.amount || 0) * 0.02, 0);
    const totalTransferred = transferSnap.docs.reduce(
      (sum, t) => sum + (t.data().amount || 0),
      0
    );

    setTotalContribution(totalContributionAmount);
    setTotalPassiveIncome(Math.max(totalPassive - totalTransferred, 0));
    setPaybackEntries(entries);

    // ✅ Create calendar events (keep expired ones visible, color coded)
    // Removed: calendarEvents and setEvents (no longer used)

    await handleUplineReward(entries); // ✅ override entries created on due

    // Removed: Notify 3 days before expiration and expired entries popup
  } catch (err) {
    console.error("Error fetching payback data:", err);
  } finally {
    setLoading(false);
  }
}, [handleUplineReward]);

  // ===================== Fetch Upline Username =====================
  const fetchUplineUsername = useCallback(async (userId) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const upline = userSnap.data().referredBy || "";
        setUplineUsername(upline);
      }
    } catch (err) {
      console.error("Error fetching upline username:", err);
    }
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        await fetchPaybackData(user.uid);
        await fetchUplineUsername(user.uid);
      }
    });
    return () => unsub && unsub();
  }, [fetchPaybackData, fetchUplineUsername]);

  // ===================== Add Payback Entry =====================
  // Removed: handleSelectSlot and handleSelectEvent (no longer used)

  const resetAddFields = () => {
    setAmount("");
    setSelectedDate(null);
  };
// Removed: handleOpenConfirmDialog (unused)
  // ===================== Add Payback Entry (continued) =====================
  const handleAddPayback = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        setAdding(false);
        return alert("User not found.");
      }

      const walletBalance = userSnap.data().eWallet || 0;
      const amountNum = parseFloat(amount);
      if (amountNum > walletBalance) {
        setAdding(false);
        return alert("Insufficient wallet balance.");
      }

      // Get upline user doc
      const q = query(collection(db, "users"), where("username", "==", uplineUsername));
      const snap = await getDocs(q);
      if (snap.empty) {
        setAdding(false);
        return alert("Upline not found.");
      }

      const uplineDoc = snap.docs[0].data();

      // Deduct wallet using transaction to avoid race conditions
      await runTransaction(db, async (tx) => {
        const uSnap = await tx.get(userRef);
        if (!uSnap.exists()) throw new Error("User not found during transaction.");
        const current = uSnap.data().eWallet || 0;
        if (current < amountNum) throw new Error("Insufficient wallet balance.");
        tx.update(userRef, { eWallet: current - amountNum });
      });

      // Prepare payback entry
      const entryDate = new Date(selectedDate || new Date()).toISOString();
      const expirationDate = new Date(new Date(entryDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Add payback entry
      const docRef = await addDoc(collection(db, "paybackEntries"), {
        userId: user.uid,
        uplineUsername,
        amount: amountNum,
        role: uplineDoc.role,
        date: entryDate,
        expirationDate,
        rewardGiven: false,
        createdAt: new Date().toISOString(),
      });

      // Prepare receipt data for dialog
      setLastAddReceipt({
      reference: docRef.id,
      amount: amountNum,
      date: new Date(entryDate).toLocaleString(),
      uplineUsername: uplineUsername,
      createdAt: new Date().toLocaleString(),
    });
      setAddReceiptDialog(true);

      await fetchPaybackData(user.uid);
      resetAddFields();
      setOpenAddDialog(false);
    } catch (err) {
      console.error("❌ Error adding payback entry:", err);
      alert("Failed to add entry.");
    } finally {
      setAdding(false);
    }
  };
    // Download receipt as image (PNG)
    const handleDownloadAddReceiptImage = () => {
      if (!lastAddReceipt) return;
      // Create a canvas and draw the receipt
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 260;
      const ctx = canvas.getContext('2d');
      // Background
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Header
      ctx.fillStyle = '#388e3c';
      ctx.fillRect(0, 0, canvas.width, 50);
      ctx.font = 'bold 22px Arial';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('Payback Entry Receipt', canvas.width / 2, 35);
      // Details
      ctx.font = '16px Arial';
      ctx.fillStyle = '#333';
      ctx.textAlign = 'left';
      ctx.fillText(`Reference No: ${lastAddReceipt.ref}`, 30, 80);
      ctx.fillText(`Amount: ₱${Number(lastAddReceipt.amount).toFixed(2)}`, 30, 110);
      ctx.fillText(`Date: ${new Date(lastAddReceipt.date).toLocaleString()}`, 30, 140);
      ctx.fillText(`Upline: ${lastAddReceipt.upline}`, 30, 170);
      // Footer
      ctx.font = 'italic 13px Arial';
      ctx.fillStyle = '#888';
      ctx.fillText('Thank you for your contribution!', 30, 210);
      // Download
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `payback-receipt-${lastAddReceipt.ref}.png`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
      }, 100);
    };
       
  // ===================== Transfer Logic =====================
  // Only allow transfer of the 2% profit (not the principal amount)
  const handleTransfer = async () => {
    const profitAvailable = Number(totalPassiveIncome);
    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) return alert("Enter a valid amount");
    if (amountNum > profitAvailable) return alert("Exceeds available 2% profit");

    const fee = amountNum * 0.01;
    const net = amountNum - fee;

    try {
      const user = auth.currentUser;
      if (!user) return;

      // Find the matured payback entry to transfer (first eligible)
      const maturedEntry = paybackEntries.find(e => {
        const expirationDate = e.expirationDate instanceof Date ? e.expirationDate : new Date(e.expirationDate);
        return expirationDate <= new Date() && !e.transferred && (e.amount * 0.02).toFixed(2) === amountNum.toFixed(2);
      });
      if (!maturedEntry) {
        alert("No eligible matured payback entry found for this transfer amount.");
        return;
      }

      const idToken = await user.getIdToken();
      const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
      const response = await fetch(`${API_BASE}/api/transfer-passive-income`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken,
          paybackEntryId: maturedEntry.id,
          amount: amountNum,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Transfer failed");
      }

      // Update UI
      setTotalPassiveIncome((prev) => prev - amountNum);
      setTransferDialogOpen(false);
      setTransferAmount("");
      setLastTransferReceipt({
        id: data.transferId || maturedEntry.id,
        amount: amountNum,
        fee,
        net,
        date: new Date().toLocaleString(),
      });
      setTransferSuccessDialog(true);

      // Re-fetch payback data to update status and history
      await fetchPaybackData(user.uid);
    } catch (err) {
      console.error("Transfer failed:", err);
      alert(err.message || "Transfer failed.");
    }
  };

  // ===================== Calendar Restriction =====================
// Removed: currentDate and onNavigate (no longer used)

// ===================== Calendar Slot Selection =====================


// Removed: eventStyleGetter and EventComponent (no longer used)

  // ===================== Render =====================
  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `linear-gradient(120deg, rgba(30, 41, 59, 0.92) 60%, rgba(33, 150, 243, 0.25)), url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        position: "relative",
        // No overflow here; let content scroll
        '&::before': {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(120deg, rgba(30, 41, 59, 0.92) 60%, rgba(33, 150, 243, 0.25))',
          zIndex: 0,
        },
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>
      <Box sx={{ zIndex: 5 }}>
        <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 4 },
          mt: 0,
          pb: { xs: 12, sm: 12, md: 12 },
          color: "#f5f7fa",
          zIndex: 1,
          width: "100%",
          transition: "all 0.3s ease",
          position: "relative",
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflowY: 'auto',
          maxHeight: '100vh',
        }}
      >
        <Toolbar />
        {/* Header Section */}
        <Box sx={{ mb: 4, width: '100%', maxWidth: 900 }}>
          <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 900, letterSpacing: 1, mb: 1, color: '#fff', textShadow: '0 2px 12px #000a' }}>
            Member <span style={{ color: '#4FC3F7' }}>Payback</span> Dashboard
          </Typography>
          <Typography variant="h6" sx={{ color: '#b0bec5', fontWeight: 500, mb: 1.5, textShadow: '0 1px 8px #0006' }}>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>💸 Track Contributions</Box>
            <Box component="span" sx={{ mx: 1, color: '#4FC3F7' }}>•</Box>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>📈 Earn Passive Income</Box>
            <Box component="span" sx={{ mx: 1, color: '#4FC3F7' }}>•</Box>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>📝 Manage Paybacks</Box>
          </Typography>
        </Box>

        {/* Totals */}
        <Grid container spacing={2.5} sx={{ mb: 4, width: '100%', maxWidth: 900, flexWrap: 'nowrap' }}>
          {[{
            label: "Total Contribution",
            value: `₱${Number(displayContribution).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: "💸",
            color: "#4FC3F7",
            bg: "rgba(79,195,247,0.15)",
          }, {
            label: "Total Passive Income",
            value: `₱${Number(displayPassiveIncome).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: "📈",
            color: "#81C784",
            bg: "rgba(129,199,132,0.15)",
          }].map((item, index) => (
            <Grid item xs={6} key={index} sx={{ display: "flex", width: '100%', flexBasis: 0, flexGrow: 1, flexShrink: 0 }}>
              <Card
                sx={{
                  background: `linear-gradient(120deg, ${item.bg} 80%, rgba(255,255,255,0.04))`,
                  backdropFilter: "blur(14px)",
                  border: `2px solid ${item.color}33`,
                  borderRadius: "18px",
                  p: 3,
                  height: "100%",
                  width: "100%",
                  minWidth: 0,
                  boxShadow: `0 4px 24px 0 ${item.color}22`,
                  transition: "transform 0.3s, box-shadow 0.3s",
                  position: "relative",
                  overflow: "hidden",
                  '&::before': {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: "100px",
                    height: "100px",
                    background: `radial-gradient(circle, ${item.color}20, transparent)`,
                    borderRadius: "50%",
                  },
                  '&:hover': {
                    transform: "translateY(-10px) scale(1.03)",
                    boxShadow: `0 20px 50px ${item.color}55`,
                    border: `2.5px solid ${item.color}66`,
                  },
                }}
              >
                <Box sx={{ position: "relative", zIndex: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                    <Box sx={{ fontSize: "2.5rem" }}>{item.icon}</Box>
                  </Box>
                  <Typography variant="body2" sx={{ opacity: 1, mb: 1, color: "#fff", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, textShadow: '1px 1px 4px #000' }}>
                    {item.label}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: item.color, mb: 1, lineHeight: 1, textShadow: '1px 1px 4px #000' }}>
                    {item.value}
                  </Typography>
                </Box>
                {/* Removed Transfer to E-Wallet button from Total Passive Income card */}
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box display="flex" gap={2} sx={{ mb: 2, width: '100%', maxWidth: 900 }}>
          <Button
            variant="contained"
            color="primary"
            sx={{ fontWeight: 700, borderRadius: 2, boxShadow: 2, textTransform: 'none', px: 3, py: 1.2, fontSize: 16 }}
            onClick={() => setOpenAddDialog(true)}
          >
            + Add Payback Entry
          </Button>
          <Button

            variant="contained"
            color="success"
            sx={{ position: 'relative', fontWeight: 700, borderRadius: 2, boxShadow: 2, textTransform: 'none', px: 3, py: 1.2, fontSize: 16 }}
            onClick={() => setHistoryDialogOpen(true)}
          >
            Passive Income Earn
          </Button>
        </Box>
        {/* Payback Transactions Card */}
        <PaybackTransactions loading={loading} paybackEntries={paybackEntries} />

      {/* Add Payback Entry */}
     <AddPaybackEntryDialog
  open={openAddDialog}
  onClose={() => setOpenAddDialog(false)}
  onSubmit={handleAddPayback}
  selectedDate={selectedDate}
  setSelectedDate={setSelectedDate}
  uplineUsername={uplineUsername}
  amount={amount}
  setAmount={setAmount}
  adding={adding}
  receiptData={lastAddReceipt}
  onDownloadReceipt={handleDownloadAddReceiptImage}
  showReceipt={addReceiptDialog}
  setShowReceipt={setAddReceiptDialog}
/>

      {/* Passive Income Earn Dialog (was Payback Transaction History) */}
      <Dialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, boxShadow: 12, overflow: 'hidden', background: 'none', maxWidth: { xs: '100%', sm: 500, md: 500 } } }}>
        {/* Reduced header with X button */}
        <Box sx={{
          bgcolor: '#1976d2',
          color: '#fff',
          px: { xs: 2, sm: 4 },
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          boxShadow: 2,
          position: 'relative',
          zIndex: 1,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ fontSize: 28, mb: 0.5 }}>📈</Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.5, color: '#fff', textShadow: '0 2px 12px #000a' }}>
              Passive Income Earn
            </Typography>
          </Box>
          <Button
            onClick={() => setHistoryDialogOpen(false)}
            sx={{ minWidth: 0, p: 0.5, color: '#fff', bgcolor: 'transparent', '&:hover': { bgcolor: '#1565c0' } }}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </Button>
        </Box>
        {/* Professional style background for content, cards centered */}
        <DialogContent
          dividers
          sx={{
            px: { xs: 2, sm: 4 },
            py: 3,
            background: `linear-gradient(120deg, rgba(30,41,59,0.92) 60%, rgba(33,150,243,0.18)), url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative',
            minHeight: 220,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            zIndex: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflowX: 'hidden', // Disable horizontal swipe/scroll
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(120deg, rgba(30,41,59,0.92) 60%, rgba(33,150,243,0.18))',
              zIndex: -1,
              borderBottomLeftRadius: 4,
              borderBottomRightRadius: 4,
            },
          }}
        >
          {paybackEntries.length > 0 ? (
            <Grid container spacing={2.5} direction="column" alignItems="center">
              {paybackEntries.map((e, idx) => {
                const now = new Date();
                const expirationDate = e.expirationDate instanceof Date ? e.expirationDate : new Date(e.expirationDate);
                let profitStatus, profitIcon, profitColor, profitBg;
                if (expirationDate > now) {
                  profitStatus = "Pending";
                  profitIcon = "⏳";
                  profitColor = '#ef6c00';
                  profitBg = '#ef6c00';
                } else if (e.transferred) {
                  profitStatus = "Transferred";
                  profitIcon = "💸";
                  profitColor = '#0288d1';
                  profitBg = '#0288d1';
                } else {
                  profitStatus = "Profit Earn";
                  profitIcon = "✅";
                  profitColor = '#388e3c';
                  profitBg = '#388e3c';
                }
                const canTransfer = profitStatus === "Profit Earn" && !e.transferred;
                const profit = (e.amount * 0.02);
                return (
                  <Grid item xs={12} key={e.id} sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <Card
                      sx={{
                        p: 2.5,
                        borderRadius: 3,
                        bgcolor: 'rgba(30,41,59,0.92)',
                        color: '#fff',
                        boxShadow: '0px 2px 12px rgba(33,150,243,0.10)',
                        borderLeft: `4px solid ${profitStatus === "Profit Earn" ? '#4caf50' : profitStatus === "Transferred" ? '#0288d1' : '#1976d2'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: { xs: 0, sm: 0, md: 0 },
                        maxWidth: { xs: 400, sm: 500, md: '100%' },
                        width: { xs: '100%', md: '100%' },
                        minHeight: 90,
                        mb: 1.2,
                        transition: 'box-shadow 0.2s',
                        alignItems: 'center',
                        '&:hover': {
                          boxShadow: `0 4px 16px 0 ${profitStatus === "Profit Earn" ? '#4caf50' : profitStatus === "Transferred" ? '#0288d1' : '#1976d2'}33`,
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ fontSize: 22, color: profitColor, mr: 1 }}>{profitIcon}</Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.1, color: '#fff' }}>
                          2% Profit
                        </Typography>
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: profitStatus === "Profit Earn" ? '#4caf50' : profitStatus === "Transferred" ? '#0288d1' : '#1976d2', mb: 0.5, fontSize: 18, letterSpacing: 0.1 }}>
                        ₱{profit.toFixed(2)}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                        <Typography
                          sx={{
                            px: 1.2,
                            py: 0.3,
                            borderRadius: 1,
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        >
                         
                        </Typography>
                        <Typography
                          sx={{
                            px: 1.2,
                            py: 0.3,
                            borderRadius: 1,
                            bgcolor: profitBg,
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        >
                          Profit: {profitIcon} {profitStatus}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 0.2, fontSize: 11 }}>
                        Next Profit Date: {expirationDate ? expirationDate.toDateString() : "-"}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: 11 }}>
                        Upline: <b style={{color:'#fff'}}>{e.uplineUsername}</b> | 2% Profit: <b style={{color:'#fff'}}>₱{(e.amount * 0.02).toFixed(2)}</b>
                      </Typography>
                      {canTransfer && (
                        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Button
                            variant="contained"
                            color="success"
                            sx={{ fontWeight: 700, borderRadius: 2, boxShadow: 2, textTransform: 'none', px: 2.5, py: 1, fontSize: 15 }}
                            onClick={() => {
                              setTransferAmount((e.amount * 0.02).toFixed(2));
                              setTransferDialogOpen(true);
                            }}
                          >
                            Transfer to E-Wallet
                          </Button>
                        </Box>
                      )}
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Typography sx={{ textAlign: "center", py: 3, color: '#1976d2', fontWeight: 700, fontSize: 18 }}>No passive income earned yet.</Typography>
          )}
        </DialogContent>
        {/* Removed: Close button at the bottom, replaced by X icon at top right */}
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 4, boxShadow: 12, overflow: 'hidden', background: 'none' } }}>
              {/* Transfer Success/Receipt Dialog */}
              <Dialog open={transferSuccessDialog} onClose={() => setTransferSuccessDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ bgcolor: '#388e3c', color: '#fff', fontWeight: 700, textAlign: 'center', pb: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4, boxShadow: 2 }}>
                  <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                    <Box sx={{ fontSize: 38, mb: 0.5 }}>✅</Box>
                    Transfer Successful
                  </Box>
                </DialogTitle>
                <DialogContent dividers sx={{ bgcolor: '#f8fafc', px: 4, py: 3, borderBottom: '1px solid #e3e8ee' }}>
                  {lastTransferReceipt && (
                    <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#388e3c', mb: 0.5, fontSize: 22, letterSpacing: 0.1 }}>
                        ₱{Number(lastTransferReceipt.net).toFixed(2)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#333', mb: 0.5 }}>
                        Net Amount Transferred
                      </Typography>
                      <Box sx={{ width: '100%', mt: 1, mb: 1 }}>
                        <Typography variant="body2" sx={{ color: '#666' }}>Gross: ₱{Number(lastTransferReceipt.amount).toFixed(2)}</Typography>
                        <Typography variant="body2" sx={{ color: '#666' }}>Fee: ₱{Number(lastTransferReceipt.fee).toFixed(2)}</Typography>
                        <Typography variant="body2" sx={{ color: '#666' }}>Date: {lastTransferReceipt.date}</Typography>
                        <Typography variant="body2" sx={{ color: '#666' }}>Transaction ID: {lastTransferReceipt.id}</Typography>
                      </Box>
                    </Box>
                  )}
                </DialogContent>
                <DialogActions sx={{ px: 4, pb: 2, bgcolor: '#f8fafc', borderBottomLeftRadius: 4, borderBottomRightRadius: 4, boxShadow: 1 }}>
                  <Button onClick={() => setTransferSuccessDialog(false)} color="success" variant="contained" sx={{ borderRadius: 2, minWidth: 100, fontWeight: 600, boxShadow: 2 }}>
                    Done
                  </Button>
                </DialogActions>
              </Dialog>
        <Box sx={{
          bgcolor: '#388e3c',
          color: '#fff',
          px: { xs: 2, sm: 4 },
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          boxShadow: 2,
          position: 'relative',
          zIndex: 1,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ fontSize: 28, mb: 0.5 }}>💸</Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.5, color: '#fff', textShadow: '0 2px 12px #000a' }}>
              Transfer to E-Wallet
            </Typography>
          </Box>
          <Button
            onClick={() => setTransferDialogOpen(false)}
            sx={{ minWidth: 0, p: 0.5, color: '#fff', bgcolor: 'transparent', '&:hover': { bgcolor: '#2e7d32' } }}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </Button>
        </Box>
        <DialogContent
          dividers
          sx={{
            px: { xs: 2, sm: 4 },
            py: 3,
            background: '#f8fafc',
            position: 'relative',
            minHeight: 120,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            zIndex: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflowX: 'hidden',
          }}
        >
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#388e3c', mb: 0.5, fontSize: 28, letterSpacing: 0.1, textShadow: '0 2px 8px #388e3c22' }}>
              ₱{Number(transferAmount).toFixed(2)}
            </Typography>
            <Typography variant="body1" sx={{ color: '#333', mb: 0.5, fontWeight: 600 }}>
              1% fee will be deducted
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
              Net Amount: <b style={{color:'#388e3c'}}>₱{(Number(transferAmount) - Number(transferAmount) * 0.01).toFixed(2)}</b>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 4, pb: 2, bgcolor: '#f8fafc', borderBottomLeftRadius: 4, borderBottomRightRadius: 4, boxShadow: 1 }}>
          <Button onClick={() => setTransferDialogOpen(false)} color="error" variant="outlined" sx={{ borderRadius: 2, minWidth: 100, fontWeight: 600 }}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} color="success" variant="contained" sx={{ borderRadius: 2, minWidth: 100, fontWeight: 600, boxShadow: 2 }}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  </Box>
  );
};

export default MemberPayback;