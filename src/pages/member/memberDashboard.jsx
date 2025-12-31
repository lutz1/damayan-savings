/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Toolbar,
  Typography,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  TextField,
  MenuItem,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SortIcon from "@mui/icons-material/Sort";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  runTransaction
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import { motion } from "framer-motion";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import bgImage from "../../assets/bg.jpg";
import NetworkGroupSales from "./components/dialogs/networkGroupsales";

const MemberDashboard = () => {
    // Animated count-up states for card values
    const [displayContribution, setDisplayContribution] = useState(0);
    const [displayCapitalShare, setDisplayCapitalShare] = useState(0);
    const [displayEarnings, setDisplayEarnings] = useState(0);
    const [displayOverride, setDisplayOverride] = useState(0);
    const [totalContribution, setTotalContribution] = useState(0);
    const [totalCapitalShare, setTotalCapitalShare] = useState(0);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [overrideEarnings, setOverrideEarnings] = useState(0);

    // Animate count-up for each card value
    useEffect(() => {
      let frame;
      let start = 100;
      let end = totalContribution;
      let duration = 800;
      let startTime;
      function animate(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const value = start + (end - start) * progress;
        setDisplayContribution(progress === 1 ? Math.round(end) : value);
        if (progress < 1) frame = requestAnimationFrame(animate);
      }
      if (start !== end) frame = requestAnimationFrame(animate);
      return () => frame && cancelAnimationFrame(frame);
    }, [totalContribution]);

    useEffect(() => {
      let frame;
      let start = 100;
      let end = totalCapitalShare;
      let duration = 800;
      let startTime;
      function animate(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const value = start + (end - start) * progress;
        setDisplayCapitalShare(progress === 1 ? Math.round(end) : value);
        if (progress < 1) frame = requestAnimationFrame(animate);
      }
      if (start !== end) frame = requestAnimationFrame(animate);
      return () => frame && cancelAnimationFrame(frame);
    }, [totalCapitalShare]);

    useEffect(() => {
      let frame;
      let start = 100;
      let end = totalEarnings;
      let duration = 800;
      let startTime;
      function animate(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const value = start + (end - start) * progress;
        setDisplayEarnings(progress === 1 ? Math.round(end) : value);
        if (progress < 1) frame = requestAnimationFrame(animate);
      }
      if (start !== end) frame = requestAnimationFrame(animate);
      return () => frame && cancelAnimationFrame(frame);
    }, [totalEarnings]);

    useEffect(() => {
      let frame;
      let start = 100;
      let end = overrideEarnings;
      let duration = 800;
      let startTime;
      function animate(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const value = start + (end - start) * progress;
        setDisplayOverride(progress === 1 ? Math.round(end) : value);
        if (progress < 1) frame = requestAnimationFrame(animate);
      }
      if (start !== end) frame = requestAnimationFrame(animate);
      return () => frame && cancelAnimationFrame(frame);
    }, [overrideEarnings]);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
  // Optional: detect mobile width
  return window.innerWidth >= 960 ? true : false; // desktop open, mobile closed
});

