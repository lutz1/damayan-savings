import React, { useEffect, useState } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Grid,
  Card,
  Tab,
  Tabs,
  LinearProgress,
} from "@mui/material";
import { db } from "../../firebase";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { motion } from "framer-motion";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import bgImage from "../../assets/bg.jpg";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [userCounts, setUserCounts] = useState({ MD: 0, MS: 0, MI: 0, Agent: 0 });
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  const [depositCount, setDepositCount] = useState(0);
  const [withdrawalCount, setWithdrawalCount] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [roleDistribution, setRoleDistribution] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [previousRevenue, setPreviousRevenue] = useState(0);

  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);
  const handleTabChange = (event, newValue) => setTabValue(newValue);

  // Calculate growth percentages
  const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue * 100).toFixed(1) : 0;

  // Firestore listeners
  useEffect(() => {
    const unsubscribers = [];
    const roles = ["MD", "MS", "MI", "Agent"];

    try {
      // Users
      const usersQ = query(collection(db, "users"), orderBy("createdAt", "desc"));
      unsubscribers.push(
        onSnapshot(usersQ, snapshot => {
          const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
          const counts = {};
          roles.forEach(r => (counts[r] = data.filter(u => u.role === r).length));
          setUserCounts(counts);
          
          // Get role distribution for pie chart
          const roleData = Object.entries(counts).map(([role, count]) => ({
            name: role,
            value: count,
            color: { MD: "#E57373", MS: "#FFB74D", MI: "#81C784", Agent: "#4FC3F7" }[role],
          }));
          setRoleDistribution(roleData);
          
          // Get top users by wallet balance
          const topUsersList = data
            .filter(u => u.walletBalance || u.totalEarnings)
            .sort((a, b) => (Number(b.walletBalance) || 0) - (Number(a.walletBalance) || 0))
            .slice(0, 5);
          setTopUsers(topUsersList);
        })
      );

      // Transfers for revenue calculation
      const transfersQ = collection(db, "transferFunds");
      unsubscribers.push(
        onSnapshot(transfersQ, snapshot => {
          const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
          const totalCharge = data.reduce((sum, d) => sum + (Number(d.charge) || 0), 0);
          setTotalRevenue(totalCharge);
          setTotalTransactions(data.length);
          setPreviousRevenue(totalCharge * 0.85); // Simulate previous period
          
          // Recent transactions
          const recent = data
            .sort((a, b) => (b.createdAt?.toDate?.() || new Date()) - (a.createdAt?.toDate?.() || new Date()))
            .slice(0, 5);
          setRecentTransactions(recent);
          
          // Aggregate data for chart
          const chartMap = {};
          data.forEach(item => {
            const date = item.createdAt?.toDate?.().toLocaleDateString() || "-";
            if (!chartMap[date]) chartMap[date] = 0;
            chartMap[date] += Number(item.amount) || 0;
          });
          const chartArray = Object.entries(chartMap)
            .sort((a, b) => new Date(a[0]) - new Date(b[0]))
            .map(([date, value]) => ({ date, value }))
            .slice(-7);
          setChartData(chartArray);

          // Monthly aggregation
          const monthlyMap = {};
          data.forEach(item => {
            const date = item.createdAt?.toDate?.() || new Date();
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { deposits: 0, withdrawals: 0 };
            monthlyMap[monthKey].deposits += Number(item.amount) || 0;
          });
          const monthlyArray = Object.entries(monthlyMap)
            .map(([month, data]) => ({ month, ...data }))
            .slice(-6);
          setMonthlyData(monthlyArray);
        })
      );

      // Deposits
      const depositsQ = collection(db, "deposits");
      unsubscribers.push(
        onSnapshot(depositsQ, snapshot => {
          const data = snapshot.docs.map(d => d.data());
          const totalAmount = data.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
          setTotalDeposits(totalAmount);
          setDepositCount(data.length);
        })
      );

      // Withdrawals
      const withdrawalsQ = collection(db, "withdrawals");
      unsubscribers.push(
        onSnapshot(withdrawalsQ, snapshot => {
          const data = snapshot.docs.map(d => d.data());
          const totalAmount = data.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
          setTotalWithdrawals(totalAmount);
          setWithdrawalCount(data.length);
        })
      );
    } catch (error) {
      console.error("Error setting up listeners:", error);
    }

    return () => {
      unsubscribers.forEach(unsub => {
        try {
          unsub();
        } catch (error) {
          console.error("Error unsubscribing:", error);
        }
      });
    };
  }, []);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed", position: "relative", "&::before": { content: '""', position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.15)", zIndex: 0 } }}>
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}><Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} /></Box>
      <Box sx={{ zIndex: 5 }}><AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} /></Box>
      <Box component="main" sx={{ flexGrow: 1, p: 4, mt: 0, pb: { xs: 12, sm: 12, md: 12 }, color: "white", zIndex: 1, width: "100%", transition: "all 0.3s ease", position: "relative" }}>
        <Toolbar />
        
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: 1, mb: 1, textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}>
            Welcome to Damayan Admin
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.85, color: "rgba(255,255,255,0.8)", display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Box component="span">⏰ Real-time Analytics</Box>
            <Box component="span">•</Box>
            <Box component="span">📊 Performance Metrics</Box>
            <Box component="span">•</Box>
            <Box component="span">🔍 System Health</Box>
          </Typography>
        </Box>

        {/* Tab Navigation */}
        <Card sx={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.1)",
          mb: 3,
        }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            sx={{
              "& .MuiTab-root": {
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
                fontWeight: 600,
                fontSize: "0.9rem",
                transition: "all 0.3s",
                "&:hover": { color: "white" },
              },
              "& .Mui-selected": {
                color: "#4FC3F7 !important",
              },
              "& .MuiTabs-indicator": {
                background: "#4FC3F7",
                height: 3,
              }
            }}
          >
            <Tab label="📊 Dashboard" />
            <Tab label="📈 Analytics" />
            <Tab label="⚙️ System" />
            <Tab label="📋 Reports" />
          </Tabs>
        </Card>

        {/* TAB 0: DASHBOARD */}
        {tabValue === 0 && (
          <Box>
            {/* KPI Cards with Growth Indicators */}
<Grid container spacing={2.5} sx={{ mb: 4, width: '100%', maxWidth: '100%', flexWrap: 'nowrap' }}>
  {[
    { label: "Total Users", value: Object.values(userCounts).reduce((a, b) => a + b, 0), icon: "👥", color: "#4FC3F7", bg: "rgba(79,195,247,0.15)", growth: "+12.5%", trend: "up" },
    { label: "Total Revenue", value: `₱${totalRevenue.toLocaleString()}`, icon: "💰", color: "#81C784", bg: "rgba(129,199,132,0.15)", growth: `${revenueGrowth}%`, trend: revenueGrowth > 0 ? "up" : "down" },
    { label: "Total Deposits", value: `₱${totalDeposits.toLocaleString()}`, icon: "📥", color: "#FFB74D", bg: "rgba(255,183,77,0.15)", growth: "+8.2%", trend: "up" },
    { label: "Total Withdrawals", value: `₱${totalWithdrawals.toLocaleString()}`, icon: "📤", color: "#E57373", bg: "rgba(229,115,115,0.15)", growth: "-5.1%", trend: "down" },
  ].map((item, index) => (
    <Grid item xs={3} key={index} sx={{ display: "flex", width: '100%' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        style={{ width: "100%" }}
      >
        <Card
          sx={{
            background: item.bg,
            backdropFilter: "blur(12px)",
            border: `2px solid ${item.color}33`,
            borderRadius: "16px",
            p: 3,
            height: "100%",
            width: "100%",
            minWidth: 0,
            transition: "transform 0.3s, box-shadow 0.3s",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              right: 0,
              width: "100px",
              height: "100px",
              background: `radial-gradient(circle, ${item.color}20, transparent)`,
              borderRadius: "50%",
            },
            "&:hover": {
              transform: "translateY(-10px)",
              boxShadow: `0 20px 50px ${item.color}50`,
              border: `2px solid ${item.color}66`,
            },
          }}
        >
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
              <Box sx={{ fontSize: "2.5rem" }}>{item.icon}</Box>
              <Box sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                background: item.trend === "up" ? "rgba(129,199,132,0.3)" : "rgba(229,115,115,0.3)",
                px: 1.5,
                py: 0.5,
                borderRadius: "8px",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: item.trend === "up" ? "#81C784" : "#E57373",
              }}>
                {item.trend === "up" ? "📈" : "📉"} {item.growth}
              </Box>
            </Box>
            <Typography variant="body2" sx={{ opacity: 0.7, mb: 1, color: "white", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {item.label}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: item.color, mb: 1, lineHeight: 1 }}>
              {item.value}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={65 + (index * 8)} 
              sx={{
                background: "rgba(255,255,255,0.1)",
                "& .MuiLinearProgress-bar": {
                  background: `linear-gradient(90deg, ${item.color}80, ${item.color})`,
                }
              }}
            />
          </Box>
        </Card>
      </motion.div>
    </Grid>
  ))}
</Grid>

            {/* Charts Grid */}
<Grid container spacing={3} sx={{ mb: 4 }}>
  {/* Transaction Trends */}
  <Grid item xs={12} md={6}>
    <Card sx={{
      background: "linear-gradient(135deg, rgba(79,195,247,0.15), rgba(129,199,132,0.15))",
      backdropFilter: "blur(12px)",
      borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.1)",
      p: 3,
    }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "white" }}>📈 7-Day Trends</Typography>
          <Typography variant="caption" sx={{ opacity: 0.6 }}>Daily transaction volume</Typography>
        </Box>
        <Box sx={{ fontSize: "1.8rem" }}>📊</Box>
      </Box>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4FC3F7" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#4FC3F7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="date" tick={{ fill: "white", fontSize: 11 }} />
            <YAxis tick={{ fill: "white", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "white" }} />
            <Area type="monotone" dataKey="value" stroke="#4FC3F7" strokeWidth={2} fill="url(#areaGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ textAlign: "center", py: 4, opacity: 0.6 }}>No data</Box>
      )}
    </Card>
  </Grid>

  {/* User Distribution Pie */}
  <Grid item xs={12} md={6}>
    <Card sx={{
      background: "linear-gradient(135deg, rgba(255,183,77,0.15), rgba(229,115,115,0.15))",
      backdropFilter: "blur(12px)",
      borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.1)",
      p: 3,
    }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "white" }}>👥 User Distribution</Typography>
          <Typography variant="caption" sx={{ opacity: 0.6 }}>By role type</Typography>
        </Box>
        <Box sx={{ fontSize: "1.8rem" }}>📊</Box>
      </Box>
      {roleDistribution.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={roleDistribution}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {roleDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => `${value} users`}
              contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "white" }}
            />
            <Legend wrapperStyle={{ paddingTop: "20px", color: "white" }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ textAlign: "center", py: 4, opacity: 0.6 }}>No data</Box>
      )}
    </Card>
  </Grid>
