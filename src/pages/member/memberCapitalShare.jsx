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
  addDoc,
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


const MIN_AMOUNT = 1000;
const LOCK_IN = 5000;
const MONTHLY_RATE = 0.05;
const TRANSFER_CHARGE = 0.01;


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
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
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
        let capitalShareActive = data.capitalShareActive;
        if (data.capitalShareActive && data.capitalActivatedAt) {
          const activatedAt = data.capitalActivatedAt.toDate ? data.capitalActivatedAt.toDate() : new Date(data.capitalActivatedAt);
          const expirationDate = new Date(activatedAt);
          expirationDate.setFullYear(expirationDate.getFullYear() + 1);
          
          const now = new Date();
          if (now > expirationDate) {
            // Activation expired - reset and show activation overlay
            capitalShareActive = false;
            await updateDoc(userRef, { capitalShareActive: false });
          }
        }
        
        setUserData({ ...data, capitalShareActive });

        if (!capitalShareActive) {
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
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);

    const now = new Date();
    let totalCapital = 0;
    let totalProfit = 0;
    const calendarData = [];

    const history = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      const entry = { id: docSnap.id, ...data };

      if (entry.nextProfitDate && typeof entry.nextProfitDate.toDate === "function") {
        entry.nextProfitDate = entry.nextProfitDate.toDate();
      }
      if (entry.createdAt && typeof entry.createdAt.toDate === "function") {
        entry.createdAt = entry.createdAt.toDate();
      }
      if (entry.date && typeof entry.date.toDate === "function") {
        entry.date = entry.date.toDate();
      }

      entry.profitStatus = entry.profitStatus || "Pending";
      entry.profit = entry.profit || 0;

      const createdAt = entry.createdAt || new Date();
      const expireDate = new Date(createdAt);
      expireDate.setFullYear(expireDate.getFullYear() + 1);
      const isActive = now <= expireDate;

      if (isActive) {
        // ✅ Include full amount (not just lock-in)
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
    const entriesRef = collection(db, "capitalShareEntries");
    const lockInAmount = Math.min(LOCK_IN, entryAmount);
    const transferableAmount =
      entryAmount > LOCK_IN ? entryAmount - LOCK_IN : 0;

    // 🔹 Add capital share entry
    await addDoc(entriesRef, {
      userId: user.uid,
      amount: entryAmount,
      date: selectedDate,
      profit: 0,
      profitStatus: "Pending",
      lockIn: lockInAmount,
      transferable: transferableAmount,
      status: "Approved",
      createdAt: serverTimestamp(),
      nextProfitDate: new Date(
        new Date().setMonth(new Date().getMonth() + 1)
      ),
    });

    // 🔹 Deduct from user wallet
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { eWallet: walletBalance - entryAmount });

    // 🔹 Store 5% upline bonus in override collection (using referredBy)
    if (userData?.referredBy) {
      const uplineQuery = query(
        collection(db, "users"),
        where("username", "==", userData.referredBy)
      );
      const snap = await getDocs(uplineQuery);
      if (!snap.empty) {
        const upline = snap.docs[0];
        const uplineBonus = entryAmount * 0.05;
        const releaseDate = new Date(
          new Date().setMonth(new Date().getMonth() + 1)
        );

        await addDoc(collection(db, "override"), {
          uplineId: upline.id,
          fromUserId: user.uid,
          fromUsername: userData.username || "",
          uplineUsername: userData.referredBy,
          amount: uplineBonus,
          type: "Upline Capital Share Bonus",
          status: "Pending",
          createdAt: serverTimestamp(),
          releaseDate,
        });

        // 🧾 Debug logs
        console.log("✅ Upline Bonus Recorded!");
        console.log(`Upline Username: ${userData.referredBy}`);
        console.log(`Bonus Amount: ₱${uplineBonus.toFixed(2)}`);
        console.log(`Release Date (after 1 month):`, releaseDate);
      } else {
        console.warn("⚠️ No upline found for referredBy:", userData.referredBy);
      }
    } else {
      console.log("ℹ️ No referredBy/upline, skipping upline bonus.");
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

  const handleTransferCapitalShare = async (entry) => {
    const now = new Date();
    const createdAt = entry.createdAt?.toDate ? entry.createdAt.toDate() : entry.createdAt;
    if ((entry.lockIn || 0) < LOCK_IN) return alert("Capital below ₱5000 is not transferable.");
    if ((now - createdAt) / (1000 * 60 * 60 * 24) < 30) return alert("Capital transferable only after 1 month.");

    const transferAmount = Number(
      prompt(`Enter amount to transfer (max ₱${entry.lockIn.toLocaleString()}):`, entry.lockIn)
    );
    if (!transferAmount || transferAmount <= 0) return;
    if (transferAmount > entry.lockIn) return alert("Exceeds transferable capital.");

    const fee = transferAmount * TRANSFER_CHARGE;
    const net = transferAmount - fee;
    const walletBalance = Number(userData?.eWallet || 0);

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { eWallet: walletBalance + net });

      const entryRef = doc(db, "capitalShareEntries", entry.id);
      await updateDoc(entryRef, { lockIn: entry.lockIn - transferAmount });

      alert(`Transferred ₱${net.toLocaleString()} to wallet (1% fee applied).`);
      await fetchUserData(user);
      await fetchTransactionHistory();
    } catch (err) {
      console.error(err);
      alert("Transfer failed.");
    }
  };

  const handleTransferProfitEntry = async (entry) => {
    if (!entry?.profit || entry.profit <= 0) return alert("No profit available for this entry.");
    if (entry.profitStatus === "Claimed") return alert("This profit was already claimed.");

    const net = entry.profit; // No fee for profit transfers
    const walletBalance = Number(userData?.eWallet || 0);

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { eWallet: walletBalance + net });

      // Log to deposits so wallet history can display (deposits create is permitted by rules)
      await addDoc(collection(db, "deposits"), {
        userId: user.uid,
        amount: net,
        status: "Approved",
        type: "Monthly Profit Transfer",
        sourceEntryId: entry.id,
        createdAt: serverTimestamp(),
      });

      const entryRef = doc(db, "capitalShareEntries", entry.id);
      await updateDoc(entryRef, {
        profitStatus: "Claimed",
        profitClaimedAmount: entry.profit,
        profitClaimedAt: serverTimestamp(),
      });

      alert(`Transferred ₱${net.toLocaleString()} to wallet.`);
      await fetchUserData(user);
      await fetchTransactionHistory();
    } catch (err) {
      console.error(err);
      alert("Profit transfer failed.");
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
                background: `linear-gradient(120deg, rgba(79,195,247,0.15) 80%, rgba(255,255,255,0.04))`,
                backdropFilter: "blur(14px)",
                border: `2px solid #4FC3F733`,
                borderRadius: "18px",
                p: 3,
                width: '100%',
                minWidth: 0,
                boxShadow: `0 4px 24px 0 #4FC3F722`,
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
                      🔒 Lock-in: ₱{Math.min(capitalAmount, LOCK_IN).toLocaleString()}
                    </Typography>
                    {capitalAmount > LOCK_IN && (
                      <Typography variant="body2" sx={{ color: '#b0bec5', fontWeight: 600, fontSize: 13 }}>
                        💼 Transferable: ₱{(capitalAmount - LOCK_IN).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                )}
                {capitalAmount >= LOCK_IN && (
                  <Button
                    variant="contained"
                    sx={{ mt: 2, fontWeight: 700, borderRadius: 2, textTransform: 'none', px: 2.5, py: 1, fontSize: 15 }}
                    onClick={() => handleTransferCapitalShare(transactionHistory[0])}
                  >
                    Transfer Capital to Wallet
                  </Button>
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




        {/* Add Entry Dialog */}
        <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} fullWidth maxWidth="xs">
          <DialogTitle>Add Capital Share Entry</DialogTitle>
          <DialogContent>
            <TextField
              label="Selected Date"
              type="date"
              fullWidth
              value={selectedDate ? selectedDate.toISOString().slice(0, 10) : ''}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              sx={{ mb: 2, mt: 1 }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Amount (₱)"
              type="number"
              fullWidth
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              sx={{ mb: 2 }}
              inputProps={{ min: MIN_AMOUNT }}
            />
            <TextField
            label="Upline Username"
            fullWidth
            value={userData?.referredBy || "No Upline"}
            InputProps={{ readOnly: true }}
            sx={{ mb: 2 }}
          />
          </DialogContent>
          <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => setConfirmDialogOpen(true)}
          >
            Submit
          </Button>
        </DialogActions>

        <Dialog
          open={confirmDialogOpen}
          onClose={() => setConfirmDialogOpen(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Confirm Submission</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to add a capital share entry of ₱{Number(amount).toLocaleString()} on {selectedDate?.toDateString()}?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={async () => {
                setConfirmDialogOpen(false);
                await handleAddEntry();
              }}
            >
              Confirm
            </Button>
          </DialogActions>
                </Dialog>
        </Dialog>
        {/* Activation Overlay */}
        {!userData?.capitalShareActive && (
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
              {userData?.capitalActivatedAt && (
                <Typography variant="body2" color="error" sx={{ mb: 2, fontWeight: 600 }}>
                  ⚠️ Your previous activation has expired. Please activate a new code to continue.
                </Typography>
              )}
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
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="xs">
          <DialogTitle>Activate Capital Share</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2, color: "#1976d2", fontWeight: 600 }}>
              ℹ️ Activation is valid for 1 year. After 1 year, you'll need to activate a new code to continue.
            </Typography>
            <TextField
              select
              fullWidth
              SelectProps={{ native: true }}
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
            >
              <option value="">-- Select Code --</option>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleActivate}>
              Activate
            </Button>
          </DialogActions>
        </Dialog>

        {/* History Dialog */}
        {/* Capital Share Transactions Section - always visible below Add Capital Share */}
        {/* Capital Share Transactions Section - styled like Payback Transactions */}
        <Card sx={{ background: "linear-gradient(120deg, rgba(231,237,241,0.27), rgba(33,150,243,0.08))", borderRadius: 3, p: 3, minHeight: 320, width: '100%', maxWidth: 900, boxShadow: '0 4px 24px 0 rgba(33,150,243,0.10)', mb: 4, height: { xs: '60vh', sm: '65vh', md: '70vh', lg: '75vh' }, display: 'flex', flexDirection: 'column', mx: 'auto' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2', mb: 2, letterSpacing: 0.5 }}>
            Capital Share Transactions
          </Typography>
          {transactionHistory.length > 0 ? (
            <Box sx={{ width: '100%', flex: 1, overflowY: 'auto', height: '100%' }}>
              {transactionHistory.map((t, idx) => {
                const now = new Date();
                const nextProfitDate = t.nextProfitDate instanceof Date
                  ? t.nextProfitDate
                  : t.nextProfitDate?.toDate?.();
                const profitStatus = nextProfitDate
                  ? nextProfitDate > now
                    ? "Pending"
                    : "Profit Earn"
                  : "-";
                const profitIcon = profitStatus === "Pending" ? "⏳" : profitStatus === "Profit Earn" ? "✅" : "";
                const borderColor = profitStatus === "Profit Earn" ? '#4caf50' : '#1976d2';
                const iconBg = profitStatus === "Profit Earn" ? '#e8f5e9' : '#e3f2fd';
                const iconColor = profitStatus === "Profit Earn" ? '#388e3c' : '#1976d2';
                return (
                  <Card key={idx} sx={{
                    mb: 2,
                    p: 2.5,
                    borderRadius: 3,
                    boxShadow: '0 2px 12px 0 #1976d222',
                    bgcolor: '#fff',
                    border: `2px solid ${borderColor}`,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 2,
                  }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                      <Box sx={{ fontSize: 32, bgcolor: iconBg, color: iconColor, borderRadius: '50%', width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px #0002', mb: 1 }}>
                        💰
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: iconColor, textAlign: 'center' }}>
                        {profitIcon} {profitStatus}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#1976d2', mb: 0.5 }}>
                        ₱{t.amount.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#607d8b', fontWeight: 600, mb: 0.5 }}>
                        Status: {t.status}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#607d8b', fontWeight: 600, mb: 0.5 }}>
                        Next Profit Date: {nextProfitDate ? nextProfitDate.toDateString() : "-"}
                      </Typography>
                      <Button
                        variant="outlined"
                        sx={{ mt: 1, fontWeight: 700, borderRadius: 2, textTransform: 'none', px: 2, py: 1, fontSize: 15 }}
                        onClick={() => {
                          setEntryDetailsOpen(true);
                          setSelectedEntry(t);
                        }}
                      >
                        View Details
                      </Button>
                    </Box>
                  </Card>
                );
              })}
            </Box>
          ) : (
            <Box display="flex" alignItems="center" justifyContent="center" height="80px">
              <Typography variant="h6" color="text.secondary" sx={{ fontSize: 16 }}>
                No capital share transactions found.
              </Typography>
            </Box>
          )}
        </Card>

        {/* Monthly Profit History Dialog */}
        <Dialog open={profitHistoryOpen} onClose={() => setProfitHistoryOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ bgcolor: "#1976d2", color: "#fff" }}>
            Monthly Profit History
          </DialogTitle>
          <DialogContent dividers sx={{ bgcolor: "#f5f5f5" }}>
            {transactionHistory.length > 0 ? (
              transactionHistory.map((t) => (
                <Box
                  key={t.id}
                  sx={{
                    mb: 2,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "#fff",
                    boxShadow: "0px 2px 6px rgba(0,0,0,0.15)",
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary">
                    Profit Amount
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#4caf50" }}>
                    ₱{Number(t.profit || 0).toLocaleString()}
                  </Typography>

                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                    <Typography
                      sx={{
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        bgcolor: t.profitStatus === "Claimed" ? "#e8f5e9" : "#fff3e0",
                        color: t.profitStatus === "Claimed" ? "#2e7d32" : "#ef6c00",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      Status: {t.profitStatus}
                    </Typography>

                    {t.nextProfitDate && (
                      <Typography
                        sx={{
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1,
                          bgcolor: "#e0f2f1",
                          color: "#004d40",
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        Next Profit: {t.nextProfitDate.toDateString()}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                    <Typography variant="body2">
                      Capital: ₱{Number(t.amount || 0).toLocaleString()}
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!t.profit || t.profit <= 0 || t.profitStatus === "Claimed"}
                      onClick={() => {
                        setSelectedProfitEntry(t);
                        setProfitConfirmOpen(true);
                      }}
                    >
                      Transfer To Wallet
                    </Button>
                  </Box>
                </Box>
              ))
            ) : (
              <Typography sx={{ textAlign: "center", py: 3 }}>
                No profit history yet.
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setProfitHistoryOpen(false)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirm Profit Transfer Dialog */}
        <Dialog
          open={profitConfirmOpen}
          onClose={() => {
            setProfitConfirmOpen(false);
            setSelectedProfitEntry(null);
          }}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Confirm Transfer</DialogTitle>
          <DialogContent>
            <Typography>
              Transfer profit of ₱{Number(selectedProfitEntry?.profit || 0).toLocaleString()} to your wallet?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setProfitConfirmOpen(false);
                setSelectedProfitEntry(null);
              }}
              disabled={profitTransferLoading}
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
        <Dialog
          open={entryDetailsOpen}
          onClose={() => {
            setEntryDetailsOpen(false);
            setSelectedEntry(null);
          }}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle sx={{ bgcolor: "#1976d2", color: "#fff" }}>
            Capital Share Entry Details
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            {selectedEntry && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Amount
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: "#4caf50", mb: 2 }}>
                  ₱{Number(selectedEntry.amount || 0).toLocaleString()}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Date Added
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {selectedEntry.date instanceof Date
                    ? selectedEntry.date.toDateString()
                    : selectedEntry.date?.toDate?.().toDateString() || "N/A"}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Current Profit
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  ₱{Number(selectedEntry.profit || 0).toLocaleString()}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Profit Status
                </Typography>
                <Typography
                  sx={{
                    mb: 2,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    bgcolor: selectedEntry.profitStatus === "Claimed" ? "#e8f5e9" : "#fff3e0",
                    color: selectedEntry.profitStatus === "Claimed" ? "#2e7d32" : "#ef6c00",
                    fontWeight: 600,
                    fontSize: 14,
                    display: "inline-block",
                  }}
                >
                  {selectedEntry.profitStatus || "Pending"}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                  Next Profit Date
                </Typography>
                <Typography variant="body1">
                  {selectedEntry.nextProfitDate instanceof Date
                    ? selectedEntry.nextProfitDate.toDateString()
                    : selectedEntry.nextProfitDate?.toDate?.().toDateString() || "N/A"}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setEntryDetailsOpen(false);
                setSelectedEntry(null);
              }}
              variant="contained"
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
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