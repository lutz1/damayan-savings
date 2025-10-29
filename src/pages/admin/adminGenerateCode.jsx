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
} from "@mui/material";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import bgImage from "../../assets/bg.jpg";
import { LineChart } from "@mui/x-charts";
import { motion } from "framer-motion";
import { useTheme } from "@mui/material/styles";

const AdminGenerateCode = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState([]);
  const [totalSales, setTotalSales] = useState(0);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

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

      const total = codesWithUserInfo.reduce(
        (acc, curr) => acc + (Number(curr.amount) || 0),
        0
      );

      setCodes(codesWithUserInfo);
      setTotalSales(total);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 🧠 Memoized chart data
  const lineChartData = useMemo(() => {
    const salesByDate = codes.reduce((acc, curr) => {
      if (!curr.createdAt?.seconds) return acc;
      const date = new Date(curr.createdAt.seconds * 1000).toLocaleDateString();
      acc[date] = (acc[date] || 0) + (Number(curr.amount) || 0);
      return acc;
    }, {});

    return Object.entries(salesByDate)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, total]) => ({ date, total }));
  }, [codes]);

  const fadeIn = {
    hidden: { opacity: 0, y: 40 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.25)",
          zIndex: 0,
        },
      }}
    >
      {/* Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Sidebar */}
      <Box sx={{ zIndex: 5 }}>
        <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

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

        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="show"
          style={{
            backdropFilter: "blur(14px)",
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "16px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
            padding: "24px",
          }}
        >
          <Typography variant="h4" gutterBottom fontWeight={700}>
            Purchase Codes Analytics
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 3, opacity: 0.9 }}>
            Real-time sales overview of all purchased codes.
          </Typography>

          {loading ? (
            <CircularProgress color="inherit" />
          ) : (
            <>
              {/* Sales Summary */}
              <motion.div variants={fadeIn} transition={{ delay: 0.2 }}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", md: "center" },
                    mb: 4,
                    gap: 2,
                  }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    💰 Total Sales: ₱{totalSales.toLocaleString()}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.8 }}>
                    {codes.length} Purchases Recorded
                  </Typography>
                </Box>
              </motion.div>

              {/* Line Chart */}
              <motion.div variants={fadeIn} transition={{ delay: 0.3 }}>
                <Paper
                  sx={{
                    p: 3,
                    height: 420,
                    mb: 4,
                    background:
                      "linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
                    borderRadius: "20px",
                    backdropFilter: "blur(12px)",
                    overflow: "hidden",
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    📈 Sales Summary (Dynamic Line Chart)
                  </Typography>

                  <LineChart
                    dataset={lineChartData}
                    xAxis={[
                      {
                        dataKey: "date",
                        label: "Date",
                        scaleType: "band",
                        tickLabelStyle: { fill: "#fff" },
                      },
                    ]}
                    yAxis={[
                      {
                        label: "₱ Sales",
                        tickLabelStyle: { fill: "#fff" },
                        gridLineStyle: { stroke: "rgba(255,255,255,0.15)" },
                      },
                    ]}
                    series={[
                      {
                        dataKey: "total",
                        label: "Daily Sales",
                        color: theme.palette.success.main,
                        curve: "monotone",
                        area: true,
                        showMark: true,
                        fill: "url(#salesGradient)",
                        highlightScope: { highlighted: "series" },
                        valueFormatter: (value) =>
                          `₱${value.toLocaleString()}`,
                      },
                    ]}
                    height={340}
                    margin={{ left: 0, right: 0, top: 10, bottom: 10 }}
                    sx={{
                      "& .MuiChartsAxis-line": {
                        stroke: "rgba(255,255,255,0.3)",
                      },
                      "& .MuiChartsAxis-tickLabel": { fill: "#fff" },
                      "& .MuiLineElement-root": {
                        strokeWidth: 3,
                        filter:
                          "drop-shadow(0px 0px 6px rgba(0,255,128,0.7))",
                      },
                      "& .MuiMarkElement-root": {
                        "&:hover": {
                          r: 6,
                          fill: theme.palette.success.light,
                        },
                      },
                    }}
                  >
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={theme.palette.success.main}
                          stopOpacity="0.6"
                        />
                        <stop
                          offset="100%"
                          stopColor={theme.palette.success.main}
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </Paper>
              </motion.div>

              {/* Responsive Purchase Details Table */}
              <motion.div variants={fadeIn} transition={{ delay: 0.5 }}>
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      mb: 2,
                      fontWeight: 600,
                      textAlign: { xs: "center", sm: "left" },
                    }}
                  >
                    Purchase Details
                  </Typography>

                  <Paper
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      background: "rgba(255, 255, 255, 0.15)",
                      borderRadius: "16px",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <Box
                      sx={{
                        width: "100%",
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch",
                        scrollbarWidth: "thin",
                        "&::-webkit-scrollbar": { height: "6px" },
                        "&::-webkit-scrollbar-thumb": {
                          backgroundColor: "rgba(255,255,255,0.3)",
                          borderRadius: "10px",
                        },
                      }}
                    >
                      <TableContainer>
                        <Table
                          size={isMobile ? "small" : "medium"}
                          sx={{ minWidth: 600 }}
                        >
                          <TableHead>
                            <TableRow sx={{ background: "rgba(255,255,255,0.1)" }}>
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
                            {codes
                              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                              .map((code) => (
                                <TableRow
                                  key={code.id}
                                  sx={{
                                    "&:hover": {
                                      backgroundColor: "rgba(255,255,255,0.05)",
                                    },
                                  }}
                                >
                                  <TableCell
                                    sx={{
                                      color: "#fff",
                                      wordBreak: "break-word",
                                      maxWidth: { xs: 100, sm: "auto" },
                                    }}
                                  >
                                    {code.code}
                                  </TableCell>
                                  <TableCell sx={{ color: "#fff", whiteSpace: "nowrap" }}>
                                    ₱{Number(code.amount || 0).toLocaleString()}
                                  </TableCell>
                                  <TableCell
                                    sx={{
                                      color: "#fff",
                                      maxWidth: { xs: 120, sm: "auto" },
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {code.userDisplay}
                                  </TableCell>
                                  <TableCell sx={{ color: "#fff", whiteSpace: "nowrap" }}>
                                    {code.createdAt?.seconds
                                      ? new Date(
                                          code.createdAt.seconds * 1000
                                        ).toLocaleString()
                                      : "--"}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>

                    <TablePagination
                      component="div"
                      count={codes.length}
                      page={page}
                      onPageChange={handleChangePage}
                      rowsPerPage={rowsPerPage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                      rowsPerPageOptions={[5, 10, 25, 50]}
                      sx={{
                        color: "#fff",
                        "& .MuiSelect-icon": { color: "#fff" },
                        "& .MuiTablePagination-toolbar": {
                          flexWrap: { xs: "wrap", sm: "nowrap" },
                        },
                      }}
                    />
                  </Paper>
                </Box>
              </motion.div>
            </>
          )}
        </motion.div>
      </Box>
    </Box>
  );
};

export default AdminGenerateCode;