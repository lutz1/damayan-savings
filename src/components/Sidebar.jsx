// src/components/Sidebar.jsx
import React, { useState } from "react";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Tooltip,
  IconButton,
  Divider,
  Collapse,
  useMediaQuery,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ExpandLess,
  ExpandMore,
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  AccountCircle as AccountCircleIcon,
  MonetizationOn as MonetizationOnIcon,
  Savings as SavingsIcon,
  PieChart as PieChartIcon,
  SwapHoriz as SwapHorizIcon,
  AccountBalanceWallet,
} from "@mui/icons-material";
import damayanLogo from "../assets/damayan.png";

const drawerWidth = 240;

const Sidebar = ({ open, onToggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [financialsOpen, setFinancialsOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const role = localStorage.getItem("userRole");
  const upperRole = role?.toUpperCase();

  // Admin Navigation
  const adminNav = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/admin/dashboard" },
    { text: "Purchased Codes", icon: <MonetizationOnIcon />, path: "/admin/generate-codes" },
    { text: "User Management", icon: <PieChartIcon />, path: "/admin/user-management" },
    { text: "Approval Requests", icon: <SavingsIcon />, path: "/admin/approval-requests" },
    { text: "Transfer Transactions", icon: <SwapHorizIcon />, path: "/admin/transfer-transactions" },
    { text: "Profile", icon: <AccountCircleIcon />, path: "/admin/profile" },
  ];

  // Member Navigation
  const memberNav = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/member/dashboard" },
    {
      text: "Income",
      icon: <MonetizationOnIcon />,
      children: [
        { text: "Payback", icon: <SavingsIcon />, path: "/member/income/payback" },
        { text: "Capital Share", icon: <PieChartIcon />, path: "/member/income/capital-share" },
      ],
    },
    { text: "Profile", icon: <AccountCircleIcon />, path: "/member/profile" },
  ];

  const navItems = ["ADMIN", "CEO"].includes(upperRole) ? adminNav : memberNav;

  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) onToggleSidebar();
  };

  const drawerContent = (
    <>
      {/* Logo + Toggle */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: open ? "space-between" : "center", p: 3, mt: 1 }}>
        {open && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: -1 }}>
            <Box
              component="img"
              src={damayanLogo}
              alt="Damayan Logo"
              sx={{
                width: 160,
                height: "auto",
                ml: 1,
                cursor: "pointer",
                filter: "drop-shadow(0 0 6px rgba(255,255,255,0.7)) drop-shadow(0 0 12px rgba(0,200,255,0.5))",
                transition: "transform 0.3s ease, filter 0.3s ease",
                "&:hover": { transform: "scale(1.05)", filter: "drop-shadow(0 0 10px rgba(255,255,255,0.8)) drop-shadow(0 0 20px rgba(0,200,255,0.6))" },
              }}
              onClick={() => navigate("/")}
            />
            <Box sx={{ mt: 1, fontSize: "0.8rem", color: "rgba(255,255,255,0.8)", fontWeight: "bold", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              {upperRole}
            </Box>
          </Box>
        )}
        <IconButton onClick={onToggleSidebar} color="inherit" size="small" sx={{ "&:hover": { backgroundColor: "rgba(255,255,255,0.2)" } }}>
          <MenuIcon />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.2)" }} />

      <List>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          // Handle items with children (like Income)
          if (item.children) {
            return (
              <Box key={item.text}>
                <Tooltip title={open ? "" : item.text} placement="right" arrow>
                  <ListItemButton onClick={() => setIncomeOpen(!incomeOpen)} sx={{ color: "#fff", "&:hover": { backgroundColor: "rgba(255,255,255,0.15)" } }}>
                    <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>{item.icon}</ListItemIcon>
                    {open && <ListItemText primary={item.text} />}
                    {open && (incomeOpen ? <ExpandLess /> : <ExpandMore />)}
                  </ListItemButton>
                </Tooltip>
                <Collapse in={incomeOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.children.map((child) => (
                      <ListItemButton
                        key={child.text}
                        sx={{
                          pl: open ? 6 : 2,
                          color: "#fff",
                          backgroundColor: location.pathname === child.path ? "rgba(255,255,255,0.25)" : "transparent",
                          "&:hover": { backgroundColor: "rgba(255,255,255,0.15)" },
                        }}
                        onClick={() => handleNavigate(child.path)}
                      >
                        <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>{child.icon}</ListItemIcon>
                        {open && <ListItemText primary={child.text} />}
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          }

          // Normal single items
          return (
            <Tooltip title={open ? "" : item.text} placement="right" key={item.text} arrow>
              <ListItemButton
                onClick={() => handleNavigate(item.path)}
                sx={{
                  color: "#fff",
                  backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "transparent",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.15)" },
                }}
              >
                <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>{item.icon}</ListItemIcon>
                {open && <ListItemText primary={item.text} />}
              </ListItemButton>
            </Tooltip>
          );
        })}

        {/* Admin Financials Section */}
        {["ADMIN", "CEO"].includes(upperRole) && (
          <Box>
            {open && (
              <Typography
                sx={{
                  pl: 3,
                  pt: 2,
                  pb: 1,
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "0.75rem",
                  fontStyle: "italic",
                  textTransform: "uppercase",
                }}
              >
                Financials
              </Typography>
            )}
            <ListItemButton onClick={() => setFinancialsOpen(!financialsOpen)} sx={{ color: "#fff", "&:hover": { backgroundColor: "rgba(255,255,255,0.15)" } }}>
              <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>
                <MonetizationOnIcon />
              </ListItemIcon>
              {open && <ListItemText primary="Financials" />}
              {open && (financialsOpen ? <ExpandLess /> : <ExpandMore />)}
            </ListItemButton>
            <Collapse in={financialsOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {[
                  { text: "Withdrawals", icon: <AccountBalanceWallet />, path: "/admin/withdrawals" },
                  { text: "Deposits", icon: <AccountBalanceWallet />, path: "/admin/deposits" },
                  { text: "Wallet-to-Wallet", icon: <SwapHorizIcon />, path: "/admin/wallet-to-wallet" },
                ].map((child) => (
                  <ListItemButton
                    key={child.text}
                    sx={{
                      pl: open ? 6 : 2,
                      color: "#fff",
                      backgroundColor: location.pathname === child.path ? "rgba(255,255,255,0.25)" : "transparent",
                      "&:hover": { backgroundColor: "rgba(255,255,255,0.15)" },
                    }}
                    onClick={() => handleNavigate(child.path)}
                  >
                    <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>{child.icon}</ListItemIcon>
                    {open && <ListItemText primary={child.text} />}
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </Box>
        )}
      </List>
    </>
  );

  return (
    <>
      {isMobile && !open && (
        <IconButton
          onClick={onToggleSidebar}
          color="inherit"
          sx={{
            position: "fixed",
            top: 15,
            left: 15,
            zIndex: 2000,
            backgroundColor: "rgba(0,0,0,0.4)",
            "&:hover": { backgroundColor: "rgba(255,255,255,0.2)" },
          }}
        >
          <MenuIcon />
        </IconButton>
      )}

      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={open}
        onClose={onToggleSidebar}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: open ? drawerWidth : 60,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: open ? drawerWidth : 60,
            transition: "width 0.3s ease",
            overflowX: "hidden",
            backdropFilter: "blur(15px)",
            background: "rgba(255,255,255,0.12)",
            borderRight: "1px solid rgba(255,255,255,0.2)",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            color: "#fff",
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default Sidebar;