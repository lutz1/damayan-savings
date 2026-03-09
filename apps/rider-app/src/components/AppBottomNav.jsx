import React from "react";
import { Paper, Box } from "@mui/material";

const AppBottomNav = ({ open, onToggleSidebar }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: "1px solid",
        borderColor: "#e5e7eb",
        bgcolor: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(10px)",
        height: 76,
        zIndex: 1000,
        display: { xs: "flex", md: "none" },
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box sx={{ fontSize: "0.75rem", color: "#666" }}>
        Rider App Navigation
      </Box>
    </Paper>
  );
};

export default AppBottomNav;