useEffect(() => {
  const handleResize = () => {
    setSidebarOpen(window.innerWidth >= 960);
  };
  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleCounts, setRoleCounts] = useState({
    MD: 0,
    MS: 0,
    MI: 0,
    Agent: 0,
  });

  const [referrals, setReferrals] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  // 💸 Referral Rewards
const [rewardHistory, setRewardHistory] = useState([]);
const [rewardDialogOpen, setRewardDialogOpen] = useState(false);

// 💰 Override Earnings
const [overrideList, setOverrideList] = useState([]);
const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

const [loadingTransfer, setLoadingTransfer] = useState(false);

const [groupSalesOpen, setGroupSalesOpen] = useState(false);

const handleTransferToWallet = async ({ amount, type, rewardId = null }) => {
  if (!user) return;
  if (!amount || amount <= 0) return alert("No funds to transfer.");

  const confirmed = window.confirm(
    `Are you sure you want to transfer ₱${amount.toLocaleString()} to your eWallet?`
  );
  if (!confirmed) return;

  try {
    setLoadingTransfer(true);

    const userRef = doc(db, "users", user.uid);

    if (type === "referral") {
      if (rewardId) {
        // Single reward transfer
        const rewardRef = doc(db, "referralReward", rewardId);

        await runTransaction(db, async (transaction) => {
          const userSnap = await transaction.get(userRef);
          const rewardSnap = await transaction.get(rewardRef);

          if (!userSnap.exists()) throw new Error("User not found.");
          if (!rewardSnap.exists()) throw new Error("Reward not found.");

          if (rewardSnap.data().transferredAmount)
            throw new Error("Reward already transferred.");

          const newBalance = (userSnap.data().eWallet || 0) + rewardSnap.data().amount;

          transaction.update(userRef, { eWallet: newBalance, updatedAt: Date.now() });
          transaction.update(rewardRef, {
            transferredAmount: rewardSnap.data().amount,
            dateTransferred: Date.now(),
          });
        });
      } else {
        // Bulk transfer for all approved rewards
        await runTransaction(db, async (transaction) => {
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) throw new Error("User not found.");

          let totalAmount = 0;

          const rewardRefs = rewardHistory.filter(r => r.payoutReleased && !r.transferredAmount)
            .map(r => {
              totalAmount += r.amount;
              return doc(db, "referralReward", r.id);
            });

          if (totalAmount === 0) throw new Error("No rewards to transfer.");

          const newBalance = (userSnap.data().eWallet || 0) + totalAmount;
          transaction.update(userRef, { eWallet: newBalance, updatedAt: Date.now() });

          rewardRefs.forEach((ref) => {
            const reward = rewardHistory.find(r => r.id === ref.id);
            transaction.update(ref, {
              transferredAmount: reward.amount,
              dateTransferred: Date.now(),
            });
          });
        });
      }
    } else if (type === "override") {
      if (rewardId) {
        const overrideRef = doc(db, "override", rewardId);
        await runTransaction(db, async (transaction) => {
          const overrideSnap = await transaction.get(overrideRef);
          if (!overrideSnap.exists()) throw new Error("Override not found.");
          if (overrideSnap.data().status === "Credited") throw new Error("Already credited.");

          transaction.update(overrideRef, { status: "Credited" });

          const userSnap = await transaction.get(userRef);
          const newBalance = (userSnap.data().eWallet || 0) + overrideSnap.data().amount;
          transaction.update(userRef, { eWallet: newBalance, updatedAt: Date.now() });
        });
      } 
    }

    alert(`₱${amount.toLocaleString()} successfully transferred to eWallet!`);
  } catch (err) {
    console.error("Error transferring funds:", err);
    alert(err.message || "Failed to transfer funds.");
  } finally {
    setLoadingTransfer(false);
  }
};

useEffect(() => {
  if (!user) return;

  const q = query(collection(db, "override"), where("userId", "==", user.uid));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const overrides = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setOverrideList(overrides);

    const now = new Date();

    // ✅ Only include credited OR expired pending rewards
    const total = overrides.reduce((sum, o) => {
      const expDate = o.expirationDate
        ? new Date(o.expirationDate)
        : null;
      const isExpired = expDate && expDate < now;
      const isCredited = o.status === "Credited";

      if (isCredited || isExpired) {
        return sum + (Number(o.amount) || 0);
      }
      return sum;
    }, 0);

    setOverrideEarnings(total);
  });

  return () => unsubscribe();
}, [user]);

useEffect(() => {
  if (!user) return;

  // ✅ Match your actual Firestore field
  const q = query(
    collection(db, "referralReward"),
    where("userId", "==", user.uid),
    where("payoutReleased", "==", true) // 🟢 FIXED
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const rewards = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setRewardHistory(rewards);

    // ✅ Compute total earnings from all payoutReleased = true
    const total = rewards.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    setTotalEarnings(total);
  });

  return () => unsubscribe();
}, [user]);

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔹 Listen to referral counts
  const listenToReferrals = useCallback((username) => {
    if (!username) return;
    const lowerUsername = username.toLowerCase();
    const q = query(collection(db, "users"), where("referredBy", "==", username));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts = { MD: 0, MS: 0, MI: 0, Agent: 0 };
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          data.referredBy &&
          data.referredBy.toLowerCase() === lowerUsername &&
          data.role &&
          counts[data.role] !== undefined
        ) {
          counts[data.role] += 1;
        }
      });
      setRoleCounts(counts);
    });

    return unsubscribe;
  }, []);

  // 🔹 Fetch Payback Total Contribution and Capital Share
