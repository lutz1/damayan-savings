// src/pages/MemberCapitalShare.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Card,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Backdrop,
  Grid,
  Toolbar,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
// 🔹 CHANGE: react-big-calendar imports
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import bgImage from "../../assets/bg.jpg";
import { auth, db } from "../../firebase";
import ProfitHistoryDialog from "./components/dialogs/ProfitHistoryDialog";
import AddCapitalShareDialog from "./components/dialogs/AddCapitalShareDialog";
import EntryDetailsDialog from "./components/dialogs/EntryDetailsDialog";
import CapitalShareTransactions from "./components/CapitalShareTransactions";


const MIN_AMOUNT = 2400;
const LOCK_IN = 5000;
const MONTHLY_RATE = 0.05;


const MemberCapitalShare = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [codes, setCodes] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [openDialog, setOpenDialog] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [amount, setAmount] = useState("");

  // Removed unused historyDialogOpen state
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [capitalAmount, setCapitalAmount] = useState(0);
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [profitHistoryOpen, setProfitHistoryOpen] = useState(false);
  const [profitConfirmOpen, setProfitConfirmOpen] = useState(false);
  const [selectedProfitEntry, setSelectedProfitEntry] = useState(null);
  const [profitTransferLoading, setProfitTransferLoading] = useState(false);
  const [entryDetailsOpen, setEntryDetailsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);


  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  const fetchUserData = useCallback(async (currentUser) => {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        
        // ✅ CHECK: Validate if activation has expired after 1 year
        let activationExpired = false;
        if (data.capitalShareActive && data.capitalActivatedAt) {
          const activatedAt = data.capitalActivatedAt.toDate ? data.capitalActivatedAt.toDate() : new Date(data.capitalActivatedAt);
          const expirationDate = new Date(activatedAt);
          expirationDate.setFullYear(expirationDate.getFullYear() + 1);
          
          const now = new Date();
          if (now > expirationDate) {
            // Activation expired - need to reactivate to ADD NEW ENTRIES
            activationExpired = true;
          }
        }
        
        setUserData({ ...data, activationExpired });

        // Fetch available codes if activation is expired OR not active
        if (!data.capitalShareActive || activationExpired) {
          const codesRef = collection(db, "purchaseCodes");
          const q = query(
            codesRef,
            where("userId", "==", currentUser.uid),
            where("used", "==", false),
            where("type", "==", "Activate Capital Share")
          );
          const querySnap = await getDocs(q);
          const codeList = querySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setCodes(codeList);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const processMonthlyProfit = useCallback(async () => {
    if (!user) return;
    try {
      const entriesRef = collection(db, "capitalShareEntries");
      const q = query(
        entriesRef,
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const now = new Date();

      const updates = [];

      snap.docs.forEach((docEntry) => {
        const data = docEntry.data();
        
        // 🔹 Skip profit calculation if entry has been transferred
        if (data.profitEnabled === false) {
          return;
        }
        
        let nextProfitDate = data.nextProfitDate?.toDate ? data.nextProfitDate.toDate() : data.nextProfitDate;
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt;
        const expireDate = new Date(createdAt);
        expireDate.setFullYear(expireDate.getFullYear() + 1);

        if (now >= nextProfitDate && now <= expireDate) {
          const profitAmount = (data.amount || 0) * MONTHLY_RATE;
          updates.push({
            id: docEntry.id,
            newProfit: (data.profit || 0) + profitAmount,
            nextProfitDate: new Date(nextProfitDate.setMonth(nextProfitDate.getMonth() + 1)),
          });
        }
      });

      for (const u of updates) {
        const entryRef = doc(db, "capitalShareEntries", u.id);
        await updateDoc(entryRef, {
          profit: u.newProfit,
          nextProfitDate: u.nextProfitDate,
        });
      }
    } catch (err) {
      console.error("Error processing monthly profit:", err);
    }
  }, [user]);

  const fetchTransactionHistory = useCallback(async () => {
  if (!user) return;
  try {
    await processMonthlyProfit();

    const q = query(
      collection(db, "capitalShareEntries"),
      where("userId", "==", user.uid)
    );
    const snap = await getDocs(q);
    
    // 🔹 Sort entries by createdAt in JavaScript (ascending)
    const sortedDocs = snap.docs.sort((a, b) => {
      const dateA = a.data().createdAt?.toDate?.() || new Date(0);
      const dateB = b.data().createdAt?.toDate?.() || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });

    const now = new Date();
    let totalCapital = 0;
    let totalProfit = 0;
    const calendarData = [];
    
    // 🔹 Retroactively assign lock-in to old entries if missing
    let cumulativeLockIn = 0;
    const entriesToUpdate = [];
    
    sortedDocs.forEach((docSnap) => {
      const data = docSnap.data();
      
      if (!data.lockInPortion) {
        const remainingLockInNeeded = Math.max(0, LOCK_IN - cumulativeLockIn);
        const lockInPortion = remainingLockInNeeded > 0 
          ? Math.min(data.amount || 0, remainingLockInNeeded)
          : 0;
        const transferablePortion = (data.amount || 0) - lockInPortion;
        
        entriesToUpdate.push({
          docRef: docSnap.ref,
          lockInPortion,
          transferablePortion,
          transferableAfterDate: data.transferableAfterDate || new Date(data.createdAt.toDate().getTime() + 30 * 24 * 60 * 60 * 1000),
        });
        
        cumulativeLockIn += lockInPortion;
      } else {
        cumulativeLockIn += data.lockInPortion || 0;
      }
    });
    
    // Update old entries in background (non-blocking)
    if (entriesToUpdate.length > 0) {
      entriesToUpdate.forEach(async (update) => {
        await updateDoc(update.docRef, {
          lockInPortion: update.lockInPortion,
          transferablePortion: update.transferablePortion,
          transferableAfterDate: update.transferableAfterDate,
        });
      });
    }

    const history = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      const entry = { id: docSnap.id, ...data };
      
      // 🔹 Apply retroactive lock-in if missing
      if (!entry.lockInPortion) {
        const updateInfo = entriesToUpdate.find(u => u.docRef.id === docSnap.id);
        if (updateInfo) {
          entry.lockInPortion = updateInfo.lockInPortion;
          entry.transferablePortion = updateInfo.transferablePortion;
          entry.transferableAfterDate = updateInfo.transferableAfterDate;
        }
      }

      if (entry.nextProfitDate && typeof entry.nextProfitDate.toDate === "function") {
        entry.nextProfitDate = entry.nextProfitDate.toDate();
      }
      if (entry.createdAt && typeof entry.createdAt.toDate === "function") {
        entry.createdAt = entry.createdAt.toDate();
      }
      if (entry.date && typeof entry.date.toDate === "function") {
        entry.date = entry.date.toDate();
      }
      if (entry.transferableAfterDate && typeof entry.transferableAfterDate.toDate === "function") {
        entry.transferableAfterDate = entry.transferableAfterDate.toDate();
      } else if (entry.transferableAfterDate && typeof entry.transferableAfterDate === "number") {
        entry.transferableAfterDate = new Date(entry.transferableAfterDate);
      }

      entry.profitStatus = entry.profitStatus || "Pending";
      entry.profit = entry.profit || 0;

      const createdAt = entry.createdAt || new Date();
      const expireDate = new Date(createdAt);
      expireDate.setFullYear(expireDate.getFullYear() + 1);
      const isActive = now <= expireDate;

      if (isActive) {
        // ✅ Include full amount
        totalCapital += entry.amount || 0;

        // 🧮 Sum unclaimed profit
        if (entry.profitStatus !== "Claimed") {
          totalProfit += entry.profit || 0;
        }

        // 📅 Calendar entry
        calendarData.push({
          date: new Date(entry.date),
          profitReady: entry.nextProfitDate <= now,
          createdAt: createdAt,
        });
      }

      return entry;
    });
    
    // 🔹 Reverse to descending order for display
    history.reverse();

    setTransactionHistory(history);
    setCapitalAmount(totalCapital);
    setMonthlyProfit(totalProfit);
    // setCalendarEntries(calendarData); // Calendar removed
  } catch (err) { 
    console.error("Error fetching capital share data:", err);
  }
}, [user, processMonthlyProfit]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchUserData(currentUser);
        await fetchTransactionHistory();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserData, fetchTransactionHistory]);

  const handleActivate = async () => {
    if (!selectedCode) return alert("Please select a code to activate Capital Share.");
    try {
      setLoading(true);
      const codeRef = doc(db, "purchaseCodes", selectedCode);
      await updateDoc(codeRef, { used: true, usedAt: serverTimestamp() });

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        capitalShareActive: true,
        capitalActivatedAt: serverTimestamp(),
      });

      alert("✅ Capital Share successfully activated!");
      setSelectedCode("");
      await fetchUserData(user);
    } catch (err) {
      console.error(err);
      alert("Activation failed.");
    } finally {
      setLoading(false);
      setOpenDialog(false);
    }
  };

  const handleAddEntry = async () => {
    const entryAmount = Number(amount);
    const walletBalance = Number(userData?.eWallet || 0);
    if (!entryAmount || entryAmount < MIN_AMOUNT)
      return alert(`Minimum amount is ₱${MIN_AMOUNT}`);
    if (entryAmount > walletBalance)
      return alert("Insufficient wallet balance.");

    try {
      // 🔹 Get ID token
      const idToken = await user.getIdToken();
      const API_BASE = process.env.REACT_APP_API_BASE_URL || "https://damayan-savings-backend.onrender.com";

      // 🔹 Call backend to create capital share entry
      const response = await fetch(`${API_BASE}/api/add-capital-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          amount: entryAmount,
          entryDate: selectedDate.toISOString(),
          referredBy: userData?.referredBy || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return alert(`❌ ${result.error || "Failed to add entry"}`);
      }

      alert("✅ Capital Share entry added successfully!");
      setAmount("");
      setOpenAddDialog(false);
      await fetchUserData(user);
      await fetchTransactionHistory();
    } catch (err) {
      console.error("Error adding capital share entry:", err);
      alert("❌ Failed to add entry.");
    }
  };

  const handleTransferProfitEntry = async (entry) => {
    if (!entry?.profit || entry.profit <= 0) return alert("No profit available for this entry.");
    if (entry.profitStatus === "Claimed") return alert("This profit was already claimed.");

    try {
      const API_BASE = process.env.REACT_APP_API_BASE_URL || "https://damayan-savings-backend.onrender.com";
      const idToken = await user.getIdToken();
      const response = await fetch(`${API_BASE}/api/transfer-profit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          entryId: entry.id,
          amount: entry.profit,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return alert(`❌ ${result.error || "Profit transfer failed."}`);
      }

      alert(`✅ Transferred ₱${entry.profit.toLocaleString()} to wallet.`);
      await fetchUserData(user);
      await fetchTransactionHistory();
    } catch (err) {
      console.error("Profit transfer error:", err);
      alert("❌ Profit transfer failed.");
    }
  };

  const handleTransferCapitalToWallet = async (entry) => {
    const now = new Date();
    const transferableAfterDate = entry.transferableAfterDate instanceof Date
      ? entry.transferableAfterDate
      : entry.transferableAfterDate?.toDate?.();

    // Check if past transferable date
    if (!transferableAfterDate || now < transferableAfterDate) {
      return alert("❌ This entry is not yet transferable. Please wait until the 1-month period has passed.");
    }

    // Check if there's transferable portion
    if (!entry.transferablePortion || entry.transferablePortion <= 0) {
      return alert("❌ No transferable portion available for this entry.");
    }

    // Check if already transferred
    if (entry.transferredAmount && entry.transferredAmount >= entry.transferablePortion) {
      return alert("❌ This entry has already been fully transferred.");
    }

    const transferAmount = entry.transferablePortion - (entry.transferredAmount || 0);

    try {
      const API_BASE = process.env.REACT_APP_API_BASE_URL || "https://damayan-savings-backend.onrender.com";
      const idToken = await user.getIdToken();
      const response = await fetch(`${API_BASE}/api/transfer-capital-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          entryId: entry.id,
          amount: transferAmount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return alert(`❌ ${result.error || "Transfer failed."}`);
      }

      alert(`✅ Transferred ₱${transferAmount.toLocaleString()} to wallet.\n\n⚠️ Monthly profit generation for this entry has been stopped.`);
      await fetchUserData(user);
      await fetchTransactionHistory();
    } catch (err) {
      console.error("Capital share transfer error:", err);
      alert("❌ Transfer failed.");
    }
  };

  if (loading)
    return (
      <Backdrop open>
        <CircularProgress color="inherit" />
      </Backdrop>
    );

  // Removed: handleSelectEvent (no longer used)

  // Removed: eventStyleGetter (no longer used)

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

      <Box sx={{ zIndex: 5, position: isMobile ? "fixed" : "relative", height: "100%", transition: "all 0.3s ease" }}>
        <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 4 },
          mt: 0,
          pb: { xs: 12, sm: 12, md: 12 },
          color: "white",
          overflowY: "auto",
          maxHeight: "100vh",
          position: "relative",
          width: "100%",
          transition: "all 0.3s ease",
        }}
      >
        <Toolbar />
        {/* Header Section */}
        <Box sx={{ mb: 4, width: '100%', maxWidth: 900 }}>
          <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 900, letterSpacing: 1, mb: 1, color: '#fff', textShadow: '0 2px 12px #000a' }}>
            Member <span style={{ color: '#4FC3F7' }}>Capital Share</span> Dashboard
          </Typography>
          <Typography variant="h6" sx={{ color: '#b0bec5', fontWeight: 500, mb: 1.5, textShadow: '0 1px 8px #0006' }}>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>💰 Grow Capital</Box>
            <Box component="span" sx={{ mx: 1, color: '#4FC3F7' }}>•</Box>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>📈 Earn Monthly Profit</Box>
            <Box component="span" sx={{ mx: 1, color: '#4FC3F7' }}>•</Box>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>📝 Manage Shares</Box>
          </Typography>
        </Box>



        <Grid container spacing={2.5} sx={{ mb: 4, width: '100%', maxWidth: 900, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          {/* Capital Share Card - full width on mobile */}
          <Grid item xs={12} md={12} sx={{ mb: { xs: 2, md: 0 }, display: 'flex', width: '100%' }}>
            <Card
              sx={{
                background: `linear-gradient(120deg, rgba(231,237,241,0.27), rgba(33,150,243,0.08))`,
                backdropFilter: "blur(14px)",
                border: `2px solid #4FC3F733`,
                borderRadius: "18px",
                p: 3,
                width: '100%',
                minWidth: 0,
                boxShadow: `0 4px 24px 0 rgba(33,150,243,0.10)`,
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
                  background: `radial-gradient(circle, #4FC3F720, transparent)`,
                  borderRadius: "50%",
                },
                '&:hover': {
                  transform: "translateY(-10px) scale(1.03)",
                  boxShadow: `0 20px 50px #4FC3F755`,
                  border: `2.5px solid #4FC3F766`,
                },
              }}
            >
              <Box sx={{ position: "relative", zIndex: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                  <Box sx={{ fontSize: "2.5rem" }}>💰</Box>
                </Box>
                <Typography variant="body2" sx={{ opacity: 1, mb: 1, color: "#fff", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, textShadow: '1px 1px 4px #000' }}>
                  Capital Share
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#4FC3F7", mb: 1, lineHeight: 1, textShadow: '1px 1px 4px #000' }}>
                  ₱{Number(capitalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                {capitalAmount > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="body2" sx={{ color: '#b0bec5', fontWeight: 600, fontSize: 13 }}>
                      🔒 Lock-in (5,000 target): ₱{Math.min(
                        transactionHistory.reduce((sum, t) => sum + (t.lockInPortion || 0), 0),
                        LOCK_IN
                      ).toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Card>
          </Grid>
          {/* Monthly Profit Card - responsive */}
          <Grid item xs={12} md={6} sx={{ display: 'flex', width: '100%' }}>
            <Card
              sx={{
                background: `linear-gradient(120deg, rgba(129,199,132,0.15) 80%, rgba(255,255,255,0.04))`,
                backdropFilter: "blur(14px)",
                border: `2px solid #81C78433`,
                borderRadius: "18px",
                p: 3,
                width: '100%',
                minWidth: 0,
                boxShadow: `0 4px 24px 0 #81C78422`,
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
                  background: `radial-gradient(circle, #81C78420, transparent)`,
                  borderRadius: "50%",
                },
                '&:hover': {
                  transform: "translateY(-10px) scale(1.03)",
                  boxShadow: `0 20px 50px #81C78455`,
                  border: `2.5px solid #81C78466` ,
                },
              }}
            >
              <Box sx={{ position: "relative", zIndex: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                  <Box sx={{ fontSize: "2.5rem" }}>📈</Box>
                </Box>
                <Typography variant="body2" sx={{ opacity: 1, mb: 1, color: "#fff", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, textShadow: '1px 1px 4px #000' }}>
                  Monthly Profit (5%)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#81C784", mb: 1, lineHeight: 1, textShadow: '1px 1px 4px #000' }}>
                  ₱{Number(monthlyProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Button
                  variant="contained"
                  sx={{ mt: 2, width: "100%", fontWeight: 700, borderRadius: 2, textTransform: 'none', px: 2.5, py: 1, fontSize: 15 }}
                  onClick={() => setProfitHistoryOpen(true)}
                >
                  View Monthly Profit History
                </Button>
              </Box>
            </Card>
          </Grid>
          {/* Add Capital Share Button */}
          <Grid item xs={12} md={6} sx={{ display: 'flex', width: '100%' }}>
            <Card
              sx={{
                background: `linear-gradient(120deg, rgba(231,237,241,0.27), rgba(33,150,243,0.08))`,
                borderRadius: 3,
                p: 3,
                minHeight: 220,
                width: '100%',
                maxWidth: 900,
                boxShadow: '0 4px 24px 0 rgba(33,150,243,0.10)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              <Typography variant="body2" sx={{ opacity: 1, mb: 1, color: "#1976d2", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, textShadow: '1px 1px 4px #0001' }}>
                Instruction
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, mb: 2, color: "#607d8b", fontWeight: 600, fontSize: 13 }}>
                📝 To add a capital share entry:
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: "#607d8b", fontWeight: 600, fontSize: 13 }}>
                1. Click "Add Capital Share" button below
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: "#607d8b", fontWeight: 600, fontSize: 13 }}>
                2. Select the date and enter amount (min ₱1,000)
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: "#607d8b", fontWeight: 600, fontSize: 13 }}>
                3. Confirm to deduct from your E-Wallet
              </Typography>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                sx={{ mt: 1, fontWeight: 700, borderRadius: 2, textTransform: 'none', px: 2.5, py: 1, fontSize: 15 }}
                onClick={() => {
                  if (!userData?.capitalShareActive) {
                    alert("Activate Capital Share first.");
                    return;
                  }
                  if (userData?.activationExpired) {
                    alert("⚠️ Your Capital Share activation has expired. Please activate a new code to add new entries.");
                    setOpenDialog(true);
                    return;
                  }
                  setSelectedDate(new Date());
                  setOpenAddDialog(true);
                }}
              >
                Add Capital Share
              </Button>
              {/* Moved Transaction History Button Below */}
              </Card>
          </Grid>
        </Grid>




        {/* Add Capital Share Dialog */}
        <AddCapitalShareDialog
          open={openAddDialog}
          onClose={() => setOpenAddDialog(false)}
          amount={amount}
          setAmount={setAmount}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          userData={userData}
          MIN_AMOUNT={MIN_AMOUNT}
          onConfirm={handleAddEntry}
        />

        {/* Activation Overlay - Only show if NOT activated at all */}
        {!userData?.capitalShareActive && !userData?.activationExpired && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9,
            }}
          >
            <Card sx={{ p: 4, width: 400, textAlign: "center" }}>
              <Typography variant="h6" gutterBottom>
                🧩 Capital Share Not Activated
              </Typography>
              {codes.length > 0 ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    You have available <strong>Activate Capital Share</strong> codes.
                  </Typography>
                  <Button sx={{ mt: 2 }} variant="contained" onClick={() => setOpenDialog(true)}>
                    Activate Now
                  </Button>
                </>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary">
                    You don’t have an activation code yet.
                  </Typography>
                  <Button
                    sx={{ mt: 2 }}
                    variant="contained"
                    color="secondary"
                    onClick={() => alert("Please purchase an 'Activate Capital Share' code first.")}
                  >
                    Purchase Code
                  </Button>
                </>
              )}
            </Card>
          </Box>
        )}

        {/* Activate Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="xs" PaperProps={{
          sx: {
            background: `linear-gradient(120deg, rgba(30, 41, 59, 0.95), rgba(33, 47, 61, 0.9))`,
            backdropFilter: "blur(14px)",
            border: `1px solid rgba(79, 195, 247, 0.2)`,
          }
        }}>
          <DialogTitle sx={{ bgcolor: "rgba(31, 150, 243, 0.15)", color: "#4FC3F7", fontWeight: 700, borderBottom: "1px solid rgba(79, 195, 247, 0.15)" }}>Activate Capital Share</DialogTitle>
          <DialogContent sx={{ bgcolor: "transparent", mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 2, color: "#FFB74D", fontWeight: 600 }}>
              ℹ️ Activation is valid for 1 year. After 1 year, you'll need to activate a new code to continue.
            </Typography>
            <TextField
              select
              fullWidth
              SelectProps={{ native: true }}
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { color: '#b0bec5' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(79, 195, 247, 0.3)' }, '& .MuiInputBase-input': { color: '#b0bec5' } }}
              inputProps={{ style: { color: '#b0bec5' } }}
            >
              <option value="">-- Select Code --</option>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions sx={{ borderTop: "1px solid rgba(79, 195, 247, 0.15)", pt: 2 }}>
            <Button onClick={() => setOpenDialog(false)} sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', color: '#4FC3F7' }}>Cancel</Button>
            <Button variant="contained" onClick={handleActivate} sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', bgcolor: '#1976d2' }}>
              Activate
            </Button>
          </DialogActions>
        </Dialog>

        {/* History Dialog */}
        {/* Capital Share Transactions Section - always visible below Add Capital Share */}
        <CapitalShareTransactions
          transactionHistory={transactionHistory}
          onViewDetails={(entry) => {
            setEntryDetailsOpen(true);
            setSelectedEntry(entry);
          }}
          onTransferCapital={handleTransferCapitalToWallet}
        />

        {/* Monthly Profit History Dialog */}
        <ProfitHistoryDialog
          open={profitHistoryOpen}
          onClose={() => setProfitHistoryOpen(false)}
          transactionHistory={transactionHistory}
          onTransferProfit={(entry) => {
            setSelectedProfitEntry(entry);
            setProfitConfirmOpen(true);
          }}
        />

        {/* Confirm Profit Transfer Dialog */}
        <Dialog
          open={profitConfirmOpen}
          onClose={() => {
            setProfitConfirmOpen(false);
            setSelectedProfitEntry(null);
          }}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            sx: {
              background: `linear-gradient(120deg, rgba(30, 41, 59, 0.95), rgba(33, 47, 61, 0.9))`,
              backdropFilter: "blur(14px)",
              border: `1px solid rgba(79, 195, 247, 0.2)`,
            }
          }}
        >
          <DialogTitle sx={{ bgcolor: "rgba(31, 150, 243, 0.15)", color: "#4FC3F7", fontWeight: 700, borderBottom: "1px solid rgba(79, 195, 247, 0.15)" }}>Confirm Transfer</DialogTitle>
          <DialogContent sx={{ bgcolor: "transparent", mt: 2 }}>
            <Typography sx={{ color: '#b0bec5' }}>
              Transfer profit of ₱{Number(selectedProfitEntry?.profit || 0).toLocaleString()} to your wallet?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ borderTop: "1px solid rgba(79, 195, 247, 0.15)", pt: 2 }}>
            <Button
              onClick={() => {
                setProfitConfirmOpen(false);
                setSelectedProfitEntry(null);
              }}
              disabled={profitTransferLoading}
              sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', color: '#4FC3F7' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={profitTransferLoading}
              onClick={async () => {
                if (!selectedProfitEntry) return;
                setProfitTransferLoading(true);
                try {
                  await handleTransferProfitEntry(selectedProfitEntry);
                  setProfitConfirmOpen(false);
                  setSelectedProfitEntry(null);
                } finally {
                  setProfitTransferLoading(false);
                }
              }}
              sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', bgcolor: '#1976d2' }}
            >
              {profitTransferLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Entry Details Dialog */}
        <EntryDetailsDialog
          open={entryDetailsOpen}
          onClose={() => {
            setEntryDetailsOpen(false);
            setSelectedEntry(null);
          }}
          selectedEntry={selectedEntry}
        />
      </Box>

      <style>{`
        .active-entry {
          background: rgba(76, 175, 80, 0.3) !important;
          border-radius: 50%;
        }
        .profit-ready {
          background: rgba(255, 193, 7, 0.5) !important;
          border-radius: 50%;
        }
      `}</style>
    </Box>
  );
};

export default MemberCapitalShare;