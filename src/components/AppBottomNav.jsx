// src/components/AppBottomNav.jsx
import React, { useState } from "react";
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Menu,
  MenuItem,
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
  Category as CategoryIcon,
  Receipt as TransactionIcon,
  AccountBalance as DepositsIcon,
} from "@mui/icons-material";

const AppBottomNav = ({ open, onToggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [merchantMenuAnchor, setMerchantMenuAnchor] = useState(null);
  const [transactionMenuAnchor, setTransactionMenuAnchor] = useState(null);

  const role = localStorage.getItem("userRole");
  const upperRole = role?.toUpperCase();

  // Navigation items based on role
  let navItems = [];
  
  if (["ADMIN", "CEO"].includes(upperRole)) {
    navItems = [
      { label: "Dashboard", value: "/admin/dashboard", icon: <DashboardIcon /> },
      { label: "Codes", value: "/admin/generate-codes", icon: <MonetizationOnIcon /> },
      { label: "Users", value: "/admin/user-management", icon: <PieChartIcon /> },
      { label: "Merchants", value: "merchants-menu", icon: <MerchantIcon />, isMenu: true },
      { label: "Transactions", value: "transactions-menu", icon: <TransactionIcon />, isMenu: true },
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

  const handleNavigate = (value, isMenu) => {
    if (!value) return;
    
    if (isMenu && value === "merchants-menu") {
      // Open the merchants submenu - find the button element
      const merchantsButton = document.querySelector('[data-merchants-menu]');
      setMerchantMenuAnchor(merchantsButton);
    } else if (isMenu && value === "transactions-menu") {
      // Open the transactions submenu - find the button element
      const transactionsButton = document.querySelector('[data-transactions-menu]');
      setTransactionMenuAnchor(transactionsButton);
    } else {
      navigate(value);
    }
  };

  const handleMerchantMenuItemClick = (path) => {
    navigate(path);
    setMerchantMenuAnchor(null);
  };

  const handleTransactionMenuItemClick = (path) => {
    navigate(path);
    setTransactionMenuAnchor(null);
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
          value={
            // For merchants menu, use the current pathname if it's one of the merchant paths
            merchantMenuAnchor && location.pathname.includes("merchant")
              ? location.pathname
              : merchantMenuAnchor && location.pathname.includes("categories")
              ? location.pathname
              : location.pathname
          }
          onChange={(_, value) => handleNavigate(value, navItems.find((item) => item.value === value)?.isMenu)}
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
              data-merchants-menu={item.isMenu && item.value === "merchants-menu" ? "true" : undefined}
              data-transactions-menu={item.isMenu && item.value === "transactions-menu" ? "true" : undefined}
            />
          ))}
        </BottomNavigation>
      </Paper>

      {/* Merchants Submenu */}
      <Menu
        anchorEl={merchantMenuAnchor}
        open={Boolean(merchantMenuAnchor)}
        onClose={() => setMerchantMenuAnchor(null)}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        PaperProps={{
          sx: {
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
            borderRadius: 2,
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 8px 32px rgba(31, 38, 135, 0.25)",
            mt: 1,
          },
        }}
      >
        <MenuItem
          onClick={() => handleMerchantMenuItemClick("/admin/merchant-management")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            py: 1.5,
            px: 2,
            "&:hover": {
              backgroundColor: "rgba(25, 118, 210, 0.1)",
            },
          }}
        >
          <MerchantIcon fontSize="small" sx={{ color: "#1976d2" }} />
          <span>Merchant Management</span>
        </MenuItem>
        <MenuItem
          onClick={() => handleMerchantMenuItemClick("/admin/categories")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            py: 1.5,
            px: 2,
            "&:hover": {
              backgroundColor: "rgba(25, 118, 210, 0.1)",
            },
          }}
        >
          <CategoryIcon fontSize="small" sx={{ color: "#1976d2" }} />
          <span>Categories</span>
        </MenuItem>
      </Menu>

      {/* Transactions Submenu */}
      <Menu
        anchorEl={transactionMenuAnchor}
        open={Boolean(transactionMenuAnchor)}
        onClose={() => setTransactionMenuAnchor(null)}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        PaperProps={{
          sx: {
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
            borderRadius: 2,
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 8px 32px rgba(31, 38, 135, 0.25)",
            mt: 1,
          },
        }}
      >
        <MenuItem
          onClick={() => handleTransactionMenuItemClick("/admin/deposits")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            py: 1.5,
            px: 2,
            "&:hover": {
              backgroundColor: "rgba(25, 118, 210, 0.1)",
            },
          }}
        >
          <DepositsIcon fontSize="small" sx={{ color: "#1976d2" }} />
          <span>Deposits</span>
        </MenuItem>
        <MenuItem
          onClick={() => handleTransactionMenuItemClick("/admin/transfer-transactions")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            py: 1.5,
            px: 2,
            "&:hover": {
              backgroundColor: "rgba(25, 118, 210, 0.1)",
            },
          }}
        >
          <SwapHorizIcon fontSize="small" sx={{ color: "#1976d2" }} />
          <span>Transfers</span>
        </MenuItem>
        <MenuItem
          onClick={() => handleTransactionMenuItemClick("/admin/withdrawals")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            py: 1.5,
            px: 2,
            "&:hover": {
              backgroundColor: "rgba(25, 118, 210, 0.1)",
            },
          }}
        >
          <WithdrawIcon fontSize="small" sx={{ color: "#1976d2" }} />
          <span>Withdrawals</span>
        </MenuItem>
        <MenuItem
          onClick={() => handleTransactionMenuItemClick("/admin/wallet-to-wallet")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            py: 1.5,
            px: 2,
            "&:hover": {
              backgroundColor: "rgba(25, 118, 210, 0.1)",
            },
          }}
        >
          <WalletTransferIcon fontSize="small" sx={{ color: "#1976d2" }} />
          <span>Wallet to Wallet</span>
        </MenuItem>
      </Menu>
    </>
  );
};

export default AppBottomNav;