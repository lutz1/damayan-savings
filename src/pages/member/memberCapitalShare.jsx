// src/pages/MemberCapitalShare.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
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
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import bgImage from "../../assets/bg.jpg";
import { auth, db } from "../../firebase";


const MIN_AMOUNT = 1000;
const LOCK_IN = 5000;
const MONTHLY_RATE = 0.05;
const TRANSFER_CHARGE = 0.01;

const locales = {
  "en-US": require("date-fns/locale/en-US"),
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

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

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [capitalAmount, setCapitalAmount] = useState(0);
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [calendarEntries, setCalendarEntries] = useState([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [profitHistoryOpen, setProfitHistoryOpen] = useState(false);
  const [profitConfirmOpen, setProfitConfirmOpen] = useState(false);
  const [selectedProfitEntry, setSelectedProfitEntry] = useState(null);
  const [profitTransferLoading, setProfitTransferLoading] = useState(false);
  const [entryDetailsOpen, setEntryDetailsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // 🔹 CHANGE: map calendarEntries to events for react-big-calendar
  const events = useMemo(() => {
    return calendarEntries.map((entry) => ({
      title: entry.profitReady ? "Profit Ready" : "Active",
      start: entry.date,
      end: entry.date,
      allDay: true,
      entry,
    }));
  }, [calendarEntries]);

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  const fetchUserData = useCallback(async (currentUser) => {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);

        if (!data.capitalShareActive) {
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
    setCalendarEntries(calendarData);
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

  const handleSelectEvent = (event) => {
    // Find the full entry from transactionHistory
    const entry = transactionHistory.find(t => {
      const entryDate = t.date instanceof Date ? t.date : t.date?.toDate?.();
      return entryDate?.toDateString() === event.start.toDateString();
    });
    if (entry) {
      setSelectedEntry(entry);
      setEntryDetailsOpen(true);
    }
  };

  const eventStyleGetter = (event) => { // 🔹 CHANGE
    const style = {
      backgroundColor: event.entry.profitReady ? "rgba(255, 193, 7, 0.5)" : "rgba(76, 175, 80, 0.3)",
      borderRadius: "50%",
      color: "black",
      border: "none",
    };
    return { style };
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        overflowX: "hidden",
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
          color: "white",
          overflowY: "auto",
          position: "relative",
          width: isMobile ? "100%" : `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
        }}
      >
        <Toolbar />
        <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700} gutterBottom>
          Member Capital Share
        </Typography>

        <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* 🔹 Capital Share Card */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              backgroundColor: "rgba(231, 237, 241, 0.53)",
              borderRadius: 3,
              width: "100%",
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600}>
                Capital Share
              </Typography>

              {/* Total */}
              <Typography variant="h4" sx={{ mt: 0.5 }}>
                ₱{Number(capitalAmount).toLocaleString()}
              </Typography>

              {/* Breakdown */}
              {capitalAmount > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    🔒 Lock-in: ₱{Math.min(capitalAmount, LOCK_IN).toLocaleString()}
                  </Typography>
                  {capitalAmount > LOCK_IN && (
                    <Typography variant="body2" color="text.secondary">
                      💼 Transferable: ₱
                      {(capitalAmount - LOCK_IN).toLocaleString()}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Transfer Button */}
              {capitalAmount >= LOCK_IN && (
                <Button
                  variant="contained"
                  sx={{ mt: 2 }}
                  onClick={() =>
                    handleTransferCapitalShare(transactionHistory[0])
                  }
                >
                  Transfer Capital to Wallet
                </Button>
              )}

              <Button
                variant="contained"
                sx={{ mt: 2, mr: 1, mb: 1 }}
                onClick={() => setHistoryDialogOpen(true)}
              >
                View Capital Share Transaction History
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* 🔹 Monthly Profit Card */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              backgroundColor: "rgba(231, 237, 241, 0.53)",
              borderRadius: 3,
              width: "100%",
              maxWidth: "100%",
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600}>
                Monthly Profit (5%)
              </Typography>

              <Typography variant="h4" sx={{ mt: 0.5 }}>
                ₱{Number(monthlyProfit).toLocaleString()}
              </Typography>

              <Button
                variant="contained"
                sx={{ mt: 2, width: "100%" }}
                onClick={() => setProfitHistoryOpen(true)}
              >
                View Monthly Profit History
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* 🔹 Add Capital Share Button */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              backgroundColor: "rgba(231, 237, 241, 0.53)",
              borderRadius: 3,
              width: "100%",
              maxWidth: "100%",
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600}>
                Instruction
              </Typography>

              <Typography variant="body2" sx={{ mt: 1, mb: 2, color: "text.secondary" }}>
                📝 To add a capital share entry:
              </Typography>
              
              <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
                1. Click "Add Capital Share" button below
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
                2. Select the date and enter amount (min ₱1,000)
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
                3. Confirm to deduct from your E-Wallet
              </Typography>

              <Button
                variant="contained"
                color="primary"
                fullWidth
                sx={{ mt: 1 }}
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>

        <Card sx={{ mt: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            📅 Capital Share Calendar
          </Typography>

          {/* 🔹 CHANGE: React Big Calendar */}
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 500 }}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
          />
        </Card>


        {/* Add Entry Dialog */}
        <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} fullWidth maxWidth="xs">
          <DialogTitle>Add Capital Share Entry</DialogTitle>
          <DialogContent>
            <TextField
              label="Selected Date"
              type="date"
              fullWidth
              value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
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

        {/* History Dialog */}
{/* History Dialog */}
<Dialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} fullWidth maxWidth="sm">
  <DialogTitle sx={{ bgcolor: "#1976d2", color: "#fff" }}>Transaction History</DialogTitle>
  <DialogContent dividers sx={{ bgcolor: "#f5f5f5" }}>
    {transactionHistory.length > 0 ? (
      transactionHistory.map((t, idx) => {
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

        return (
          <Box
            key={idx}
            sx={{
              mb: 2,
              p: 2,
              borderRadius: 2,
              bgcolor: "#fff",
              boxShadow: "0px 2px 6px rgba(0,0,0,0.15)",
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">Amount</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#4caf50" }}>
              ₱{t.amount.toLocaleString()}
            </Typography>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
              <Typography
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: t.status === "Approved" ? "#e0f7fa" : "#ffe0e0",
                  color: t.status === "Approved" ? "#006064" : "#c62828",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Status: {t.status}
              </Typography>

              <Typography
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: profitStatus === "Profit Earn" ? "#e8f5e9" : "#fff3e0",
                  color: profitStatus === "Profit Earn" ? "#2e7d32" : "#ef6c00",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Profit: {profitIcon} {profitStatus}
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ mt: 1 }}>
              Next Profit Date: {nextProfitDate ? nextProfitDate.toDateString() : "-"}
            </Typography>
          </Box>
        );
      })
    ) : (
      <Typography sx={{ textAlign: "center", py: 3 }}>No transaction history.</Typography>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setHistoryDialogOpen(false)} variant="contained">
      Close
    </Button>
  </DialogActions>
</Dialog>

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