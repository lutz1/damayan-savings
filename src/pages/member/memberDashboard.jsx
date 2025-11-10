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
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import { motion } from "framer-motion";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";

const MemberDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  const [totalContribution, setTotalContribution] = useState(0);
  const [totalCapitalShare, setTotalCapitalShare] = useState(0);

  // 💸 Referral Rewards
const [totalEarnings, setTotalEarnings] = useState(0);
const [rewardHistory, setRewardHistory] = useState([]);
const [rewardDialogOpen, setRewardDialogOpen] = useState(false);

// 💰 Override Earnings
const [overrideEarnings, setOverrideEarnings] = useState(0);
const [overrideList, setOverrideList] = useState([]);
const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

const handleTransferToWallet = async (amount, type) => {
  if (!user) return;
  if (!amount || amount <= 0) return alert("No funds to transfer.");

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return alert("User not found.");

    const currentBalance = userSnap.data().eWallet || 0;
    await updateDoc(userRef, {
      eWallet: currentBalance + amount,
    });

    // ✅ Update relevant reward documents as transferred
    if (type === "referral") {
      const batchPromises = rewardHistory
        .filter((r) => r.payoutReleased) // Only unreleased or approved
        .map((r) =>
          updateDoc(doc(db, "referralReward", r.id), { payoutReleased: true })
        );
      await Promise.all(batchPromises);
    } else if (type === "override") {
      const batchPromises = overrideList
        .filter((o) => o.status !== "Credited") // Only pending
        .map((o) =>
          updateDoc(doc(db, "override", o.id), { status: "Credited" })
        );
      await Promise.all(batchPromises);
    }

    alert(`₱${amount.toLocaleString()} transferred to eWallet!`);

  } catch (err) {
    console.error("Error transferring funds:", err);
    alert("Failed to transfer funds.");
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
    // ✅ Payback entries from main collection (not subcollection)
    const paybackRef = collection(db, "paybackEntries");
    const paybackQuery = query(
      paybackRef,
      where("userId", "==", uid),
      where("status", "==", "Approved")
    );
    const paybackSnap = await getDocs(paybackQuery);

    const totalPayback = paybackSnap.docs.reduce(
      (acc, doc) => acc + (Number(doc.data().amount) || 0),
      0
    );
    setTotalContribution(totalPayback);

    // ✅ Capital Share from capitalShares collection
    const capitalRef = collection(db, "capitalShares");
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
          backgroundColor: "rgba(0, 0, 0, 0.2)",
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
            <Grid item xs={12} sm={6} md={4}>
              <Card
                sx={{
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(10px)",
                  width: "350px",
                  color: "#fff",
                  borderRadius: 3,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Payback Total Contribution
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: "bold", color: "#81C784", mt: 1 }}
                  >
                    ₱{totalContribution.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Card
                sx={{
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(10px)",
                  width: "350px",
                  color: "#fff",
                  borderRadius: 3,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Total Capital Share
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: "bold", color: "#FFD54F", mt: 1 }}
                  >
                    ₱{totalCapitalShare.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

{/* 💸 Earnings Card */}
<Grid item xs={12} sm={6} md={4}>
  <Card
    sx={{
      background: "rgba(255,255,255,0.1)",
      backdropFilter: "blur(10px)",
      width: "350px",
      color: "#fff",
      borderRadius: 3,
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      position: "relative",
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
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Referral Earnings
        </Typography>
        <IconButton
          onClick={() => setRewardDialogOpen(true)}
          color="inherit"
          size="small"
        >
          <VisibilityIcon sx={{ color: "#81C784" }} />
        </IconButton>
      </Box>
      <Typography
        variant="h4"
        sx={{ fontWeight: "bold", color: "#81C784", mt: 1 }}
      >
        ₱{totalEarnings.toLocaleString()}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
        Total earned from your referrals
      </Typography>

        <Button
  variant="contained"
  color="success"
  size="small"
  sx={{ mt: 1 }}
  onClick={() => handleTransferToWallet(totalEarnings, "referral")}
  disabled={totalEarnings <= 0}
>
  Transfer to eWallet
</Button>

    </CardContent>
  </Card>
</Grid>

{/* 💼 Override Earnings Card */}
<Grid item xs={12} sm={6} md={4}>
  <Card
    sx={{
      background: "rgba(255,255,255,0.1)",
      backdropFilter: "blur(10px)",
      width: "350px",
      color: "#fff",
      borderRadius: 3,
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      position: "relative",
    }}
  >
    <CardContent>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Override Earnings
        </Typography>
        <IconButton onClick={() => setOverrideDialogOpen(true)} color="inherit" size="small">
          <VisibilityIcon sx={{ color: "#64B5F6" }} />
        </IconButton>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: "bold", color: "#64B5F6", mt: 1 }}>
        ₱{overrideEarnings.toLocaleString()}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
        Credited rewards (after expiration date)
      </Typography>

  <Button
  variant="contained"
  color="primary"
  size="small"
  sx={{ mt: 1 }}
  onClick={() => handleTransferToWallet(overrideEarnings, "override")}
  disabled={overrideEarnings <= 0}
>
  Transfer to eWallet
</Button>

    </CardContent>
  </Card>
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

              <Grid container spacing={3}>
                {["MD", "MS", "MI", "Agent"].map((role) => (
                  <Grid item xs={12} sm={6} md={3} key={role}>
                    <Card
                      sx={{
                        width: "350px",
                        background: "rgba(255,255,255,0.1)",
                        backdropFilter: "blur(10px)",
                        color: "#fff",
                        borderRadius: 3,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                        position: "relative",
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
      .map((reward) => (
        <ListItem key={reward.id} divider>
          <ListItemText
            primary={`₱${reward.amount.toLocaleString()} earned`}
            secondary={`From: ${reward.source} | ${new Date(
            (reward.releasedAt?.seconds || 0) * 1000
          ).toLocaleString()}`}
          />
        </ListItem>
      ))}
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
      return (
        <ListItem key={o.id} divider>
          <ListItemText
            primary={`₱${o.amount.toLocaleString()} — ${
              credited ? "Credited" : "Pending"
            }`}
            secondary={`From: ${o.source || "N/A"} | Expiration: ${
              o.expirationDate
                ? new Date(o.expirationDate).toLocaleDateString()
                : "N/A"
            }`}
          />
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

    </Box>
  );
};

export default MemberDashboard;