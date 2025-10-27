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

  const [referrals, setReferrals] = useState([]); // list for dialog
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔹 Real-time listener for referral counts
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

  // 🔹 Fetch current user info
  const fetchUserData = useCallback(
    async (uid) => {
      try {
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);
          const unsubscribe = listenToReferrals(data.username);
          return unsubscribe;
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    },
    [listenToReferrals]
  );

  // 🔹 Track authentication state
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

  // 🔹 Handle “View” click — fetch referrals for that role
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

  // 🔹 Filter + sort referrals
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

  // 🔹 Toggle sort order
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
                      width:"350px",
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
      </Box>

      {/* 👁 Referrals Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {selectedRole} Referrals
        </DialogTitle>
        <DialogContent dividers>
          {/* 🔍 Search and Sort Controls */}
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
    </Box>
  );
};

export default MemberDashboard;