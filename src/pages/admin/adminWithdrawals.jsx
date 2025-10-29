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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useMediaQuery,
  Drawer,
  Stack,
  MenuItem,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { motion } from "framer-motion";
import { collection, onSnapshot, doc, updateDoc, getDoc, query } from "firebase/firestore";
import { db } from "../../firebase";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";
import { useTheme } from "@mui/material/styles";
import { getAuth } from "firebase/auth";

const AdminWithdrawals = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [qrImage, setQrImage] = useState(null);
  const [salesData, setSalesData] = useState({ total: 0, revenue: 0 });
  const [userRole, setUserRole] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const auth = getAuth();

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // iOS Input Styling
  const iosInputStyle = {
    borderRadius: "20px",
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "white",
    "& .MuiOutlinedInput-notchedOutline": { border: "none" },
    "&:hover .MuiOutlinedInput-notchedOutline": { border: "none" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { border: "1px solid #81C784" },
    "& input": { padding: "10px 14px", color: "white" },
    "& svg": { color: "white" },
  };

  const iosSelectStyle = {
    borderRadius: "20px",
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "white",
    "& .MuiOutlinedInput-notchedOutline": { border: "none" },
    "&:hover .MuiOutlinedInput-notchedOutline": { border: "none" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { border: "1px solid #81C784" },
    "& .MuiSelect-select": { padding: "10px 14px", color: "white" },
    "& .MuiSvgIcon-root": { color: "white" },
  };

  // Get current user role
  useEffect(() => {
    const fetchRole = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) setUserRole(userDoc.data().role?.toLowerCase() || "");
    };
    fetchRole();
  }, [auth]);

  // Listen to withdrawals collection
  useEffect(() => {
    const q = query(collection(db, "withdrawals"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        const sorted = data.sort(
          (a, b) => b.createdAt?.seconds - a.createdAt?.seconds
        );
        setWithdrawals(sorted);

        const approvedTotal = sorted
          .filter((w) => w.status?.toLowerCase() === "approved")
          .reduce((sum, w) => sum + Number(w.amount || 0), 0);
        setSalesData({ total: approvedTotal, revenue: approvedTotal * 0.05 });
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching withdrawals:", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Approve or Reject withdrawal
  const handleAction = async (status) => {
    if (!selectedWithdrawal) return;
    const { id, userId, amount } = selectedWithdrawal;

    try {
      const withdrawalRef = doc(db, "withdrawals", id);
      await updateDoc(withdrawalRef, {
        status: status.toLowerCase(),
        reviewedAt: new Date(),
        remarks,
      });

      if (status.toLowerCase() === "approved") {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentBalance = Number(userSnap.data().eWallet || 0);
          await updateDoc(userRef, {
            eWallet: currentBalance - Number(amount),
            lastUpdated: new Date(),
          });
        }
      }

      setSelectedWithdrawal(null);
      setRemarks("");
    } catch (err) {
      console.error("Error updating withdrawal:", err);
    }
  };

  const openDialog = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setRemarks("");
  };

  const closeDialog = () => {
    setSelectedWithdrawal(null);
    setRemarks("");
  };

  const handleViewQR = (url) => setQrImage(url);
  const closeQRDialog = () => setQrImage(null);

  const canApproveReject = ["admin", "ceo"].includes(userRole);

  // Filtered withdrawals
  const filteredWithdrawals = withdrawals.filter((w) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      w.name?.toLowerCase().includes(search) ||
      w.paymentMethod?.toLowerCase().includes(search);
    const matchesStatus =
      filterStatus === "All" || w.status?.toLowerCase() === filterStatus.toLowerCase();
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
      {/* Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Sidebar for desktop */}
      {!isMobile && (
        <Box sx={{ zIndex: 5 }}>
          <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        </Box>
      )}

      {/* Sidebar Drawer for mobile */}
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

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isMobile ? 1 : 3,
          mt: 2,
          color: "white",
          zIndex: 1,
          width: "96%",
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
          💰 Withdrawals Management
        </Typography>

        {/* Sales Summary */}
        <Card
          sx={{
            color: "white",
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            borderRadius: "16px",
            mb: 3,
            width: "100%",
            overflowX: "auto",
          }}
        >
          <CardContent sx={{ textAlign: isMobile ? "center" : "left" }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              📈 Sales Summary
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Total Approved Withdrawals:{" "}
              <b>₱{salesData.total.toFixed(2)}</b>
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Revenue (5% charge):{" "}
              <b>₱{salesData.revenue.toFixed(2)}</b>
            </Typography>
          </CardContent>
        </Card>

        {/* 🔹 Search & Filter */}
        <Stack direction={isMobile ? "column" : "row"} spacing={2} mb={2}>
          <TextField
            placeholder="Search by Name or Method"
            variant="outlined"
            size="small"
            fullWidth={isMobile}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              sx: iosInputStyle,
            }}
          />
          <TextField
            select
            label="Filter Status"
            value={filterStatus}
            size="small"
            onChange={(e) => setFilterStatus(e.target.value)}
            sx={iosSelectStyle}
          >
            {["All", "Pending", "Approved", "Rejected"].map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {/* Withdrawals Table */}
        <Card
          sx={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            borderRadius: "16px",
            boxShadow: "0 6px 25px rgba(0,0,0,0.25)",
            width: "100%",
            overflowX: "auto",
          }}
        >
          <CardContent sx={{ p: 1 }}>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress sx={{ color: "white" }} />
              </Box>
            ) : filteredWithdrawals.length === 0 ? (
              <Typography align="center" sx={{ color: "rgba(255,255,255,0.7)", py: 3 }}>
                No withdrawals found.
              </Typography>
            ) : (
              <TableContainer>
                <Table size={isMobile ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      {["Name", "Amount", "Charge", "Net", "Method", "Status", "Date", "Actions"].map(
                        (head) => (
                          <TableCell
                            key={head}
                            sx={{ color: "white", fontWeight: "bold", whiteSpace: "nowrap" }}
                          >
                            {head}
                          </TableCell>
                        )
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredWithdrawals.map((w) => {
                      const status = w.status?.toLowerCase() || "pending";
                      return (
                        <motion.tr
                          key={w.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <TableCell sx={{ color: "white" }}>{w.name}</TableCell>
                          <TableCell sx={{ color: "white" }}>₱{w.amount}</TableCell>
                          <TableCell sx={{ color: "white" }}>₱{w.charge || 0}</TableCell>
                          <TableCell sx={{ color: "white" }}>₱{w.netAmount || w.amount}</TableCell>
                          <TableCell sx={{ color: "white" }}>{w.paymentMethod || "Wallet"}</TableCell>
                          <TableCell
                            sx={{
                              color:
                                status === "approved"
                                  ? "#00e676"
                                  : status === "rejected"
                                  ? "#ff1744"
                                  : "#fff",
                              fontWeight: 600,
                            }}
                          >
                            {status.toUpperCase()}
                          </TableCell>
                          <TableCell sx={{ color: "white", whiteSpace: "nowrap" }}>
                            {w.createdAt
                              ? new Date(w.createdAt.seconds * 1000).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {canApproveReject && status === "pending" ? (
                              <Box
                                sx={{
                                  display: "flex",
                                  gap: 1,
                                  flexWrap: "wrap",
                                  justifyContent: "center",
                                }}
                              >
                                {w.qrUrl && (
                                  <Button
                                    variant="outlined"
                                    color="info"
                                    size="small"
                                    onClick={() => handleViewQR(w.qrUrl)}
                                  >
                                    View QR
                                  </Button>
                                )}
                                <Button
                                  variant="contained"
                                  color="success"
                                  size="small"
                                  onClick={() => openDialog(w)}
                                >
                                  Approve / Reject
                                </Button>
                              </Box>
                            ) : (
                              <Typography
                                variant="body2"
                                sx={{ color: "rgba(255,255,255,0.6)" }}
                              >
                                {status === "pending" ? "—" : "Done"}
                              </Typography>
                            )}
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Approve / Reject Dialog */}
        <Dialog open={!!selectedWithdrawal} onClose={closeDialog} fullWidth maxWidth="sm">
          <DialogTitle>Approve or Reject Withdrawal</DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {selectedWithdrawal?.name} requested ₱
              {selectedWithdrawal?.amount}.<br />
              Charge: ₱{selectedWithdrawal?.charge || 0} | Net: ₱
              {selectedWithdrawal?.netAmount || selectedWithdrawal?.amount}
            </Typography>
            <TextField
              fullWidth
              label="Remarks (optional)"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              multiline
              rows={3}
            />
          </DialogContent>
          <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={() => handleAction("rejected")}
              color="error"
              variant="contained"
            >
              Reject
            </Button>
            <Button
              onClick={() => handleAction("approved")}
              color="success"
              variant="contained"
            >
              Approve
            </Button>
          </DialogActions>
        </Dialog>

        {/* QR Viewer Dialog */}
        <Dialog open={!!qrImage} onClose={closeQRDialog} fullWidth maxWidth="xs">
          <DialogTitle>QR / Proof Image</DialogTitle>
          <DialogContent sx={{ textAlign: "center" }}>
            <img
              src={qrImage}
              alt="Withdrawal QR Proof"
              style={{ width: "100%", borderRadius: "12px", marginTop: "10px" }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeQRDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default AdminWithdrawals;