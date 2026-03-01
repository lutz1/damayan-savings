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
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";
import bgImage from "../../assets/bg.jpg";
import { useTheme } from "@mui/material/styles";
import {
  ResponsiveContainer,
  Cell,
  Legend,
  Tooltip as RechartsTooltip,
  RadialBarChart,
  RadialBar,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  LabelList,
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
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
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

  const formatCurrency = (value) =>
    `PHP ${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

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
      }
      return "Unknown";
    } catch (err) {
      console.error("Error fetching sender name:", err);
      return "Unknown";
    }
  };

  useEffect(() => {
    const q = query(collection(db, "transferFunds"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const dataWithNames = await Promise.all(
        data.map(async (t) => {
          if (!t.senderName) {
            t.senderName = await fetchSenderName(t.senderEmail || t.userId);
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

  const chartData = [
    { name: "Pending", value: summary.totalPending },
    { name: "Approved", value: summary.totalApproved },
    { name: "Rejected", value: summary.totalRejected },
  ];

  const statusTotal = Math.max(
    chartData.reduce((sum, item) => sum + item.value, 0),
    1
  );

  const financialData = [
    { name: "Gross Transfers", value: summary.totalAmount },
    { name: "Revenue", value: summary.totalRevenue },
  ];

  const filteredTransfers = transfers.filter((t) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      (t.senderName || "").toLowerCase().includes(search) ||
      (t.recipientUsername || "").toLowerCase().includes(search) ||
      (t.senderEmail || "").toLowerCase().includes(search) ||
      (t.userId || "").toLowerCase().includes(search);
    const matchesStatus =
      filterStatus === "All" || t.status?.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const pagedTransfers = filteredTransfers.slice(
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
          Wallet-to-Wallet Transfers
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
              Total Transfers: <b>{formatCurrency(summary.totalAmount)}</b>
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Total Revenue: <b>{formatCurrency(summary.totalRevenue)}</b>
            </Typography>
          </CardContent>
        </Card>

        <Card
          sx={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            borderRadius: "16px",
            mb: 3,
            width: "100%",
          }}
        >
          <CardContent>
            <Stack direction={isMobile ? "column" : "row"} spacing={2}>
              <Box sx={{ flex: 1, minWidth: 260, height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="40%"
                    outerRadius="90%"
                    startAngle={90}
                    endAngle={-270}
                    data={chartData}
                  >
                    <RadialBar dataKey="value" background cornerRadius={10} />
                    {chartData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                    <RechartsTooltip
                      formatter={(value, name) => [value, name]}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      contentStyle={{
                        background: "rgba(0,0,0,0.75)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 10,
                        color: "white",
                      }}
                    />
                    <Legend wrapperStyle={{ color: "white" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <Typography align="center" sx={{ mt: 1, opacity: 0.8, fontSize: 12 }}>
                  Total status count: {statusTotal}
                </Typography>
              </Box>

              <Box sx={{ flex: 1, minWidth: 260, height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialData} margin={{ top: 16, right: 8, left: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4FC3F7" stopOpacity={0.9} />
                        <stop offset="95%" stopColor="#4FC3F7" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                    <XAxis dataKey="name" stroke="#fff" />
                    <YAxis stroke="#fff" tickFormatter={(v) => Math.round(v)} />
                    <RechartsTooltip
                      formatter={(value, name) => [formatCurrency(value), name]}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      contentStyle={{
                        background: "rgba(0,0,0,0.75)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 10,
                        color: "white",
                      }}
                    />
                    <Legend wrapperStyle={{ color: "white" }} />
                    <Bar dataKey="value" name="Amount" fill="url(#barGradient)" radius={[10, 10, 0, 0]}>
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(v) => formatCurrency(v)}
                        style={{ fill: "white", fontWeight: 600 }}
                      />
                      {financialData.map((entry, index) => (
                        <Cell key={entry.name} fill={index === 1 ? "#FFB74D" : "url(#barGradient)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Stack direction={isMobile ? "column" : "row"} spacing={2} mb={2} sx={{ width: "100%" }}>
          <TextField
            placeholder="Search by sender, recipient, or user ID"
            variant="outlined"
            size="small"
            fullWidth
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
            ) : filteredTransfers.length === 0 ? (
              <Typography align="center" sx={{ color: "rgba(255,255,255,0.7)", py: 3 }}>
                No transfer requests found.
              </Typography>
            ) : (
              <>
                {isMobile ? (
                  <Stack spacing={2} sx={{ p: 1 }}>
                    {pagedTransfers.map((t) => (
                      <Card
                        key={t.id}
                        sx={{
                          background: "rgba(15, 23, 42, 0.75)",
                          borderRadius: 3,
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "white",
                        }}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Typography sx={{ fontWeight: 700, mb: 1 }}>
                            {t.senderName || "Unknown"} to {t.recipientUsername}
                          </Typography>
                          <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                            Amount: {formatCurrency(t.amount)}
                          </Typography>
                          <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                            Charge: {formatCurrency(t.charge)}
                          </Typography>
                          <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                            Net: {formatCurrency(t.netAmount)}
                          </Typography>
                          <Box
                            sx={{
                              mt: 1,
                              display: "inline-block",
                              px: 2,
                              py: 0.5,
                              borderRadius: "12px",
                              backgroundColor:
                                t.status === "Approved"
                                  ? "rgba(129, 199, 132, 0.2)"
                                  : t.status === "Rejected"
                                  ? "rgba(229, 115, 115, 0.2)"
                                  : "rgba(255, 183, 77, 0.2)",
                              color:
                                t.status === "Approved"
                                  ? "#81C784"
                                  : t.status === "Rejected"
                                  ? "#E57373"
                                  : "#FFB74D",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                            }}
                          >
                            {t.status}
                          </Box>
                          <Typography sx={{ fontSize: 12, opacity: 0.7, mt: 0.5 }}>
                            {t.createdAt?.toDate
                              ? new Date(t.createdAt.toDate()).toLocaleString("en-PH", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "N/A"}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table size="medium">
                      <TableHead>
                        <TableRow>
                          {[
                            "Sender",
                            "Recipient",
                            "Amount",
                            "Charge (2%)",
                            "Net Amount",
                            "Status",
                            "Date",
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
                        {pagedTransfers.map((t) => (
                          <motion.tr
                            key={t.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <TableCell sx={{ color: "white" }}>{t.senderName || "Unknown"}</TableCell>
                            <TableCell sx={{ color: "white" }}>{t.recipientUsername}</TableCell>
                            <TableCell sx={{ color: "white" }}>{formatCurrency(t.amount)}</TableCell>
                            <TableCell sx={{ color: "white" }}>{formatCurrency(t.charge)}</TableCell>
                            <TableCell sx={{ color: "white" }}>{formatCurrency(t.netAmount)}</TableCell>
                            <TableCell>
                              <Box
                                sx={{
                                  display: "inline-block",
                                  px: 2,
                                  py: 0.5,
                                  borderRadius: "12px",
                                  backgroundColor:
                                    t.status === "Approved"
                                      ? "rgba(129, 199, 132, 0.2)"
                                      : t.status === "Rejected"
                                      ? "rgba(229, 115, 115, 0.2)"
                                      : "rgba(255, 183, 77, 0.2)",
                                  color:
                                    t.status === "Approved"
                                      ? "#81C784"
                                      : t.status === "Rejected"
                                      ? "#E57373"
                                      : "#FFB74D",
                                  fontWeight: 600,
                                  fontSize: "0.85rem",
                                }}
                              >
                                {t.status}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ color: "white" }}>
                              {t.createdAt?.toDate
                                ? new Date(t.createdAt.toDate()).toLocaleString("en-PH", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "N/A"}
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                <TablePagination
                  component="div"
                  count={filteredTransfers.length}
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
