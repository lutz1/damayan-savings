import React, { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Backdrop,
  Tooltip,
  Slide,
  useMediaQuery,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Wallet as WalletIcon,
  Email as EmailIcon,
  Payment as PurchaseIcon,
  Savings as DepositIcon,
  Send as TransferIcon,
  MonetizationOn as WithdrawIcon,
  GroupAdd as InviteIcon,
  KeyboardArrowRight as CloseIcon,
  VpnKey as CodeIcon,
} from "@mui/icons-material";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  onSnapshot as listenCollection,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import tclcLogo from "../assets/tclc-logo1.png";

// Dialog components
import PurchaseCodesDialog from "./Topbar/dialogs/PurchaseCodesDialog";
import WithdrawDialog from "./Topbar/dialogs/WithdrawDialog";
import DepositDialog from "./Topbar/dialogs/DepositDialog";
import TransferFundsDialog from "./Topbar/dialogs/TransferFundsDialog";
import InviteEarnDialog from "./Topbar/dialogs/InviteEarnDialog";

const Topbar = ({ open, onToggleSidebar }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [userData, setUserData] = useState({
    username: "",
    email: "",
    eWallet: 0,
    role: "member",
  });
  const [availableCodes, setAvailableCodes] = useState([]);

  // 🔹 Real-time Firestore listeners
  useEffect(() => {
    let unsubscribeUser = null;
    let unsubscribeCodes = null;

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) return;

      const userRef = doc(db, "users", currentUser.uid);
      unsubscribeUser = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData({
            username: data.username || "UnknownUser",
            email: data.email || currentUser.email || "No email",
            eWallet: Number(data.eWallet) || 0,
            role: data.role || "member",
          });

          const codesRef = collection(db, "purchaseCodes");
          const q = query(
            codesRef,
            where("userId", "==", currentUser.uid),
            where("used", "==", false)
          );

          if (unsubscribeCodes) unsubscribeCodes();
          unsubscribeCodes = listenCollection(q, (snap) => {
            const codes = snap.docs.map((d) => d.data());
            setAvailableCodes(codes);
          });
        }
      });
    });

    return () => {
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeCodes) unsubscribeCodes();
      unsubscribeAuth();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const openDrawer = () => {
    setDrawerOpen(true);
    setTimeout(() => setSlideIn(true), 50);
  };
  const closeDrawer = () => {
    setSlideIn(false);
    setTimeout(() => setDrawerOpen(false), 300);
  };

  const handleOpenDialog = (type) => setDialog(type);
  const handleCloseDialog = () => setDialog(null);

  return (
    <>
      {/* 🔹 Top AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { xs: "100%", md: `calc(100% - ${open ? 240 : 60}px)` },
          ml: { xs: 0, md: `${open ? 240 : 60}px` },
          transition: "all 0.3s ease",
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
          color: "#fff",
          boxShadow: "0 8px 32px rgba(31, 38, 135, 0.25)",
          zIndex: 1201,
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          {/* Left */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {(isMobile || isTablet) && (
              <IconButton color="inherit" onClick={onToggleSidebar}>
                <MenuIcon />
              </IconButton>
            )}
            <Box
              component="img"
              src={tclcLogo}
              alt="TCLC Logo"
              sx={{
                width: { xs: 45, sm: 55, md: 60 },
                height: "auto",
                objectFit: "contain",
              }}
            />
          </Box>

          {/* Right */}
          <IconButton color="inherit" onClick={openDrawer}>
            <Avatar
              alt={userData.username}
              src="/images/avatar-placeholder.png"
              sx={{
                bgcolor: "secondary.main",
                border: "2px solid rgba(255,255,255,0.3)",
                boxShadow: "0 0 8px rgba(255,255,255,0.4)",
                transition: "transform 0.2s ease",
                "&:hover": { transform: "scale(1.08)" },
              }}
            />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* 🔹 Drawer Overlay */}
      <Backdrop
        open={drawerOpen}
        sx={{
          zIndex: 1200,
          backgroundColor: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(5px)",
        }}
        onClick={closeDrawer}
      />

      {/* 🔹 Drawer */}
      {drawerOpen && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            right: 0,
            height: "100vh",
            width: isMobile ? "90%" : isTablet ? "70%" : 360,
            zIndex: 1300,
            display: "flex",
            justifyContent: "flex-end",
            pointerEvents: "none",
          }}
        >
          <Slide direction="left" in={slideIn} mountOnEnter unmountOnExit>
            <Box
              sx={{
                width: "100%",
                height: "100%",
                borderRadius: "20px 0 0 20px",
                background: "rgba(25,25,25,0.85)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 8px 25px rgba(0,0,0,0.5)",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                pointerEvents: "auto",
                overflow: "hidden",
              }}
            >
              {/* Close */}
              <Tooltip title="Close Menu" placement="left">
                <IconButton
                  onClick={closeDrawer}
                  sx={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    bgcolor: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.25)",
                      transform: "scale(1.05)",
                    },
                  }}
                  size="small"
                >
                  <CloseIcon sx={{ color: "#fff" }} />
                </IconButton>
              </Tooltip>

              {/* Content */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  p: 2,
                  "&::-webkit-scrollbar": { width: 6 },
                  "&::-webkit-scrollbar-thumb": {
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 10,
                  },
                }}
              >
                {/* Profile */}
                <Box sx={{ textAlign: "center", mt: 5 }}>
                  <Avatar
                    alt={userData.username}
                    src="/images/avatar-placeholder.png"
                    sx={{
                      width: 80,
                      height: 80,
                      mx: "auto",
                      mb: 1.5,
                      bgcolor: "#1976d2",
                      boxShadow: "0 0 20px rgba(25,118,210,0.5)",
                    }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    @{userData.username}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                      mt: 0.5,
                    }}
                  >
                    <EmailIcon fontSize="small" sx={{ color: "gray" }} />
                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      {userData.email}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.2)" }} />

                {/* Wallet */}
                {userData.role !== "admin" && (
                  <Box
                    sx={{
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: 2,
                      p: 2,
                      mb: 2,
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{
                        mb: 1,
                        display: "flex",
                        alignItems: "center",
                        fontWeight: 500,
                      }}
                    >
                      <WalletIcon
                        fontSize="small"
                        sx={{ mr: 1, color: "#4CAF50" }}
                      />
                      E-Wallet
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{ color: "#4CAF50", fontWeight: 700 }}
                    >
                      ₱
                      {userData.eWallet.toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </Typography>
                  </Box>
                )}

                {/* Codes */}
                {availableCodes.length > 0 && (
                  <Box
                    sx={{
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: 2,
                      p: 2,
                      mb: 2,
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        fontWeight: 500,
                        mb: 1,
                      }}
                    >
                      <CodeIcon sx={{ mr: 1, color: "#FFD54F" }} />
                      Available Codes
                    </Typography>
                    {availableCodes.map((code, i) => (
                      <Typography
                        key={i}
                        variant="body2"
                        sx={{
                          color: "#FFF59D",
                          fontFamily: "monospace",
                          ml: 2,
                          wordBreak: "break-all",
                        }}
                      >
                        {code.type}: {code.code}
                      </Typography>
                    ))}
                  </Box>
                )}

                {/* Menu */}
                <List>
                  {[
                    {
                      icon: <PurchaseIcon sx={{ color: "#4FC3F7" }} />,
                      label: "Purchase Codes",
                      dialog: "purchase",
                    },
                    {
                      icon: <WithdrawIcon sx={{ color: "#FF7043" }} />,
                      label: "Withdrawal",
                      dialog: "withdraw",
                    },
                    {
                      icon: <DepositIcon sx={{ color: "#81C784" }} />,
                      label: "Deposit",
                      dialog: "deposit",
                    },
                    {
                      icon: <TransferIcon sx={{ color: "#BA68C8" }} />,
                      label: "Transfer Funds",
                      dialog: "transfer",
                    },
                    {
                      icon: <InviteIcon sx={{ color: "#FFB300" }} />,
                      label: "Invite & Earn",
                      dialog: "invite",
                    },
                  ].map((item, i) => (
                    <ListItem disablePadding key={i}>
                      <ListItemButton onClick={() => handleOpenDialog(item.dialog)}>
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.label} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>

              {/* Logout fixed at bottom */}
              <Box
                sx={{
                  p: 2,
                  borderTop: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <ListItem disablePadding>
                  <ListItemButton onClick={handleLogout}>
                    <ListItemIcon>
                      <LogoutIcon sx={{ color: "#FF5252" }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Logout"
                      sx={{
                        color: "#FF5252",
                        "& .MuiListItemText-primary": { fontWeight: 600 },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              </Box>
            </Box>
          </Slide>
        </Box>
      )}

      {/* 🔹 Dialogs */}
      <PurchaseCodesDialog
        open={dialog === "purchase"}
        onClose={handleCloseDialog}
        userData={userData}
        availableCodes={availableCodes}
        db={db}
        auth={auth}
      />
      <WithdrawDialog
        open={dialog === "withdraw"}
        onClose={handleCloseDialog}
        userData={userData}
        db={db}
        auth={auth}
      />
      <DepositDialog
        open={dialog === "deposit"}
        onClose={handleCloseDialog}
        userData={userData}
        db={db}
        auth={auth}
      />
      <TransferFundsDialog
        open={dialog === "transfer"}
        onClose={handleCloseDialog}
        userData={userData}
        db={db}
        auth={auth}
      />
      <InviteEarnDialog
        open={dialog === "invite"}
        onClose={handleCloseDialog}
        userData={userData}
        availableCodes={availableCodes}
        db={db}
        auth={auth}
      />
    </>
  );
};

export default Topbar;