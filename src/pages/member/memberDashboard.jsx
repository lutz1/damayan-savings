import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Grid,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  Fade,
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";

const toDate = (timestamp) =>
  timestamp instanceof Date ? timestamp : new Date(timestamp);

const MemberDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userCounts, setUserCounts] = useState({
    MD: 0,
    MS: 0,
    MI: 0,
    Agent: 0,
    Member: 0,
  });
  const [totals, setTotals] = useState({
    contribution: 0,
    passiveIncome: 0,
    capitalShare: 0,
    monthlyContribution: 0,
  });
  const [salesData, setSalesData] = useState([]);
  const [chartKey, setChartKey] = useState(0);
  const [logs] = useState([]);

  const [currentUserName, setCurrentUserName] = useState("");
  const [searchValue, setSearchValue] = useState("");

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔐 Get current logged-in user's displayName from Firebase Auth
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      setCurrentUserName(user.displayName || "");
    } else {
      // Optionally listen for auth state change
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) setCurrentUserName(user.displayName || "");
      });
      return () => unsubscribe();
    }
  }, []);

  // 📦 Fetch Firestore data where referredBy == currentUserName or searchValue
  useEffect(() => {
    if (!currentUserName && !searchValue) return;

    const fetchData = async () => {
      try {
        const refName = searchValue.trim() || currentUserName;
        const roles = ["MD", "MS", "MI", "Agent", "Member"];
        const counts = {};
        const salesByRole = {};
        let totalContribution = 0;
        let totalPassive = 0;
        let totalCapital = 0;
        let totalMonthly = 0;

        for (const role of roles) {
          const q = query(collection(db, role), where("referredBy", "==", refName));
          const snapshot = await getDocs(q);

          let roleContribution = 0;
          let rolePassive = 0;
          let roleCapital = 0;
          let roleMonthly = 0;
          let roleSales = 0;

          snapshot.forEach((doc) => {
            const data = doc.data();
            roleContribution += data.totalContribution || 0;
            rolePassive += data.passiveIncome || 0;
            roleCapital += data.capitalShare || 0;
            roleMonthly += data.monthlyContribution || 0;
            roleSales += data.salesAmount || 0;
          });

          counts[role] = snapshot.size;
          salesByRole[role] = roleSales;

          totalContribution += roleContribution;
          totalPassive += rolePassive;
          totalCapital += roleCapital;
          totalMonthly += roleMonthly;
        }

        setUserCounts(counts);
        setTotals({
          contribution: totalContribution,
          passiveIncome: totalPassive,
          capitalShare: totalCapital,
          monthlyContribution: totalMonthly,
        });

        const formattedSales = Object.entries(salesByRole).map(([role, total]) => ({
          role,
          total,
        }));

        setSalesData(formattedSales);
        setChartKey((prev) => prev + 1);
      } catch (err) {
        console.error("Error fetching Firestore data:", err);
      }
    };

    fetchData();
  }, [currentUserName, searchValue]);

  const totalSales = useMemo(
    () => salesData.reduce((sum, d) => sum + d.total, 0),
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
            mb: 2,
            textShadow: "1px 1px 3px rgba(0,0,0,0.4)",
          }}
        >
          📊 Member Dashboard Overview
        </Typography>

        {/* 🔍 Search bar */}
        <Box sx={{ mb: 3, maxWidth: 400 }}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder="Search referred by name..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            InputProps={{
              sx: { background: "rgba(255,255,255,0.15)", color: "white" },
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "white" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setSearchValue("")}
                    sx={{ color: "white" }}
                  >
                    ✖
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Currently viewing: {searchValue || currentUserName || "Loading..."}
          </Typography>
        </Box>

        {/* 🧱 Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            { label: "Marketing Director (MD)", value: userCounts.MD },
            { label: "Marketing Supervisor (MS)", value: userCounts.MS },
            { label: "Marketing Incharge (MI)", value: userCounts.MI },
            { label: "Agents", value: userCounts.Agent },
            { label: "Members", value: userCounts.Member },
            {
              label: "💰 Total Sales",
              value: `₱${totalSales.toLocaleString()}`,
            },
            {
              label: "Total Contribution",
              value: `₱${totals.contribution.toLocaleString()}`,
            },
            {
              label: "Passive Income",
              value: `₱${totals.passiveIncome.toLocaleString()}`,
            },
            {
              label: "Capital Share",
              value: `₱${totals.capitalShare.toLocaleString()}`,
            },
            {
              label: "Monthly Contribution",
              value: `₱${totals.monthlyContribution.toLocaleString()}`,
            },
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
                    <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>
                      {item.value}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* 📊 Sales by Role Bar Chart */}
        <Box
          sx={{
            p: 4,
            background: "rgba(255,255,255,0.12)",
            borderRadius: "20px",
            boxShadow: "0 6px 25px rgba(0,0,0,0.25)",
            mb: 5,
          }}
        >
          <Typography variant="h5" fontWeight="600" mb={2}>
            Sales by Role
          </Typography>

          <AnimatePresence mode="wait">
            <motion.div
              key={chartKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={salesData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.2)"
                  />
                  <XAxis dataKey="role" stroke="white" />
                  <YAxis stroke="white" />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.8)",
                      color: "white",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total" name="Sales" barSize={40} fill="#00E5FF" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </AnimatePresence>
        </Box>

        {/* 🧾 Logs Section */}
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
              {logs.length > 0 ? (
                logs.map((log) => (
                  <ListItem key={log.id} divider>
                    <ListItemText
                      primary={log.action}
                      secondary={format(toDate(log.timestamp), "PPpp")}
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                  </ListItem>
                ))
              ) : (
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  No recent activity logs.
                </Typography>
              )}
            </List>
          </Box>
        </Fade>
      </Box>
    </Box>
  );
};

export default MemberDashboard;