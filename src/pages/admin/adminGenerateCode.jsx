// src/pages/admin/AdminGenerateCode.jsx
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
} from "@mui/material";
import { collection, onSnapshot } from "firebase/firestore";
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

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔥 Real-time Firestore fetch
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "purchaseCodes"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const sorted = data.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );

      const total = sorted.reduce(
        (acc, curr) => acc + (Number(curr.amount) || 0),
        0
      );

      setCodes(sorted);
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

  // 🪄 Animations
  const fadeIn = {
    hidden: { opacity: 0, y: 40 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  // Pagination handlers
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
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      <Box sx={{ zIndex: 5 }}>
        <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          color: "white",
          zIndex: 1,
          width: `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
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
              {/* Summary */}
              <motion.div variants={fadeIn} transition={{ delay: 0.2 }}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 4,
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

              {/* Enhanced Line Chart */}
              <motion.div
                variants={fadeIn}
                transition={{ delay: 0.3 }}
                style={{ position: "relative" }}
              >
                <Paper
                  sx={{
                    p: 3,
                    height: 420,
                    mb: 4,
                    background: "linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
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
                        gridLineStyle: {
                          stroke: "rgba(255,255,255,0.15)",
                        },
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
                        valueFormatter: (value) => `₱${value.toLocaleString()}`,
                      },
                    ]}
                    tooltip={{
                      trigger: "item",
                      itemContentRender: (item) => (
                        <Paper
                          sx={{
                            p: 1,
                            bgcolor: "rgba(0,0,0,0.75)",
                            color: "white",
                            borderRadius: "8px",
                            boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                          }}
                        >
                          <Typography variant="body2" fontWeight={600}>
                            {item.data.date}
                          </Typography>
                          <Typography variant="body2">
                            ₱{item.data.total.toLocaleString()}
                          </Typography>
                        </Paper>
                      ),
                    }}
                    height={340}
                    margin={{ left: 60, right: 20, top: 20, bottom: 40 }}
                    sx={{
                      "& .MuiChartsAxis-line": {
                        stroke: "rgba(255,255,255,0.3)",
                      },
                      "& .MuiChartsAxis-tickLabel": { fill: "#fff" },
                      "& .MuiLineElement-root": {
                        strokeWidth: 3,
                        filter: "drop-shadow(0px 0px 6px rgba(0,255,128,0.7))",
                        transition: "all 0.6s ease",
                      },
                      "& .MuiMarkElement-root": {
                        transition: "all 0.3s ease",
                        "&:hover": {
                          r: 6,
                          fill: theme.palette.success.light,
                        },
                      },
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="salesGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
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

              {/* Table */}
              <motion.div variants={fadeIn} transition={{ delay: 0.5 }}>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Purchase Details
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      background: "rgba(255, 255, 255, 0.15)",
                      borderRadius: "16px",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <Table>
                      <TableHead>
                        <TableRow sx={{ background: "rgba(255,255,255,0.1)" }}>
                          <TableCell sx={{ color: "#fff" }}>Code</TableCell>
                          <TableCell sx={{ color: "#fff" }}>Amount (₱)</TableCell>
                          <TableCell sx={{ color: "#fff" }}>Purchased By</TableCell>
                          <TableCell sx={{ color: "#fff" }}>Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {codes
                          .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                          .map((code) => (
                            <TableRow key={code.id}>
                              <TableCell sx={{ color: "#fff" }}>{code.code}</TableCell>
                              <TableCell sx={{ color: "#fff" }}>
                                ₱{Number(code.amount || 0).toLocaleString()}
                              </TableCell>
                              <TableCell sx={{ color: "#fff" }}>
                                {code.purchasedBy?.name ||
                                  code.name ||
                                  code.userName ||
                                  "Unnamed User"}
                              </TableCell>
                              <TableCell sx={{ color: "#fff" }}>
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