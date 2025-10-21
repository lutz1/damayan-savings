import React, { useState, useEffect } from "react";
import {
  Box,
  Toolbar,
  Typography,
  useMediaQuery,
  Card,
  CardContent,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion } from "framer-motion";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";

const MemberDashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          zIndex: 0,
        },
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
          p: { xs: 2, sm: 3, md: 0 },
          mt: 0,
          color: "white",
          zIndex: 1,
          position: "relative",
          width: isMobile ? "100%" : `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          textAlign: "center",
        }}
      >
        <Toolbar />

        {/* 🌈 Animated Glow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, scale: [1, 1.1, 1] }}
          transition={{ duration: 6, repeat: Infinity, repeatType: "mirror" }}
          style={{
            position: "absolute",
            width: isMobile ? 250 : 400,
            height: isMobile ? 250 : 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at center, rgba(63,81,181,0.6), transparent 70%)",
            filter: "blur(80px)",
            top: "45%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 0,
          }}
        />

        {/* 💎 Animated Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ zIndex: 2, width: "100%", maxWidth: 520 }}
        >
          <Card
            sx={{
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(12px)",
              borderRadius: 4,
              p: { xs: 3, sm: 4, md: 5 },
              boxShadow: "0 0 25px rgba(0,0,0,0.3)",
            }}
          >
            <CardContent>
              {/* Floating animation */}
              <motion.div
                initial={{ y: 0 }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Typography
                  variant="h4"
                  fontWeight={800}
                  sx={{
                    background:
                      "linear-gradient(90deg, #42a5f5, #66bb6a, #ab47bc)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    mb: 2,
                    fontSize: { xs: "1.6rem", sm: "2rem", md: "2.3rem" },
                  }}
                >
                  Dashboard Coming Soon
                </Typography>
              </motion.div>

              <Typography
                variant="body1"
                sx={{
                  opacity: 0.9,
                  mb: 2,
                  px: { xs: 1, sm: 3 },
                  fontSize: { xs: "0.85rem", sm: "1rem" },
                }}
              >
                Exciting new tools and analytics are on the way to help you
                monitor your growth, earnings, and performance effortlessly.
              </Typography>

              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{
                    color: "info.light",
                    fontSize: { xs: "0.9rem", sm: "1rem" },
                  }}
                >
                  Stay tuned for updates 🚀
                </Typography>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </Box>
    </Box>
  );
};

export default MemberDashboard;