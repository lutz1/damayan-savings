// src/components/AppBottomNav.jsx
import React from "react";
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Dashboard as DashboardIcon,
  AccountCircle as AccountCircleIcon,
  MonetizationOn as MonetizationOnIcon,
  Savings as SavingsIcon,
  PieChart as PieChartIcon,
  SwapHoriz as SwapHorizIcon,
  LocalMall as LocalMallIcon,
  Coffee as CoffeeIcon,
  Store as StoreIcon
} from "@mui/icons-material";

const AppBottomNav = ({ open, onToggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const role = localStorage.getItem("userRole");
  const upperRole = role?.toUpperCase();

  // Navigation items based on role
  let navItems = [];
  
  if (["ADMIN", "CEO"].includes(upperRole)) {
    navItems = [
      { label: "Dashboard", value: "/admin/dashboard", icon: <DashboardIcon /> },
      { label: "Codes", value: "/admin/generate-codes", icon: <MonetizationOnIcon /> },
      { label: "Users", value: "/admin/user-management", icon: <PieChartIcon /> },
      { label: "Transfers", value: "/admin/transfer-transactions", icon: <SwapHorizIcon /> },
      { label: "Account", value: "/admin/profile", icon: <AccountCircleIcon /> },
    ];
  } else if (upperRole === "MERCHANT") {
    navItems = [
      { label: "Dashboard", value: "/merchant/dashboard", icon: <DashboardIcon /> },
      { label: "Add Product", value: "/merchant/add-product", icon: <CoffeeIcon /> },
      { label: "Products", value: "/merchant/manage-products", icon: <StoreIcon /> },
      { label: "Account", value: "/merchant/profile", icon: <AccountCircleIcon /> },
    ];
  } else {
    navItems = [
      { label: "Dashboard", value: "/member/dashboard", icon: <DashboardIcon /> },
      { label: "Payback", value: "/member/income/payback", icon: <SavingsIcon /> },
      { label: "Capital", value: "/member/income/capital-share", icon: <PieChartIcon /> },
      { label: "Shop", value: "/shop", icon: <LocalMallIcon /> },
      { label: "Account", value: "/member/profile", icon: <AccountCircleIcon /> },
    ];
  }

  
  const handleNavigate = (value) => {
    if (value) {
      navigate(value);
    }
  };

  return (
    <>
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
          height: 80,
          zIndex: 1000,
        }}
      >
        <BottomNavigation
          showLabels
          value={location.pathname}
          onChange={(_, value) => handleNavigate(value)}
          sx={{
            height: "100%",
            "& .MuiBottomNavigationAction-root": {
              minWidth: 70,
              paddingTop: 5,
              paddingBottom: 8,
            },
            "& .MuiBottomNavigationAction-label": {
              fontSize: "0.75rem",
            },
          }}
        >
          {navItems.map((item) => (
            <BottomNavigationAction
              key={item.value}
              label={item.label}
              value={item.value}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </>
  );
};

export default AppBottomNav;