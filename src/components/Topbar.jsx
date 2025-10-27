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
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
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

  // 🔹 Real-time user info listener
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) return;

      const userRef = doc(db, "users", currentUser.uid);
      const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData({
            username: data.username || "UnknownUser",
            email: data.email || currentUser.email || "No email",
            eWallet: Number(data.eWallet) || 0,
            role: data.role || "member",
          });

          // Listen for available codes
          const codesRef = collection(db, "purchaseCodes");
          const q = query(
            codesRef,
            where("userId", "==", currentUser.uid),
            where("used", "==", false)
          );

          const unsubCodes = listenCollection(q, (snap) => {
            const codes = snap.docs.map((d) => d.data());
            setAvailableCodes(codes);
          });

          return () => unsubCodes();
        }
      });

      return () => unsubscribeUser();
    });

    return () => unsubscribeAuth();
  }, []);

  // 🔹 Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // 🔹 Drawer controls
  const openDrawer = () => {
    setDrawerOpen(true);
    setTimeout(() => setSlideIn(true), 50);
  };
  const closeDrawer = () => {
    setSlideIn(false);
    setTimeout(() => setDrawerOpen(false), 300);
  };

  // 🔹 Dialog controls
  const handleOpenDialog = (type) => setDialog(type);
  const handleCloseDialog = () => setDialog(null);

  return (
    <>
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { xs: "100%", md: `calc(100% - ${open ? 240 : 60}px)` },
          ml: { xs: 0, md: `${open ? 240 : 60}px` },
          transition: "all 0.3s ease",
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.3)",
          color: "#fff",
          zIndex: 1201,
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          {/* Left Side */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isMobile && (
              <IconButton color="inherit" onClick={onToggleSidebar}>
                <MenuIcon />
              </IconButton>
            )}
            <Box
              component="img"
              src={tclcLogo}
              alt="TCLC Logo"
              sx={{ width: 60, height: 66, objectFit: "contain" }}
            />
          </Box>

          {/* Right Side */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton color="inherit" onClick={openDrawer}>
              <Avatar
                alt={userData.username}
                src="/images/avatar-placeholder.png"
                sx={{
                  bgcolor: "secondary.main",
                  border: "2px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 0 8px rgba(255,255,255,0.4)",
                  transition: "transform 0.2s ease",
                  "&:hover": { transform: "scale(1.1)" },
                }}
              />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Drawer Backdrop */}
      <Backdrop
        open={drawerOpen}
        sx={{
          zIndex: 1200,
          backgroundColor: "rgba(0,0,0,0.3)",
          backdropFilter: "blur(5px)",
        }}
        onClick={closeDrawer}
      />

      {/* Drawer */}
      {drawerOpen && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            right: 0,
            height: "100vh",
            width: isMobile ? "85%" : 350,
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
                background: "rgba(30,30,30,0.75)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 8px 25px rgba(0,0,0,0.4)",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "auto",
              }}
            >
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

              {/* User Info */}
              <Box sx={{ textAlign: "center", p: 2, pt: 4 }}>
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

              <Divider sx={{ borderColor: "rgba(255,255,255,0.2)" }} />

              {/* Wallet Section */}
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

              {/* Available Codes */}
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
                      sx={{ color: "#FFF59D", fontFamily: "monospace", ml: 2 }}
                    >
                      {code.type}: {code.code}
                    </Typography>
                  ))}
                </Box>
              )}

              {/* Menu Items */}
              <List>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleOpenDialog("purchase")}>
                    <ListItemIcon>
                      <PurchaseIcon sx={{ color: "#4FC3F7" }} />
                    </ListItemIcon>
                    <ListItemText primary="Purchase Codes" />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleOpenDialog("withdraw")}>
                    <ListItemIcon>
                      <WithdrawIcon sx={{ color: "#FF7043" }} />
                    </ListItemIcon>
                    <ListItemText primary="Withdrawal" />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleOpenDialog("deposit")}>
                    <ListItemIcon>
                      <DepositIcon sx={{ color: "#81C784" }} />
                    </ListItemIcon>
                    <ListItemText primary="Deposit" />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleOpenDialog("transfer")}>
                    <ListItemIcon>
                      <TransferIcon sx={{ color: "#BA68C8" }} />
                    </ListItemIcon>
                    <ListItemText primary="Transfer Funds" />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleOpenDialog("invite")}>
                    <ListItemIcon>
                      <InviteIcon sx={{ color: "#FFB300" }} />
                    </ListItemIcon>
                    <ListItemText primary="Invite & Earn" />
                  </ListItemButton>
                </ListItem>

                {/* Logout */}
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
              </List>
            </Box>
          </Slide>
        </Box>
      )}

      {/* Dialog Components */}
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