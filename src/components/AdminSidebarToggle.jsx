import React from "react";
import { IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

const AdminSidebarToggle = ({ onClick, sx }) => {
  return (
    <IconButton
      aria-label="Open navigation"
      onClick={onClick}
      sx={{
        position: "fixed",
        top: 80,
        left: 12,
        zIndex: 1202,
        color: "#fff",
        backgroundColor: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.2)",
        "&:hover": { backgroundColor: "rgba(0,0,0,0.5)" },
        ...sx,
      }}
    >
      <MenuIcon />
    </IconButton>
  );
};

export default AdminSidebarToggle;
