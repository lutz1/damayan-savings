import OverrideUplineRewardsDialog from "./components/dialogs/OverrideUplineRewardsDialog";
import RewardHistoryDialog from "./components/dialogs/RewardHistoryDialog";
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { sendReferralTransferAvailableNotification } from "../../utils/referralNotifications";
import { sendOverrideTransferAvailableNotification } from "../../utils/overrideNotifications";
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
  Badge,
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
    // Get location for deposit dialog redirect
    const location = useLocation();
    
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
  const [openDepositDialog, setOpenDepositDialog] = useState(false);
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
  const notifiedRef = useRef(false);
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

    if (type === "referral") {
      if (rewardId) {
        // Single reward transfer via backend
        const idToken = await user.getIdToken();
        const API_BASE = process.env.REACT_APP_API_BASE_URL || "https://damayan-savings-backend.onrender.com";
        
        const response = await fetch(`${API_BASE}/api/transfer-referral-reward`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            rewardId,
            amount: rewardHistory.find(r => r.id === rewardId)?.amount || amount,
          }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Transfer failed");
      } else {
        // Bulk transfer for all approved rewards
        const userRef = doc(db, "users", user.uid);
        const idToken = await user.getIdToken();
        const API_BASE = process.env.REACT_APP_API_BASE_URL || "https://damayan-savings-backend.onrender.com";

        let totalAmount = 0;
        const approvedRewards = rewardHistory.filter(r => r.payoutReleased && !r.transferredAmount);

        for (const reward of approvedRewards) {
          const response = await fetch(`${API_BASE}/api/transfer-referral-reward`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idToken,
              rewardId: reward.id,
              amount: reward.amount,
            }),
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Transfer failed");
          totalAmount += reward.amount;
        }

        if (totalAmount === 0) throw new Error("No rewards to transfer.");
      }
    } else if (type === "override") {
      if (rewardId) {
        const idToken = await user.getIdToken();
        const API_BASE = process.env.REACT_APP_API_BASE_URL || "https://damayan-savings-backend.onrender.com";
        
        const response = await fetch(`${API_BASE}/api/transfer-override-reward`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, overrideId: rewardId, amount: amount || overrideList.find(o => o.id === rewardId)?.amount }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Transfer failed");
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


// Listen for upline rewards where user is the upline
useEffect(() => {
  if (!user) return;

  // Listen to uplineRewards collection (₱65 from payback entries)
  const q1 = query(
    collection(db, "uplineRewards"),
    where("uplineId", "==", user.uid)
  );

  const unsubscribe1 = onSnapshot(q1, (snapshot) => {
    const uplineRewards = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      source: "uplineRewards", // Mark source for debugging
    }));

    // Listen to override collection (5% from capital share entries)
    const q2 = query(
      collection(db, "override"),
      where("uplineId", "==", user.uid)
    );

    const unsubscribe2 = onSnapshot(q2, (snapshot2) => {
      const overrideRewards = snapshot2.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        source: "override", // Mark source for debugging
      }));

      // Combine both reward types
      const allRewards = [...uplineRewards, ...overrideRewards];
      setOverrideList(allRewards);
    });

    return () => unsubscribe2();
  });

  return () => unsubscribe1();
}, [user]);


