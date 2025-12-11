import React from "react";
import { AppBar, Toolbar, Typography } from "@mui/material";

const AppHeader = ({ title }) => {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: "rgba(15,23,42,0.9)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Toolbar>
        <Typography fontWeight={700}>{title}</Typography>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;