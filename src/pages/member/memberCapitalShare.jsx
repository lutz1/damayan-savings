import React, { useEffect, useState, useCallback } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Backdrop,
  Grid,
  Toolbar,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { onAuthStateChanged } from "firebase/auth";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";

const MemberCapitalShare = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isActive, setIsActive] = useState(
    localStorage.getItem("capitalShareActive") === "true"
  );
  const [codes, setCodes] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(!isActive);

  // Calendar and Add Entry Dialog states
  const [selectedDate, setSelectedDate] = useState(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [amount, setAmount] = useState("");
  const [directUser, setDirectUser] = useState("");

  // ✅ Fetch Firestore user data + available codes
  const fetchData = useCallback(
    async (currentUser) => {
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);

          if (data.capitalShareActive) {
            setIsActive(true);
            localStorage.setItem("capitalShareActive", "true");
          } else {
            setIsActive(false);
            localStorage.removeItem("capitalShareActive");
          }
        }

        // Fetch activation codes only if not active
        if (!isActive) {
          const codesRef = collection(db, "purchaseCodes");
          const q = query(
            codesRef,
            where("userId", "==", currentUser.uid),
            where("used", "==", false),
            where("type", "==", "Activate Capital Share")
          );
          const querySnap = await getDocs(q);
          const codeList = querySnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setCodes(codeList);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [isActive]
  );

  // ✅ Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchData(currentUser);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [fetchData]);

  // ✅ Activation logic
  const handleActivate = async () => {
    if (!selectedCode) return alert("Please select a code to activate Capital Share.");

    try {
      setLoading(true);
      const codeRef = doc(db, "purchaseCodes", selectedCode);
      await updateDoc(codeRef, { used: true, usedAt: serverTimestamp() });

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        capitalShareActive: true,
        capitalActivatedAt: serverTimestamp(),
      });

      setIsActive(true);
      localStorage.setItem("capitalShareActive", "true");
      setOpenDialog(false);
      alert("✅ Capital Share successfully activated!");
    } catch (error) {
      console.error("Activation failed:", error);
      alert("Activation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle calendar date click
  const handleDateClick = (date) => {
    if (!isActive) {
      alert("Please activate your Capital Share first.");
      return;
    }
    setSelectedDate(date);
    setOpenAddDialog(true);
  };

  // ✅ Handle Add Entry Submit
  const handleAddEntry = async () => {
    if (!amount || Number(amount) < 1000) {
      alert("Minimum capital share amount is ₱1,000.");
      return;
    }

    try {
      setLoading(true);
      const entryRef = collection(db, "capitalShareEntries");
      await addDoc(entryRef, {
        userId: user.uid,
        amount: Number(amount),
        date: selectedDate,
        directUsernameOrEmail: directUser || "",
        directBonus: directUser ? Number(amount) * 0.0033 : 0,
        profit: 0,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      alert("✅ Capital Share entry added successfully!");
      setAmount("");
      setDirectUser("");
      setOpenAddDialog(false);
    } catch (error) {
      console.error("Error adding capital share:", error);
      alert("Failed to add capital share entry.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Backdrop open>
        <CircularProgress color="inherit" />
      </Backdrop>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* ✅ Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* ✅ Sidebar */}
      <Box
        sx={{
          zIndex: 5,
          position: isMobile ? "fixed" : "relative",
          height: "100%",
          transition: "all 0.3s ease",
        }}
      >
        <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* ✅ Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 4 },
          mt: 8,
          color: "white",
          overflowY: "auto",
          position: "relative",
          width: isMobile ? "100%" : `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
        }}
      >
        <Toolbar />

        <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700} gutterBottom>
          Member Capital Share
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: "rgba(33,150,243,0.12)", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6">Capital Amount</Typography>
                <Typography variant="h4" sx={{ color: "#fff" }}>
                  ₱{Number(userData?.capitalAmount || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: "rgba(76,175,80,0.12)", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6">Monthly Profit (5%)</Typography>
                <Typography variant="h4" sx={{ color: "#fff" }}>
                  ₱{Number(userData?.capitalAmount * 0.05 || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* ✅ Calendar */}
        <Card
          sx={{
            mt: 4,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 3,
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            📅 Capital Share Calendar
          </Typography>
          <Calendar
            onClickDay={handleDateClick}
            tileDisabled={({ date }) => date > new Date()}
          />
        </Card>

        {/* ✅ Add Capital Share Dialog */}
        <Dialog
          open={openAddDialog}
          onClose={() => setOpenAddDialog(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Add Capital Share Entry</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Selected Date: <strong>{selectedDate?.toDateString()}</strong>
            </Typography>
            <TextField
              label="Amount (₱)"
              type="number"
              fullWidth
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              sx={{ mb: 2 }}
              inputProps={{ min: 1000 }}
            />
            <TextField
              label="Direct Username or Email (Optional)"
              fullWidth
              value={directUser}
              onChange={(e) => setDirectUser(e.target.value)}
              sx={{ mb: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddEntry} variant="contained">
              Submit
            </Button>
          </DialogActions>
        </Dialog>

        {/* ✅ Activation Overlay */}
        {!isActive && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9,
            }}
          >
            <Card sx={{ p: 4, width: 400, textAlign: "center" }}>
              <Typography variant="h6" gutterBottom>
                🧩 Capital Share Not Activated
              </Typography>
              {codes.length > 0 ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    You have available <strong>Activate Capital Share</strong> codes.
                  </Typography>
                  <Button
                    sx={{ mt: 2 }}
                    variant="contained"
                    color="primary"
                    onClick={() => setOpenDialog(true)}
                  >
                    Activate Now
                  </Button>
                </>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary">
                    You don’t have an activation code yet.
                  </Typography>
                  <Button
                    sx={{ mt: 2 }}
                    variant="contained"
                    color="secondary"
                    onClick={() =>
                      alert("Please purchase an 'Activate Capital Share' code first.")
                    }
                  >
                    Purchase Code
                  </Button>
                </>
              )}
            </Card>
          </Box>
        )}

        {/* ✅ Activation Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="xs">
          <DialogTitle>Activate Capital Share</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Select one of your available <strong>Activate Capital Share</strong> codes:
            </Typography>
            <TextField
              select
              fullWidth
              SelectProps={{ native: true }}
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
            >
              <option value="">-- Select Code --</option>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleActivate} variant="contained">
              Activate
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default MemberCapitalShare;