import { writeFileSync } from 'fs';

const content = `import React, { useEffect, useState } from "react";
import { Box, Toolbar, Typography, Grid, Card, Drawer, useMediaQuery } from "@mui/material";
import { db } from "../../firebase";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { motion } from "framer-motion";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";
import { CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useTheme } from "@mui/material/styles";

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);

  const [userCounts, setUserCounts] = useState({ MasterMD: 0, MD: 0, MS: 0, MI: 0, Agent: 0 });
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [recentActivities, setRecentActivities] = useState([]);
  const [previousRevenue, setPreviousRevenue] = useState(0);
  const [memberActivityDist, setMemberActivityDist] = useState({ MasterMD: { codes: 0, shares: 0 }, MD: { codes: 0, shares: 0 }, MS: { codes: 0, shares: 0 }, MI: { codes: 0, shares: 0 }, Agent: { codes: 0, shares: 0 } });

  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);

  // Calculate growth percentages
  const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue * 100).toFixed(1) : 0;

  // Firestore listeners
  useEffect(() => {
    const unsubscribers = [];

    // Activity data storage
    let allActivities = {
      deposits: [],
      withdrawals: [],
      capitalShareEntries: [],
      paybackEntries: [],
      purchaseCodes: [],
      pendingInvites: [],
      capitalShareVouchers: [],
      walletToWalletTransfers: [],
    };

    const updateMemberDist = () => {
      const distRoles = ["MasterMD", "MD", "MS", "MI", "Agent"];
      const dist = {};
      distRoles.forEach(r => { dist[r] = { codes: 0, shares: 0 }; });
      allActivities.purchaseCodes.forEach(code => {
        const role = code.role || code.userRole || code.memberRole;
        if (role && dist[role] !== undefined) dist[role].codes++;
      });
      [...allActivities.capitalShareVouchers, ...allActivities.capitalShareEntries].forEach(v => {
        const role = v.role || v.userRole || v.memberRole;
        if (role && dist[role] !== undefined) dist[role].shares++;
      });
      setMemberActivityDist(dist);
    };

    const updateRecentActivities = () => {
      const combined = [
        ...allActivities.deposits.map(d => ({ ...d, activityType: "Deposit" })),
        ...allActivities.withdrawals.map(d => ({ ...d, activityType: "Withdrawal" })),
        ...allActivities.capitalShareEntries.map(d => ({ ...d, activityType: "Add Capital Share" })),
        ...allActivities.paybackEntries.map(d => ({ ...d, activityType: "Add Payback Entry" })),
        ...allActivities.purchaseCodes.map(d => ({ ...d, activityType: "Purchase Code" })),
        ...allActivities.pendingInvites.map(d => ({ ...d, activityType: "Invite & Earn" })),
        ...allActivities.capitalShareVouchers.map(d => ({ ...d, activityType: "Capital Share Voucher" })),
        ...allActivities.walletToWalletTransfers.map(d => ({ ...d, activityType: "Send Money" })),
      ]
        .sort((a, b) => (b.createdAt?.toDate?.() || new Date()) - (a.createdAt?.toDate?.() || new Date()))
        .slice(0, 50);
      setRecentActivities(combined);
    };

    // Deposits activity
    const depositsActivityQ = query(collection(db, "deposits"), orderBy("createdAt", "desc"));
    const unsubDepositsActivity = onSnapshot(depositsActivityQ, snapshot => {
      allActivities.deposits = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      updateRecentActivities();
    });
    unsubscribers.push(unsubDepositsActivity);

    // Withdrawals activity
    const withdrawalsActivityQ = query(collection(db, "withdrawals"), orderBy("createdAt", "desc"));
    const unsubWithdrawalsActivity = onSnapshot(withdrawalsActivityQ, snapshot => {
      allActivities.withdrawals = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      updateRecentActivities();
    });
    unsubscribers.push(unsubWithdrawalsActivity);

    // Capital Share Entries
    const capitalShareQ = query(collection(db, "capitalShareEntries"), orderBy("createdAt", "desc"));
    const unsubCapitalShare = onSnapshot(capitalShareQ, snapshot => {
      allActivities.capitalShareEntries = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      updateRecentActivities();
      updateMemberDist();
    });
    unsubscribers.push(unsubCapitalShare);

    // Payback Entries
    const paybackQ = query(collection(db, "paybackEntries"), orderBy("createdAt", "desc"));
    const unsubPayback = onSnapshot(paybackQ, snapshot => {
      allActivities.paybackEntries = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      updateRecentActivities();
    });
    unsubscribers.push(unsubPayback);

    // Purchase Codes
    const codesQ = query(collection(db, "purchaseCodes"), orderBy("createdAt", "desc"));
    const unsubCodes = onSnapshot(codesQ, snapshot => {
      allActivities.purchaseCodes = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      updateRecentActivities();
      updateMemberDist();
    });
    unsubscribers.push(unsubCodes);

    // Pending Invites
    const invitesQ = query(collection(db, "pendingInvites"), orderBy("createdAt", "desc"));
    const unsubInvites = onSnapshot(invitesQ, snapshot => {
      allActivities.pendingInvites = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      updateRecentActivities();
    });
    unsubscribers.push(unsubInvites);

    // Capital Share Vouchers
    const vouchersQ = query(collection(db, "capitalShareVouchers"));
    const unsubVouchers = onSnapshot(vouchersQ, snapshot => {
      allActivities.capitalShareVouchers = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      updateRecentActivities();
      updateMemberDist();
    });
    unsubscribers.push(unsubVouchers);

    const roles = ["MasterMD", "MD", "MS", "MI", "Agent"];
    try {
      // Users
      const usersQ = query(collection(db, "users"), orderBy("createdAt", "desc"));
      unsubscribers.push(
        onSnapshot(usersQ, snapshot => {
          const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
          const counts = {};
          roles.forEach(r => (counts[r] = data.filter(u => u.role === r).length));
          setUserCounts(counts);

          const userMapObj = {};
          data.forEach(u => {
            if (u.username) userMapObj[u.username] = u;
            if (u.email) userMapObj[u.email] = u;
            userMapObj[u.id] = u;
          });
          setUserMap(userMapObj);
        })
      );

      // Referral Rewards (Top Earners - Direct Invite Reward only)
      const referralQ = collection(db, "referralReward");
      unsubscribers.push(
        onSnapshot(referralQ, snapshot => {
          const rewards = snapshot.docs.map(d => d.data());
          // Only count Direct Invite Reward
          const filtered = rewards.filter(r => r.type === 'Direct Invite Reward');
          const earningsMap = {};
          filtered.forEach(r => {
            const username = r.username || r.user || r.email;
            if (!username) return;
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
          const earnersArr = Object.entries(earningsMap)
            .map(([username, totalEarnings]) => ({ username, totalEarnings: Number(totalEarnings) }))
            .sort((a, b) => b.totalEarnings - a.totalEarnings)
            .slice(0, 5);
          setTopUsers(earnersArr);
        })
      );

      // Transfers for revenue calculation
      const transfersQ = collection(db, "transferFunds");
      unsubscribers.push(
        onSnapshot(transfersQ, async snapshot => {
          const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
          allActivities.walletToWalletTransfers = data;

          const totalCharge = data.reduce((sum, d) => sum + (Number(d.charge) || 0), 0);
          setTotalRevenue(totalCharge);
          setPreviousRevenue(totalCharge * 0.85);

          let recent = data
            .sort((a, b) => (b.createdAt?.toDate?.() || new Date()) - (a.createdAt?.toDate?.() || new Date()))
            .slice(0, 5);

          const userIdsToFetch = recent
            .filter(tx => !(tx.name && tx.email && tx.profileUrl))
            .map(tx => tx.senderId || tx.userId || tx.fromUserId || tx.user_id)
            .filter(Boolean);

          let userInfoMap = {};
          if (userIdsToFetch.length > 0) {
            const uniqueUserIds = [...new Set(userIdsToFetch)];
            const usersSnap = await Promise.all(
              uniqueUserIds.map(async (uid) => {
                try {
                  const userDoc = await import("firebase/firestore").then(firestore => firestore.getDoc(firestore.doc(db, "users", uid)));
                  return userDoc.exists() ? { id: uid, ...userDoc.data() } : null;
                } catch { return null; }
              })
            );
            usersSnap.forEach(user => { if (user && user.id) userInfoMap[user.id] = user; });
          }

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
          updateRecentActivities();

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
        })
      );

      // Deposits totals
      const depositsQ = collection(db, "deposits");
      unsubscribers.push(
        onSnapshot(depositsQ, snapshot => {
          const data = snapshot.docs.map(d => d.data());
          setTotalDeposits(data.reduce((sum, d) => sum + (Number(d.amount) || 0), 0));
        })
      );

      // Withdrawals totals
      const withdrawalsQ = collection(db, "withdrawals");
      unsubscribers.push(
        onSnapshot(withdrawalsQ, snapshot => {
          const data = snapshot.docs.map(d => d.data());
          setTotalWithdrawals(data.reduce((sum, d) => sum + (Number(d.amount) || 0), 0));
        })
      );
    } catch (error) {
      console.error("Error setting up listeners:", error);
    }

    return () => {
      unsubscribers.forEach(unsub => { try { unsub(); } catch (e) { console.error(e); } });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        backgroundColor: "#f7f9fb",
        position: "relative",
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

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
            PaperProps={{ sx: { background: "transparent", boxShadow: "none" } }}
          >
            <AppBottomNav layout="sidebar" open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
          </Drawer>
        </>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 2, sm: 3.5 },
          pt: 2,
          pb: { xs: 16, sm: 16 },
          color: "#191c1e",
          zIndex: 1,
          width: "100%",
          overflowX: "hidden",
          transition: "all 0.3s ease",
        }}
      >
        <Toolbar />

        {/* Page Title */}
        <Typography
          sx={{ fontWeight: 800, fontFamily: "'Manrope', sans-serif", fontSize: { xs: 22, sm: 28 }, color: "#191c1e", mb: 3 }}
        >
          Dashboard
        </Typography>

        {/* Metric Cards Grid (2×2 on mobile, 4 columns on sm+) */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            { label: "Total Users", value: Object.values(userCounts).reduce((a, b) => a + b, 0).toLocaleString(), icon: "group", badge: "+12%", positive: true },
            { label: "Total Revenue", value: \`\u20B1\${totalRevenue.toLocaleString()}\`, icon: "payments", badge: \`\${Number(revenueGrowth) >= 0 ? "+" : ""}\${revenueGrowth}%\`, positive: Number(revenueGrowth) >= 0 },
            { label: "Total Deposits", value: \`\u20B1\${totalDeposits.toLocaleString()}\`, icon: "account_balance_wallet", badge: "+5.2%", positive: true },
            { label: "Total Withdrawals", value: \`\u20B1\${totalWithdrawals.toLocaleString()}\`, icon: "outbox", badge: "-2.1%", positive: false },
          ].map((item, i) => (
            <Grid item xs={6} sm={3} key={i}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}>
                <Box
                  sx={{
                    bgcolor: "#ffffff",
                    p: 2.5,
                    borderRadius: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: 112,
                    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                    transition: "box-shadow 0.2s",
                    "&:hover": { boxShadow: "0 4px 18px rgba(0,0,0,0.12)" },
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Box
                      component="span"
                      sx={{
                        fontFamily: "'Material Symbols Outlined'",
                        fontSize: 26,
                        color: "#497cff",
                        fontVariationSettings: "'FILL' 1, 'wght' 400",
                        userSelect: "none",
                        lineHeight: 1,
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Box
                      sx={{
                        bgcolor: item.positive ? "rgba(0,150,104,0.12)" : "rgba(186,26,26,0.12)",
                        px: 1,
                        py: 0.25,
                        borderRadius: "4px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: item.positive ? "#009668" : "#ba1a1a",
                      }}
                    >
                      {item.badge}
                    </Box>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#54647a" }}>
                      {item.label}
                    </Typography>
                    <Typography sx={{ fontSize: 18, fontWeight: 700, fontFamily: "'Manrope', sans-serif", color: "#191c1e", mt: 0.5 }}>
                      {item.value}
                    </Typography>
                  </Box>
                </Box>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* Revenue Chart */}
        <Card sx={{ bgcolor: "#ffffff", borderRadius: "16px", p: { xs: 2.5, sm: 3 }, mb: 4, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 3 }}>
            <Box>
              <Typography sx={{ fontSize: 18, fontWeight: 700, fontFamily: "'Manrope', sans-serif", color: "#191c1e" }}>
                Total Revenue Over Time
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#54647a", mt: 0.5 }}>Daily updates \u00B7 current period</Typography>
            </Box>
          </Box>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0053db" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#0053db" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="date" tick={{ fill: "#76777d", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#76777d", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e0e3e5", borderRadius: 10, color: "#191c1e", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }} />
                <Area type="monotone" dataKey="value" stroke="#0053db" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 5, fill: "#0053db" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Box>
              <Box sx={{ height: 192, display: "flex", alignItems: "flex-end", gap: "4px" }}>
                {[40, 55, 45, 70, 85, 60, 50, 65, 75, 40].map((h, i) => (
                  <Box key={i} sx={{ flex: 1, bgcolor: i === 4 ? "#0053db" : "rgba(0,83,219,0.15)", height: \`\${h}%\`, borderRadius: "4px 4px 0 0" }} />
                ))}
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1.5, px: 0.5 }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <Typography key={d} sx={{ fontSize: 10, color: "#76777d", textTransform: "uppercase", letterSpacing: 1 }}>{d}</Typography>
                ))}
              </Box>
            </Box>
          )}
        </Card>

        {/* Bento: Member Distribution + Top Earners */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ bgcolor: "#f2f4f6", borderRadius: "16px", p: 3, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", height: "100%" }}>
              <Typography sx={{ fontSize: 18, fontWeight: 700, fontFamily: "'Manrope', sans-serif", color: "#191c1e", mb: 1.5 }}>
                Member Distribution
              </Typography>
              <Box sx={{ display: "flex", gap: 2, mb: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, bgcolor: "#0053db", borderRadius: "2px", flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 10, color: "#54647a", fontWeight: 600 }}>Invite Codes</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, bgcolor: "#009668", borderRadius: "2px", flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 10, color: "#54647a", fontWeight: 600 }}>Capital Shares</Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                {["MasterMD", "MD", "MS", "MI", "Agent"].map((role) => {
                  const data = memberActivityDist[role] || { codes: 0, shares: 0 };
                  const totalCodes = Math.max(Object.values(memberActivityDist).reduce((a, b) => a + b.codes, 0), 1);
                  const totalShares = Math.max(Object.values(memberActivityDist).reduce((a, b) => a + b.shares, 0), 1);
                  const codePct = Math.round((data.codes / totalCodes) * 100);
                  const sharePct = Math.round((data.shares / totalShares) * 100);
                  return (
                    <Box key={role}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#191c1e" }}>{role}</Typography>
                        <Typography sx={{ fontSize: 10, color: "#76777d" }}>{data.codes} \u00B7 {data.shares}</Typography>
                      </Box>
                      <Box sx={{ width: "100%", bgcolor: "#e0e3e5", height: 6, borderRadius: 99, overflow: "hidden", mb: 0.75 }}>
                        <Box sx={{ bgcolor: "#0053db", height: "100%", width: \`\${codePct}%\`, borderRadius: 99, transition: "width 0.8s ease" }} />
                      </Box>
                      <Box sx={{ width: "100%", bgcolor: "#e0e3e5", height: 6, borderRadius: 99, overflow: "hidden" }}>
                        <Box sx={{ bgcolor: "#009668", height: "100%", width: \`\${sharePct}%\`, borderRadius: 99, transition: "width 0.8s ease" }} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ bgcolor: "#ffffff", borderRadius: "16px", p: 3, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", height: "100%" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 700, fontFamily: "'Manrope', sans-serif", color: "#191c1e" }}>
                  Top Earners
                </Typography>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {topUsers.length > 0 ? (
                  topUsers.slice(0, 5).map((user, idx) => {
                    const info = userMap[user.username] || userMap[user.email] || {};
                    const displayName = info.name || info.username || user.username || "User";
                    const role = info.role || "Member";
                    const avatarBg = ["#4FC3F7", "#81C784", "#FFB74D", "#E57373", "#BA68C8"][idx % 5];
                    return (
                      <Box key={idx} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <Box
                            sx={{
                              width: 40, height: 40, borderRadius: "50%", bgcolor: avatarBg,
                              overflow: "hidden", display: "flex", alignItems: "center",
                              justifyContent: "center", fontWeight: 700, fontSize: 16, color: "#fff", flexShrink: 0,
                            }}
                          >
                            {info.profileUrl
                              ? <Box component="img" src={info.profileUrl} alt={displayName} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : displayName[0]?.toUpperCase()}
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#191c1e" }}>{displayName}</Typography>
                            <Typography sx={{ fontSize: 10, color: "#76777d", textTransform: "uppercase", fontWeight: 500, letterSpacing: 0.5 }}>{role}</Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#009668" }}>
                          \u20B1{Number(user.totalEarnings).toLocaleString()}
                        </Typography>
                      </Box>
                    );
                  })
                ) : (
                  <Typography sx={{ fontSize: 12, color: "#76777d" }}>No earner data yet.</Typography>
                )}
              </Box>
            </Card>
          </Grid>
        </Grid>

        {/* Activity Logs */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, fontFamily: "'Manrope', sans-serif", color: "#191c1e", mb: 2 }}>
            Activity Logs
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {recentActivities.length > 0 ? (
              recentActivities.map((act, idx) => {
                const totalShown = recentActivities.length;
                const isFirst = idx === 0;
                const isLast = idx === totalShown - 1;
                const actCfg = {
                  "Deposit":               { icon: "account_balance_wallet", color: "#009668", bg: "rgba(0,150,104,0.08)" },
                  "Withdrawal":            { icon: "outbox",                  color: "#ba1a1a", bg: "rgba(186,26,26,0.08)" },
                  "Add Capital Share":     { icon: "savings",                 color: "#0053db", bg: "rgba(0,83,219,0.08)" },
                  "Add Payback Entry":     { icon: "receipt_long",            color: "#605e71", bg: "rgba(96,94,113,0.08)" },
                  "Purchase Code":         { icon: "confirmation_number",     color: "#7c5295", bg: "rgba(124,82,149,0.08)" },
                  "Invite & Earn":         { icon: "group_add",               color: "#0053db", bg: "rgba(0,83,219,0.08)" },
                  "Capital Share Voucher": { icon: "card_giftcard",           color: "#009668", bg: "rgba(0,150,104,0.08)" },
                  "Send Money":            { icon: "send",                    color: "#0053db", bg: "rgba(0,83,219,0.08)" },
                };
                const cfg = actCfg[act.activityType] || { icon: "info", color: "#76777d", bg: "rgba(118,119,125,0.08)" };

                let displayName = act.name || act.userName || act.username || act.email || "";
                if (!displayName && act.userId && userMap[act.userId]) {
                  const u = userMap[act.userId];
                  displayName = u.name || u.username || u.email || "";
                }
                if (!displayName) {
                  for (const k of [act.senderId, act.userName, act.username, act.email]) {
                    if (k && userMap[k]) { displayName = userMap[k].name || userMap[k].username || k; break; }
                  }
                }
                displayName = displayName || "System";

                const timeStr =
                  act.createdAt?.toDate?.().toLocaleString() ||
                  (act.createdAt?.seconds ? new Date(act.createdAt.seconds * 1000).toLocaleString() : "Recently");

                return (
                  <motion.div key={act.id || idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(idx, 10) * 0.04 }}>
                    <Box
                      sx={{
                        bgcolor: "#f2f4f6",
                        p: 2,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 2,
                        borderRadius: isFirst ? "12px 12px 0 0" : isLast ? "0 0 12px 12px" : 0,
                      }}
                    >
                      <Box sx={{ bgcolor: cfg.bg, p: 1, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Box
                          component="span"
                          sx={{ fontFamily: "'Material Symbols Outlined'", fontSize: 18, color: cfg.color, fontVariationSettings: "'FILL' 1", userSelect: "none", lineHeight: 1 }}
                        >
                          {cfg.icon}
                        </Box>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 12, color: "#191c1e", lineHeight: 1.5 }}>
                          <Box component="span" sx={{ fontWeight: 700 }}>{act.activityType}</Box>
                          {" "}by{" "}
                          <Box component="span" sx={{ fontWeight: 600 }}>{displayName}</Box>
                          {act.amount ? \` \u2014 \u20B1\${Number(act.amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}\` : ""}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "#76777d", mt: 0.5 }}>{timeStr}</Typography>
                      </Box>
                    </Box>
                  </motion.div>
                );
              })
            ) : (
              <Box sx={{ bgcolor: "#f2f4f6", p: 3, borderRadius: "12px", textAlign: "center" }}>
                <Typography sx={{ fontSize: 12, color: "#76777d" }}>No recent activity.</Typography>
              </Box>
            )}
          </Box>
        </Box>

      </Box>
    </Box>
  );
};

export default AdminDashboard;
`;

writeFileSync('src/pages/admin/adminDashboard.jsx', content, 'utf8');

// Verify key things
const checks = {
  'no GoogleMap': !content.includes('GoogleMap'),
  'no userLocations': !content.includes('userLocations'),
  'memberActivityDist': content.includes('memberActivityDist'),
  'updateMemberDist': content.includes('updateMemberDist'),
  'Direct Invite Reward only': content.includes("filter(r => r.type === 'Direct Invite Reward');"),
  'slice 50': content.includes('.slice(0, 50)'),
  'Grid container': content.includes('<Grid container spacing={2}'),
  'Grid item xs6 sm3': content.includes('xs={6} sm={3}'),
  'peso symbol': content.includes('\u20B1'),
  'no map section': !content.includes('User Locations'),
  'activity logs all': content.includes('recentActivities.map((act, idx)'),
  'MasterMD in roles': content.includes('"MasterMD"'),
};

console.log('Checks:');
Object.entries(checks).forEach(([k,v]) => console.log(v ? '  \u2713' : '  \u2717', k));
console.log('Lines:', content.split('\n').length);
