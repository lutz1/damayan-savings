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
  Store as StoreIcon,
  FileDownload as WithdrawIcon,
  CompareArrows as WalletTransferIcon,
  Business as MerchantIcon,
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
      { label: "Merchants", value: "/admin/merchant-management", icon: <MerchantIcon /> },
      { label: "Transfers", value: "/admin/transfer-transactions", icon: <SwapHorizIcon /> },
      { label: "Withdrawals", value: "/admin/withdrawals", icon: <WithdrawIcon /> },
      { label: "W2W", value: "/admin/wallet-to-wallet", icon: <WalletTransferIcon /> },
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
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 8px 32px rgba(31, 38, 135, 0.25)",
        }}
      >
        <BottomNavigation
          showLabels
          value={location.pathname}
          onChange={(_, value) => handleNavigate(value)}
          sx={{
            height: "100%",
            backgroundColor: "transparent",
            "& .MuiBottomNavigationAction-root": {
              minWidth: 70,
              paddingTop: 5,
              paddingBottom: 8,
              color: "rgba(255,255,255,0.8)",
            },
            "& .MuiBottomNavigationAction-root.Mui-selected": {
              color: "#ffffff",
            },
            "& .MuiBottomNavigationAction-label": {
              fontSize: "0.75rem",
              transition: "color 0.2s ease, opacity 0.2s ease",
            },
            "& .MuiBottomNavigationAction-root.Mui-selected .MuiBottomNavigationAction-label": {
              fontWeight: 600,
              letterSpacing: 0.2,
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