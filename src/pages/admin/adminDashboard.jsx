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
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
      <Box sx={{ zIndex: 5 }}><Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} /></Box>
      <Box component="main" sx={{ flexGrow: 1, p: 4, mt: 0, color: "white", zIndex: 1, width: `calc(100% - ${sidebarOpen ? 240 : 60}px)`, transition: "all 0.3s ease", position: "relative" }}>
        <Toolbar />
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, letterSpacing: 0.5, mb: 3, textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}>📊 Admin Dashboard Overview</Typography>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[{ label: "MD", value: userCounts.MD }, { label: "MS", value: userCounts.MS }, { label: "MI", value: userCounts.MI }, { label: "Agents", value: userCounts.Agent }, { label: "Total Sales", value: `₱${totalSales.toLocaleString()}` }].map((item, index) => (
            <Grid item xs={12} sm={6} md={2.4} key={index}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.1 }}>
                <Card sx={{ background: "linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))", backdropFilter: "blur(12px)", color: "white", borderRadius: "18px", width: "160px", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", transition: "transform 0.3s ease, box-shadow 0.3s ease", "&:hover": { transform: "translateY(-5px)", boxShadow: "0 12px 30px rgba(0,0,0,0.4)" } }}>
                  <CardContent><Typography variant="subtitle1" sx={{ opacity: 0.8 }}>{item.label}</Typography><Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>{item.value}</Typography></CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* Chart Controls */}
        <Box sx={{ mb: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <ToggleButtonGroup value={chartType} exclusive onChange={handleChartTypeChange} size="small">
            {chartTypes.map(type => <ToggleButton key={type} value={type}>{type.toUpperCase()}</ToggleButton>)}
          </ToggleButtonGroup>
          <TextField type="date" label="From" InputLabelProps={{ shrink: true }} size="small" value={dateRange.from} onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))} />
          <TextField type="date" label="To" InputLabelProps={{ shrink: true }} size="small" value={dateRange.to} onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))} />
        </Box>

        {/* Dynamic Charts Section */}
        <Grid container spacing={3}>
          {[{ title: "Purchased Codes", data: purchasedCodes }, { title: "User Management", data: Object.values(userCounts).map((v, i) => ({ amount: v, createdAt: { toDate: () => new Date() } })) }, { title: "Transfer Transactions", data: transfers }, { title: "Withdrawals", data: withdrawals }, { title: "Deposits", data: deposits }, { title: "Wallet-to-Wallet", data: wallets }].map((chart, idx) => (
            <Grid item xs={12} md={6} key={idx}>
              <Card sx={{ p: 2, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", color: "#fff" }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>{chart.title} (Interactive)</Typography>
                  {aggregateByDate(chart.data).length === 0 ? <Typography>No data available</Typography> : <ResponsiveContainer width="100%" height={250}>{renderChart(aggregateByDate(chart.data))}</ResponsiveContainer>}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};

export default AdminDashboard;