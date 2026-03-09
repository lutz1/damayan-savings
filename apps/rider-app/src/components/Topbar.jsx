import React from "react";
import { AppBar, Toolbar, Box, IconButton } from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";

const Topbar = ({ open, onToggleSidebar }) => {
  return (
    <AppBar
      position="fixed"
      sx={{
        width: "100%",
        zIndex: 1201,
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          onClick={onToggleSidebar}
          sx={{ display: { xs: "block", md: "none" } }}
        >
          <MenuIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }} />
      </Toolbar>
    </AppBar>
  );
};

export default Topbar;
