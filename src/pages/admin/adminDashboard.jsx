/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import { db } from "../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { motion } from "framer-motion";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userCounts, setUserCounts] = useState({
    MD: 0,
    MS: 0,
    MI: 0,
    Agent: 0,
  });
  const [salesData, setSalesData] = useState([]);

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔹 Real-time Firestore listeners
  useEffect(() => {
    const unsubscribers = [];

    // 🧮 1. Count users by role (MD, MS, MI, Agent)
    const roles = ["MD", "MS", "MI", "Agent"];
    roles.forEach((role) => {
      const q = query(collection(db, "users"), where("role", "==", role));
      const unsub = onSnapshot(q, (snapshot) => {
        setUserCounts((prev) => ({
          ...prev,
          [role]: snapshot.size,
        }));
      });
      unsubscribers.push(unsub);
    });

    // 💰 2. Real-time Total Sales (sum of all sales amounts)
    const salesQuery = query(collection(db, "sales"));
    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      const sales = snapshot.docs.map((doc) => doc.data());
      setSalesData(sales);
    });
    unsubscribers.push(unsubSales);

    // 🧹 Cleanup all listeners
    return () => unsubscribers.forEach((u) => u());
  }, []);

  // 💰 Total Sales Calculation
  const totalSales = useMemo(
    () =>
      salesData.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
    [salesData]
  );

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
          backgroundColor: "rgba(0, 0, 0, 0.1)",
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
          📊 Admin Dashboard Overview
        </Typography>

        {/* 🧱 Stats Cards */}
        <Grid container spacing={2}>
          {[
            { label: "Marketing Director (MD)", value: userCounts.MD },
            { label: "Marketing Supervisor (MS)", value: userCounts.MS },
            { label: "Marketing Incharge (MI)", value: userCounts.MI },
            { label: "Agents", value: userCounts.Agent },
          ].map((item, index) => (
            <Grid item xs={12} sm={6} md={2.4} key={index}>
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
                    width: "160px",
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
      </Box>
    </Box>
  );
};

export default AdminDashboard;