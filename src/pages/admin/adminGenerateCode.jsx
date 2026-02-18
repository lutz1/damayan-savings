import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Toolbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  useMediaQuery,
  TableContainer,
  Button,
  TextField,
  InputAdornment,
  Drawer,
  Stack,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { collection, onSnapshot, doc, getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import AppBottomNav from "../../components/AppBottomNav";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";
import Topbar from "../../components/Topbar";
import bgImage from "../../assets/bg.jpg";
import {
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { useTheme } from "@mui/material/styles";

const AdminGenerateCode = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [capitalShareCodes, setCapitalShareCodes] = useState([]);
  const [downlineCodes, setDownlineCodes] = useState([]);
  const [totalCapitalSales, setTotalCapitalSales] = useState(0);
  const [totalDownlineSales, setTotalDownlineSales] = useState(0);

  const [capitalPage, setCapitalPage] = useState(0);
  const [downlinePage, setDownlinePage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

    // Memoized filtered codes
const filteredCapitalCodes = useMemo(() => {
  if (!searchQuery) return capitalShareCodes;
  const lowerQuery = searchQuery.toLowerCase();
  return capitalShareCodes.filter((code) =>
    [
      code.code,
      code.amount?.toString(),
      code.userDisplay,
      code.createdAt?.seconds
        ? new Date(code.createdAt.seconds * 1000).toLocaleString()
        : "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(lowerQuery)
  );
}, [capitalShareCodes, searchQuery]);

const filteredDownlineCodes = useMemo(() => {
  if (!searchQuery) return downlineCodes;
  const lowerQuery = searchQuery.toLowerCase();
  return downlineCodes.filter((code) =>
    [
      code.code,
      code.amount?.toString(),
      code.userDisplay,
      code.createdAt?.seconds
        ? new Date(code.createdAt.seconds * 1000).toLocaleString()
        : "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(lowerQuery)
  );
}, [downlineCodes, searchQuery]);

  const handleExportCodes = async () => {
    try {
      const workbook = XLSX.utils.book_new();

      // Capital Share Codes
      if (capitalShareCodes.length > 0) {
        const capitalData = capitalShareCodes.map((code) => ({
          Code: code.code || "",
          Amount: code.amount || 0,
          "User ID": code.userId || "",
          "Purchased By": code.userDisplay || "",
          Status: code.status || "",
          "Created At": code.createdAt?.seconds
            ? new Date(code.createdAt.seconds * 1000).toLocaleString()
            : "--",
        }));
        const capitalSheet = XLSX.utils.json_to_sheet(capitalData);
        XLSX.utils.book_append_sheet(workbook, capitalSheet, "Capital Share Codes");
      }

      // Downline Codes
      if (downlineCodes.length > 0) {
        const downlineData = downlineCodes.map((code) => ({
          Code: code.code || "",
          Amount: code.amount || 0,
          "User ID": code.userId || "",
          "Purchased By": code.userDisplay || "",
          Status: code.status || "",
          "Created At": code.createdAt?.seconds
            ? new Date(code.createdAt.seconds * 1000).toLocaleString()
            : "--",
        }));
        const downlineSheet = XLSX.utils.json_to_sheet(downlineData);
        XLSX.utils.book_append_sheet(workbook, downlineSheet, "Downline Codes");
      }

      // Write and download
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const data = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(data, "PurchaseCodes.xlsx");
    } catch (error) {
      console.error("Error exporting codes:", error);
      alert("Failed to export codes: " + error.message);
    }
  };

  // 🔥 Real-time Firestore fetch with user lookup
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "purchaseCodes"), async (snapshot) => {
      const purchaseData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const sorted = purchaseData.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );

      const codesWithUserInfo = await Promise.all(
        sorted.map(async (code) => {
          if (!code.userId) return { ...code, userDisplay: "Unknown User" };

          try {
            const userDoc = await getDoc(doc(db, "users", code.userId));
            if (!userDoc.exists()) return { ...code, userDisplay: "Unknown User" };

            const userData = userDoc.data();
            return {
              ...code,
              userDisplay:
                userData.username ||
                userData.fullName ||
                userData.displayName ||
                userData.email ||
                "Unnamed User",
            };
          } catch (error) {
            console.error("Error fetching user data:", error);
            return { ...code, userDisplay: "Error Loading User" };
          }
        })
      );

      // Separate codes by type - using exact field names from Firestore
      const capitalShare = codesWithUserInfo.filter(
        (c) => c.type === "Activate Capital Share"
      );
      const downline = codesWithUserInfo.filter(
        (c) => c.type === "Downline Code"
      );
      
      // Debug: log the data structure
      console.log("Purchase Codes Sample:", codesWithUserInfo.slice(0, 2));
      console.log("Capital Share Count:", capitalShare.length, "Downline Count:", downline.length);

      const totalCapital = capitalShare.reduce(
        (acc, curr) => acc + (Number(curr.amount) || 0),
        0
      );
      const totalDownline = downline.reduce(
        (acc, curr) => acc + (Number(curr.amount) || 0),
        0
      );

      setCapitalShareCodes(capitalShare);
      setDownlineCodes(downline);
      setTotalCapitalSales(totalCapital);
      setTotalDownlineSales(totalDownline);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 🧠 Memoized chart data
  const capitalChartData = useMemo(() => {
    const salesByDate = capitalShareCodes.reduce((acc, curr) => {
      if (!curr.createdAt?.seconds) return acc;
      const date = new Date(curr.createdAt.seconds * 1000).toLocaleDateString();
      acc[date] = (acc[date] || 0) + (Number(curr.amount) || 0);
      return acc;
    }, {});

    return Object.entries(salesByDate)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, total]) => ({ date, total }));
  }, [capitalShareCodes]);

  const downlineChartData = useMemo(() => {
    const salesByDate = downlineCodes.reduce((acc, curr) => {
      if (!curr.createdAt?.seconds) return acc;
      const date = new Date(curr.createdAt.seconds * 1000).toLocaleDateString();
      acc[date] = (acc[date] || 0) + (Number(curr.amount) || 0);
      return acc;
    }, {});

    return Object.entries(salesByDate)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, total]) => ({ date, total }));
  }, [downlineCodes]);

  const fadeIn = {
    hidden: { opacity: 0, y: 40 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setCapitalPage(0);
    setDownlinePage(0);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        minHeight: '100vh',
        minWidth: '100vw',
        overflow: 'hidden',
        display: 'flex',
        backgroundImage: `linear-gradient(120deg, rgba(30, 41, 59, 0.92) 60%, rgba(33, 150, 243, 0.25)), url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 0,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(120deg, rgba(30, 41, 59, 0.92) 60%, rgba(33, 150, 243, 0.25))',
          zIndex: 0,
        },
      }}
    >
      {/* Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Sidebar */}
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

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isMobile ? 1 : 4,
          mt: 0,
          pb: { xs: 3, sm: 12, md: 12 },
          color: "#f5f7fa",
          zIndex: 1,
          width: "100%",
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Toolbar />
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            mb: 2,
            gap: 2,
          }}
        >
          <Button
            variant="contained"
            onClick={handleExportCodes}
            sx={{
              backgroundColor: "#2e7d32",
              "&:hover": { backgroundColor: "#27632a" },
            }}
          >
            📄 Export All Codes (Excel)
          </Button>
        </Box>
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="show"
          style={{
            maxWidth: 1200,
            width: '100%',
            margin: '0 auto',
            background: 'rgba(34, 40, 49, 0.92)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px 0 rgba(16, 30, 54, 0.25)',
            padding: isMobile ? '16px' : '40px',
            border: '1.5px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(18px)',
            marginBottom: 32,
          }}
        >
              
          <Typography variant="h3" gutterBottom fontWeight={800} sx={{ letterSpacing: 1, color: '#fff', textShadow: '0 2px 8px #0008' }}>
            Purchase Codes Analytics
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 4, opacity: 0.92, color: '#b0bec5', fontWeight: 500, fontSize: isMobile ? 15 : 18 }}>
            Real-time sales overview of <b>Capital Share</b> and <b>Downline</b> codes. Export, search, and analyze with ease.
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress color="inherit" size={48} thickness={4.5} />
            </Box>
          ) : (
            <>
              {/* CAPITAL SHARE SECTION */}
              <Box sx={{ mb: 6 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, color: "#81C784", letterSpacing: 0.5, textShadow: '0 2px 8px #0006' }}>
                  📊 Capital Share Activation Codes
                </Typography>

                {/* Capital Share Summary */}
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", md: "center" },
                    mb: 3,
                    gap: 2,
                    p: 2.5,
                    background: "linear-gradient(90deg, rgba(129,199,132,0.18), rgba(255,255,255,0.04))",
                    borderRadius: "14px",
                    boxShadow: '0 2px 12px 0 rgba(129,199,132,0.08)',
                  }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "#81C784" }}>
                    💰 Total Sales: ₱{totalCapitalSales.toLocaleString()}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.85, color: '#fff' }}>
                    {capitalShareCodes.length} Codes Purchased
                  </Typography>
                </Box>

                {/* Capital Share Chart */}
                <Paper
                  sx={{
                    p: 3,
                    height: 380,
                    mb: 3,
                    background:
                      "linear-gradient(120deg, rgba(129,199,132,0.18), rgba(255,255,255,0.04))",
                    borderRadius: "18px",
                    boxShadow: '0 4px 24px 0 rgba(129,199,132,0.10)',
                    backdropFilter: "blur(14px)",
                    overflow: "hidden",
                    border: "1.5px solid rgba(129,199,132,0.18)",
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#fff' }}>
                    📈 Capital Share Sales Trend
                  </Typography>

                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={capitalChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <defs>
                        <linearGradient id="capitalGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#81C784" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#66BB6A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="date" tick={{ fill: "white" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "white" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                      <RechartsTooltip
                        formatter={(value) => `₱${value.toLocaleString()}`}
                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                        contentStyle={{
                          background: "rgba(0,0,0,0.75)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 10,
                          color: "white",
                        }}
                      />
                      <Area type="monotone" dataKey="total" stroke="#81C784" strokeWidth={3} fill="url(#capitalGradient)" dot={{ r: 3, stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Paper>

                {/* Capital Share Table */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#fff' }}>
                    Capital Share Code Details
                  </Typography>
                  <Box sx={{ mb: 2, width: "100%" }}>
                    <TextField
                      fullWidth
                      placeholder="Search capital share codes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      variant="filled"
                      size="small"
                      sx={{
                        backgroundColor: "rgba(255,255,255,0.1)",
                        borderRadius: 2,
                        "& .MuiInputBase-input": { color: "#fff" },
                        "& .MuiInputLabel-root": { color: "#fff" },
                        "& .MuiFilledInput-root": {
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: "white" }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Box>
                  <Paper
                    sx={{
                      p: { xs: 1.5, sm: 2.5 },
                      background: "rgba(34, 40, 49, 0.92)",
                      borderRadius: "14px",
                      boxShadow: '0 2px 12px 0 rgba(129,199,132,0.08)',
                      backdropFilter: "blur(8px)",
                      border: '1.5px solid rgba(129,199,132,0.10)',
                    }}
                  >
                    {isMobile ? (
                      <Stack spacing={2} sx={{ p: 1 }}>
                        {filteredCapitalCodes
                          .slice(capitalPage * rowsPerPage, capitalPage * rowsPerPage + rowsPerPage)
                          .map((code) => (
                            <Card
                              key={code.id}
                              sx={{
                                background: "rgba(15, 23, 42, 0.75)",
                                borderRadius: 3,
                                border: "1px solid rgba(255,255,255,0.1)",
                                color: "white",
                              }}
                            >
                              <CardContent sx={{ p: 2 }}>
                                <Typography sx={{ fontWeight: 700, mb: 1 }}>{code.code}</Typography>
                                <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                                  Amount: ₱{Number(code.amount || 0).toLocaleString()}
                                </Typography>
                                <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                                  Purchased By: {code.userDisplay}
                                </Typography>
                                <Typography sx={{ fontSize: 12, opacity: 0.7, mt: 0.5 }}>
                                  {code.createdAt?.seconds
                                    ? new Date(code.createdAt.seconds * 1000).toLocaleString()
                                    : "--"}
                                </Typography>
                              </CardContent>
                            </Card>
                          ))}
                      </Stack>
                    ) : (
                      <Box sx={{ width: "100%", overflowX: "auto" }}>
                        <TableContainer>
                          <Table size="medium" sx={{ minWidth: 600, background: 'transparent' }}>
                            <TableHead>
                              <TableRow sx={{ background: "rgba(129,199,132,0.15)" }}>
                                <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                                  Code
                                </TableCell>
                                <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                                  Amount (₱)
                                </TableCell>
                                <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                                  Purchased By
                                </TableCell>
                                <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                                  Date
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {filteredCapitalCodes
                                .slice(capitalPage * rowsPerPage, capitalPage * rowsPerPage + rowsPerPage)
                                .map((code) => (
                                  <TableRow
                                    key={code.id}
                                    sx={{
                                      "&:hover": {
                                        backgroundColor: "rgba(129,199,132,0.1)",
                                      },
                                    }}
                                  >
                                    <TableCell sx={{ color: "#fff" }}>{code.code}</TableCell>
                                    <TableCell sx={{ color: "#fff" }}>
                                      ₱{Number(code.amount || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell sx={{ color: "#fff" }}>{code.userDisplay}</TableCell>
                                    <TableCell sx={{ color: "#fff" }}>
                                      {code.createdAt?.seconds
                                        ? new Date(code.createdAt.seconds * 1000).toLocaleString()
                                        : "--"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}

                    <TablePagination
                      component="div"
                      count={filteredCapitalCodes.length}
                      page={capitalPage}
                      onPageChange={(_, p) => setCapitalPage(p)}
                      rowsPerPage={rowsPerPage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                      rowsPerPageOptions={[5, 10, 25, 50]}
                      sx={{
                        color: "#fff",
                        "& .MuiSelect-icon": { color: "#fff" },
                      }}
                    />
                  </Paper>
                </Box>
              </Box>

              {/* DOWNLINE CODE SECTION */}
              <Box sx={{ mt: 6 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, color: "#4FC3F7", letterSpacing: 0.5, textShadow: '0 2px 8px #0006' }}>
                  📊 Downline Codes
                </Typography>

                {/* Downline Summary */}
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", md: "center" },
                    mb: 3,
                    gap: 2,
                    p: 2.5,
                    background: "linear-gradient(90deg, rgba(79,195,247,0.18), rgba(255,255,255,0.04))",
                    borderRadius: "14px",
                    boxShadow: '0 2px 12px 0 rgba(79,195,247,0.08)',
                  }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "#4FC3F7" }}>
                    💰 Total Sales: ₱{totalDownlineSales.toLocaleString()}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.85, color: '#fff' }}>
                    {downlineCodes.length} Codes Purchased
                  </Typography>
                </Box>

                {/* Downline Chart */}
                <Paper
                  sx={{
                    p: 3,
                    height: 380,
                    mb: 3,
                    background:
                      "linear-gradient(120deg, rgba(79,195,247,0.18), rgba(255,255,255,0.04))",
                    borderRadius: "18px",
                    boxShadow: '0 4px 24px 0 rgba(79,195,247,0.10)',
                    backdropFilter: "blur(14px)",
                    overflow: "hidden",
                    border: "1.5px solid rgba(79,195,247,0.18)",
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#fff' }}>
                    📈 Downline Sales Trend
                  </Typography>

                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={downlineChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <defs>
                        <linearGradient id="downlineGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4FC3F7" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#29B6F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="date" tick={{ fill: "white" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "white" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                      <RechartsTooltip
                        formatter={(value) => `₱${value.toLocaleString()}`}
                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                        contentStyle={{
                          background: "rgba(0,0,0,0.75)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 10,
                          color: "white",
                        }}
                      />
                      <Area type="monotone" dataKey="total" stroke="#4FC3F7" strokeWidth={3} fill="url(#downlineGradient)" dot={{ r: 3, stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Paper>

                {/* Downline Table */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#fff' }}>
                    Downline Code Details
                  </Typography>
                  <Box sx={{ mb: 2, width: "100%" }}>
                    <TextField
                      fullWidth
                      placeholder="Search downline codes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      variant="filled"
                      size="small"
                      sx={{
                        backgroundColor: "rgba(255,255,255,0.1)",
                        borderRadius: 2,
                        "& .MuiInputBase-input": { color: "#fff" },
                        "& .MuiInputLabel-root": { color: "#fff" },
                        "& .MuiFilledInput-root": {
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: "white" }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Box>
                  <Paper
                    sx={{
                      p: { xs: 1.5, sm: 2.5 },
                      background: "rgba(34, 40, 49, 0.92)",
                      borderRadius: "14px",
                      boxShadow: '0 2px 12px 0 rgba(79,195,247,0.08)',
                      backdropFilter: "blur(8px)",
                      border: '1.5px solid rgba(79,195,247,0.10)',
                    }}
                  >
                    {isMobile ? (
                      <Stack spacing={2} sx={{ p: 1 }}>
                        {filteredDownlineCodes
                          .slice(downlinePage * rowsPerPage, downlinePage * rowsPerPage + rowsPerPage)
                          .map((code) => (
                            <Card
                              key={code.id}
                              sx={{
                                background: "rgba(15, 23, 42, 0.75)",
                                borderRadius: 3,
                                border: "1px solid rgba(255,255,255,0.1)",
                                color: "white",
                              }}
                            >
                              <CardContent sx={{ p: 2 }}>
                                <Typography sx={{ fontWeight: 700, mb: 1 }}>{code.code}</Typography>
                                <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                                  Amount: ₱{Number(code.amount || 0).toLocaleString()}
                                </Typography>
                                <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
                                  Purchased By: {code.userDisplay}
                                </Typography>
                                <Typography sx={{ fontSize: 12, opacity: 0.7, mt: 0.5 }}>
                                  {code.createdAt?.seconds
                                    ? new Date(code.createdAt.seconds * 1000).toLocaleString()
                                    : "--"}
                                </Typography>
                              </CardContent>
                            </Card>
                          ))}
                      </Stack>
                    ) : (
                      <Box sx={{ width: "100%", overflowX: "auto" }}>
                        <TableContainer>
                          <Table size="medium" sx={{ minWidth: 600, background: 'transparent' }}>
                            <TableHead>
                              <TableRow sx={{ background: "rgba(79,195,247,0.15)" }}>
                                <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                                  Code
                                </TableCell>
                                <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                                  Amount (₱)
                                </TableCell>
                                <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                                  Purchased By
                                </TableCell>
                                <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                                  Date
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {filteredDownlineCodes
                                .slice(downlinePage * rowsPerPage, downlinePage * rowsPerPage + rowsPerPage)
                                .map((code) => (
                                  <TableRow
                                    key={code.id}
                                    sx={{
                                      "&:hover": {
                                        backgroundColor: "rgba(79,195,247,0.1)",
                                      },
                                    }}
                                  >
                                    <TableCell sx={{ color: "#fff" }}>{code.code}</TableCell>
                                    <TableCell sx={{ color: "#fff" }}>
                                      ₱{Number(code.amount || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell sx={{ color: "#fff" }}>{code.userDisplay}</TableCell>
                                    <TableCell sx={{ color: "#fff" }}>
                                      {code.createdAt?.seconds
                                        ? new Date(code.createdAt.seconds * 1000).toLocaleString()
                                        : "--"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}

                    <TablePagination
                      component="div"
                      count={filteredDownlineCodes.length}
                      page={downlinePage}
                      onPageChange={(_, p) => setDownlinePage(p)}
                      rowsPerPage={rowsPerPage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                      rowsPerPageOptions={[5, 10, 25, 50]}
                      sx={{
                        color: "#fff",
                        "& .MuiSelect-icon": { color: "#fff" },
                      }}
                    />
                  </Paper>
                </Box>
              </Box>
            </>
          )}
        </motion.div>
      </Box>
    </Box>
  );
};

export default AdminGenerateCode;