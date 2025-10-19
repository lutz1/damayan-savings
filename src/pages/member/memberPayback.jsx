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
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  TableContainer,
  Paper,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Pagination,
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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../../firebase";

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
  const [filterStatus, setFilterStatus] = useState("All");
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
  const [receiptFile, setReceiptFile] = useState(null);
  const [adding, setAdding] = useState(false);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // View Entry Dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

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

      const entries = paybackSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const totalContributionAmount = entries
        .filter((e) => e.status?.toLowerCase() === "approved")
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const totalPassive = entries
        .filter((e) => e.status?.toLowerCase() === "approved")
        .reduce((sum, e) => sum + (e.amount || 0) * 0.02, 0);

      const totalTransferred = transferSnap.docs.reduce(
        (sum, t) => sum + (t.data().amount || 0),
        0
      );

      setTotalContribution(totalContributionAmount);
      setTotalPassiveIncome(Math.max(totalPassive - totalTransferred, 0));
      setPaybackEntries(entries);

      const calendarEvents = entries.map((e) => ({
        id: e.id,
        title: `₱${Number(e.amount).toFixed(2)} - ${e.status || "Pending"}`,
        start: new Date(e.date),
        end: new Date(e.date),
        allDay: true,
        data: e,
      }));

      setEvents(calendarEvents);
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
    setReceiptFile(null);
    setSelectedDate(null);
  };

  const handleAddPayback = async () => {
    if (!directUsername || !amount || !receiptFile) {
      return alert("Please provide direct username, amount and upload a receipt.");
    }

    setAdding(true);
    try {
      const usersRef = collection(db, "users");
      const q1 = query(usersRef, where("username", "==", directUsername));
      const q2 = query(usersRef, where("email", "==", directUsername));
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const snap = !snap1.empty ? snap1 : snap2;

      if (snap.empty) {
        setAdding(false);
        return alert("Direct referral not found in your system.");
      }

      const userDoc = snap.docs[0].data();
      if (!["MD", "MS", "MI", "Agent", "Member"].includes(userDoc.role)) {
        setAdding(false);
        return alert(
          "Direct referral must have role MD, MS, MI, Agent or Member."
        );
      }

      const fileName = `${auth.currentUser.uid}_${Date.now()}_${receiptFile.name}`;
      const storageRef = ref(storage, `receipts/${fileName}`);
      await uploadBytes(storageRef, receiptFile);
      const receiptUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, "paybackEntries"), {
        userId: auth.currentUser.uid,
        directUsername,
        miUsername: directUsername,
        role: userDoc.role,
        receiptUrl,
        amount: parseFloat(amount),
        date: selectedDate
          ? new Date(selectedDate).toISOString()
          : new Date().toISOString(),
        status: "Waiting for Approval",
        createdAt: new Date().toISOString(),
      });

      await fetchPaybackData(auth.currentUser.uid);
      resetAddFields();
      setOpenAddDialog(false);
      alert("Payback entry submitted! Awaiting admin approval.");
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
  const eventStyleGetter = (event) => {
    let backgroundColor = "#4CAF50";
    const status = (event.data?.status || "").toLowerCase();
    if (status === "waiting for approval") backgroundColor = "#FFC107";
    if (status === "rejected") backgroundColor = "#F44336";
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

  // ===================== Filters =====================
  const filteredEntries = paybackEntries.filter((entry) => {
    const statusMatch =
      filterStatus === "All" ||
      (entry.status || "").toLowerCase() === filterStatus.toLowerCase();
    const lowerSearch = searchTerm.trim().toLowerCase();
    const searchMatch =
      !lowerSearch ||
      (entry.directUsername || "").toLowerCase().includes(lowerSearch) ||
      (entry.status || "").toLowerCase().includes(lowerSearch);
    const dateMatch =
      (!fromDate || new Date(entry.date) >= new Date(fromDate)) &&
      (!toDate || new Date(entry.date) <= new Date(toDate));
    return statusMatch && searchMatch && dateMatch;
  });

  useEffect(() => setCurrentPage(1), [searchTerm, filterStatus, fromDate, toDate]);
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / itemsPerPage));
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(253, 250, 250, 0.01)",
          zIndex: 0,
        },
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
          transition: "all 0.3s ease",
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
          mt: 8,
          color: "white",
          overflowY: "auto",
          maxHeight: "100vh",
          width: isMobile ? "100%" : `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
        }}
      >
        <Toolbar />
        <Typography
          variant={isMobile ? "h5" : "h4"}
          fontWeight={700}
          gutterBottom
        >
          Payback Overview
        </Typography>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: "rgba(33,150,243,0.12)", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6">Total Contribution</Typography>
                <Typography variant="h4" sx={{ color: "#ffffffff" }}>
                  ₱{Number(totalContribution).toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: "rgba(76,175,80,0.12)", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6">Total Passive Income</Typography>
                <Typography variant="h4" sx={{ color: "#ffffffff" }}>
                  ₱{Number(totalPassiveIncome).toFixed(2)}
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  sx={{ mt: 2 }}
                  onClick={() => setTransferDialogOpen(true)}
                >
                  Transfer to E-Wallet
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Calendar */}
        <Card
          sx={{
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 3,
            p: 2,
            mb: 4,
            height: { xs: "60vh", md: "75vh" },
          }}
        >
          {loading ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              height="100%"
            >
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

        {/* Table */}
        <Card sx={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, mb: 4 }}>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <TextField
                label="Search"
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  backgroundColor: "white",
                  borderRadius: 1,
                  minWidth: { xs: "100%", sm: 300 },
                }}
              />
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField
                  label="From"
                  type="date"
                  size="small"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ backgroundColor: "white", borderRadius: 1 }}
                />
                <TextField
                  label="To"
                  type="date"
                  size="small"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ backgroundColor: "white", borderRadius: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Status Filter</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    label="Status Filter"
                    sx={{ backgroundColor: "white", borderRadius: 1 }}
                  >
                    <MenuItem value="All">All</MenuItem>
                    <MenuItem value="Approved">Approved</MenuItem>
                    <MenuItem value="Rejected">Rejected</MenuItem>
                    <MenuItem value="Waiting for Approval">
                      Waiting for Approval
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Direct Username</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        No entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{moment(entry.date).format("LL")}</TableCell>
                        <TableCell>
                          {entry.directUsername || "N/A"}
                        </TableCell>
                        <TableCell>₱{Number(entry.amount).toFixed(2)}</TableCell>
                        <TableCell
                          sx={{
                            color:
                              entry.status === "Approved"
                                ? "green"
                                : entry.status === "Rejected"
                                ? "red"
                                : "#03b120ff",
                            fontWeight: 600,
                          }}
                        >
                          {entry.status || "Pending"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            {totalPages > 1 && (
              <Box display="flex" justifyContent="center" mt={2}>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(e, page) => setCurrentPage(page)}
                  color="primary"
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* ===================== DIALOGS ===================== */}

      {/* Add Payback Entry Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: { borderRadius: 3, backgroundColor: "rgba(255,255,255,0.95)" },
        }}
      >
        <DialogTitle>Add Payback Entry</DialogTitle>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2" sx={{ fontStyle: "italic", mb: 1 }}>
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
          />

          <Button variant="contained" component="label" color="info">
            Upload Receipt
            <input
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => setReceiptFile(e.target.files[0])}
            />
          </Button>

          {receiptFile && (
            <Typography variant="body2" color="text.secondary">
              {receiptFile.name}
            </Typography>
          )}
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
            startIcon={adding && <CircularProgress size={18} color="inherit" />}
          >
            {adding ? "Submitting..." : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Payback Entry Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: { borderRadius: 3, backgroundColor: "rgba(255,255,255,0.95)" },
        }}
      >
        <DialogTitle>Payback Entry Details</DialogTitle>
        {selectedEntry && (
          <DialogContent dividers>
            <Typography>
              <strong>Date:</strong>{" "}
              {moment(selectedEntry.date).format("LL")}
            </Typography>
            <Typography>
              <strong>Direct Username:</strong> {selectedEntry.directUsername}
            </Typography>
            <Typography>
              <strong>Role:</strong> {selectedEntry.role}
            </Typography>
            <Typography>
              <strong>Amount:</strong> ₱
              {Number(selectedEntry.amount).toFixed(2)}
            </Typography>
            <Typography>
              <strong>Status:</strong> {selectedEntry.status}
            </Typography>
            {selectedEntry.receiptUrl && (
              <Box mt={2}>
                <Typography variant="subtitle2">Receipt:</Typography>
                <a
                  href={selectedEntry.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Receipt
                </a>
              </Box>
            )}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer to E-Wallet Dialog */}
      <Dialog
        open={transferDialogOpen}
        onClose={() => setTransferDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: { borderRadius: 3, backgroundColor: "rgba(255,255,255,0.95)" },
        }}
      >
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
            sx={{ mt: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            1% fee will be deducted from your transfer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)} color="error">
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            color="success"
            variant="contained"
            disabled={!transferAmount}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MemberPayback;