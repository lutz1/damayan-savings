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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
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
  const [directUsername, setDirectUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);

  // View Entry Dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Expiration Notification Dialog
  const [expiredDialogOpen, setExpiredDialogOpen] = useState(false);
  const [expiredEntries, setExpiredEntries] = useState([]);

  // Payback Transaction History Dialog
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // ===================== Fetch Payback + Transfers =====================
  const fetchPaybackData = useCallback(async (userId) => {
    try {
      setLoading(true);
      const paybackQ = query(
        collection(db, "paybackEntries"),
        where("userId", "==", userId)
      );
      const transferQ = query(
        collection(db, "passiveTransfers"),
        where("userId", "==", userId)
      );

      const [paybackSnap, transferSnap] = await Promise.all([
        getDocs(paybackQ),
        getDocs(transferQ),
      ]);

      const entries = paybackSnap.docs.map((d) => {
        const data = d.data();
        // Compute expiration date = 30 days after entry date
        const expirationDate = moment(data.date).add(30, "days").toISOString();
        const isExpired = moment().isAfter(expirationDate);
        return { id: d.id, ...data, expirationDate, isExpired };
      });

      const totalContributionAmount = entries.reduce(
        (sum, e) => sum + (e.amount || 0),
        0
      );

      const totalPassive = entries.reduce(
        (sum, e) => sum + (e.amount || 0) * 0.02,
        0
      );

      const totalTransferred = transferSnap.docs.reduce(
        (sum, t) => sum + (t.data().amount || 0),
        0
      );

      setTotalContribution(totalContributionAmount);
      setTotalPassiveIncome(Math.max(totalPassive - totalTransferred, 0));
      setPaybackEntries(entries);

      const calendarEvents = entries.map((e) => ({
        id: e.id,
        title: `₱${Number(e.amount).toFixed(2)}`,
        start: new Date(e.date),
        end: new Date(e.date),
        allDay: true,
        data: e,
      }));

      setEvents(calendarEvents);

      // Check expired entries
      const expired = entries.filter((e) => e.isExpired);
      if (expired.length > 0) {
        setExpiredEntries(expired);
        setExpiredDialogOpen(true);
      }
    } catch (err) {
      console.error("Error fetching payback data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) await fetchPaybackData(user.uid);
    });
    return () => unsub && unsub();
  }, [fetchPaybackData]);

  // ===================== Add Payback Entry =====================
  const handleSelectSlot = (slotInfo) => {
    setSelectedDate(slotInfo.start || slotInfo);
    setOpenAddDialog(true);
  };

  const handleSelectEvent = (event) => {
    setSelectedEntry(event.data);
    setViewDialogOpen(true);
  };

  const resetAddFields = () => {
    setDirectUsername("");
    setAmount("");
    setSelectedDate(null);
  };

  const handleAddPayback = async () => {
    if (!directUsername || !amount) {
      return alert("Please provide direct username and amount.");
    }

    setAdding(true);
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

      const usersRef = collection(db, "users");
      const q1 = query(usersRef, where("username", "==", directUsername));
      const q2 = query(usersRef, where("email", "==", directUsername));
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const snap = !snap1.empty ? snap1 : snap2;

      if (snap.empty) {
        setAdding(false);
        return alert("Direct referral not found.");
      }

      const userDoc = snap.docs[0].data();
      if (!["MD", "MS", "MI", "Agent", "Member"].includes(userDoc.role)) {
        setAdding(false);
        return alert("Invalid role for direct referral.");
      }

      await updateDoc(userRef, {
        eWallet: walletBalance - amountNum,
      });

      const entryDate = selectedDate
        ? new Date(selectedDate).toISOString()
        : new Date().toISOString();
      const expirationDate = moment(entryDate).add(30, "days").toISOString();

      await addDoc(collection(db, "paybackEntries"), {
        userId: user.uid,
        directUsername,
        miUsername: directUsername,
        role: userDoc.role,
        amount: amountNum,
        date: entryDate,
        expirationDate,
        status: "Approved",
        createdAt: new Date().toISOString(),
      });

      await fetchPaybackData(user.uid);
      resetAddFields();
      setOpenAddDialog(false);
      alert(`Payback entry added successfully! ₱${amountNum.toFixed(2)} deducted from wallet.`);
    } catch (err) {
      console.error("Error adding payback entry:", err);
      alert("Failed to add entry. See console for details.");
    } finally {
      setAdding(false);
    }
  };

  // ===================== Transfer Logic =====================
  const handleTransfer = async () => {
    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0)
      return alert("Enter a valid transfer amount");
    if (amountNum > totalPassiveIncome)
      return alert("Amount exceeds passive income balance");

    const fee = amountNum * 0.01;
    const net = amountNum - fee;

    try {
      const user = auth.currentUser;
      if (!user) return;

      await addDoc(collection(db, "passiveTransfers"), {
        userId: user.uid,
        amount: amountNum,
        fee,
        netAmount: net,
        createdAt: new Date().toISOString(),
      });

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const currentWallet = snap.data().eWallet || 0;
        await updateDoc(userRef, { eWallet: currentWallet + net });
      }

      setTotalPassiveIncome((prev) => prev - amountNum);
      setTransferDialogOpen(false);
      setTransferAmount("");
      alert(`₱${net.toFixed(2)} transferred! Fee: ₱${fee.toFixed(2)}.`);
    } catch (err) {
      console.error("Transfer failed:", err);
      alert("Transfer failed. See console for details.");
    }
  };

  // ===================== Calendar Style =====================
  const eventStyleGetter = () => ({
    style: {
      backgroundColor: "#4CAF50",
      color: "white",
      borderRadius: "6px",
      padding: "2px 4px",
    },
  });

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
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Sidebar */}
      <Box
        sx={{
          zIndex: 5,
          position: isMobile ? "fixed" : "relative",
          height: "100%",
        }}
      >
        <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Main Content */}
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

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: "rgba(231, 237, 241, 0.53)", borderRadius: 3, width: 380 }}>
              <CardContent>
                <Typography variant="h6" >Total Contribution</Typography>
                <Typography variant="h4">₱{Number(totalContribution).toFixed(2)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: "rgba(231, 237, 241, 0.53)", borderRadius: 3 , width: 380}}>
              <CardContent>
                <Typography variant="h6">Total Passive Income</Typography>
                <Typography variant="h4">₱{Number(totalPassiveIncome).toFixed(2)}</Typography>
                <Button
                  variant="contained"
                  color="success"
                  sx={{ mt: 2, mr: 2 }}
                  onClick={() => setTransferDialogOpen(true)}
                >
                  Transfer to E-Wallet
                </Button>
                
              </CardContent>
            </Card>
          </Grid>
        </Grid>
                <Button
                  variant="contained"
                  color="success"
                  sx={{ mt: 1, mb: 2 }}
                  onClick={() => setHistoryDialogOpen(true)}
                >
                  Payback Transaction History
                </Button>
        {/* Calendar */}
        <Card
          sx={{
            backgroundColor: "rgba(231, 237, 241, 0.27)",
            borderRadius: 3,
            p: 2,
            height: { xs: "60vh", md: "75vh" },
          }}
        >
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
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              popup
              views={["month", "week", "day"]}
            />
          )}
        </Card>
      </Box>

      {/* Add Payback Entry Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Payback Entry</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Selected Date: {selectedDate ? moment(selectedDate).format("LL") : ""}
          </Typography>
          <TextField
            label="Direct Username or Email"
            fullWidth
            value={directUsername}
            onChange={(e) => setDirectUsername(e.target.value)}
          />
          <TextField
            label="Amount"
            type="number"
            fullWidth
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)} color="error">
            Cancel
          </Button>
          <Button
            onClick={handleAddPayback}
            color="primary"
            variant="contained"
            disabled={adding}
          >
            {adding ? <CircularProgress size={18} color="inherit" /> : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Payback Entry Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Payback Entry Details</DialogTitle>
        {selectedEntry && (
          <DialogContent dividers>
            <Typography>
              <strong>Date:</strong> {moment(selectedEntry.date).format("LL")}
            </Typography>
            <Typography>
              <strong>Direct Username:</strong> {selectedEntry.directUsername}
            </Typography>
            <Typography>
              <strong>Role:</strong> {selectedEntry.role}
            </Typography>
            <Typography>
              <strong>Amount:</strong> ₱{Number(selectedEntry.amount).toFixed(2)}
            </Typography>
            <Typography>
              <strong>2% Profit:</strong> ₱{(selectedEntry.amount * 0.02).toFixed(2)}
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

      {/* Expired Entries Notification Dialog */}
      <Dialog open={expiredDialogOpen} onClose={() => setExpiredDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Expired Payback Entries</DialogTitle>
        <DialogContent dividers>
          {expiredEntries.length > 0 ? (
            expiredEntries.map((e) => (
              <Box key={e.id} mb={2}>
                <Typography>
                  <strong>{e.directUsername}</strong> — ₱{e.amount.toFixed(2)} (Expired:{" "}
                  {moment(e.expirationDate).format("LL")})
                </Typography>
              </Box>
            ))
          ) : (
            <Typography>No expired entries.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpiredDialogOpen(false)} color="primary">
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payback Transaction History Dialog */}
      <Dialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Payback Transaction History</DialogTitle>
        <DialogContent dividers>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Direct Username</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>2% Profit</TableCell>
                <TableCell>Expiration</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paybackEntries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{moment(e.date).format("LL")}</TableCell>
                  <TableCell>{e.directUsername}</TableCell>
                  <TableCell>₱{e.amount.toFixed(2)}</TableCell>
                  <TableCell>₱{(e.amount * 0.02).toFixed(2)}</TableCell>
                  <TableCell>{moment(e.expirationDate).format("LL")}</TableCell>
                  <TableCell>{e.isExpired ? "Expired" : e.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)} color="primary">
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
          <Typography variant="caption">1% fee will be deducted.</Typography>
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