// src/components/AppBottomNav.jsx
import React, { useState, useEffect } from "react";
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Menu,
  MenuItem,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Badge,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
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
  FactCheck as ProductApprovalIcon,
} from "@mui/icons-material";

const AppBottomNav = ({ open, onToggleSidebar, layout = "bottom" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [merchantMenuAnchor, setMerchantMenuAnchor] = useState(null);
  const [transactionMenuAnchor, setTransactionMenuAnchor] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [authReady, setAuthReady] = useState(false);

  // Close menus when location changes
  useEffect(() => {
    setMerchantMenuAnchor(null);
    setTransactionMenuAnchor(null);
    setIsNavigating(false);
  }, [location.pathname]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, () => {
      setAuthReady(true);
    });

    return () => unsubAuth();
  }, []);

  const role = localStorage.getItem("userRole")?.trim();
  const upperRole = role?.toUpperCase();
  const isAdminOrCEO = ["ADMIN", "CEO"].includes(upperRole);
  const effectiveLayout = isAdminOrCEO && layout === "bottom" ? "sidebar" : layout;
  
  // Debug log for CEO users
  if (isAdminOrCEO && typeof window !== "undefined" && window.location.href.includes("admin")) {
    console.log("[AppBottomNav] Admin/CEO Sidebar - Role:", role, "Upper:", upperRole, "Layout:", effectiveLayout);
  }

  useEffect(() => {
    if (!isAdminOrCEO || !authReady || !auth.currentUser) return undefined;

    const unsubPendingApprovals = onSnapshot(
      query(collection(db, "products"), where("approvalStatus", "==", "PENDING")),
      (snap) => {
        setPendingApprovals(snap.size);
      },
      (err) => {
        if (err?.code !== "permission-denied") {
          console.error("Pending approvals listener error:", err);
        }
      }
    );

    return () => unsubPendingApprovals();
  }, [upperRole, authReady]);

  // Navigation items based on role
  let navItems = [];
  
  if (isAdminOrCEO) {
    navItems = [
      { label: "Dashboard", value: "/admin/dashboard", icon: <DashboardIcon /> },
      { label: "Paybacks", value: "/admin/payback-entries", icon: <SavingsIcon /> },
      { label: "Codes", value: "/admin/generate-codes", icon: <MonetizationOnIcon /> },
      { label: "Users", value: "/admin/user-management", icon: <PieChartIcon /> },
      { label: "Merchants", value: "merchants-menu", icon: <MerchantIcon />, isMenu: true },
      { label: "Product Management", value: "/admin/products", icon: <ProductApprovalIcon /> },
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

  const handleNavigate = (value, isMenu, anchorEl = null) => {
    if (!value || isNavigating) return;
    
    if (isMenu && value === "merchants-menu") {
      const merchantsButton = anchorEl || document.querySelector('[data-merchants-menu]');
      setMerchantMenuAnchor(merchantsButton);
    } else if (isMenu && value === "transactions-menu") {
      const transactionsButton = anchorEl || document.querySelector('[data-transactions-menu]');
      setTransactionMenuAnchor(transactionsButton);
    } else {
      // For direct nav items, use a longer delay
      setIsNavigating(true);
      setTimeout(() => {
        navigate(value);
        if (layout === "sidebar" && onToggleSidebar) {
          onToggleSidebar();
        }
      }, 200);
    }
  };

  const handleMerchantMenuItemClick = (path) => {
    setMerchantMenuAnchor(null);
    // Delay navigation to allow Firestore to properly cleanup previous listeners
    setTimeout(() => {
      navigate(path);
      if (layout === "sidebar" && onToggleSidebar) {
        onToggleSidebar();
      }
    }, 300);
  };

  const handleTransactionMenuItemClick = (path) => {
    setTransactionMenuAnchor(null);
    // Delay navigation to allow Firestore to properly cleanup previous listeners
    setTimeout(() => {
      navigate(path);
      if (layout === "sidebar" && onToggleSidebar) {
        onToggleSidebar();
      }
    }, 300);
  };

  const renderItemIcon = (item) => {
    if (item.value === "/admin/products" && pendingApprovals > 0) {
      return (
        <Badge
          color="error"
          badgeContent={pendingApprovals > 99 ? "99+" : pendingApprovals}
          sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", minWidth: 16, height: 16 } }}
        >
          {item.icon}
        </Badge>
      );
    }

    return item.icon;
  };

  const sidebarContent = (
    <Paper
      elevation={0}
      sx={{
        position: "fixed",
        left: open ? 0 : -280,
        top: 64,
        bottom: 0,
        width: 280,
        borderRadius: 0,
        background: "rgba(16, 20, 28, 0.95)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255, 255, 255, 0.15)",
        color: "#fff",
        zIndex: 1100,
        overflowY: "auto",
        transition: "left 0.3s ease",
      }}
    >
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
          Navigation
        </Typography>
      </Box>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />
      <List sx={{ px: 1.2, py: 1.2 }}>
        {navItems.map((item) => {
          const isSelected = !item.isMenu && location.pathname === item.value;
          return (
            <ListItemButton
              key={item.value}
              onClick={(e) => handleNavigate(item.value, item.isMenu, e.currentTarget)}
              sx={{
                mb: 0.5,
                borderRadius: 2,
                color: "rgba(255,255,255,0.9)",
                backgroundColor: isSelected ? "rgba(79,195,247,0.18)" : "transparent",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.08)",
                },
              }}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>{renderItemIcon(item)}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: isSelected ? 700 : 500 }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );

  return (
    <>
      {effectiveLayout === "sidebar" ? (
        sidebarContent
      ) : (
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
                icon={renderItemIcon(item)}
                data-merchants-menu={item.isMenu && item.value === "merchants-menu" ? "true" : undefined}
                data-transactions-menu={item.isMenu && item.value === "transactions-menu" ? "true" : undefined}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}

      {/* Merchants Submenu */}
      <Menu
        anchorEl={merchantMenuAnchor}
        open={Boolean(merchantMenuAnchor)}
        onClose={() => setMerchantMenuAnchor(null)}
        disableScrollLock={true}
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
          onClick={() => handleMerchantMenuItemClick("/admin/merchants")}
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
        disableScrollLock={true}
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