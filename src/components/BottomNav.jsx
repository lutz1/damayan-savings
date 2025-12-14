// src/components/BottomNav.jsx
import React from "react";
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from "@mui/material";
import {
  Dashboard,
  Storefront,
  AddBox,
  AccountCircle,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Paper
  elevation={10}
  sx={{
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    height: 80, // increase the overall height
    zIndex: 1000, // ensure it stays on top of content
  }}
>
  <BottomNavigation
    showLabels
    value={location.pathname}
    onChange={(_, value) => navigate(value)}
    sx={{
      height: "100%", // make navigation fill the Paper
      "& .MuiBottomNavigationAction-root": {
        minWidth: 70,
        paddingTop: 5,
        paddingBottom: 8,
      },
      "& .MuiBottomNavigationAction-label": {
        fontSize: "0.85rem",
      },
    }}
  >
    <BottomNavigationAction
      label="Dashboard"
      value="/merchant/dashboard"
      icon={<Dashboard />}
    />

    <BottomNavigationAction
      label="Products"
      value="/merchant/products"
      icon={<Storefront />}
    />

    <BottomNavigationAction
      label="Add +"
      value="/merchant/add-product"
      icon={<AddBox />}
    />

    <BottomNavigationAction
      label="Account"
      value="/merchant/profile"
      icon={<AccountCircle />}
    />
  </BottomNavigation>
</Paper>
  );
};

export default BottomNav;