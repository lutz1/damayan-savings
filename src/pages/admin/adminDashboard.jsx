import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Grid,
  Card,
  CardContent,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  Fade,
} from "@mui/material";
import { format, subDays, subMonths, subYears } from "date-fns";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";

const toDate = (timestamp) =>
  timestamp instanceof Date ? timestamp : new Date(timestamp);

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filter, setFilter] = useState("weekly");
  const [salesData, setSalesData] = useState([]);
  const [userCounts, setUserCounts] = useState({
    MD: 0,
    MS: 0,
    MI: 0,
    Agent: 0,
    Members: 0,
  });
  const [logs, setLogs] = useState([]);
  const [chartKey, setChartKey] = useState(0);

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔹 Simulate live data (replace with Firestore later)
  useEffect(() => {
    const now = new Date();

    setUserCounts({
      MD: 4,
      MS: 8,
      MI: 12,
      Agent: 20,
      Members: 100,
    });

    let data = [];
    if (filter === "weekly") {
      for (let i = 6; i >= 0; i--) {
        data.push({
          date: format(subDays(now, i), "MMM dd"),
          amount: Math.floor(Math.random() * 1000 + 500),
        });
      }
    } else if (filter === "monthly") {
      for (let i = 4; i >= 0; i--) {
        data.push({
          date: format(subMonths(now, i), "MMM yyyy"),
          amount: Math.floor(Math.random() * 10000 + 2000),
        });
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        data.push({
          date: format(subYears(now, i), "yyyy"),
          amount: Math.floor(Math.random() * 50000 + 10000),
        });
      }
    }

    setSalesData(data);
    setChartKey((prev) => prev + 1);

    setLogs([
      { id: 1, action: "New member registered", timestamp: new Date() },
      { id: 2, action: "Marketing Supervisor approved a request", timestamp: subDays(now, 1) },
      { id: 3, action: "Code generated for Marketing Incharge", timestamp: subDays(now, 2) },
      { id: 4, action: "Agent completed a sale", timestamp: subDays(now, 3) },
      { id: 5, action: "System backup completed", timestamp: subDays(now, 4) },
    ]);
  }, [filter]);

  // 💰 Calculate total sales dynamically
  const totalSales = useMemo(
    () => salesData.reduce((sum, d) => sum + d.amount, 0),
    [salesData]
  );

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
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          zIndex: 0,
        },
      }}
    >
      {/* 🔝 Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* 🧭 Sidebar */}
      <Box sx={{ zIndex: 5 }}>
        <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* 🧩 Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 4,
          mt: 8,
          color: "white",
          zIndex: 1,
          width: `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
          position: "relative",
        }}
      >
        <Toolbar />

        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontWeight: 700,
            letterSpacing: 0.5,
            mb: 3,
            textShadow: "1px 1px 3px rgba(0,0,0,0.4)",
          }}
        >
          📊 Admin Dashboard Overview
        </Typography>

        {/* 🧱 Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            { label: "Marketing Director (MD)", value: userCounts.MD },
            { label: "Marketing Supervisor (MS)", value: userCounts.MS },
            { label: "Marketing Incharge (MI)", value: userCounts.MI },
            { label: "Agents", value: userCounts.Agent },
            { label: "Members", value: userCounts.Members },
            { label: "💰 Total Sales", value: `₱${totalSales.toLocaleString()}` },
          ].map((item, index) => (
            <Grid item xs={12} sm={6} md={2.4} key={index}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card
                  sx={{
                    background:
                      "linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))",
                    backdropFilter: "blur(12px)",
                    color: "white",
                    borderRadius: "18px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-5px)",
                      boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
                    },
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ opacity: 0.8 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>
                      {item.value}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* 📈 Sales Chart Section */}
        <Box
          sx={{
            p: 4,
            background: "rgba(255, 255, 255, 0.12)",
            borderRadius: "20px",
            boxShadow: "0 6px 25px rgba(0,0,0,0.25)",
            mb: 5,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h5" fontWeight="600">
              Sales Overview
            </Typography>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel sx={{ color: "white" }}>Filter By</InputLabel>
              <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                label="Filter By"
                sx={{
                  color: "white",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.3)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "white",
                  },
                }}
              >
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="annual">Annual</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <AnimatePresence mode="wait">
            <motion.div
              key={chartKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={salesData}>
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#00e5ff"
                    strokeWidth={3}
                    dot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                  />
                  <CartesianGrid stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="white" />
                  <YAxis stroke="white" />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.8)",
                      color: "white",
                      borderRadius: "8px",
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </AnimatePresence>
        </Box>

        {/* 🧾 Activity Logs */}
        <Fade in timeout={900}>
          <Box
            sx={{
              p: 4,
              background: "rgba(255, 255, 255, 0.12)",
              borderRadius: "20px",
              boxShadow: "0 6px 25px rgba(0,0,0,0.25)",
            }}
          >
            <Typography variant="h5" gutterBottom fontWeight="600">
              Recent Activity Logs
            </Typography>
            <Divider sx={{ mb: 2, borderColor: "rgba(255,255,255,0.2)" }} />
            <List>
              {logs.map((log) => (
                <ListItem key={log.id} divider>
                  <ListItemText
                    primary={log.action}
                    secondary={format(toDate(log.timestamp), "PPpp")}
                    primaryTypographyProps={{ fontWeight: 500 }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Fade>
      </Box>
    </Box>
  );
};

export default AdminDashboard;