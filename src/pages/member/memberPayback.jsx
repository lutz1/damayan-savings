// src/pages/member/MemberPayback.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Toolbar,
  Typography,
  useMediaQuery,
  Grid,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
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
} from "firebase/firestore";
import { db, auth } from "../../firebase";

const localizer = momentLocalizer(moment);

const MemberPayback = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // States
  const [events, setEvents] = useState([]);
  const [paybackEntries, setPaybackEntries] = useState([]);
  const [totalContribution, setTotalContribution] = useState(0);
  const [totalPassiveIncome, setTotalPassiveIncome] = useState(0);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [loading, setLoading] = useState(true);

  // Add Payback Dialog
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [uplineUsername, setUplineUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // View Entry Dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Expired Notification
  const [expiredDialogOpen, setExpiredDialogOpen] = useState(false);
  const [expiredEntries, setExpiredEntries] = useState([]);

  // History
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

// ===================== Upline ₱65 Reward Logic (Stored in Override) =====================

const handleUplineReward = useCallback(async (entries) => {
  const today = moment().startOf("day");
  console.log("🟡 Checking for expired payback entries eligible for ₱65 upline reward...");
  console.log("📅 Today's Date:", today.format("YYYY-MM-DD"));
  console.log("📄 Total entries to check:", entries.length);

  for (const entry of entries) {
    const dueDate = moment(entry.expirationDate).startOf("day");
    console.log(`🔹 Entry: ${entry.id} | Expiration: ${entry.expirationDate} | RewardGiven: ${entry.rewardGiven}`);

    // Only process if the entry is due and not yet rewarded
    if (today.isSameOrAfter(dueDate) && !entry.rewardGiven) {
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
        data.expirationDate || moment(data.date).add(30, "days").toISOString();
      const isExpired = moment().isAfter(expirationDate);
      return { id: d.id, ...data, expirationDate, isExpired };
    });

    const totalContributionAmount = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalPassive = entries
      .filter((e) => moment().isSameOrAfter(moment(e.expirationDate)))
      .reduce((sum, e) => sum + (e.amount || 0) * 0.02, 0);
    const totalTransferred = transferSnap.docs.reduce(
      (sum, t) => sum + (t.data().amount || 0),
      0
    );

    setTotalContribution(totalContributionAmount);
    setTotalPassiveIncome(Math.max(totalPassive - totalTransferred, 0));
    setPaybackEntries(entries);

    // ✅ Create calendar events (keep expired ones visible, color coded)
    const calendarEvents = entries.map((e) => ({
      id: e.id,
      title: `₱${Number(e.amount).toFixed(2)}`,
      start: new Date(e.date),
      end: new Date(e.date),
      allDay: true,
      data: e,
      isExpired: e.isExpired,
    }));

    setEvents(calendarEvents);

    await handleUplineReward(entries); // ✅ override entries created on due

    // ✅ Notify 3 days before expiration
    const today = moment();
    const nearDue = entries.filter((e) => {
      const daysLeft = moment(e.expirationDate).diff(today, "days");
      return daysLeft <= 3 && daysLeft >= 0 && !e.isExpired;
    });

    // ✅ Collect expired entries (still visible in calendar)
    const expired = entries.filter((e) => e.isExpired);

    if (nearDue.length > 0 || expired.length > 0) {
      setExpiredEntries([...nearDue, ...expired]);
      setExpiredDialogOpen(true);
    }
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
  const handleSelectSlot = (slotInfo) => {
    const selected = moment(slotInfo.start);
    const today = moment().startOf("day");
    if (!selected.isSame(today, "day")) {
      alert("❌ You can only set an entry on today's date.");
      return;
    }
    setSelectedDate(selected.toDate());
    setOpenAddDialog(true);
  };

  const handleSelectEvent = (event) => {
    setSelectedEntry(event.data);
    setViewDialogOpen(true);
  };

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

    // Deduct wallet
    await updateDoc(userRef, { eWallet: walletBalance - amountNum });
    console.log(`✅ Deducted ₱${amountNum} from user eWallet`);

    // Prepare payback entry
    const entryDate = moment(selectedDate || new Date()).toISOString();
    const expirationDate = moment(entryDate).add(30, "days").toISOString();

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
  const handleTransfer = async () => {
  const amountNum = parseFloat(transferAmount);
  if (isNaN(amountNum) || amountNum <= 0) return alert("Enter a valid amount");
  if (amountNum > totalPassiveIncome) return alert("Exceeds passive income balance");

  const fee = amountNum * 0.01;
  const net = amountNum - fee;

  try {
    const user = auth.currentUser;
    if (!user) return;

    // ✅ Create a record in passiveTransfers with same structure used in EwalletHistoryDialog
    await addDoc(collection(db, "passiveTransfers"), {
      userId: user.uid,
      amount: amountNum,
      fee,
      netAmount: net,
      type: "Passive Transfer", // helps identify the transaction type in history
      status: "Approved",
      createdAt: new Date().toISOString(),
    });

    // ✅ Update user eWallet balance
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const currentWallet = snap.data().eWallet || 0;
      await updateDoc(userRef, { eWallet: currentWallet + net });
    }

    // ✅ Update UI
    setTotalPassiveIncome((prev) => prev - amountNum);
    setTransferDialogOpen(false);
    setTransferAmount("");
    alert(`₱${net.toFixed(2)} transferred to your E-Wallet! Fee: ₱${fee.toFixed(2)}.`);
  } catch (err) {
    console.error("Transfer failed:", err);
    alert("Transfer failed.");
  }
};

  // ===================== Calendar Restriction =====================
const [currentDate, setCurrentDate] = useState(new Date());

const onNavigate = (date, view, action) => {
  setCurrentDate(date); // ✅ allow navigation freely
};

// ===================== Calendar Slot Selection =====================


  const eventStyleGetter = (event) => {
  let backgroundColor = "#4CAF50"; // default (green)
  if (event.isExpired) {
    backgroundColor = "#d32f2f"; // red for expired
  } else {
    const daysLeft = moment(event.data.expirationDate).diff(moment(), "days");
    if (daysLeft <= 3 && daysLeft >= 0) {
      backgroundColor = "#FFA000"; // orange for soon-to-expire
    }
  }

  return {
    style: {
      backgroundColor,
      color: "white",
      borderRadius: "6px",
      padding: "2px 4px",
    },
  };
};

  const EventComponent = ({ event }) => (
    <span>
      <strong>{event.title}</strong>
    </span>
  );

  // ===================== Render =====================
  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        overflowX: "hidden",
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>
      <Box sx={{ zIndex: 5, position: isMobile ? "fixed" : "relative", height: "100%" }}>
        <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 4 },
          mt: 1,
          color: "white",
          overflowY: "auto",
          width: isMobile ? "100%" : `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
        }}
      >
        <Toolbar />
        <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700} gutterBottom>
          Payback Overview
        </Typography>

        {/* Totals */}
        <Grid container spacing={3} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: "rgba(231,237,241,0.53)", borderRadius: 3}}>
              <CardContent>
                <Typography variant="h6">Total Contribution</Typography>
                <Typography variant="h4">₱{Number(totalContribution).toFixed(2)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: "rgba(231,237,241,0.53)", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6">Total Passive Income</Typography>
                <Typography variant="h4">₱{Number(totalPassiveIncome).toFixed(2)}</Typography>
                <Button variant="contained" color="success" sx={{ mt: 2 }} onClick={() => setTransferDialogOpen(true)}>
                  Transfer to E-Wallet
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Button variant="contained" color="success" sx={{ mt: 1, mb: 2 }} onClick={() => setHistoryDialogOpen(true)}>
          Payback Transaction History
        </Button>

        {/* Calendar */}
        <Card sx={{ backgroundColor: "rgba(231,237,241,0.27)", borderRadius: 3, p: 2, height: "70vh" }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <CircularProgress color="info" />
            </Box>
          ) : (
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "100%", color: "#000" }}
              eventPropGetter={eventStyleGetter}
              components={{ event: EventComponent }}
              selectable
              date={currentDate}
              onNavigate={onNavigate}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              popup
              views={["month"]}
            />
          )}
        </Card>
      </Box>

      {/* Add Payback Entry */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Payback Entry</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Selected Date: {selectedDate ? moment(selectedDate).format("LL") : ""}
          </Typography>
          <TextField label="Upline Username" fullWidth value={uplineUsername} disabled sx={{ mb: 2 }} />
          <TextField label="Amount" type="number" fullWidth value={amount} onChange={(e) => setAmount(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)} color="error">
            Cancel
          </Button>
         <Button
          onClick={handleOpenConfirmDialog}
          color="primary"
          variant="contained"
          disabled={adding}
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

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Payback Entry Details</DialogTitle>
        {selectedEntry && (
          <DialogContent dividers>
            <Typography>
              <strong>Date:</strong> {moment(selectedEntry.date).format("LL")}
            </Typography>
            <Typography>
              <strong>Upline Username:</strong> {selectedEntry.uplineUsername}
            </Typography>
            <Typography>
              <strong>Role:</strong> {selectedEntry.role}
            </Typography>
            <Typography>
              <strong>Amount:</strong> ₱{Number(selectedEntry.amount).toFixed(2)}
            </Typography>
            <Typography>
              <strong>2 % Profit:</strong> ₱{(selectedEntry.amount * 0.02).toFixed(2)}
            </Typography>
            <Typography>
              <strong>Expiration:</strong> {moment(selectedEntry.expirationDate).format("LL")}
            </Typography>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Expired Entries */}
      <Dialog open={expiredDialogOpen} onClose={() => setExpiredDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
  {expiredEntries.some(e => !e.isExpired)
    ? "Payback Entries Expiring Soon"
    : "Expired Payback Entries"}
</DialogTitle>
<DialogContent dividers>
  {expiredEntries.length > 0 ? (
    expiredEntries.map((e) => (
      <Box key={e.id} mb={1}>
        <Typography>
          <strong>{e.uplineUsername}</strong> — ₱{e.amount.toFixed(2)}{" "}
          ({e.isExpired
            ? `Expired ${moment(e.expirationDate).format("LL")}`
            : `Expiring on ${moment(e.expirationDate).format("LL")}`})
        </Typography>
      </Box>
    ))
  ) : (
    <Typography>No expiring or expired entries.</Typography>
  )}
</DialogContent>
      </Dialog>

      {/* Payback Transaction History */}
<Dialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} fullWidth maxWidth="md">
  <DialogTitle sx={{ bgcolor: "#1976d2", color: "#fff" }}>Payback Transaction History</DialogTitle>
  <DialogContent dividers sx={{ bgcolor: "#f5f5f5" }}>
    {paybackEntries.length > 0 ? (
      paybackEntries.map((e, idx) => {
        const now = new Date();
        const expirationDate = e.expirationDate instanceof Date ? e.expirationDate : new Date(e.expirationDate);
        const profitStatus = expirationDate > now ? "Pending" : "Profit Earn";
        const profitIcon = profitStatus === "Pending" ? "⏳" : "✅";

        return (
          <Box
            key={e.id}
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
              ₱{e.amount.toFixed(2)}
            </Typography>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
              <Typography
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: e.status === "Approved" ? "#e0f7fa" : "#ffe0e0",
                  color: e.status === "Approved" ? "#006064" : "#c62828",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Status: {e.status || "Pending"}
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
              Next Profit Date: {expirationDate ? expirationDate.toDateString() : "-"}
            </Typography>

            <Typography variant="body2">
              Upline: {e.uplineUsername} | 2% Profit: ₱{(e.amount * 0.02).toFixed(2)}
            </Typography>
          </Box>
        );
      })
    ) : (
      <Typography sx={{ textAlign: "center", py: 3 }}>No payback entries.</Typography>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setHistoryDialogOpen(false)} variant="contained">
      Close
    </Button>
  </DialogActions>
</Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Transfer Passive Income</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" gutterBottom>
            Available Balance: ₱{Number(totalPassiveIncome).toFixed(2)}
          </Typography>
          <TextField
            label="Transfer Amount"
            type="number"
            fullWidth
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
          />
          <Typography variant="caption">1 % fee will be deducted.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)} color="error">
            Cancel
          </Button>
          <Button onClick={handleTransfer} color="success" variant="contained" disabled={!transferAmount}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MemberPayback;