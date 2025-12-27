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
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔹 ENHANCED SEARCH/FILTER styles
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

  // Fetch sender name
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
    { name: "Platform Revenue", value: summary.totalRevenue },
  ];

  const formatCurrency = (val) =>
    `₱${(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

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

      {!isMobile && (
        <Box sx={{ zIndex: 5 }}>
          <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        </Box>
      )}

      {isMobile && (
        <Drawer
          anchor="left"
          open={sidebarOpen}
          onClose={handleToggleSidebar}
          ModalProps={{ keepMounted: true }}
        >
          <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isMobile ? 1 : 3,
          mt: 2,
          pb: { xs: 12, sm: 12, md: 12 },
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
        <Card
          sx={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            borderRadius: "16px",
            mb: 3,
          }}
        >
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600 , color: "white",}}>
              📊 Transfer Summary
            </Typography>

            <Box sx={{ width: "100%", mt: 2 }}>
              <Stack direction={isMobile ? "column" : "row"} spacing={2}>
                <Box sx={{ flex: 1, height: 260 }}>
              
                  <ResponsiveContainer>
                    <RadialBarChart
                      innerRadius="35%"
                      outerRadius="95%"
                      data={chartData.map((item, idx) => ({
                        ...item,
                        fill: COLORS[idx % COLORS.length],
                        percent: Math.round((item.value / statusTotal) * 100),
                      }))}
                    >
                      <RadialBar
                        dataKey="value"
                        cornerRadius={12}
                        background
                        clockWise
                        minAngle={10}
                      />
                      <Legend
                        iconSize={12}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        formatter={(value, entry) => `${value} — ${entry.payload.percent || 0}%`}
                      />
                      <RechartsTooltip
                        formatter={(value, name) => [value, `${name} requests`]}
                        contentStyle={{
                          background: "rgba(0,0,0,0.75)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 10,
                          color: "white",
                        }}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </Box>

                <Box sx={{ flex: 1, height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={financialData} barSize={28}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4FC3F7" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#81C784" stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" tick={{ fill: "white" }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: "white" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                      />
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
            </Box>
          </CardContent>
        </Card>

        {/* Search & Filter */}
        <Stack
          direction={isMobile ? "column" : "row"}
          spacing={2}
          mb={2}
          sx={{ width: "100%" }}
        >
          <TextField
            placeholder="Search by Sender, Recipient, or User ID"
            variant="outlined"
            size="small"
            fullWidth={true}
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

        {/* Table */}
        <Box sx={{ width: "100%", overflowX: "auto" }}> {/* 🔹 Wrap table for mobile */}
          <Card
            sx={{
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(12px)",
              borderRadius: "16px",
              boxShadow: "0 6px 25px rgba(0,0,0,0.25)",
              minWidth: isMobile ? "700px" : "auto",
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
                  <TableContainer>
                    <Table size={isMobile ? "small" : "medium"}>
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
                              sx={{ color: "white", fontWeight: "bold" }}
                            >
                              {head}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredTransfers
                          .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                          .map((t) => (
                            <motion.tr
                              key={t.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <TableCell sx={{ color: "white" }}>{t.senderName || "Unknown"}</TableCell>
                              <TableCell sx={{ color: "white" }}>{t.recipientUsername}</TableCell>
                              <TableCell sx={{ color: "white" }}>
                                ₱{t.amount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell sx={{ color: "white" }}>
                                ₱{t.charge?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell sx={{ color: "white" }}>
                                ₱{t.netAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                              </TableCell>
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
                      ".MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows": { color: "white" },
                    }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </Box>
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