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
  TablePagination,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { motion } from "framer-motion";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  query,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "../../firebase";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";
import { useTheme } from "@mui/material/styles";

const AdminWithdrawals = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [qrImage, setQrImage] = useState(null);
  const [salesData, setSalesData] = useState({ total: 0, revenue: 0 });
  const [userRole, setUserRole] = useState(
    () => localStorage.getItem("userRole")?.toUpperCase() || ""
  );
  const [userEmail, setUserEmail] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const auth = getAuth();
  const functions = getFunctions(app, "us-central1");
  const normalizedRole = String(userRole || "").toUpperCase().trim();
  const isSuperAdmin = normalizedRole === "SUPERADMIN";

  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

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

  useEffect(() => {
    const fetchRole = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const role = userDoc.data().role?.toUpperCase() || "";
          const email = userDoc.data().email || user.email || "";
          setUserRole(role);
          setUserEmail(email);
        }
      } catch (err) {
        console.error("[adminWithdrawals] Error fetching role:", err);
      }
    };

    fetchRole();
  }, [auth]);

  useEffect(() => {
    const q = query(collection(db, "withdrawals"));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const rawData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        const enrichedData = await Promise.all(
          rawData.map(async (withdrawal) => {
            if (!withdrawal.name || withdrawal.name.trim() === "") {
              try {
                const userRef = doc(db, "users", withdrawal.userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  const displayName =
                    userData.name || userData.fullName || userData.username || "Unknown";
                  return { ...withdrawal, name: displayName };
                }
              } catch (err) {
                console.warn("Failed to fetch user for withdrawal:", withdrawal.id, err);
              }
            }
            return withdrawal;
          })
        );

        const sorted = enrichedData.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );

        const approved = sorted.filter((w) => w.status?.toLowerCase() === "approved");
        const totalAmount = approved.reduce((sum, w) => sum + Number(w.amount || 0), 0);
        const revenue = approved.reduce((sum, w) => sum + Number(w.charge || 0), 0);

        setWithdrawals(sorted);
        setSalesData({ total: totalAmount, revenue });
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching withdrawals:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const openDialog = (withdrawal) => {
    if (!canApproveReject) {
      return;
    }

    setSelectedWithdrawal(withdrawal);
    setRemarks(withdrawal?.remarks || "");
  };

  const closeDialog = () => {
    setSelectedWithdrawal(null);
    setRemarks("");
  };

  const handleViewQR = (url) => setQrImage(url);
  const closeQRDialog = () => setQrImage(null);

  const handleAction = async (status) => {
    if (!selectedWithdrawal) return;
    if (!canApproveReject) {
      alert("Approve/Reject is disabled for this admin account.");
      return;
    }

    try {
      const processWithdrawalApproval = httpsCallable(functions, "processWithdrawalApproval");
      await processWithdrawalApproval({
        withdrawalId: selectedWithdrawal.id,
        action: status.toLowerCase(),
        remarks,
      });

      closeDialog();
      window.alert(
        status.toLowerCase() === "approved"
          ? "Withdrawal approved successfully. The user has been notified."
          : "Withdrawal rejected successfully. The user has been notified."
      );
    } catch (err) {
      console.error("Error updating withdrawal:", err);
      alert(err?.message || "Failed to update withdrawal.");
    }
  };

  // Emails that should have approve/reject disabled
  const restrictedEmails = [
    "admin1@gmail.com",
    "admin2@gmail.com",
  ];

  // Check if user can approve/reject
  const normalizedEmail = String(userEmail || auth.currentUser?.email || "").trim().toLowerCase();
  const isRestrictedEmail = restrictedEmails.includes(normalizedEmail);
  const canApproveReject = ["SUPERADMIN", "CEO"].includes(normalizedRole) && !isRestrictedEmail;

  const filteredWithdrawals = withdrawals.filter((w) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      (w.name || "").toLowerCase().includes(search) ||
      (w.paymentMethod || "").toLowerCase().includes(search);
    const matchesStatus =
      filterStatus === "All" || w.status?.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const pagedWithdrawals = filteredWithdrawals.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        backgroundColor: "#1a1a1a",
        position: "relative",
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 1200 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {!isMobile && (
        <Box sx={{ zIndex: 5 }}>
          <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        </Box>
      )}

      {isMobile && (
        <>
          <AdminSidebarToggle onClick={handleToggleSidebar} />
          <Drawer
            anchor="left"
            open={sidebarOpen}
            onClose={handleToggleSidebar}
            ModalProps={{ keepMounted: true }}
            PaperProps={{
              sx: {
                background: "transparent",
                boxShadow: "none",
              },
            }}
          >
            <AppBottomNav layout="sidebar" open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
          </Drawer>
        </>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isMobile ? 1 : 3,
          mt: 2,
          pb: { xs: 3, sm: 12, md: 12 },
          color: "white",
          zIndex: 1,
          width: "100%",
          overflowX: "hidden",
          paddingLeft: 0,
          transition: "all 0.3s ease",
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
          Withdrawals Management
        </Typography>

        <Card
          sx={{
            color: "white",
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            borderRadius: "16px",
            mb: 3,
            width: "100%",
          }}
        >
          <CardContent sx={{ textAlign: isMobile ? "center" : "left" }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Sales Summary
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Total Approved Withdrawals: <b>₱{salesData.total.toFixed(2)}</b>
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Revenue (5% charge): <b>₱{salesData.revenue.toFixed(2)}</b>
            </Typography>
          </CardContent>
        </Card>

        <Stack direction={isMobile ? "column" : "row"} spacing={2} mb={2} sx={{ width: "100%" }}>
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
              <>
                {isMobile ? (
                  <Stack spacing={2} sx={{ p: 1 }}>
                    {pagedWithdrawals.map((w) => {
                      const status = w.status?.toLowerCase() || "pending";
                      const isPending = status === "pending";
                      const canAction = canApproveReject && isPending;
                      const showDisabledAction = isRestrictedEmail && isPending;
                      return (
                        <Card
                          key={w.id}
                          sx={{
                            background: "rgba(15, 23, 42, 0.75)",
                            borderRadius: 3,
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "white",
                          }}
                        >
                          <CardContent sx={{ p: 2 }}>
                            <Typography sx={{ fontWeight: 700, mb: 1 }}>{w.name}</Typography>
                            <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                              Amount: ₱{w.amount}
                            </Typography>
                            <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                              Charge: ₱{w.charge || 0}
                            </Typography>
                            <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                              Net: ₱{w.netAmount || w.amount}
                            </Typography>
                            <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                              Method: {w.paymentMethod || "Wallet"}
                            </Typography>
                            {isSuperAdmin && (
                              <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                                Reviewed By: {w.reviewedByUsername || w.reviewedByEmail || w.reviewedByUid || "—"}
                              </Typography>
                            )}
                            <Typography
                              sx={{
                                mt: 1,
                                fontWeight: 700,
                                color:
                                  status === "approved"
                                    ? "#00e676"
                                    : status === "rejected"
                                    ? "#ff1744"
                                    : "#fff",
                              }}
                            >
                              {status.toUpperCase()}
                            </Typography>
                            <Typography sx={{ fontSize: 12, opacity: 0.7, mt: 0.5 }}>
                              {w.createdAt
                                ? new Date(w.createdAt.seconds * 1000).toLocaleString()
                                : "—"}
                            </Typography>
                            {canAction || showDisabledAction ? (
                              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
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
                                  disabled={!canApproveReject}
                                  title={showDisabledAction ? "Approve/Reject is disabled for this account" : undefined}
                                >
                                  Approve / Reject
                                </Button>
                              </Box>
                            ) : (
                              <Typography
                                variant="body2"
                                sx={{ color: "rgba(255,255,255,0.6)", mt: 1 }}
                              >
                                {status === "pending" ? "—" : "Done"}
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table size="medium">
                      <TableHead>
                        <TableRow>
                          {[
                            "Name",
                            "Amount",
                            "Charge",
                            "Net",
                            "Method",
                            ...(isSuperAdmin ? ["Reviewed By"] : []),
                            "Status",
                            "Date",
                            "Actions",
                          ].map((head) => (
                            <TableCell
                              key={head}
                              sx={{ color: "white", fontWeight: "bold", whiteSpace: "nowrap" }}
                            >
                              {head}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pagedWithdrawals.map((w) => {
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
                              {isSuperAdmin && (
                                <TableCell sx={{ color: "white" }}>
                                  {w.reviewedByUsername || w.reviewedByEmail || w.reviewedByUid || "—"}
                                </TableCell>
                              )}
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
                                {(canApproveReject || isRestrictedEmail) && status === "pending" ? (
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
                                      disabled={!canApproveReject}
                                      title={isRestrictedEmail ? "Approve/Reject is disabled for this account" : undefined}
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

                <TablePagination
                  component="div"
                  count={filteredWithdrawals.length}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  sx={{
                    color: "white",
                    ".MuiTablePagination-toolbar": { color: "white" },
                    ".MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows": {
                      color: "white",
                    },
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedWithdrawal} onClose={closeDialog} fullWidth maxWidth="sm">
          <DialogTitle>Approve or Reject Withdrawal</DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {selectedWithdrawal?.name} requested ₱{selectedWithdrawal?.amount}.<br />
              Charge: ₱{selectedWithdrawal?.charge || 0} | Net: ₱
              {selectedWithdrawal?.netAmount || selectedWithdrawal?.amount}
            </Typography>
            {isRestrictedEmail && (
              <Typography variant="body2" sx={{ mb: 2, color: "error.main", fontWeight: 600 }}>
                Approve/Reject is disabled for this admin account.
              </Typography>
            )}
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
            <Button onClick={() => handleAction("rejected")} color="error" variant="contained" disabled={!canApproveReject}>
              Reject
            </Button>
            <Button onClick={() => handleAction("approved")} color="success" variant="contained" disabled={!canApproveReject}>
              Approve
            </Button>
          </DialogActions>
        </Dialog>

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
