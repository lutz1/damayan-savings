// src/pages/MemberDashboard.jsx
import React, { useState } from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";

const MemberDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", position: "relative" }}>
      {/* Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Sidebar */}
      <Box sx={{ zIndex: 5 }}>
        <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
          mt: 0,
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
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
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            zIndex: 0,
          },
          color: "white",
          textAlign: "center",
          p: 3,
        }}
      >
        <Box sx={{ zIndex: 1 }}>
          <Typography variant="h3" sx={{ mb: 2, fontWeight: "bold" }}>
            🚧 Dashboard Under Maintenance
          </Typography>
          <Typography variant="h6" sx={{ mb: 4 }}>
            We are currently performing updates. Please check back later.
          </Typography>
          <CircularProgress color="inherit" />
        </Box>
      </Box>
    </Box>
  );
};

export default MemberDashboard;