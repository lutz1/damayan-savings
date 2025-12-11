import React from "react";
import { Box } from "@mui/material";
import BottomNav from "./BottomNav";
import AppHeader from "./AppHeader";

const MobileAppShell = ({ title, children }) => {
  return (
    <Box
      sx={{
        height: "100dvh", // ✅ modern mobile height
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0f172a",
        color: "white",
        overflow: "hidden",
      }}
    >
      {/* ✅ Top App Header */}
      <AppHeader title={title} />

      {/* ✅ App Content */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 2,
          pt: 2,
          pb: 10, // space for bottom nav
        }}
      >
        {children}
      </Box>

      {/* ✅ Bottom Navigation */}
      <BottomNav />
    </Box>
  );
};

export default MobileAppShell;