/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
} from "@mui/material";
import { motion } from "framer-motion";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../../firebase";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";

const MemberDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [downlines, setDownlines] = useState({
    MD: 0,
    MS: 0,
    MI: 0,
    Agent: 0,
  });

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔹 Track current user & fetch username
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUsername(data.username || "");
            console.log("Logged in user:", data.username);
          }
        } catch (err) {
          console.error("Error fetching user document:", err);
        }
      } else {
        setUser(null);
        setUsername("");
      }
    });

    return () => unsubAuth();
  }, []);

  // 🔹 Fetch downline counts safely
  useEffect(() => {
    if (!username) return;

    setLoading(true);
    const roles = ["MD", "MS", "MI", "Agent"];
    const unsubscribers = [];

    roles.forEach((role) => {
      const q = query(
        collection(db, "users"),
        where("referredBy", "==", username),
        where("role", "==", role)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          setDownlines((prev) => ({
            ...prev,
            [role]: snapshot.size,
          }));
        },
        (err) => {
          console.error("Firestore snapshot error:", err);
        }
      );

      unsubscribers.push(unsub);
    });

    setLoading(false);

    return () => unsubscribers.forEach((u) => u());
  }, [username]);

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
          backgroundColor: "rgba(0, 0, 0, 0.3)",
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
          👥 My Downline Overview
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
        ) : (
          <Grid container spacing={2}>
            {[
              { label: "Downline MD", value: downlines.MD },
              { label: "Downline MS", value: downlines.MS },
              { label: "Downline MI", value: downlines.MI },
              { label: "Downline Agents", value: downlines.Agent },
            ].map((item, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card
                    sx={{
                      background:
                        "linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))",
                      backdropFilter: "blur(12px)",
                      color: "white",
                      borderRadius: "18px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                      transition: "transform 0.3s ease, box-shadow 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-5px)",
                        boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
                      },
                    }}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ opacity: 0.8 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>
                        {item.value}
                      </Typography>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
};

export default MemberDashboard;