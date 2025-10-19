import React, { useEffect, useState, useCallback } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
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
  ); // ✅ Cache check
  const [codes, setCodes] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(!isActive); // ✅ Skip spinner if already active
  const [overrideIncome, setOverrideIncome] = useState(0);

  // ✅ Fetch Firestore user data + available codes
  const fetchData = useCallback(
    async (currentUser) => {
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);

          // Sync active state if changed
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
    [isActive] // ✅ add only stable dependency
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

  // ✅ Compute 5% profit + override income
  useEffect(() => {
    if (isActive && userData?.capitalAmount) {
      const monthlyProfit = userData.capitalAmount * 0.05;
      setOverrideIncome(monthlyProfit);
    }
  }, [isActive, userData]);

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
      localStorage.setItem("capitalShareActive", "true"); // ✅ save cache
      setOpenDialog(false);
      alert("✅ Capital Share successfully activated!");
    } catch (error) {
      console.error("Activation failed:", error);
      alert("Activation failed. Please try again.");
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

        <Card
          sx={{
            mt: 4,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 3,
            p: 3,
          }}
        >
          <Typography variant="h6">Override Income (Genealogy Tree)</Typography>
          <Typography variant="h4" sx={{ color: "#fff", mt: 1 }}>
            ₱{Number(overrideIncome || 0).toLocaleString()}
          </Typography>
        </Card>

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