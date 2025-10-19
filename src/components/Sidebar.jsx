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
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate, useLocation } from "react-router-dom";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import SavingsIcon from "@mui/icons-material/Savings";
import PieChartIcon from "@mui/icons-material/PieChart";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import damayanLogo from "../assets/damayan.png";

const drawerWidth = 240;

const Sidebar = ({ open, onToggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [incomeOpen, setIncomeOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const role = localStorage.getItem("userRole");

  const adminNav = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/admin/dashboard" },
    {
      text: "Generate Codes",
      icon: <MonetizationOnIcon />,
      path: "/admin/generate-codes",
    },
    {
      text: "User Management",
      icon: <PieChartIcon />,
      path: "/admin/user-management",
    },
    {
      text: "Approval Requests",
      icon: <SavingsIcon />,
      path: "/admin/approval-requests",
    },
    {
      text: "Transfer Transactions",
      icon: <SwapHorizIcon />,
      path: "/admin/transfer-transactions",
    },
    { text: "Profile", icon: <AccountCircleIcon />, path: "/admin/profile" },
  ];

  const memberNav = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/member/dashboard" },
    {
      text: "Income",
      icon: <MonetizationOnIcon />,
      children: [
        {
          text: "Payback",
          icon: <SavingsIcon />,
          path: "/member/income/payback",
        },
        {
          text: "Capital Share",
          icon: <PieChartIcon />,
          path: "/member/income/capital-share",
        },
      ],
    },
    { text: "Genealogy Tree", icon: <AccountTreeIcon />, path: "/member/genealogy" },
    { text: "Profile", icon: <AccountCircleIcon />, path: "/member/profile" },
  ];

  // ✅ Fix: case-insensitive role matching
  const navItems = role?.toUpperCase() === "ADMIN" ? adminNav : memberNav;

  const handleToggleIncome = () => {
    setIncomeOpen((prev) => !prev);
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) onToggleSidebar();
    // Auto close submenu when navigating to a different page
    setIncomeOpen(false);
  };

  const drawerContent = (
    <>
      {/* ✅ Logo + Toggle Icon */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: open ? "space-between" : "center",
          p: 3,
          mt: 1,
        }}
      >
        {open && (
          <Box
            component="img"
            src={damayanLogo}
            alt="Damayan Logo"
            sx={{
              width: 160,
              height: "auto",
              ml: 1,
              cursor: "pointer",
              filter: `
                drop-shadow(0 0 6px rgba(255,255,255,0.7))
                drop-shadow(0 0 12px rgba(0,200,255,0.5))
              `,
              transition: "transform 0.3s ease, filter 0.3s ease",
              "&:hover": {
                transform: "scale(1.05)",
                filter: `
                  drop-shadow(0 0 10px rgba(255,255,255,0.8))
                  drop-shadow(0 0 20px rgba(0,200,255,0.6))
                `,
              },
            }}
            onClick={() => navigate("/")}
          />
        )}

        <IconButton
          onClick={onToggleSidebar}
          color="inherit"
          size="small"
          sx={{
            "&:hover": { backgroundColor: "rgba(255,255,255,0.2)" },
          }}
        >
          <MenuIcon />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.2)" }} />

      {/* ✅ Navigation Links */}
      <Box sx={{ mt: 1 }}>
        <List>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;

            if (item.children) {
              return (
                <Box key={item.text}>
                  <Tooltip title={open ? "" : item.text} placement="right" arrow>
                    <ListItemButton
                      onClick={handleToggleIncome}
                      sx={{
                        color: "#fff",
                        "&:hover": {
                          backgroundColor: "rgba(255, 255, 255, 0.15)",
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>
                        {item.icon}
                      </ListItemIcon>
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
                            backgroundColor:
                              location.pathname === child.path
                                ? "rgba(255, 255, 255, 0.25)"
                                : "transparent",
                            "&:hover": {
                              backgroundColor: "rgba(255, 255, 255, 0.15)",
                            },
                          }}
                          onClick={() => handleNavigate(child.path)}
                        >
                          <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>
                            {child.icon}
                          </ListItemIcon>
                          {open && <ListItemText primary={child.text} />}
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </Box>
              );
            }

            return (
              <Tooltip
                title={open ? "" : item.text}
                placement="right"
                key={item.text}
                arrow
              >
                <ListItemButton
                  onClick={() => handleNavigate(item.path)}
                  sx={{
                    color: "#fff",
                    backgroundColor: isActive
                      ? "rgba(255, 255, 255, 0.25)"
                      : "transparent",
                    "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.15)" },
                  }}
                >
                  <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>
                    {item.icon}
                  </ListItemIcon>
                  {open && <ListItemText primary={item.text} />}
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Box>
    </>
  );

  return (
    <>
      {/* 👇 Show hamburger icon always on mobile */}
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
            background: "rgba(255, 255, 255, 0.12)",
            borderRight: "1px solid rgba(255, 255, 255, 0.2)",
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