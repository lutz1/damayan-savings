/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
} from "@mui/material";
import { db } from "../../firebase";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { motion } from "framer-motion";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import bgImage from "../../assets/bg.jpg";
import PurchaseCodesAnalytics from "../../components/purchaseCodesAnalytics";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const chartTypes = ["line", "bar", "area"];

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chartType, setChartType] = useState("line");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const [userCounts, setUserCounts] = useState({ MD: 0, MS: 0, MI: 0, Agent: 0 });
  const [salesData, setSalesData] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [purchasedCodes, setPurchasedCodes] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [wallets, setWallets] = useState([]);

  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);
  const handleChartTypeChange = (e, newType) => setChartType(newType);

  // Firestore listeners
  useEffect(() => {
    const unsubscribers = [];
    const roles = ["MD", "MS", "MI", "Agent"];

    // Users
    const usersQ = query(collection(db, "users"), orderBy("createdAt", "desc"));
    unsubscribers.push(
      onSnapshot(usersQ, snapshot => {
        const data = snapshot.docs.map(d => d.data());
        const counts = {};
        roles.forEach(r => (counts[r] = data.filter(u => u.role === r).length));
        setUserCounts(counts);
      })
    );

    // Sales
    const salesQ = query(collection(db, "sales"));
    unsubscribers.push(onSnapshot(salesQ, snapshot => setSalesData(snapshot.docs.map(d => d.data()))));

    // Activity logs
    const logsQ = query(collection(db, "activityLogs"), orderBy("createdAt", "desc"));
    unsubscribers.push(onSnapshot(logsQ, snapshot => setActivityLogs(snapshot.docs.map(d => d.data()))));

    // Purchased Codes
    const codesQ = query(collection(db, "purchasedCodes"), orderBy("createdAt", "asc"));
    unsubscribers.push(onSnapshot(codesQ, snapshot => setPurchasedCodes(snapshot.docs.map(d => d.data()))));

    // Transfers
    const transfersQ = query(collection(db, "transfers"), orderBy("createdAt", "asc"));
    unsubscribers.push(onSnapshot(transfersQ, snapshot => setTransfers(snapshot.docs.map(d => d.data()))));

    // Withdrawals
    const withdrawalsQ = query(collection(db, "withdrawals"), orderBy("createdAt", "asc"));
    unsubscribers.push(onSnapshot(withdrawalsQ, snapshot => setWithdrawals(snapshot.docs.map(d => d.data()))));

    // Deposits
    const depositsQ = query(collection(db, "deposits"), orderBy("createdAt", "asc"));
    unsubscribers.push(onSnapshot(depositsQ, snapshot => setDeposits(snapshot.docs.map(d => d.data()))));

    // Wallet-to-wallet
    const walletQ = query(collection(db, "walletTransfers"), orderBy("createdAt", "asc"));
    unsubscribers.push(onSnapshot(walletQ, snapshot => setWallets(snapshot.docs.map(d => d.data()))));

    return () => unsubscribers.forEach(u => u());
  }, []);

  const totalSales = useMemo(() => salesData.reduce((sum, d) => sum + (Number(d.amount) || 0), 0), [salesData]);

  // Aggregate by date (filtered by date range)
  const aggregateByDate = (arr, key = "amount") => {
    const map = {};
    arr.forEach(item => {
      const date = item.createdAt?.toDate?.().toLocaleDateString() || "-";
      if (dateRange.from && new Date(date) < new Date(dateRange.from)) return;
      if (dateRange.to && new Date(date) > new Date(dateRange.to)) return;
      if (!map[date]) map[date] = 0;
      map[date] += Number(item[key]) || 0;
    });
    return Object.entries(map).map(([date, value]) => ({ date, value }));
  };

  // Render chart dynamically
  const renderChart = (data) => {
    switch (chartType) {
      case "bar":
        return <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}><CartesianGrid stroke="#444" strokeDasharray="3 3" /><XAxis dataKey="date" stroke="#fff" /><YAxis stroke="#fff" /><Tooltip contentStyle={{ backgroundColor: "#222" }} /><Legend /><Bar dataKey="value" fill="#82ca9d" /> </BarChart>;
      case "area":
        return <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}><CartesianGrid stroke="#444" strokeDasharray="3 3" /><XAxis dataKey="date" stroke="#fff" /><YAxis stroke="#fff" /><Tooltip contentStyle={{ backgroundColor: "#222" }} /><Legend /><Area dataKey="value" stroke="#82ca9d" fill="#82ca9d" /> </AreaChart>;
      default:
        return <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}><CartesianGrid stroke="#444" strokeDasharray="3 3" /><XAxis dataKey="date" stroke="#fff" /><YAxis stroke="#fff" /><Tooltip contentStyle={{ backgroundColor: "#222" }} /><Legend /><Line type="monotone" dataKey="value" stroke="#82ca9d" strokeWidth={2} /> </LineChart>;
    }
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative", "&::before": { content: '""', position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.1)", zIndex: 0 } }}>
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}><Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} /></Box>
      <Box sx={{ zIndex: 5 }}><AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} /></Box>
      <Box component="main" sx={{ flexGrow: 1, p: 4, mt: 0, pb: { xs: 12, sm: 12, md: 12 }, color: "white", zIndex: 1, width: "100%", transition: "all 0.3s ease", position: "relative" }}>
        <Toolbar />
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, letterSpacing: 0.5, mb: 3, textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}>📊 Admin Dashboard Overview</Typography>
    
    {/* Stats Cards */}
<Grid container spacing={3} sx={{ mb: 4, justifyContent: { xs: "center", md: "flex-start" } }}>
  {[
    { label: "MD", value: userCounts.MD, icon: "👨‍💼" },
    { label: "MS", value: userCounts.MS, icon: "👩‍💼" },
    { label: "MI", value: userCounts.MI, icon: "🧑‍💼" },
    { label: "Agents", value: userCounts.Agent, icon: "🕵️" },
  ].map((item, index) => (
    <Grid item xs={12} sm={10} md="auto" key={index}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
      >
        <Card
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 3,
            width: { xs: "85%", md: "450px" }, // full width mobile/tablet, 500px on desktop
            flexDirection: "row",
            background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
            backdropFilter: "blur(15px)",
            color: "white",
            borderRadius: "20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            transition: "transform 0.3s ease, box-shadow 0.3s ease",
            "&:hover": {
              transform: "translateY(-5px)",
              boxShadow: "0 15px 35px rgba(0,0,0,0.5)",
            },
          }}
        >
          <Box sx={{ fontSize: "3rem" }}>{item.icon}</Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="subtitle2" sx={{ opacity: 0.7, textTransform: "uppercase" }}>
              {item.label}
            </Typography>
            <Typography variant="h3" fontWeight="bold" sx={{ mt: 0.5 }}>
              {item.value}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Total {item.label} referrals under your network
            </Typography>
          </Box>
        </Card>
      </motion.div>
    </Grid>
  ))}
</Grid>

    {/* Purchased Codes Analytics */}
   <PurchaseCodesAnalytics
      purchasedCodes={purchasedCodes}
      dateRange={dateRange}
      setDateRange={setDateRange}
      aggregateByDate={aggregateByDate}
    />

      </Box>
    </Box>
  );
};

export default AdminDashboard;