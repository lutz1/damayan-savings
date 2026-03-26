import React from "react";
import { IconButton } from "@mui/material";
import { useMediaQuery } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

const AdminSidebarToggle = ({ onClick, sx }) => {
  const isMobile = useMediaQuery("(max-width:900px)");
  const normalizedRole = String(localStorage.getItem("userRole") || "")
    .trim()
    .toUpperCase();

  if (isMobile && ["ADMIN", "CEO", "SUPERADMIN"].includes(normalizedRole)) {
    return null;
  }

  return (
    <IconButton
      aria-label="Open navigation"
      onClick={onClick}
      sx={{
        position: "fixed",
        top: 80,
        left: 12,
        zIndex: 1202,
        color: "#191c1e",
        backgroundColor: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(0,0,0,0.12)",
        "&:hover": { backgroundColor: "rgba(255,255,255,1)" },
        ...sx,
      }}
    >
      <MenuIcon />
    </IconButton>
  );
};

export default AdminSidebarToggle;