const fetchPaybackAndCapital = async (uid) => {
  try {
    // ✅ Fetch Payback Entries
    const paybackRef = collection(db, "paybackEntries");
    const paybackQuery = query(paybackRef, where("userId", "==", uid));
    const paybackSnap = await getDocs(paybackQuery);

    const totalPayback = paybackSnap.docs.reduce(
      (acc, doc) => acc + (Number(doc.data().amount) || 0),
      0
    );
    setTotalContribution(totalPayback);

    // ✅ Fetch Capital Share Entries
    const capitalRef = collection(db, "capitalShareEntries");
    const capitalQuery = query(capitalRef, where("userId", "==", uid));
    const capitalSnap = await getDocs(capitalQuery);

    const totalCapital = capitalSnap.docs.reduce(
      (acc, doc) => acc + (Number(doc.data().amount) || 0),
      0
    );
    setTotalCapitalShare(totalCapital);
  } catch (error) {
    console.error("Error fetching totals:", error);
  }
};

  // 🔹 Fetch user info
  const fetchUserData = useCallback(
    async (uid) => {
      try {
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);
          const unsubscribe = listenToReferrals(data.username);

          // Fetch payback and capital share
          await fetchPaybackAndCapital(uid);
          return unsubscribe;
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    },
    [listenToReferrals]
  );

  // 🔹 Auth state listener
  useEffect(() => {
    let unsubReferrals = null;
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        unsubReferrals = await fetchUserData(currentUser.uid);
      } else {
        setUser(null);
        setUserData(null);
        setRoleCounts({ MD: 0, MS: 0, MI: 0, Agent: 0 });
        if (unsubReferrals) unsubReferrals();
      }
      setLoading(false);
    });

    return () => {
      unsubAuth();
      if (unsubReferrals) unsubReferrals();
    };
  }, [fetchUserData]);

  // 🔹 View referrals by role
  const handleViewReferrals = async (role) => {
    if (!userData?.username) return;
    setSelectedRole(role);
    setOpenDialog(true);

    try {
      const q = query(
        collection(db, "users"),
        where("referredBy", "==", userData.username),
        where("role", "==", role)
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((d) => d.data());
      setReferrals(data);
    } catch (error) {
      console.error("Error fetching referrals:", error);
    }
  };

  // 🔹 Filter + Sort
  const filteredReferrals = referrals
    .filter(
      (r) =>
        r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.username?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const fieldA = a[sortField]?.toString().toLowerCase() || "";
      const fieldB = b[sortField]?.toString().toLowerCase() || "";
      if (fieldA < fieldB) return sortOrder === "asc" ? -1 : 1;
      if (fieldA > fieldB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  const handleToggleSortOrder = () =>
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage:
          `linear-gradient(120deg, rgba(30, 41, 59, 0.92) 60%, rgba(33, 150, 243, 0.25)), url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        position: "relative",
        overflow: "hidden",
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
      {/* 🔝 Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* 🧭 Sidebar */}
      <Box sx={{ zIndex: 5 }}>
        <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* 🧩 Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 4,
          mt: 0,
          pb: { xs: 12, sm: 12, md: 12 },
          color: "white",
          zIndex: 1,
          overflowY: "auto",
          maxHeight: "100vh",
          width: "100%",
          transition: "all 0.3s ease",
          position: "relative",
        }}
      >
        <Toolbar />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
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
            👤 {userData ? `${userData.username}'s Dashboard` : "Loading Dashboard..."}
          </Typography>

          {/* 💰 Payback and Capital Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Unified Card Style for All Four Cards - Vertical Alignment */}
            <Grid container direction="column" spacing={3} sx={{ mb: 3, alignItems: 'center' }}>
              {[{
                label: "Payback Total Contribution",
                value: `₱${Number(displayContribution).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                color: "#81C784",
                icon: null,
              }, {
                label: "Total Capital Share",
                value: `₱${Number(displayCapitalShare).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                color: "#FFD54F",
                icon: null,
              }, {
                label: "Referral Earnings",
                value: `₱${Number(displayEarnings).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                color: "#81C784",
                icon: (
                  <IconButton onClick={() => setRewardDialogOpen(true)} color="inherit" size="small">
                    <VisibilityIcon sx={{ color: "#81C784" }} />
                  </IconButton>
                ),
                subtitle: "Total earned from your referrals"
              }, {
                label: "Override Earnings",
                value: `₱${Number(displayOverride).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                color: "#64B5F6",
                icon: (
                  <IconButton onClick={() => setOverrideDialogOpen(true)} color="inherit" size="small">
                    <VisibilityIcon sx={{ color: "#64B5F6" }} />
                  </IconButton>
                ),
                subtitle: "Credited rewards (after expiration date)"
              }].map((card, idx) => (
                <Grid item key={card.label} sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <Card
                    sx={{
                      background: "rgba(255,255,255,0.1)",
                      backdropFilter: "blur(10px)",
                      width: 340,
                      maxWidth: '90vw',
                      color: "#fff",
                      borderRadius: 3,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                      position: "relative",
                      m: 1,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {card.label}
                        </Typography>
                        {card.icon}
                      </Box>
                      <Typography
                        variant="h4"
                        sx={{ fontWeight: "bold", color: card.color, mt: 1, wordBreak: 'break-word' }}
                      >
                        {card.value}
                      </Typography>
                      {card.subtitle && (
                        <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                          {card.subtitle}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

          </Grid>

          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "60vh",
              }}
            >
              <CircularProgress color="inherit" />
            </Box>
          ) : userData ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
                Welcome <strong>{userData.name}</strong>! Here’s your current network summary:
              </Typography>

              <Button
              variant="contained"
              sx={{
                mb: 3,
                backgroundColor: "#FFD54F",
                color: "#000",
                fontWeight: 600,
                "&:hover": { backgroundColor: "#FFC107" },
              }}
              onClick={() => setGroupSalesOpen(true)}
            >
              📊 Network Group Sales
            </Button>

              <Grid container direction="column" spacing={3} sx={{ mb: 3, alignItems: 'center', width: '100%' }}>
                {["MD", "MS", "MI", "Agent"].map((role) => (
                  <Grid item key={role} sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <Card
                      sx={{
                        background: "rgba(255,255,255,0.1)",
                        backdropFilter: "blur(10px)",
                        width: 340,
                        maxWidth: '90vw',
                        color: "#fff",
                        borderRadius: 3,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                        position: "relative",
                        m: 1,
                      }}
                    >
                      <CardContent>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {role}
                          </Typography>
                          <IconButton
                            onClick={() => handleViewReferrals(role)}
                            color="inherit"
                            size="small"
                          >
                            <VisibilityIcon sx={{ color: "#FFD54F" }} />
                          </IconButton>
                        </Box>
                        <Typography
                          variant="h4"
                          sx={{ mt: 1, fontWeight: "bold", color: "#FFD54F" }}
                        >
                          {roleCounts[role]}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                          Total {role} referrals under your network
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </motion.div>
          ) : (
            <Typography variant="body1">Unable to load user data.</Typography>
          )}
        </motion.div>
      </Box>

      {/* 👁 Referrals Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{selectedRole} Referrals</DialogTitle>
        <DialogContent dividers>
          {/* 🔍 Search + Sort */}
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField
              label="Search by name or username"
              variant="outlined"
              fullWidth
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <TextField
              select
              label="Sort by"
              variant="outlined"
              size="small"
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="username">Username</MenuItem>
            </TextField>
            <IconButton onClick={handleToggleSortOrder}>
              <SortIcon
                sx={{
                  transform: sortOrder === "asc" ? "rotate(0deg)" : "rotate(180deg)",
                  transition: "transform 0.3s",
                }}
              />
            </IconButton>
          </Box>

          {filteredReferrals.length === 0 ? (
            <Typography variant="body2">No referrals found.</Typography>
          ) : (
            <List>
              {filteredReferrals.map((ref, i) => (
                <ListItem key={i} divider>
                  <ListItemText
                    primary={`${ref.name} (${ref.username})`}
                    secondary={`Email: ${ref.email || "N/A"} | Contact: ${ref.contactNumber || "N/A"}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    {/* 🧾 Reward History Dialog */}
<Dialog
  open={rewardDialogOpen}
  onClose={() => setRewardDialogOpen(false)}
  fullWidth
  maxWidth="sm"
>
  <DialogTitle>Reward History</DialogTitle>
  <DialogContent dividers>
    {rewardHistory.length === 0 ? (
      <Typography variant="body2">No approved rewards yet.</Typography>
    ) : (
      <List>
        {rewardHistory
          .sort((a, b) => (b.releasedAt?.seconds || 0) - (a.releasedAt?.seconds || 0))
          .map((reward) => {
            const transferred = reward.transferredAmount && reward.dateTransferred;
            const transferredText = transferred
              ? ` | Transferred: ₱${(reward.transferredAmount || 0).toLocaleString()} on ${new Date(
                  reward.dateTransferred
                ).toLocaleString()}`
              : " | Not yet transferred";

            const handleSingleTransfer = async () => {
              if (!user) return;
              if (transferred) return alert("Reward already transferred.");

              // ✅ Ask user for confirmation
              const confirmed = window.confirm(
                `Are you sure you want to transfer ₱${reward.amount.toLocaleString()} to your eWallet?`
              );
              if (!confirmed) return;

              try {
                setLoadingTransfer((prev) => ({ ...prev, [reward.id]: true }));

                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) return alert("User not found.");

                const currentBalance = userSnap.data().eWallet || 0;
                await updateDoc(userRef, {
                  eWallet: currentBalance + reward.amount,
                  updatedAt: Date.now(),
                });

                // Mark this reward as transferred
                await updateDoc(doc(db, "referralReward", reward.id), {
                  transferredAmount: reward.amount,
                  dateTransferred: Date.now(),
                });

                alert(`₱${reward.amount.toLocaleString()} transferred to eWallet!`);
              } catch (err) {
                console.error("Error transferring reward:", err);
                alert("Failed to transfer reward.");
              } finally {
                setLoadingTransfer((prev) => ({ ...prev, [reward.id]: false }));
              }
            };

            return (
              <ListItem key={reward.id} divider>
                <ListItemText
                  primary={`₱${reward.amount.toLocaleString()} earned`}
                  secondary={`From: ${reward.source}${transferredText}`}
                />
                {!transferred && (
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    onClick={handleSingleTransfer}
                    disabled={loadingTransfer?.[reward.id]}
                  >
                    {loadingTransfer?.[reward.id] ? "Processing..." : "Transfer to eWallet"}
                  </Button>
                )}
              </ListItem>
            );
          })}
      </List>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setRewardDialogOpen(false)}>Close</Button>
  </DialogActions>
</Dialog>

{/* 🧾 Override History Dialog */}
<Dialog
  open={overrideDialogOpen}
  onClose={() => setOverrideDialogOpen(false)}
  fullWidth
  maxWidth="sm"
>
  <DialogTitle>Override Upline Rewards</DialogTitle>
  <DialogContent dividers>
    {overrideList.length === 0 ? (
      <Typography variant="body2">No override rewards found.</Typography>
    ) : (
      <List>
  {overrideList
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .map((o) => {
      const isExpired = o.expirationDate && new Date(o.expirationDate) < new Date();
      const credited = o.status === "Credited" || isExpired;

      const handleSingleOverrideTransfer = async () => {
        if (!user) return;
        if (credited) return alert("Already credited.");

        const confirmed = window.confirm(
          `Are you sure you want to transfer ₱${o.amount.toLocaleString()} to your eWallet?`
        );
        if (!confirmed) return;

        try {
          setLoadingTransfer((prev) => ({ ...prev, [o.id]: true }));

          const userRef = doc(db, "users", user.uid);
          const overrideRef = doc(db, "override", o.id);

          await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            const overrideSnap = await transaction.get(overrideRef);

            if (!userSnap.exists()) throw new Error("User not found.");
            if (!overrideSnap.exists()) throw new Error("Reward not found.");

            const newBalance = (userSnap.data().eWallet || 0) + overrideSnap.data().amount;
            transaction.update(userRef, { eWallet: newBalance, updatedAt: Date.now() });
            transaction.update(overrideRef, { status: "Credited" });
          });

          alert(`₱${o.amount.toLocaleString()} successfully transferred to eWallet!`);
        } catch (err) {
          console.error(err);
          alert(err.message || "Transfer failed.");
        } finally {
          setLoadingTransfer((prev) => ({ ...prev, [o.id]: false }));
        }
      };

      return (
        <ListItem key={o.id} divider>
          <ListItemText
            primary={`₱${o.amount.toLocaleString()} — ${credited ? "Credited" : "Pending"}`}
            secondary={`From: ${o.source || "N/A"} | Expiration: ${
              o.expirationDate ? new Date(o.expirationDate).toLocaleDateString() : "N/A"
            }`}
          />
          {!credited && (
            <Button
              variant="contained"
              size="small"
              color="primary"
              onClick={handleSingleOverrideTransfer}
              disabled={loadingTransfer?.[o.id]}
            >
              {loadingTransfer?.[o.id] ? "Processing..." : "Transfer to eWallet"}
            </Button>
          )}
        </ListItem>
      );
    })}
</List>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setOverrideDialogOpen(false)}>Close</Button>
  </DialogActions>
</Dialog>

<NetworkGroupSales
  open={groupSalesOpen}
  onClose={() => setGroupSalesOpen(false)}
  username={userData?.username}
  user={userData}
/>

    </Box>
  );
};

export default MemberDashboard;