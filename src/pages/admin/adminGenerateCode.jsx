import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Toolbar,
} from "@mui/material";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import bgImage from "../../assets/bg.jpg";
import {
  BarChart,
  BarPlot,
  PieChart,
  pieArcLabelClasses,
  axisClasses,
} from "@mui/x-charts";
import { motion } from "framer-motion";
import { useTheme } from "@mui/material/styles";

const AdminGenerateCode = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState([]);
  const [totalSales, setTotalSales] = useState(0);
  const theme = useTheme();

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // ✅ Real-time Firestore fetch
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "purchaseCodes"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort by createdAt (newest first)
      const sorted = data.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );

      // Compute total sales
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

  // ✅ Aggregate sales per code
  const salesPerCode = codes.reduce((acc, curr) => {
    const code = curr.code || "Unknown";
    acc[code] = (acc[code] || 0) + (Number(curr.amount) || 0);
    return acc;
  }, {});

  const barData = Object.entries(salesPerCode).map(([code, amount]) => ({
    code,
    amount,
  }));

  const pieData = Object.entries(salesPerCode).map(([code, amount]) => ({
    label: code,
    value: amount,
  }));

  const totalPieValue = pieData.reduce((a, b) => a + b.value, 0);

  // ✨ Motion Variants for Smooth Animation
  const fadeIn = {
    hidden: { opacity: 0, y: 40 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
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
      {/* ✅ Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* ✅ Sidebar */}
      <Box sx={{ zIndex: 5 }}>
        <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* ✅ Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 2 },
          mt: 0,
          color: "white",
          zIndex: 1,
          width: `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
          position: "relative",
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
          <Typography variant="h4" gutterBottom>
            Purchase Codes Analytics
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 3 }}>
            Real-time data of all purchased access codes and total sales.
          </Typography>

          {loading ? (
            <CircularProgress color="inherit" />
          ) : (
            <>
              {/* 🧮 Summary Section */}
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="show"
                transition={{ delay: 0.2 }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", sm: "center" },
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

              {/* 📊 Charts Section */}
              <Grid container spacing={3}>
                {/* 📈 Bar Chart */}
                <Grid item xs={12} md={8}>
                  <motion.div
                    variants={fadeIn}
                    initial="hidden"
                    animate="show"
                    transition={{ delay: 0.3 }}
                  >
                    <Paper
                      sx={{
                        p: 2,
                        height: 400,
                        background: "rgba(255, 255, 255, 0.15)",
                        borderRadius: "16px",
                        backdropFilter: "blur(10px)",
                      }}
                    >
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        Sales per Code
                      </Typography>
                      <BarChart
                        dataset={barData}
                        xAxis={[{ dataKey: "code", scaleType: "band" }]}
                        yAxis={[{ label: "Sales (₱)" }]}
                        series={[
                          {
                            dataKey: "amount",
                            color: theme.palette.success.light,
                          },
                        ]}
                        height={320}
                        grid={{ vertical: true, horizontal: true }}
                        sx={{
                          [`.${axisClasses.root}`]: { stroke: "#ccc" },
                          "& .MuiChartsAxis-label": { fill: "#fff" },
                          "& .MuiChartsAxis-tickLabel": { fill: "#fff" },
                          "& .MuiBarElement-root": {
                            transition: "all 0.4s ease",
                          },
                        }}
                      >
                        <BarPlot />
                      </BarChart>
                    </Paper>
                  </motion.div>
                </Grid>

                {/* 🥧 Pie Chart */}
                <Grid item xs={12} md={4}>
                  <motion.div
                    variants={fadeIn}
                    initial="hidden"
                    animate="show"
                    transition={{ delay: 0.4 }}
                  >
                    <Paper
                      sx={{
                        p: 2,
                        height: 400,
                        background: "rgba(255, 255, 255, 0.15)",
                        borderRadius: "16px",
                        backdropFilter: "blur(10px)",
                      }}
                    >
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        Code Sales Distribution
                      </Typography>
                      <PieChart
                        series={[
                          {
                            arcLabel: (item) =>
                              `${item.label} (${(
                                (item.value / totalPieValue) *
                                100
                              ).toFixed(1)}%)`,
                            arcLabelMinAngle: 15,
                            data: pieData,
                          },
                        ]}
                        height={320}
                        sx={{
                          [`& .${pieArcLabelClasses.root}`]: {
                            fill: "#fff",
                            fontSize: 12,
                          },
                        }}
                      />
                    </Paper>
                  </motion.div>
                </Grid>
              </Grid>

              {/* 📋 Table Section */}
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="show"
                transition={{ delay: 0.5 }}
              >
                <Box sx={{ mt: 5 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Purchase Details
                  </Typography>
                  <Paper
                    sx={{
                      p: 2,
                      background: "rgba(255, 255, 255, 0.15)",
                      borderRadius: "16px",
                      backdropFilter: "blur(8px)",
                      overflowX: "auto",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        color: "white",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "rgba(255,255,255,0.1)",
                            textAlign: "left",
                          }}
                        >
                          <th style={{ padding: "8px" }}>Code</th>
                          <th style={{ padding: "8px" }}>Amount (₱)</th>
                          <th style={{ padding: "8px" }}>Purchased By</th>
                          <th style={{ padding: "8px" }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {codes.map((code) => (
                          <tr key={code.id}>
                            <td style={{ padding: "8px" }}>{code.code}</td>
                            <td style={{ padding: "8px" }}>
                              ₱{Number(code.amount || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: "8px" }}>
                              {code.purchasedBy?.name ||
                                code.name ||
                                code.userName ||
                                "Unnamed User"}
                            </td>
                            <td style={{ padding: "8px" }}>
                              {code.createdAt?.seconds
                                ? new Date(
                                    code.createdAt.seconds * 1000
                                  ).toLocaleString()
                                : "--"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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