// Calculate upline reward earnings and send notification if claimable
const overrideNotifiedRef = useRef(false);
useEffect(() => {
  const now = new Date();
  
  // Calculate TOTAL from ALL rewards (for marketing purposes - show total earned, even if claimed)
  const total = overrideList.reduce((sum, reward) => {
    return sum + (Number(reward.amount) || 0);
  }, 0);
  
  setOverrideEarnings(total);

  // Notify if there are claimable rewards (dueDate/releaseDate passed and not claimed)
  let claimableTotal = 0;
  const hasClaimable = overrideList.some(reward => {
    let dueDate = reward.dueDate || reward.releaseDate;
    if (dueDate) {
      if (typeof dueDate === "object" && dueDate.seconds) {
        dueDate = new Date(dueDate.seconds * 1000);
      } else if (typeof dueDate === "string" || typeof dueDate === "number") {
        dueDate = new Date(dueDate);
      }
    }
    
    const isDue = dueDate && dueDate <= now;
    const isClaimed = reward.claimed || reward.status === "Credited";
    
    if (isDue && !isClaimed) {
      claimableTotal += Number(reward.amount) || 0;
      return true;
    }
    return false;
  });
  
  if (hasClaimable && !overrideNotifiedRef.current && user) {
    sendOverrideTransferAvailableNotification(user.uid);
    overrideNotifiedRef.current = true;
  }
  if (!hasClaimable) {
    overrideNotifiedRef.current = false;
  }
}, [overrideList, user]);

  useEffect(() => {
    if (!user) return;

    // Query ALL rewards (both approved and pending approval)
    // to include System Bonus and other pending reward types
    const q = query(
      collection(db, "referralReward"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const allRewards = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      
      // Filter to show:
      // 1. All payoutReleased=true rewards (regardless of transferred status)
      // 2. All approved=true rewards (including pending payoutReleased)
      // 3. All System Bonus type rewards (even if not approved yet)
      const displayRewards = allRewards.filter(r => 
        r.payoutReleased === true || 
        r.approved === true || 
        r.type === "System Bonus"
      );
      
      // Filter out transferred rewards for the dialog (show only pending transfers)
      const pendingRewards = displayRewards.filter(r => !r.transferredAmount);
      setRewardHistory(pendingRewards);
      
      // Calculate total from ALL released rewards (including transferred ones)
      const total = allRewards.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      setTotalEarnings(total);

      // Notify if there are available rewards to transfer and not already notified in this session
      const hasAvailable = pendingRewards.some(r => r.payoutReleased && !r.transferredAmount);
      if (hasAvailable && !notifiedRef.current) {
        await sendReferralTransferAvailableNotification(user.uid);
        notifiedRef.current = true;
      }
      if (!hasAvailable) {
        notifiedRef.current = false;
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔹 Check if we should open deposit dialog (from deposit-cancel page)
  useEffect(() => {
    if (location.state?.openDepositDialog) {
      setOpenDepositDialog(true);
      // Clear the state to prevent opening dialog on subsequent visits
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

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
        <Topbar
          open={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          openDepositDialog={openDepositDialog}
          onDepositDialogChange={setOpenDepositDialog}
          dialogProps={{
            onReferralTransferClick: () => setRewardDialogOpen(true),
            onOverrideTransferClick: () => setOverrideDialogOpen(true),
          }}
        />
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
          // Hide scrollbar while keeping scroll functionality
          scrollbarWidth: 'none', // Firefox
          '-ms-overflow-style': 'none', // IE and Edge
          '&::-webkit-scrollbar': {
            display: 'none', // Chrome, Safari, Opera
          },
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
                    <Badge
                      color="warning"
                      variant="dot"
                      overlap="circular"
                      invisible={!rewardHistory.some(r => r.payoutReleased && !r.transferredAmount)}
                      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                      <VisibilityIcon sx={{ color: "#81C784" }} />
                    </Badge>
                  </IconButton>
                ),
                subtitle: "Total earned from your referrals"
              }, {
                label: "Override Earnings",
                value: `₱${Number(displayOverride).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                color: "#64B5F6",
                icon: (
                  <IconButton onClick={() => setOverrideDialogOpen(true)} color="inherit" size="small">
                    <Badge
                      color="warning"
                      variant="dot"
                      overlap="circular"
                      invisible={!overrideList.some(reward => {
                        const dueDate = reward.dueDate
                          ? (typeof reward.dueDate === "object" && reward.dueDate.seconds
                              ? new Date(reward.dueDate.seconds * 1000)
                              : new Date(reward.dueDate))
                          : null;
                        const isDue = dueDate && new Date() >= dueDate;
                        const isClaimed = reward.claimed || reward.status === "Credited";
                        return isDue && !isClaimed;
                      })}
                      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                      <VisibilityIcon sx={{ color: "#64B5F6" }} />
                    </Badge>
                  </IconButton>
                ),
                subtitle: "Upline rewards (after 30-day maturation)"
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
    <RewardHistoryDialog
      open={rewardDialogOpen}
      onClose={() => setRewardDialogOpen(false)}
      rewardHistory={rewardHistory}
      user={user}
      loadingTransfer={loadingTransfer}
      setLoadingTransfer={setLoadingTransfer}
      onTransferSuccess={() => {
        // Reward data will auto-refresh via the Firestore listener
        // Optionally add a small delay to ensure Firestore update completes
        setTimeout(() => {
          console.log("[Dashboard] Reward transfer successful, data will refresh from Firestore");
        }, 500);
      }}
    />


    {/* 🧾 Override Upline Rewards Dialog */}
    <OverrideUplineRewardsDialog
      open={overrideDialogOpen}
      onClose={() => setOverrideDialogOpen(false)}
      overrideList={overrideList}
      user={user}
      loadingTransfer={loadingTransfer}
      setLoadingTransfer={setLoadingTransfer}
    />

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