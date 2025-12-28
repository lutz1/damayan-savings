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
  TextField,
  CircularProgress,
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
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

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
const handleOpenConfirmDialog = () => {
  if (!uplineUsername || !amount) return alert("Please confirm upline and amount.");
  setConfirmDialogOpen(true);
};
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

    console.log("💰 Wallet balance before deduction:", walletBalance);

    // Get upline user doc
    const q = query(collection(db, "users"), where("username", "==", uplineUsername));
    const snap = await getDocs(q);
    if (snap.empty) {
      setAdding(false);
      return alert("Upline not found.");
    }

    const uplineDoc = snap.docs[0].data();
    console.log("👥 Upline data:", uplineDoc);

    // Deduct wallet using transaction to avoid race conditions
    await runTransaction(db, async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists()) throw new Error("User not found during transaction.");
      const current = uSnap.data().eWallet || 0;
      if (current < amountNum) throw new Error("Insufficient wallet balance.");
      tx.update(userRef, { eWallet: current - amountNum });
    });
    console.log(`✅ Deducted ₱${amountNum} from user eWallet (transaction)`);

    // Prepare payback entry
    // TODO: Replace moment with native Date if needed
    const entryDate = new Date(selectedDate || new Date()).toISOString();
    // TODO: Replace moment with native Date if needed
    const expirationDate = new Date(new Date(entryDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log("📝 Adding payback entry with:");
    console.log("User ID:", user.uid);
    console.log("Upline Username:", uplineUsername);
    console.log("Amount:", amountNum);
    console.log("Upline Role:", uplineDoc.role);
    console.log("Entry Date:", entryDate);
    console.log("Expiration Date:", expirationDate);
    console.log("RewardGiven: false (Upline ₱65 pending after expiration)");

    // Add payback entry
    await addDoc(collection(db, "paybackEntries"), {
      userId: user.uid,
      uplineUsername,
      amount: amountNum,
      role: uplineDoc.role,
      date: entryDate,
      expirationDate,
      rewardGiven: false,
      createdAt: new Date().toISOString(),
    });

    console.log("✅ Payback entry successfully added");

    await fetchPaybackData(user.uid);
    resetAddFields();
    setOpenAddDialog(false);
    alert(`Payback entry added! ₱${amountNum.toFixed(2)} deducted.`);
  } catch (err) {
    console.error("❌ Error adding payback entry:", err);
    alert("Failed to add entry.");
  } finally {
    setAdding(false);
  }
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
            value: `₱${Number(totalContribution).toFixed(2)}`,
            icon: "💸",
            color: "#4FC3F7",
            bg: "rgba(79,195,247,0.15)",
          }, {
            label: "Total Passive Income",
            value: `₱${Number(totalPassiveIncome).toFixed(2)}`,
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
            {/* Badge for available transfer */}
            {(() => {
              const availableCount = paybackEntries.filter(e => {
                const now = new Date();
                const expirationDate = e.expirationDate instanceof Date ? e.expirationDate : new Date(e.expirationDate);
                return expirationDate <= now && !e.transferred;
              }).length;
              return availableCount > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    bgcolor: '#d32f2f',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 13,
                    boxShadow: '0 2px 8px #0003',
                    zIndex: 2,
                  }}
                >
                  {availableCount}
                </Box>
              );
            })()}
          </Button>
        </Box>

        {/* Payback Transactions Section (replaces calendar) */}
        <Card sx={{ background: "linear-gradient(120deg, rgba(231,237,241,0.27), rgba(33,150,243,0.08))", borderRadius: 3, p: 3, minHeight: 320, width: '100%', maxWidth: 900, boxShadow: '0 4px 24px 0 rgba(33,150,243,0.10)', mb: 4, height: { xs: '60vh', sm: '65vh', md: '70vh', lg: '75vh' }, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2', mb: 2, letterSpacing: 0.5 }}>
            Payback Transactions
          </Typography>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="120px">
              <CircularProgress color="info" />
            </Box>
          ) : paybackEntries.length > 0 ? (
            <Box sx={{ width: '100%', flex: 1, overflowY: 'auto', height: '100%' }}>
              {paybackEntries.map((e, idx) => {
                const now = new Date();
                const expirationDate = e.expirationDate instanceof Date ? e.expirationDate : new Date(e.expirationDate);
                const profitStatus = expirationDate > now ? "Pending" : "Profit Earn";
                const profitIcon = profitStatus === "Pending" ? "⏳" : "✅";
                // const canTransfer = profitStatus === "Profit Earn" && !e.transferred; // unused
                const borderColor = profitStatus === "Profit Earn" ? '#4caf50' : '#1976d2';
                const iconBg = profitStatus === "Profit Earn" ? '#e8f5e9' : '#e3f2fd';
                const iconColor = profitStatus === "Profit Earn" ? '#388e3c' : '#1976d2';
                return (
                  <Card
                    key={e.id}
                    sx={{
                      p: 0,
                      borderRadius: 1.5,
                      bgcolor: 'rgba(30,41,59,0.92)', // dark blue-gray, matches app background but more opaque
                      color: '#fff',
                      boxShadow: '0px 2px 12px rgba(33,150,243,0.10)',
                      borderLeft: `4px solid ${borderColor}`,
                      display: 'flex',
                      alignItems: 'stretch',
                      minHeight: 56,
                      mb: 0.8,
                      transition: 'box-shadow 0.2s',
                      '&:hover': {
                        boxShadow: `0 4px 16px 0 ${borderColor}33`,
                      },
                    }}
                  >
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 38,
                      bgcolor: iconBg,
                      borderTopLeftRadius: 6,
                      borderBottomLeftRadius: 6,
                      px: 0.7,
                      py: 1.1,
                      mr: 1,
                    }}>
                      <Box sx={{ fontSize: 18, color: iconColor }}>{profitIcon}</Box>
                    </Box>
                    <Box sx={{ flex: 1, py: 0.7, pr: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 11, letterSpacing: 0.1, color: '#fff' }}>
                        Amount
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: borderColor, mb: 0.1, fontSize: 14, letterSpacing: 0.1 }}>
                        ₱{e.amount.toFixed(2)}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.7, flexWrap: "wrap", mb: 0.2 }}>
                        <Typography
                          sx={{
                            px: 0.7,
                            py: 0.1,
                            borderRadius: 1,
                            bgcolor: e.status === "Approved" ? "#1976d2" : "#c62828",
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 9.5,
                          }}
                        >
                          Status: {e.status || "Pending"}
                        </Typography>
                        <Typography
                          sx={{
                            px: 0.7,
                            py: 0.1,
                            borderRadius: 1,
                            bgcolor: profitStatus === "Profit Earn" ? "#388e3c" : "#ef6c00",
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 9.5,
                          }}
                        >
                          Profit: {profitStatus}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 0.1, fontSize: 10 }}>
                        Next Profit Date: {expirationDate ? expirationDate.toDateString() : "-"}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: 10 }}>
                        Upline: <b style={{color:'#fff'}}>{e.uplineUsername}</b> | 2% Profit: <b style={{color:'#fff'}}>₱{(e.amount * 0.02).toFixed(2)}</b>
                      </Typography>
                      {/* No Transfer to Wallet button here; transfer is a single transaction, not per entry */}
                    </Box>
                  </Card>
                );
              })}
            </Box>
          ) : (
            <Box display="flex" alignItems="center" justifyContent="center" height="80px">
              <Typography variant="h6" color="text.secondary" sx={{ fontSize: 16 }}>
                No payback transactions found.
              </Typography>
            </Box>
          )}
        </Card>
      </Box>

      {/* Add Payback Entry */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 4, boxShadow: 12 } }}>
        <DialogTitle sx={{ bgcolor: '#1976d2', color: '#fff', fontWeight: 700, textAlign: 'center', pb: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4, boxShadow: 2 }}>
          <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
            <Box sx={{ fontSize: 38, mb: 0.5 }}>📝</Box>
            Add Payback Entry
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#f8fafc', px: 4, py: 3, borderBottom: '1px solid #e3e8ee' }}>
          <Box display="flex" flexDirection="column" gap={3}>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ width: 28, height: 28, bgcolor: '#1976d2', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>1</Box>
              <TextField
                label="Date"
                type="date"
                fullWidth
                value={selectedDate ? new Date(selectedDate).toISOString().slice(0,10) : ''}
                onChange={e => setSelectedDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ bgcolor: '#fff', borderRadius: 2 }}
                error={!selectedDate}
                helperText={!selectedDate ? 'Please select a date.' : ''}
              />
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ width: 28, height: 28, bgcolor: '#1976d2', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>2</Box>
              <TextField
                label="Upline Username"
                fullWidth
                value={uplineUsername}
                disabled
                sx={{ bgcolor: '#fff', borderRadius: 2 }}
              />
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ width: 28, height: 28, bgcolor: '#1976d2', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>3</Box>
              <TextField
                label="Amount (₱)"
                type="number"
                fullWidth
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                inputProps={{ min: 1, step: '0.01' }}
                sx={{ bgcolor: '#fff', borderRadius: 2 }}
                error={!amount || Number(amount) <= 0}
                helperText={!amount || Number(amount) <= 0 ? 'Enter a valid amount.' : 'Minimum ₱1'}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 4, pb: 2, bgcolor: '#f8fafc', borderBottomLeftRadius: 4, borderBottomRightRadius: 4, boxShadow: 1 }}>
          <Button onClick={() => setOpenAddDialog(false)} color="error" variant="outlined" sx={{ borderRadius: 2, minWidth: 100, fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            onClick={handleOpenConfirmDialog}
            color="primary"
            variant="contained"
            disabled={adding || !selectedDate || !amount || Number(amount) <= 0}
            sx={{ borderRadius: 2, minWidth: 100, fontWeight: 600, boxShadow: 2 }}
          >
            {adding ? <CircularProgress size={18} color="inherit" /> : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Entry */}

      <Dialog
  open={confirmDialogOpen}
  onClose={() => setConfirmDialogOpen(false)}
  fullWidth
  maxWidth="xs"
>
  <DialogTitle>Confirm Payback Entry</DialogTitle>
  <DialogContent dividers>
    <Typography>
      Are you sure you want to submit this payback entry of ₱{amount}?
    </Typography>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setConfirmDialogOpen(false)} color="error">
      Cancel
    </Button>
    <Button
      onClick={async () => {
        setConfirmDialogOpen(false);
        await handleAddPayback(); // Proceed with adding
      }}
      color="primary"
      variant="contained"
      disabled={adding}
    >
      {adding ? <CircularProgress size={18} color="inherit" /> : "Confirm"}
    </Button>
  </DialogActions>
</Dialog>

      {/* Removed: Payback Entry Details Dialog (viewDialogOpen, selectedEntry) */}

      {/* Removed: Expired Entries Dialog */}

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
                const profitStatus = expirationDate > now ? "Pending" : "Profit Earn";
                const profitIcon = profitStatus === "Pending" ? "⏳" : "✅";
                // Only allow transfer if profit is earned and not transferred
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
                        borderLeft: `4px solid ${profitStatus === "Profit Earn" ? '#4caf50' : '#1976d2'}`,
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
                          boxShadow: `0 4px 16px 0 ${profitStatus === "Profit Earn" ? '#4caf50' : '#1976d2'}33`,
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ fontSize: 22, color: profitStatus === "Profit Earn" ? '#4caf50' : '#1976d2', mr: 1 }}>{profitIcon}</Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.1, color: '#fff' }}>
                          2% Profit
                        </Typography>
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: profitStatus === "Profit Earn" ? '#4caf50' : '#1976d2', mb: 0.5, fontSize: 18, letterSpacing: 0.1 }}>
                        ₱{profit.toFixed(2)}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                        <Typography
                          sx={{
                            px: 1.2,
                            py: 0.3,
                            borderRadius: 1,
                            bgcolor: e.status === "Approved" ? "#1976d2" : "#c62828",
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        >
                          Status: {e.status || "Pending"}
                        </Typography>
                        <Typography
                          sx={{
                            px: 1.2,
                            py: 0.3,
                            borderRadius: 1,
                            bgcolor: profitStatus === "Profit Earn" ? "#388e3c" : "#ef6c00",
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
  );
};

export default MemberPayback;