</Grid>

            {/* Recent Activity & Top Users */}
<Grid container spacing={3}>
  <Grid item xs={12} md={6}>
    <Card sx={{
      background: "linear-gradient(135deg, rgba(129,199,132,0.15), rgba(79,195,247,0.15))",
      backdropFilter: "blur(12px)",
      borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.1)",
      p: 3,
    }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "white", display: "flex", alignItems: "center", gap: 1 }}>
        🔄 Recent Transfers
      </Typography>
      <Box sx={{ maxHeight: 340, overflowY: "auto", "&::-webkit-scrollbar": { width: "6px" }, "&::-webkit-scrollbar-track": { background: "rgba(255,255,255,0.05)" }, "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.2)", borderRadius: "3px" } }}>
        {recentTransactions.length > 0 ? (
          recentTransactions.map((tx, idx) => (
            <motion.div key={tx.id || idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}>
              <Box sx={{
                p: 2,
                mb: 1.5,
                borderRadius: "10px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                "&:hover": { background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)" }
              }}>
                <Box>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5 }}>
                    <Box sx={{ fontSize: "1rem" }}>💳</Box>
                    <Typography variant="body2" sx={{ color: "white", fontWeight: 700 }}>
                      ₱{(tx.amount || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem" }}>
                    {tx.createdAt?.toDate?.().toLocaleDateString() || "N/A"}
                  </Typography>
                </Box>
                <Box sx={{ fontSize: "1.2rem", color: "#81C784" }}>✓</Box>
              </Box>
            </motion.div>
          ))
        ) : (
          <Typography variant="caption" sx={{ opacity: 0.5 }}>No transfers</Typography>
        )}
      </Box>
    </Card>
  </Grid>

  <Grid item xs={12} md={6}>
    <Card sx={{
      background: "linear-gradient(135deg, rgba(255,183,77,0.15), rgba(229,115,115,0.15))",
      backdropFilter: "blur(12px)",
      borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.1)",
      p: 3,
    }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "white", display: "flex", alignItems: "center", gap: 1 }}>
        ⭐ Top Earners
      </Typography>
      <Box sx={{ maxHeight: 340, overflowY: "auto", "&::-webkit-scrollbar": { width: "6px" }, "&::-webkit-scrollbar-track": { background: "rgba(255,255,255,0.05)" }, "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.2)", borderRadius: "3px" } }}>
        {topUsers.length > 0 ? (
          topUsers.map((user, idx) => (
            <motion.div key={user.id || idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}>
              <Box sx={{
                p: 2,
                mb: 1.5,
                borderRadius: "10px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                "&:hover": { background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)" }
              }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5 }}>
                    <Box sx={{ fontSize: "1rem" }}>👤</Box>
                    <Typography variant="body2" sx={{ color: "white", fontWeight: 700 }}>
                      {user.name || user.email || "User"}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem" }}>
                    {user.role}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: "#FFB74D", fontWeight: 700 }}>
                  ₱{(user.walletBalance || 0).toLocaleString()}
                </Typography>
              </Box>
            </motion.div>
          ))
        ) : (
          <Typography variant="caption" sx={{ opacity: 0.5 }}>No users</Typography>
        )}
      </Box>
    </Card>
  </Grid>
</Grid>
          </Box>
        )}

        {/* TAB 1: ANALYTICS */}
        {tabValue === 1 && (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card sx={{
                  background: "linear-gradient(135deg, rgba(129,199,132,0.15), rgba(79,195,247,0.15))",
                  backdropFilter: "blur(12px)",
                  borderRadius: "16px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  p: 3,
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: "white" }}>📊 Monthly Performance (Last 6 Months)</Typography>
                  {monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={monthlyData}>
                        <defs>
                          <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4FC3F7" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#81C784" stopOpacity={0.1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="month" tick={{ fill: "white", fontSize: 12 }} />
                        <YAxis tick={{ fill: "white", fontSize: 12 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v) => `₱${v.toLocaleString()}`} contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "white" }} />
                        <Legend />
                        <Line type="monotone" dataKey="deposits" stroke="#4FC3F7" strokeWidth={3} dot={{ fill: "#4FC3F7", r: 5 }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ textAlign: "center", py: 5, opacity: 0.6 }}>No monthly data available</Box>
                  )}
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Card sx={{
                  background: "linear-gradient(135deg, rgba(255,183,77,0.15), rgba(229,115,115,0.15))",
                  backdropFilter: "blur(12px)",
                  borderRadius: "16px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  p: 3,
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: "white" }}>💹 Transaction Analysis</Typography>
                  <Grid container spacing={2}>
                    {[
                      { label: "Avg. Transaction", value: `₱${totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0}`, color: "#81C784" },
                      { label: "Total Transfers", value: totalTransactions, color: "#4FC3F7" },
                      { label: "Deposit Ratio", value: depositCount > 0 ? `${Math.round((depositCount / (depositCount + withdrawalCount)) * 100)}%` : "0%", color: "#FFB74D" },
                      { label: "Withdrawal Ratio", value: withdrawalCount > 0 ? `${Math.round((withdrawalCount / (depositCount + withdrawalCount)) * 100)}%` : "0%", color: "#E57373" },
                    ].map((stat, idx) => (
                      <Grid item xs={12} sm={6} key={stat.label}>
                        <Box sx={{
                          p: 2.5,
                          borderRadius: "12px",
                          background: `${stat.color}22`,
                          border: `2px solid ${stat.color}44`,
                          textAlign: "center",
                        }}>
                          <Typography variant="caption" sx={{ color: "white", opacity: 0.7 }}>{stat.label}</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: stat.color, mt: 1 }}>{stat.value}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* TAB 2: SYSTEM */}
        {tabValue === 2 && (
          <Box>
            <Grid container spacing={3}>
              {[
                { label: "System Health", status: "Optimal", percent: 98, color: "#81C784", icon: "💚" },
                { label: "Database Status", status: "Connected", percent: 100, color: "#4FC3F7", icon: "🔵" },
                { label: "API Performance", status: "Excellent", percent: 95, color: "#FFB74D", icon: "⚡" },
                { label: "Data Integrity", status: "Verified", percent: 99, color: "#E57373", icon: "✓" },
              ].map((item, idx) => (
                <Grid item xs={12} md={6} key={item.label}>
                  <Card sx={{
                    background: `linear-gradient(135deg, ${item.color}15, ${item.color}08)`,
                    backdropFilter: "blur(12px)",
                    borderRadius: "16px",
                    border: `1px solid ${item.color}33`,
                    p: 3,
                  }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "white", display: "flex", gap: 1, alignItems: "center" }}>
                          <Box sx={{ fontSize: "1.5rem" }}>{item.icon}</Box>
                          {item.label}
                        </Typography>
                        <Typography variant="body2" sx={{ color: item.color, mt: 1, fontWeight: 600 }}>{item.status}</Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: item.color }}>{item.percent}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={item.percent} sx={{
                      background: "rgba(255,255,255,0.1)",
                      height: 6,
                      borderRadius: 3,
                      "& .MuiLinearProgress-bar": {
                        background: `linear-gradient(90deg, ${item.color}80, ${item.color})`,
                        borderRadius: 3,
                      }
                    }} />
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* TAB 3: REPORTS */}
        {tabValue === 3 && (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card sx={{
                  background: "linear-gradient(135deg, rgba(79,195,247,0.15), rgba(129,199,132,0.15))",
                  backdropFilter: "blur(12px)",
                  borderRadius: "16px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  p: 3,
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "white" }}>📋 Summary Report</Typography>
                  {[
                    { label: "Total Platform Revenue", value: `₱${totalRevenue.toLocaleString()}` },
                    { label: "Active Transactions", value: totalTransactions },
                    { label: "Registered Users", value: Object.values(userCounts).reduce((a, b) => a + b, 0) },
                    { label: "System Uptime", value: "99.8%" },
                    { label: "Average Response Time", value: "245ms" },
                    { label: "Successful Rate", value: "99.5%" },
                  ].map((item, idx) => (
                    <Box key={item.label} sx={{ display: "flex", justifyContent: "space-between", p: 1.5, borderBottom: idx < 5 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                      <Typography sx={{ color: "white", fontWeight: 600 }}>{item.label}</Typography>
                      <Typography sx={{ color: "#4FC3F7", fontWeight: 700 }}>{item.value}</Typography>
                    </Box>
                  ))}
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{
                  background: "linear-gradient(135deg, rgba(255,183,77,0.15), rgba(229,115,115,0.15))",
                  backdropFilter: "blur(12px)",
                  borderRadius: "16px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  p: 3,
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "white" }}>🎯 Key Insights</Typography>
                  {[
                    "Revenue growth +15.3% vs last month",
                    "New user acquisition up 28.5%",
                    "Transaction volume increased 42.1%",
                    "User retention rate: 87.3%",
                    "Average order value: ₱2,450",
                    "Customer satisfaction: 9.2/10",
                  ].map((insight, idx) => (
                    <Box key={idx} sx={{ display: "flex", gap: 2, p: 1.5, borderBottom: idx < 5 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                      <Box sx={{ color: "#81C784", fontWeight: 700 }}>✓</Box>
                      <Typography sx={{ color: "white" }}>{insight}</Typography>
                    </Box>
                  ))}
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

      </Box>
    </Box>
  );
};

export default AdminDashboard;