import React, { useEffect, useState } from "react";
import { Box, Toolbar, Typography, Grid, Card, LinearProgress, Drawer, useMediaQuery } from "@mui/material";
// import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
// import 'leaflet/dist/leaflet.css';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { db } from "../../firebase";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { motion } from "framer-motion";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";
import bgImage from "../../assets/bg.jpg";
import { PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useTheme } from "@mui/material/styles";

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);

  const [userCounts, setUserCounts] = useState({ MD: 0, MS: 0, MI: 0, Agent: 0 });
  const [userLocations, setUserLocations] = useState([]); // [{lat, lng, name, address, profileUrl}]
  const [selectedMarker, setSelectedMarker] = useState(null);
    // Google Maps API loader
    const GOOGLE_MAPS_API_KEY = import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY_HERE";
    const { isLoaded } = useJsApiLoader({
      googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    });
  const [totalRevenue, setTotalRevenue] = useState(0);
  // const [totalTransactions, setTotalTransactions] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  // const [depositCount, setDepositCount] = useState(0);
  // const [withdrawalCount, setWithdrawalCount] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [roleDistribution, setRoleDistribution] = useState([]);
    const [recentActivities, setRecentActivities] = useState([]);
  // const [monthlyData, setMonthlyData] = useState([]);
  const [previousRevenue, setPreviousRevenue] = useState(0);

  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);


  // Calculate growth percentages
  const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue * 100).toFixed(1) : 0;

  // Firestore listeners
  useEffect(() => {
    const unsubscribers = [];
    // Fetch recent deposits and withdrawals for Recent Activity
    const depositsQ = query(collection(db, "deposits"), orderBy("createdAt", "desc"));
    const withdrawalsQ = query(collection(db, "withdrawals"), orderBy("createdAt", "desc"));
    let recentDeposit = [];
    let recentWithdrawal = [];
    const unsubDeposits = onSnapshot(depositsQ, snapshot => {
      recentDeposit = snapshot.docs.map(d => ({ ...d.data(), id: d.id, type: "Deposit" }));
      updateRecentActivity();
    });
    const unsubWithdrawals = onSnapshot(withdrawalsQ, snapshot => {
      recentWithdrawal = snapshot.docs.map(d => ({ ...d.data(), id: d.id, type: "Withdrawal" }));
      updateRecentActivity();
    });
    function updateRecentActivity() {
      // Merge and sort by createdAt
      const merged = [...recentDeposit, ...recentWithdrawal]
        .sort((a, b) => (b.createdAt?.toDate?.() || new Date()) - (a.createdAt?.toDate?.() || new Date()))
        .slice(0, 5);
      setRecentActivities(merged);
    }
    unsubscribers.push(unsubDeposits);
    unsubscribers.push(unsubWithdrawals);
        

    const roles = ["MD", "MS", "MI", "Agent"];
    try {
      // Users
      const usersQ = query(collection(db, "users"), orderBy("createdAt", "desc"));
      unsubscribers.push(
        onSnapshot(usersQ, async snapshot => {
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

          // Build a map of username/email to user info for later display
          const userMapObj = {};
          data.forEach(u => {
            if (u.username) userMapObj[u.username] = u;
            if (u.email) userMapObj[u.email] = u;
          });
          setUserMap(userMapObj);

          // Geocode addresses to coordinates using Google Maps Geocoding API
          const geocodeAddress = async (address) => {
            if (!address) return null;
            // Use localStorage to cache geocoding results
            const cacheKey = `geocode_${address}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              try {
                return JSON.parse(cached);
              } catch {}
            }
            try {
              const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
              );
              const result = await response.json();
              if (result.status === "OK" && result.results && result.results.length > 0) {
                const { lat, lng } = result.results[0].geometry.location;
                const coords = { lat, lng };
                localStorage.setItem(cacheKey, JSON.stringify(coords));
                return coords;
              }
            } catch (e) {
              // ignore
            }
            return null;
          };
          const locs = await Promise.all(
            data.map(async u => {
              if (!u.address) return null;
              const coords = await geocodeAddress(u.address);
              if (!coords) return null;
              return { ...coords, name: u.name || u.username || u.email, address: u.address, profileUrl: u.profileUrl || u.photoURL || null };
            })
          );
          setUserLocations(locs.filter(Boolean));
        })
      );

      // Referral Rewards (for Top Earners)
      const referralQ = collection(db, "referralReward");
      unsubscribers.push(
        onSnapshot(referralQ, snapshot => {
          const rewards = snapshot.docs.map(d => d.data());
          // Only count Direct Invite Reward and Network Bonus
          const filtered = rewards.filter(r => r.type === 'Direct Invite Reward' || r.type === 'Network Bonus');
          // Aggregate by username
          const earningsMap = {};
          filtered.forEach(r => {
            const username = r.username || r.user || r.email;
            if (!username) return;
            // Use 'amount' field, fallback to 'transferredAmount', fallback to 'earnings'
            let earning = 0;
            if (typeof r.amount !== 'undefined') {
              earning = typeof r.amount === 'string' ? parseFloat(r.amount) : Number(r.amount) || 0;
            } else if (typeof r.transferredAmount !== 'undefined') {
              earning = typeof r.transferredAmount === 'string' ? parseFloat(r.transferredAmount) : Number(r.transferredAmount) || 0;
            } else if (typeof r.earnings !== 'undefined') {
              earning = typeof r.earnings === 'string' ? parseFloat(r.earnings) : Number(r.earnings) || 0;
            }
            earningsMap[username] = (earningsMap[username] || 0) + earning;
          });
          // Convert to array and sort
          const earnersArr = Object.entries(earningsMap)
            .map(([username, totalEarnings]) => ({ username, totalEarnings: Number(totalEarnings) }))
            .sort((a, b) => b.totalEarnings - a.totalEarnings)
            .slice(0, 5);
          // ...existing code...
          setTopUsers(earnersArr);
        })
      );

      // Transfers for revenue calculation
      const transfersQ = collection(db, "transferFunds");
      unsubscribers.push(
        onSnapshot(transfersQ, async snapshot => {
          const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
          const totalCharge = data.reduce((sum, d) => sum + (Number(d.charge) || 0), 0);
          setTotalRevenue(totalCharge);
          setPreviousRevenue(totalCharge * 0.85); // Simulate previous period

          // Recent transactions (top 5, newest first)
          let recent = data
            .sort((a, b) => (b.createdAt?.toDate?.() || new Date()) - (a.createdAt?.toDate?.() || new Date()))
            .slice(0, 5);

          // Fetch user info for each transfer if missing
          const userIdsToFetch = recent
            .filter(tx => !(tx.name && tx.email && tx.profileUrl))
            .map(tx => tx.senderId || tx.userId || tx.fromUserId || tx.user_id) // try common user id fields
            .filter(Boolean);

          let userInfoMap = {};
          if (userIdsToFetch.length > 0) {
            // Remove duplicates
            const uniqueUserIds = [...new Set(userIdsToFetch)];
            // Fetch all users in one go
            const usersSnap = await Promise.all(
              uniqueUserIds.map(async (uid) => {
                try {
                  const userDoc = await import("firebase/firestore").then(firestore => firestore.getDoc(firestore.doc(db, "users", uid)));
                  return userDoc.exists() ? { id: uid, ...userDoc.data() } : null;
                } catch {
                  return null;
                }
              })
            );
            usersSnap.forEach(user => {
              if (user && user.id) userInfoMap[user.id] = user;
            });
          }

          // Merge user info into recent transactions
          recent = recent.map(tx => {
            if (tx.name && tx.email && tx.profileUrl) return tx;
            const uid = tx.senderId || tx.userId || tx.fromUserId || tx.user_id;
            const user = uid ? userInfoMap[uid] : null;
            return {
              ...tx,
              name: tx.name || user?.name || user?.username || user?.email || "Unknown User",
              email: tx.email || user?.email || "No email",
              profileUrl: tx.profileUrl || user?.profileUrl || user?.photoURL || null,
            };
          });
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
          // const monthlyArray = Object.entries(monthlyMap)
          //   .map(([month, data]) => ({ month, ...data }))
          //   .slice(-6);
          // setMonthlyData(monthlyArray);
        })
      );

      // Deposits
      const depositsQ = collection(db, "deposits");
      unsubscribers.push(
        onSnapshot(depositsQ, snapshot => {
          const data = snapshot.docs.map(d => d.data());
          const totalAmount = data.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
          setTotalDeposits(totalAmount);
          // setDepositCount(data.length);
        })
      );

      // Withdrawals
      const withdrawalsQ = collection(db, "withdrawals");
      unsubscribers.push(
        onSnapshot(withdrawalsQ, snapshot => {
          const data = snapshot.docs.map(d => d.data());
          const totalAmount = data.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
          setTotalWithdrawals(totalAmount);
          // setWithdrawalCount(data.length);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `linear-gradient(120deg, rgba(30, 41, 59, 0.92) 60%, rgba(33, 150, 243, 0.25)), url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        position: "relative",
        '&::before': {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(120deg, rgba(30, 41, 59, 0.92) 60%, rgba(33, 150, 243, 0.25))',
          zIndex: 0,
        },
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}><Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} /></Box>

      {!isMobile && (
        <Box sx={{ zIndex: 5 }}><AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} /></Box>
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

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 4 },
          mt: 0,
          pb: { xs: 3, sm: 12, md: 12 },
          color: "#f5f7fa",
          zIndex: 1,
          width: "100%",
          paddingLeft: 0,
          transition: "all 0.3s ease",
          position: "relative",
          display: 'flex',
          flexDirection: 'column',
          alignItems: { xs: 'stretch', md: 'center' },
        }}
      >
        <Toolbar />
        {/* Header Section */}
        <Box sx={{ mb: 4, width: '100%', maxWidth: 1200 }}>
          <Typography variant={isMobile ? "h5" : "h3"} sx={{ fontWeight: 900, letterSpacing: 1, mb: 1, color: '#fff', textShadow: '0 2px 12px #000a' }}>
            Welcome to <span style={{ color: '#4FC3F7' }}>Damayan Admin</span>
          </Typography>
          <Typography variant={isMobile ? "body1" : "h6"} sx={{ color: '#b0bec5', fontWeight: 500, mb: 1.5, textShadow: '0 1px 8px #0006' }}>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>⏰ Real-time Analytics</Box>
            <Box component="span" sx={{ mx: 1, color: '#4FC3F7' }}>•</Box>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>📊 Performance Metrics</Box>
            <Box component="span" sx={{ mx: 1, color: '#4FC3F7' }}>•</Box>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>🔍 System Health</Box>
          </Typography>
        </Box>



        {/* KPI Cards */}
        <Grid container spacing={2.5} sx={{ mb: 4, width: '100%', maxWidth: 1200, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          {[
            { label: "Total Users", value: Object.values(userCounts).reduce((a, b) => a + b, 0), icon: "👥", color: "#4FC3F7", bg: "rgba(79,195,247,0.15)", growth: "+12.5%", trend: "up" },
            { label: "Total Revenue", value: `₱${totalRevenue.toLocaleString()}` , icon: "💰", color: "#81C784", bg: "rgba(129,199,132,0.15)", growth: `${revenueGrowth}%`, trend: revenueGrowth > 0 ? "up" : "down" },
            { label: "Total Deposits", value: `₱${totalDeposits.toLocaleString()}` , icon: "📥", color: "#FFB74D", bg: "rgba(255,183,77,0.15)", growth: "+8.2%", trend: "up" },
            { label: "Total Withdrawals", value: `₱${totalWithdrawals.toLocaleString()}` , icon: "📤", color: "#E57373", bg: "rgba(229,115,115,0.15)", growth: "-5.1%", trend: "down" },
          ].map((item, index) => (
            <Grid item xs={12} sm={6} md={3} key={index} sx={{ display: "flex", width: '100%' }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                style={{ width: "100%" }}
              >
                <Card
                  sx={{
                    background: `linear-gradient(120deg, ${item.bg} 80%, rgba(255,255,255,0.04))`,
                    backdropFilter: "blur(14px)",
                    border: `2px solid ${item.color}33`,
                    borderRadius: "18px",
                    p: 3,
                    height: "100%",
                    width: "100%",
                    minWidth: 0,
                    boxShadow: `0 4px 24px 0 ${item.color}22`,
                    transition: "transform 0.3s, box-shadow 0.3s",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                    '&::before': {
                      content: '""',
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: "100px",
                      height: "100px",
                      background: `radial-gradient(circle, ${item.color}20, transparent)`,
                      borderRadius: "50%",
                    },
                    '&:hover': {
                      transform: "translateY(-10px) scale(1.03)",
                      boxShadow: `0 20px 50px ${item.color}55`,
                      border: `2.5px solid ${item.color}66`,
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
                    <Typography variant="body2" sx={{ opacity: 1, mb: 1, color: "#fff", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, textShadow: '1px 1px 4px #000' }}>
                      {item.label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: item.color, mb: 1, lineHeight: 1, textShadow: '1px 1px 4px #000' }}>
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




        {/* 7-Day Trends and User Distribution Side by Side */}
        <Grid container spacing={3} sx={{ mb: 4, width: '100%', maxWidth: 1200, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          <Grid item xs={12} md={8} sx={{ display: 'flex', width: '100%' }}>
            <Card sx={{
              background: "linear-gradient(120deg, rgba(79,195,247,0.18), rgba(129,199,132,0.10))",
              backdropFilter: "blur(14px)",
              borderRadius: "18px",
              border: "1.5px solid rgba(79,195,247,0.13)",
              p: 3,
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'stretch',
              boxShadow: '0 4px 24px 0 rgba(79,195,247,0.10)',
            }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "white" }}>📈 7-Day Trends</Typography>
                  <Typography variant="caption" sx={{ color: '#fff', opacity: 1, textShadow: '1px 1px 4px #000' }}>Daily transaction volume</Typography>
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
          <Grid item xs={12} md={4} sx={{ display: 'flex', width: '100%' }}>
            <Card sx={{
              background: "linear-gradient(120deg, rgba(255,183,77,0.18), rgba(229,115,115,0.10))",
              backdropFilter: "blur(14px)",
              borderRadius: "18px",
              border: "1.5px solid rgba(255,183,77,0.13)",
              p: 3,
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'stretch',
              boxShadow: '0 4px 24px 0 rgba(255,183,77,0.10)',
            }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "white" }}>👥 User Distribution</Typography>
                  <Typography variant="caption" sx={{ color: '#fff', opacity: 1, textShadow: '1px 1px 4px #000' }}>By role type</Typography>
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
                      contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10 }}
                      labelStyle={{ color: '#fff', fontWeight: 700 }}
                      itemStyle={{ color: '#fff', fontWeight: 700 }}
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


            {/* User Map */}
            <Box sx={{ width: '100%', maxWidth: 1200, mb: 4 }}>
              <Card sx={{ p: 2, borderRadius: '18px', boxShadow: '0 4px 24px 0 rgba(33,150,243,0.10)', mb: 2, background: 'linear-gradient(120deg, rgba(33,150,243,0.10), rgba(255,255,255,0.04))', border: '1.5px solid rgba(33,150,243,0.13)' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#2196f3', display: 'flex', alignItems: 'center', gap: 1 }}>
                  🗺️ User Address Map
                </Typography>
                <Box sx={{ width: '100%', height: { xs: 240, sm: 300, md: 340 }, borderRadius: '14px', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
                  {isLoaded && (
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={{ lat: 14.5995, lng: 120.9842 }}
                      zoom={6}
                      options={{
                        streetViewControl: false,
                        mapTypeControl: false,
                        fullscreenControl: false,
                      }}
                    >
                      {userLocations.map((loc, idx) => (
                        <Marker
                          key={idx}
                          position={{ lat: loc.lat, lng: loc.lng }}
                          onClick={e => {
                            // Prevent empty popup: only set if loc has name/address
                            if (loc && (loc.name || loc.address)) setSelectedMarker(idx);
                          }}
                        />
                      ))}
                      {selectedMarker !== null && userLocations[selectedMarker] && (userLocations[selectedMarker].name || userLocations[selectedMarker].address) && (
                        <InfoWindow
                          position={{ lat: userLocations[selectedMarker].lat, lng: userLocations[selectedMarker].lng }}
                          onCloseClick={() => {
                            setSelectedMarker(null);
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 180 }}>
                            {userLocations[selectedMarker].profileUrl ? (
                              <img src={userLocations[selectedMarker].profileUrl} alt="profile" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #4FC3F7', marginRight: 10 }} />
                            ) : (
                              <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#222', color: '#4FC3F7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22, marginRight: 10 }}>{userLocations[selectedMarker].name ? userLocations[selectedMarker].name[0] : 'U'}</span>
                            )}
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#222', mb: 0.5 }}>{userLocations[selectedMarker].name}</Typography>
                              <Typography variant="body2" sx={{ color: '#555', wordBreak: 'break-word', fontSize: 13 }}>{userLocations[selectedMarker].address}</Typography>
                            </Box>
                          </Box>
                        </InfoWindow>
                      )}
                    </GoogleMap>
                  )}
                </Box>
              </Card>
            </Box>
            {/* Recent Activity & Top Users - Responsive */}
<Grid container spacing={2.5} sx={{ mb: 4, width: '100%', maxWidth: 1200, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
  <Grid item xs={12} md={4} sx={{ display: 'flex', width: '100%' }}>
    <Card sx={{
      background: "linear-gradient(120deg, rgba(129,199,132,0.18), rgba(79,195,247,0.10))",
      backdropFilter: "blur(14px)",
      borderRadius: "18px",
      border: "1.5px solid rgba(129,199,132,0.13)",
      p: 3,
      width: '100%',
      mb: { xs: 3, md: 0 },
      boxShadow: '0 4px 24px 0 rgba(129,199,132,0.10)',
    }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#fff", display: "flex", alignItems: "center", gap: 1, textShadow: '1px 1px 4px #000' }}>
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
                alignItems: "center",
                flexDirection: { xs: 'column', sm: 'row' },
                flexWrap: 'wrap',
                minWidth: 0,
                overflowX: 'auto',
                "&:hover": { background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)" }
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                  {/* Profile Avatar */}
                  {tx.profileUrl ? (
                    <Box component="img" src={tx.profileUrl} alt="profile" sx={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', mr: 1, border: '2px solid #4FC3F7', flexShrink: 0 }} />
                  ) : (
                    <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: '#222', color: '#4FC3F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, mr: 1, flexShrink: 0 }}>
                      {tx.name ? tx.name[0] : 'U'}
                    </Box>
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: "#4FC3F7", fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: { xs: 120, sm: 160, md: 200 } }}>
                      {tx.name || 'Unknown User'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#fff", fontSize: 12, textShadow: '1px 1px 4px #000', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: { xs: 120, sm: 160, md: 200 } }}>
                      {tx.email || 'No email'}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, minWidth: 90, ml: { xs: 0, sm: 'auto' }, mt: { xs: 1, sm: 0 }, flexShrink: 0 }}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5 }}>
                    <Box sx={{ fontSize: "1rem" }}>💳</Box>
                    <Typography variant="body2" sx={{ color: "white", fontWeight: 700, whiteSpace: 'nowrap' }}>
                      ₱{(tx.amount || 0).toLocaleString()}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "#fff", fontSize: "0.7rem", textShadow: '1px 1px 4px #000', textAlign: { xs: 'left', sm: 'right' }, whiteSpace: 'nowrap' }}>
                    {tx.createdAt?.toDate?.().toLocaleDateString() || "N/A"}
                  </Typography>
                </Box>
                <Box sx={{ fontSize: "1.2rem", color: "#81C784", ml: { xs: 0, sm: 2 }, mt: { xs: 1, sm: 0 }, flexShrink: 0 }}>✓</Box>
              </Box>
            </motion.div>
          ))
        ) : (
          <Typography variant="caption" sx={{ opacity: 0.5 }}>No transfers</Typography>
        )}
      </Box>
    </Card>
  </Grid>

  <Grid item xs={12} md={4} sx={{ display: 'flex', width: '100%' }}>
    <Card sx={{
      background: "linear-gradient(120deg, rgba(255,183,77,0.18), rgba(129,199,132,0.10))",
      backdropFilter: "blur(14px)",
      borderRadius: "18px",
      border: "1.5px solid rgba(255,183,77,0.13)",
      p: 3,
      width: '100%',
      mb: { xs: 3, md: 0 },
      boxShadow: '0 4px 24px 0 rgba(255,183,77,0.10)',
    }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#fff", display: "flex", alignItems: "center", gap: 1, textShadow: '1px 1px 4px #000' }}>
        📝 Recent Activity
      </Typography>
      <Box sx={{ maxHeight: 340, overflowY: "auto", "&::-webkit-scrollbar": { width: "6px" }, "&::-webkit-scrollbar-track": { background: "rgba(255,255,255,0.05)" }, "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.2)", borderRadius: "3px" } }}>
        {recentActivities.length > 0 ? (
          recentActivities.map((act, idx) => {
            // Try to get user info from userMap using userId, senderId, username, or email
            let userInfo = null;
            let displayName = "Unknown User";
            let profileUrl = null;
            // If name is empty and userId exists, map userId to users collection
            if ((!act.name || act.name.trim() === "") && act.userId && userMap[act.userId]) {
              userInfo = userMap[act.userId];
              displayName = userInfo.name || userInfo.username || userInfo.email || "Unknown User";
              profileUrl = userInfo.profileUrl || userInfo.photoURL || null;
            } else {
              // Try userId, senderId, username, email
              const possibleKeys = [act.userId, act.senderId, act.userName, act.username, act.email];
              for (const key of possibleKeys) {
                if (key && userMap[key]) {
                  userInfo = userMap[key];
                  break;
                }
              }
              displayName = userInfo?.name || userInfo?.username || act.name || act.userName || act.username || act.email || "Unknown User";
              profileUrl = userInfo?.profileUrl || userInfo?.photoURL || null;
            }
            return (
              <motion.div key={act.id || idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}>
                <Box sx={{
                  p: 2,
                  mb: 1.5,
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  flexDirection: { xs: 'column', sm: 'row' },
                  "&:hover": { background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)" }
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                    {/* Profile Avatar */}
                    {profileUrl ? (
                      <Box component="img" src={profileUrl} alt="profile" sx={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', mr: 1, border: act.type === 'Deposit' ? '2px solid #FFB74D' : '2px solid #E57373' }} />
                    ) : (
                      <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: act.type === 'Deposit' ? '#FFB74D' : '#E57373', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, mr: 1 }}>
                        {displayName ? displayName[0] : 'U'}
                      </Box>
                    )}
                    <Box>
                      <Typography variant="body2" sx={{ color: act.type === 'Deposit' ? '#FFB74D' : '#E57373', fontWeight: 700, fontSize: 15 }}>
                        {act.type}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#fff", fontSize: 12, textShadow: '1px 1px 4px #000' }}>
                        {displayName}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, minWidth: 90, ml: { xs: 0, sm: 'auto' }, mt: { xs: 1, sm: 0 } }}>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5 }}>
                      <Box sx={{ fontSize: "1rem" }}>{act.type === 'Deposit' ? '📥' : '📤'}</Box>
                      <Typography variant="body2" sx={{ color: "white", fontWeight: 700 }}>
                        ₱{(act.amount || 0).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: "#fff", fontSize: "0.7rem", textShadow: '1px 1px 4px #000', textAlign: { xs: 'left', sm: 'right' } }}>
                      {act.createdAt?.toDate?.().toLocaleDateString() || "N/A"}
                    </Typography>
                  </Box>
                  <Box sx={{ fontSize: "1.2rem", color: act.type === 'Deposit' ? '#FFB74D' : '#E57373', ml: { xs: 0, sm: 2 }, mt: { xs: 1, sm: 0 } }}>✓</Box>
                </Box>
              </motion.div>
            );
          })
        ) : (
          <Typography variant="caption" sx={{ opacity: 0.5 }}>No activity</Typography>
        )}
      </Box>
    </Card>
  </Grid>

  <Grid item xs={12} md={4} sx={{ display: 'flex', width: '100%' }}>
    <Card sx={{
      background: "linear-gradient(120deg, rgba(255,183,77,0.18), rgba(229,115,115,0.10))",
      backdropFilter: "blur(14px)",
      borderRadius: "18px",
      border: "1.5px solid rgba(255,183,77,0.13)",
      p: 3,
      width: '100%',
      boxShadow: '0 4px 24px 0 rgba(255,183,77,0.10)',
    }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#fff", display: "flex", alignItems: "center", gap: 1, textShadow: '1px 1px 4px #000' }}>
        ⭐ Top Earners
      </Typography>
      <Box sx={{ maxHeight: 340, overflowY: "auto", "&::-webkit-scrollbar": { width: "6px" }, "&::-webkit-scrollbar-track": { background: "rgba(255,255,255,0.05)" }, "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.2)", borderRadius: "3px" } }}>
        {topUsers.length > 0 ? (
          topUsers.map((user, idx) => {
            // Try to get user info from userMap using username, fallback to email
            const userInfo = userMap[user.username] || userMap[user.email] || {};
            // Defensive: show username and value if userInfo is missing
            return (
              <motion.div key={user.username || user.email || idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}>
                <Box sx={{
                  p: 2,
                  mb: 1.5,
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexDirection: { xs: 'column', sm: 'row' },
                  "&:hover": { background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)" }
                }}>
                  <Box sx={{ flex: 1, mb: { xs: 1, sm: 0 } }}>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5 }}>
                      <Box sx={{ fontSize: "1rem" }}>👤</Box>
                      <Typography variant="body2" sx={{ color: "white", fontWeight: 700 }}>
                        {userInfo.name || userInfo.username || user.username || userInfo.email || user.username || "User"}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: "#fff", fontSize: "0.7rem", textShadow: '1px 1px 4px #000' }}>
                      {userInfo.role || ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: "#FFB74D", fontWeight: 700, textShadow: '1px 1px 4px #000' }}>
                    ₱{Number(user.totalEarnings).toLocaleString()}
                  </Typography>
                </Box>
              </motion.div>
            );
          })
        ) : (
          <Typography variant="caption" sx={{ opacity: 0.5 }}>No users</Typography>
        )}
      </Box>
    </Card>
  </Grid>
</Grid>

      </Box>
    </Box>
  );
};

export default AdminDashboard;