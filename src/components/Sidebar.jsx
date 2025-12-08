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
  Dialog,
  DialogTitle,
  DialogContent,
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
  ShoppingCart as ShoppingCartIcon,
  Fastfood as FastfoodIcon,
  LocalGroceryStore as LocalGroceryStoreIcon,
  PhoneAndroid as PhoneAndroidIcon,
  Send as SendIcon,
  LocalMall as LocalMallIcon,
  Wifi as WifiIcon,
  Spa as SpaIcon,
  Coffee as CoffeeIcon
   // Wellness icon
} from "@mui/icons-material";
import damayanLogo from "../assets/damayan.png";

const drawerWidth = 250;

const Sidebar = ({ open, onToggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // flexible collapse state for multiple sections
  const [openSections, setOpenSections] = useState({
    Income: false,
    Financials: false,
    Shopping: false,
    "Digital Services": false,
    "Wellness Products": false,
  });

  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [comingSoonItem, setComingSoonItem] = useState("");

  const role = localStorage.getItem("userRole");
  const upperRole = role?.toUpperCase();

  // Admin Navigation
  const adminNav = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/admin/dashboard" },
    { text: "Purchased Codes", icon: <MonetizationOnIcon />, path: "/admin/generate-codes" },
    { text: "User Management", icon: <PieChartIcon />, path: "/admin/user-management" },
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

  // Shopping group
  const shoppingGroup = [
    { text: "Market Place", icon: <ShoppingCartIcon />, comingSoon: true },
    { text: "Groceries", icon: <LocalGroceryStoreIcon />, comingSoon: true },
    { text: "Food", icon: <FastfoodIcon />, comingSoon: true },
  ];

  // Digital Services group
  const digitalGroup = [
    { text: "E-Load", icon: <PhoneAndroidIcon />, comingSoon: true },
    { text: "Remittances", icon: <SendIcon />, comingSoon: true },
  ];

  // Wellness Products group
  const wellnessGroup = [
  { text: "Coffee", icon: <CoffeeIcon />, path: "/merchant/wellness-coffee" },
];
  // Combine nav depending on role
  const baseNav = ["ADMIN", "CEO"].includes(upperRole) ? adminNav : memberNav;

  // handle navigation / coming soon
  const handleNavigate = (item) => {
    if (item.comingSoon) {
      setComingSoonItem(item.text);
      setComingSoonOpen(true);
      return;
    }
    if (item.path) {
      navigate(item.path);
      if (isMobile) onToggleSidebar();
    }
  };

  // toggle section open state
  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // helper: active matching for items or children
  const isItemActive = (item) => item.path && location.pathname === item.path;
  const isChildActive = (parent) =>
    parent?.children?.some((c) => location.pathname === c.path || location.pathname.startsWith(c.path));

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
                filter:
                  "drop-shadow(0 0 6px rgba(255,255,255,0.7)) drop-shadow(0 0 12px rgba(0,200,255,0.5))",
                transition: "transform 0.3s ease, filter 0.3s ease",
                "&:hover": {
                  transform: "scale(1.05)",
                  filter:
                    "drop-shadow(0 0 10px rgba(255,255,255,0.8)) drop-shadow(0 0 20px rgba(0,200,255,0.6))",
                },
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
        {/* Base Nav */}
        {baseNav.map((item) => {
          if (item.children) {
            const parentActive = isChildActive(item);
            return (
              <Box key={item.text}>
                <Tooltip title={open ? "" : item.text} placement="right" arrow>
                  <ListItemButton
                    onClick={() => toggleSection(item.text)}
                    sx={{ color: "#fff", backgroundColor: parentActive && open ? "rgba(255,255,255,0.08)" : "transparent", "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" } }}
                  >
                    <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>{item.icon}</ListItemIcon>
                    {open && <ListItemText primary={item.text} />}
                    {open && (openSections[item.text] ? <ExpandLess /> : <ExpandMore />)}
                  </ListItemButton>
                </Tooltip>
                <Collapse in={openSections[item.text]} timeout={300} unmountOnExit>
                  <List component="div" disablePadding>
                    {item.children.map((child) => (
                      <ListItemButton
                        key={child.text}
                        onClick={() => handleNavigate(child)}
                        sx={{
                          pl: open ? 6 : 2,
                          color: "#fff",
                          backgroundColor: isItemActive(child) ? "rgba(255,255,255,0.25)" : "transparent",
                          "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
                        }}
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

          const active = isItemActive(item);
          return (
            <Tooltip title={open ? "" : item.text} placement="right" key={item.text} arrow>
              <ListItemButton
                onClick={() => handleNavigate(item)}
                sx={{
                  color: "#fff",
                  backgroundColor: active ? "rgba(255,255,255,0.25)" : "transparent",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
                }}
              >
                <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>{item.icon}</ListItemIcon>
                {open && <ListItemText primary={item.text} />}
              </ListItemButton>
            </Tooltip>
          );
        })}

            {!["ADMIN", "CEO"].includes(upperRole) && (
      <>

        {/* Shopping Section */}
        <Box sx={{ mt: 1, mb: 1 }}>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", px: open ? 2 : 1, pb: 0 }}>
          <ListItemIcon sx={{ color: "rgba(255,255,255,0.85)", minWidth: open ? 40 : "auto" }}>
            <LocalMallIcon />
          </ListItemIcon>
          {open && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <Typography sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                Shopping
              </Typography>
              <IconButton
                onClick={() => toggleSection("Shopping")}
                size="small"
                sx={{
                  color: "rgba(255,255,255,0.6)",
                  transform: openSections.Shopping ? "rotate(-180deg)" : "rotate(0deg)",
                  transition: "transform 220ms ease",
                }}
              >
                {openSections.Shopping ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
          )}
        </Box>
        <Collapse in={openSections.Shopping} timeout={300} unmountOnExit>
          <List component="div" disablePadding>
            {shoppingGroup.map((item) => {
              const comingStyle = item.comingSoon
                ? { opacity: 0.6, color: "rgba(255,255,255,0.6)", cursor: "default" }
                : {};
              return (
                <Tooltip title={open ? "" : item.text} placement="right" key={item.text} arrow>
                  <ListItemButton
                    onClick={() => handleNavigate(item)}
                    sx={{
                      pl: open ? 4 : 2,
                      color: "#fff",
                      backgroundColor: location.pathname === item.path ? "rgba(255,255,255,0.2)" : "transparent",
                      "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
                      ...comingStyle,
                    }}
                  >
                    <ListItemIcon sx={{ color: "inherit", minWidth: open ? 40 : "auto" }}>
                      {item.icon}
                    </ListItemIcon>
                    {open && <ListItemText primary={item.text} />}
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </List>
        </Collapse>

        {/* Wellness Products Section */}
        <Box sx={{ mt: 1, mb: 1 }}>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", px: open ? 2 : 1, pb: 0 }}>
          <ListItemIcon sx={{ color: "rgba(255,255,255,0.85)", minWidth: open ? 40 : "auto" }}>
            <SpaIcon />
          </ListItemIcon>
          {open && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <Typography sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                Wellness Products
              </Typography>
              <IconButton
                onClick={() => toggleSection("Wellness Products")}
                size="small"
                sx={{
                  color: "rgba(255,255,255,0.6)",
                  transform: openSections["Wellness Products"] ? "rotate(-180deg)" : "rotate(0deg)",
                  transition: "transform 220ms ease",
                }}
              >
                {openSections["Wellness Products"] ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
          )}
        </Box>
        <Collapse in={openSections["Wellness Products"]} timeout={300} unmountOnExit>
          <List component="div" disablePadding>
            {wellnessGroup.map((item) => (
              <Tooltip title={open ? "" : item.text} placement="right" key={item.text} arrow>
                <ListItemButton
                  onClick={() => handleNavigate(item)}
                  sx={{
                    pl: open ? 4 : 2,
                    color: "#fff",
                    backgroundColor: location.pathname === item.path ? "rgba(255,255,255,0.2)" : "transparent",
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
                  }}
                >
                  <ListItemIcon sx={{ color: "inherit", minWidth: open ? 40 : "auto" }}>
                    {item.icon}
                  </ListItemIcon>
                  {open && <ListItemText primary={item.text} />}
                </ListItemButton>
              </Tooltip>
            ))}
          </List>
        </Collapse>

        {/* Digital Services Section */}
        <Box sx={{ mt: 1, mb: 1 }}>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", px: open ? 2 : 1, pb: 0 }}>
          <ListItemIcon sx={{ color: "rgba(255,255,255,0.85)", minWidth: open ? 40 : "auto" }}>
            <WifiIcon />
          </ListItemIcon>
          {open && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <Typography sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                Digital Services
              </Typography>
              <IconButton
                onClick={() => toggleSection("Digital Services")}
                size="small"
                sx={{
                  color: "rgba(255,255,255,0.6)",
                  transform: openSections["Digital Services"] ? "rotate(-180deg)" : "rotate(0deg)",
                  transition: "transform 220ms ease",
                }}
              >
                {openSections["Digital Services"] ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
          )}
        </Box>
        <Collapse in={openSections["Digital Services"]} timeout={300} unmountOnExit>
          <List component="div" disablePadding>
            {digitalGroup.map((item) => (
              <Tooltip title={open ? "" : item.text} placement="right" key={item.text} arrow>
                <ListItemButton
                  onClick={() => handleNavigate(item)}
                  sx={{
                    pl: open ? 4 : 2,
                    color: "#fff",
                    backgroundColor: location.pathname === item.path ? "rgba(255,255,255,0.2)" : "transparent",
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
                  }}
                >
                  <ListItemIcon sx={{ color: "inherit", minWidth: open ? 40 : "auto" }}>
                    {item.icon}
                  </ListItemIcon>
                  {open && <ListItemText primary={item.text} />}
                </ListItemButton>
              </Tooltip>
            ))}
          </List>
        </Collapse>

      </>
    )}

       {/* Admin Financials Section */}
{["ADMIN", "CEO"].includes(upperRole) && (
  <>
    {/* Financials */}
    <Box sx={{ mt: 1, mb: 1 }}>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
    </Box>
    {open && (
      <Typography
        sx={{
          pl: 3,
          pt: 1,
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
    <ListItemButton
      onClick={() => toggleSection("Financials")}
      sx={{ color: "#fff", "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" } }}
    >
      <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>
        <MonetizationOnIcon />
      </ListItemIcon>
      {open && <ListItemText primary="Financials" />}
      {open && (openSections.Financials ? <ExpandLess /> : <ExpandMore />)}
    </ListItemButton>
    <Collapse in={openSections.Financials} timeout={300} unmountOnExit>
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
              "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
            }}
            onClick={() => handleNavigate(child)}
          >
            <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>{child.icon}</ListItemIcon>
            {open && <ListItemText primary={child.text} />}
          </ListItemButton>
        ))}
      </List>
    </Collapse>

    {/* Manage Merchant Section */}
    <Box sx={{ mt: 1, mb: 1 }}>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
    </Box>
    {open && (
      <Typography
        sx={{
          pl: 3,
          pt: 1,
          pb: 1,
          color: "rgba(255,255,255,0.6)",
          fontSize: "0.75rem",
          fontStyle: "italic",
          textTransform: "uppercase",
        }}
      >
        Manage Merchant
      </Typography>
    )}
    <ListItemButton
      onClick={() => toggleSection("Manage Merchant")}
      sx={{ color: "#fff", "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" } }}
    >
      <ListItemIcon sx={{ color: "#fff", minWidth: open ? 40 : "auto" }}>
        <LocalMallIcon />
      </ListItemIcon>
      {open && <ListItemText primary="Manage Merchant" />}
      {open && (openSections["Manage Merchant"] ? <ExpandLess /> : <ExpandMore />)}
    </ListItemButton>
    <Collapse in={openSections["Manage Merchant"]} timeout={300} unmountOnExit>
      <List component="div" disablePadding>
        {[
          { text: "Market Place", icon: <ShoppingCartIcon />, comingSoon: true },
          { text: "Groceries", icon: <LocalGroceryStoreIcon />, comingSoon: true },
          { text: "Food", icon: <FastfoodIcon />, comingSoon: true },
          { text: "Coffee", icon: <CoffeeIcon />, path: "/merchant/wellness-coffee" },
          { text: "E-Load", icon: <PhoneAndroidIcon />, comingSoon: true },
          { text: "Remittances", icon: <SendIcon />, comingSoon: true },
        ].map((item) => {
          const comingStyle = item.comingSoon
            ? { opacity: 0.6, color: "rgba(255,255,255,0.6)", cursor: "default" }
            : {};
          return (
            <Tooltip title={open ? "" : item.text} placement="right" key={item.text} arrow>
              <ListItemButton
                onClick={() => handleNavigate(item)}
                sx={{
                  pl: open ? 6 : 2,
                  color: "#fff",
                  backgroundColor: location.pathname === item.path ? "rgba(255,255,255,0.2)" : "transparent",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
                  ...comingStyle,
                }}
              >
                <ListItemIcon sx={{ color: "inherit", minWidth: open ? 40 : "auto" }}>{item.icon}</ListItemIcon>
                {open && <ListItemText primary={item.text} />}
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>
    </Collapse>
  </>
)}
      </List>

      {/* Footer */}
      {open && (
        <Box sx={{ mt: "auto", mb: 2, textAlign: "center", fontSize: "0.7rem", color: "rgba(255,255,255,0.5)" }}>
          © 2025 All Rights Reserved
        </Box>
      )}

      {/* Coming Soon Dialog */}
      <Dialog open={comingSoonOpen} onClose={() => setComingSoonOpen(false)}>
        <DialogTitle>Coming Soon</DialogTitle>
        <DialogContent>
          <Typography>{comingSoonItem} feature is coming soon!</Typography>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <>
      {isMobile && !open && (
        <IconButton
          onClick={onToggleSidebar}
          color="inherit"
          sx={{ position: "fixed", top: 15, left: 15, zIndex: 2000, backgroundColor: "rgba(0,0,0,0.4)", "&:hover": { backgroundColor: "rgba(255,255,255,0.2)" } }}
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