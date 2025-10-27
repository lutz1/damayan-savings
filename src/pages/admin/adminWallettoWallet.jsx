import React, { useEffect, useState } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Stack,
  Snackbar,
  Alert,
  useMediaQuery,
  TablePagination,
  TextField,
  MenuItem,
  InputAdornment,
  Drawer,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { motion } from "framer-motion";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  getDocs,
  where,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";
import { useTheme } from "@mui/material/styles";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip as RechartsTooltip,
} from "recharts";

const COLORS = ["#4FC3F7", "#81C784", "#FFB74D", "#E57373"];

const AdminWalletToWallet = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalAmount: 0,
    totalRevenue: 0,
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // Fetch sender name helper
  const fetchSenderName = async (emailOrId) => {
    try {
      let userQuery = query(collection(db, "users"), where("uid", "==", emailOrId));
      let userSnap = await getDocs(userQuery);

      if (userSnap.empty) {
        userQuery = query(collection(db, "users"), where("email", "==", emailOrId));
        userSnap = await getDocs(userQuery);
      }

      if (!userSnap.empty) {
        const user = userSnap.docs[0].data();
        return user.fullName || user.name || user.username || "Unknown";
      } else {
        return "Unknown";
      }
    } catch (err) {
      console.error("Error fetching sender name:", err);
      return "Unknown";
    }
  };

  // Fetch transfers
  useEffect(() => {
    const q = query(collection(db, "transferFunds"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const dataWithNames = await Promise.all(
        data.map(async (t) => {
          if (!t.senderName) {
            const senderName = await fetchSenderName(t.senderEmail || t.userId);
            return { ...t, senderName };
          }
          return t;
        })
      );

      const totalPending = dataWithNames.filter((t) => t.status === "Pending").length;
      const totalApproved = dataWithNames.filter((t) => t.status === "Approved").length;
      const totalRejected = dataWithNames.filter((t) => t.status === "Rejected").length;
      const totalAmount = dataWithNames.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalRevenue = dataWithNames.reduce((sum, t) => sum + (t.charge || 0), 0);

      setTransfers(dataWithNames);
      setSummary({ totalPending, totalApproved, totalRejected, totalAmount, totalRevenue });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Approve or reject
  const handleAction = async (id, status) => {
    try {
      const transferRef = doc(db, "transferFunds", id);
      const transferSnap = await getDoc(transferRef);
      if (!transferSnap.exists()) throw new Error("Transfer not found.");
      const transfer = transferSnap.data();

      if (status === "Approved") {
        const senderQuery = query(
          collection(db, "users"),
          where("email", "==", transfer.senderEmail)
        );
        const senderSnapshot = await getDocs(senderQuery);
        if (senderSnapshot.empty) throw new Error("Sender not found.");
        const senderDoc = senderSnapshot.docs[0];
        const senderData = senderDoc.data();
        const senderRef = doc(db, "users", senderDoc.id);
        if (senderData.eWallet < transfer.amount) throw new Error("Sender has insufficient balance.");

        await updateDoc(senderRef, { eWallet: senderData.eWallet - transfer.amount });

        const recipientQuery = query(
          collection(db, "users"),
          where("username", "==", transfer.recipientUsername)
        );
        const recipientSnapshot = await getDocs(recipientQuery);
        if (recipientSnapshot.empty) throw new Error("Recipient not found.");
        const recipientDoc = recipientSnapshot.docs[0];
        const recipientData = recipientDoc.data();
        const recipientRef = doc(db, "users", recipientDoc.id);

        await updateDoc(recipientRef, { eWallet: (recipientData.eWallet || 0) + transfer.netAmount });
        await updateDoc(transferRef, { status: "Approved" });
      } else {
        await updateDoc(transferRef, { status: "Rejected" });
      }

      setSnackbar({
        open: true,
        message: `Transfer ${status}`,
        severity: status === "Approved" ? "success" : "error",
      });
    } catch (err) {
      console.error("Error updating transfer:", err);
      setSnackbar({
        open: true,
        message: err.message || "Failed to update transfer.",
        severity: "error",
      });
    }
  };

  const chartData = [
    { name: "Pending", value: summary.totalPending },
    { name: "Approved", value: summary.totalApproved },
    { name: "Rejected", value: summary.totalRejected },
  ];

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredTransfers = transfers.filter((t) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      t.senderName?.toLowerCase().includes(search) ||
      t.recipientUsername?.toLowerCase().includes(search) ||
      t.userId?.toLowerCase().includes(search);

    const matchesStatus = filterStatus === "All" || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.25)",
          zIndex: 0,
        },
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Desktop sidebar */}
      {!isMobile && (
        <Box sx={{ zIndex: 5 }}>
          <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        </Box>
      )}

      {/* Mobile sidebar */}
      {isMobile && (
        <Drawer
          anchor="left"
          open={sidebarOpen}
          onClose={handleToggleSidebar}
          ModalProps={{ keepMounted: true }}
        >
          <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isMobile ? 1 : 3,
          mt: 8,
          color: "white",
          zIndex: 1,
          width: "100%",
          overflowX: "hidden",
        }}
      >
        <Toolbar />
        <Typography
          variant={isMobile ? "h6" : "h5"}
          sx={{
            mb: 2,
            fontWeight: 700,
            textShadow: "1px 1px 3px rgba(0,0,0,0.4)",
            textAlign: isMobile ? "center" : "left",
          }}
        >
          💳 Wallet-to-Wallet Transfer Requests
        </Typography>

        {/* Summary */}
        <Card sx={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", borderRadius: "16px", mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              📊 Transfer Summary
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Total Amount Transferred:{" "}
              <b>
                ₱{summary.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </b>
            </Typography>
            <Typography sx={{ mt: 0.5 }}>
              Revenue (2% Charge):{" "}
              <b>₱{summary.totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</b>
            </Typography>

            <Box sx={{ width: "100%", height: 250, mt: 2 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Search & Filter */}
        <Stack direction={isMobile ? "column" : "row"} spacing={2} mb={2}>
          <TextField
            placeholder="Search by Sender, Recipient, or User ID"
            variant="outlined"
            size="small"
            fullWidth={isMobile}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "white" }} />
                </InputAdornment>
              ),
              sx: { color: "white" },
            }}
          />
          <TextField
            select
            label="Filter Status"
            value={filterStatus}
            size="small"
            sx={{ minWidth: 150, color: "white" }}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            {["All", "Pending", "Approved", "Rejected"].map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {/* Table */}
        <Card sx={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", borderRadius: "16px", boxShadow: "0 6px 25px rgba(0,0,0,0.25)", width: "100%", overflowX: "auto" }}>
          <CardContent sx={{ p: 1 }}>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress sx={{ color: "white" }} />
              </Box>
            ) : filteredTransfers.length === 0 ? (
              <Typography align="center" sx={{ color: "rgba(255,255,255,0.7)", py: 3 }}>
                No transfer requests found.
              </Typography>
            ) : (
              <>
                <TableContainer>
                  <Table size={isMobile ? "small" : "medium"}>
                    <TableHead>
                      <TableRow>
                        {["Sender","Recipient","Amount","Charge (2%)","Net Amount","Status","Date","Actions"].map((head) => (
                          <TableCell key={head} sx={{ color: "white", fontWeight: "bold" }}>{head}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredTransfers
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((t) => (
                          <motion.tr key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                            <TableCell sx={{ color: "white" }}>{t.senderName || "Unknown"}</TableCell>
                            <TableCell sx={{ color: "white" }}>{t.recipientUsername}</TableCell>
                            <TableCell sx={{ color: "white" }}>₱{t.amount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell sx={{ color: "white" }}>₱{t.charge?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell sx={{ color: "white" }}>₱{t.netAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell sx={{ color: t.status==="Approved"?"#81C784":t.status==="Rejected"?"#E57373":"#FFB74D", fontWeight: 600 }}>{t.status}</TableCell>
                            <TableCell sx={{ color: "white" }}>{t.createdAt ? new Date(t.createdAt.seconds * 1000).toLocaleString("en-PH") : "—"}</TableCell>
                            <TableCell>
                              {t.status === "Pending" ? (
                                <Stack direction="row" spacing={1}>
                                  <Button size="small" variant="contained" sx={{ bgcolor:"#81C784", color:"#000","&:hover":{bgcolor:"#66BB6A"}, fontWeight:600 }} onClick={()=>handleAction(t.id,"Approved")}>Approve</Button>
                                  <Button size="small" variant="contained" sx={{ bgcolor:"#E57373", color:"#000","&:hover":{bgcolor:"#EF5350"}, fontWeight:600 }} onClick={()=>handleAction(t.id,"Rejected")}>Reject</Button>
                                </Stack>
                              ) : (
                                <Typography variant="body2" sx={{ color:"rgba(255,255,255,0.6)" }}>No actions</Typography>
                              )}
                            </TableCell>
                          </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component="div"
                  count={filteredTransfers.length}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[5,10,25,50]}
                  sx={{
                    color: "white",
                    ".MuiTablePagination-toolbar": { color: "white" },
                    ".MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows": { color: "white" },
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminWalletToWallet;