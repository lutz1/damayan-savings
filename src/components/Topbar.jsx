import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  useMediaQuery,
  Badge,
  Drawer,
} from "@mui/material";
import {
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
  Menu as MenuIcon,
  ConfirmationNumber as VoucherIcon,
  NotificationsNone as NotificationsNoneIcon,
  NotificationsActive as NotificationsActiveIcon,
  InfoOutlined as InfoOutlinedIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Celebration as CelebrationIcon,
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
  updateDoc,
  getDocs,
  or,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import appLogo from "../assets/newlogo.png";
import { onForegroundFcmMessage, setupFcmForCurrentUser } from "../utils/pushNotifications";

// Dialog components
import PurchaseCodesDialog from "./Topbar/dialogs/PurchaseCodesDialog";
import WithdrawDialog from "./Topbar/dialogs/WithdrawDialog";
import DepositDialog from "./Topbar/dialogs/DepositDialog";
import TransferFundsDialog from "./Topbar/dialogs/TransferFundsDialog";
import InviteEarnDialog from "./Topbar/dialogs/InviteEarnDialog";
import EwalletHistoryDialog from "./Topbar/dialogs/EwalletHistoryDialog";
import { History as HistoryIcon } from "@mui/icons-material";

const Topbar = ({ open, onToggleSidebar, dialogProps = {}, openDepositDialog = false, onDepositDialogChange = null }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const [dialog, setDialog] = useState(openDepositDialog ? "deposit" : null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const knownNotificationIdsRef = useRef(new Set());
  const notifListenerInitializedRef = useRef(false);
  const [notifListenerFailed, setNotifListenerFailed] = useState(false);
  const appBaseUrl = import.meta.env.BASE_URL || "/";
  const [userData, setUserData] = useState({
    uid: "",
    username: "",
    email: "",
    eWallet: 0,
    role: "member",
    profilePicture: "",
  });
  const [availableCodes, setAvailableCodes] = useState([]);
  // Emails that should have some actions disabled
  const restrictedEmails = [
    "dionesiovelasquez@gmail.com",
    "ericalvarez@gmail.com",
    "melchor@gmail.com",
    "vanessa.ilagan@gmail.com",
    "admin1@gmail.com",
    "admin2@gmail.com"
  ];
  /*
  const restrictedForAdmin = ["Purchase Codes", "Withdrawal", /* "Deposit", */ "Transfer Funds", "Invite & Earn" // DISABLED: deposits disabled for now
*
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
          const normalizedUserRole = String(data.role || "").trim().toUpperCase();
          setUserData({
            uid: currentUser.uid,
            username: data.username || "UnknownUser",
            email: data.email || currentUser.email || "No email",
            eWallet: isNaN(Number(data.eWallet)) ? 0 : Number(data.eWallet),
            role: data.role || "member",
            profilePicture: data.profilePicture || "", // ✅ added
          });

          if (unsubscribeCodes) {
            unsubscribeCodes();
            unsubscribeCodes = null;
          }

          // Admin-like roles do not use purchase codes in Topbar; avoid unnecessary listeners.
          if (!["ADMIN", "CEO", "SUPERADMIN"].includes(normalizedUserRole)) {
            const codesRef = collection(db, "purchaseCodes");
            const q = query(
              codesRef,
              where("userId", "==", currentUser.uid),
              where("used", "==", false)
            );

            unsubscribeCodes = listenCollection(
              q,
              (snap) => {
                const codes = snap.docs.map((d) => d.data());
                setAvailableCodes(codes);
              },
              (error) => {
                if (error?.code !== "permission-denied") {
                  console.error("Topbar purchase codes listener error:", error);
                }
                setAvailableCodes([]);
              }
            );
          } else {
            setAvailableCodes([]);
          }
        }
      }, (error) => {
        if (error?.code !== "permission-denied") {
          console.error("Topbar user listener error:", error);
        }
      });
    });

    return () => {
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeCodes) unsubscribeCodes();
      unsubscribeAuth();
    };
  }, []);

  // 🔹 Sync dialog state with prop
  useEffect(() => {
    if (openDepositDialog) {
      setDialog("deposit");
    }
  }, [openDepositDialog]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      try {
        localStorage.removeItem('locationCompleted');
        localStorage.removeItem('userRole');
        localStorage.removeItem('uid');
        localStorage.clear();
      } catch (e) {}
      try {
        sessionStorage.removeItem('redirect');
      } catch (e) {}
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

  const handleOpenLogoutDialog = () => setLogoutDialogOpen(true);
  const handleCloseLogoutDialog = () => setLogoutDialogOpen(false);
  const normalizedRole = String(userData.role || localStorage.getItem("userRole") || "")
    .trim()
    .toUpperCase();
  const isAdminLike = ["ADMIN", "CEO", "SUPERADMIN"].includes(normalizedRole);

  const playNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.25);

      oscillator.onended = () => {
        ctx.close().catch(() => {});
      };
    } catch (_) {}
  };

  const showBrowserNotification = (item) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const show = () => {
      try {
        const notification = new Notification(item?.title || "New notification", {
          body: item?.message || "You have a new update.",
          icon: `${appBaseUrl}logo192.png`,
          badge: `${appBaseUrl}logo192.png`,
          tag: `amayan-notif-${item?.id || Date.now()}`,
        });
        notification.onclick = () => {
          window.focus();
        };
      } catch (_) {}
    };

    if (Notification.permission === "granted") {
      show();
      return;
    }

    if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") show();
      }).catch(() => {});
    }
  };

  const refreshNotifications = useCallback(async () => {
    if (!isAdminLike || !userData.uid) return;
    try {
      const q = query(
        collection(db, "notifications"),
        or(where("userId", "==", userData.uid), where("recipientUid", "==", userData.uid))
      );
      const snap = await getDocs(q);
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
    } catch (_) {}
  }, [isAdminLike, userData.uid]);

  useEffect(() => {
    if (!isAdminLike || !userData.uid) {
      setNotifications([]);
      setUnreadCount(0);
      knownNotificationIdsRef.current = new Set();
      notifListenerInitializedRef.current = false;
      setNotifListenerFailed(false);
      return undefined;
    }

    refreshNotifications();

    const q = query(
      collection(db, "notifications"),
      or(where("userId", "==", userData.uid), where("recipientUid", "==", userData.uid))
    );
    const unsub = listenCollection(
      q,
      (snap) => {
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const currentIds = new Set(items.map((n) => n.id));
        const newUnreadItems = items.filter((n) => !n.read && !knownNotificationIdsRef.current.has(n.id));

        if (notifListenerInitializedRef.current && newUnreadItems.length > 0) {
          playNotificationSound();
          if (document.hidden) {
            showBrowserNotification(newUnreadItems[0]);
          }
        }

        knownNotificationIdsRef.current = currentIds;
        notifListenerInitializedRef.current = true;
        setNotifListenerFailed(false);

        setNotifications(items);
        setUnreadCount(items.filter((n) => !n.read).length);
      },
      () => {
        setNotifListenerFailed(true);
        refreshNotifications();
      }
    );

    return () => unsub();
  }, [isAdminLike, userData.uid, refreshNotifications]);

  useEffect(() => {
    if (!isAdminLike || !userData.uid || !notifListenerFailed) return undefined;
    const interval = setInterval(() => {
      refreshNotifications();
    }, 4000);
    return () => clearInterval(interval);
  }, [isAdminLike, userData.uid, notifListenerFailed, refreshNotifications]);

  useEffect(() => {
    if (!userData.uid) return undefined;

    let fcmSynced = false;
    const trySetupFcm = async () => {
      if (fcmSynced) return;
      const token = await setupFcmForCurrentUser().catch(() => null);
      if (token) {
        fcmSynced = true;
      }
    };

    trySetupFcm();

    const retryInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        trySetupFcm();
      }
    }, 15000);

    const handleOnline = () => {
      trySetupFcm();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        trySetupFcm();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    let unsubscribe = () => {};
    let cancelled = false;

    onForegroundFcmMessage((payload) => {
      if (cancelled) return;
      playNotificationSound();

      if (document.hidden) {
        showBrowserNotification({
          id: payload?.messageId,
          title: payload?.notification?.title || payload?.data?.title,
          message: payload?.notification?.body || payload?.data?.body,
        });
      }
    }).then((unsub) => {
      if (cancelled) {
        unsub?.();
        return;
      }
      unsubscribe = unsub || (() => {});
    });

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(retryInterval);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userData.uid]);

  const handleOpenNotifications = async () => {
    // Run setup from a user gesture so browsers can allow permission/token flow.
    await setupFcmForCurrentUser().catch(() => null);

    setNotifDrawerOpen(true);
    notifications
      .filter((n) => !n.read)
      .forEach((n) => {
        updateDoc(doc(db, "notifications", n.id), { read: true }).catch(() => {});
      });
    setUnreadCount(0);
  };

  const isPasswordRelatedNotification = (notification) => {
    const text = `${notification?.title || ""} ${notification?.message || ""}`.toLowerCase();
    return text.includes("password") || text.includes("reset") || text.includes("mpin");
  };

  return (
    <>
      {/* 🔹 Top AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: "100%",
          ml: 0,
          transition: "all 0.3s ease",
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
          color: "#fff",
          boxShadow: "0 8px 32px rgba(31, 38, 135, 0.25)",
          zIndex: 1201,
          pt: "env(safe-area-inset-top)",
        }}
      >
        <Toolbar
          sx={{
            display: "flex",
            justifyContent: "space-between",
            minHeight: { xs: 56, sm: 64 },
          }}
        >
          {/* Left */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {onToggleSidebar && (
              <IconButton
                color="inherit"
                onClick={onToggleSidebar}
                sx={{
                  color: "#191c1e",
                  backgroundColor: "rgba(255,255,255,0.75)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.95)" },
                  display: ["ADMIN", "CEO", "SUPERADMIN"].includes(normalizedRole)
                    ? { xs: "inline-flex", md: "inline-flex" }
                    : { xs: "none", md: "inline-flex" },
                }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Box
              component="img"
              src={appLogo}
              alt="TCLC Logo"
              sx={{
                width: { xs: 45, sm: 55, md: 60 },
                height: "auto",
                objectFit: "contain",
              }}
            />
          </Box>

          {/* Right */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdminLike && (
              <Tooltip title="Notifications">
                <IconButton color="inherit" onClick={handleOpenNotifications}>
                  <Badge
                    badgeContent={unreadCount > 0 ? unreadCount : null}
                    color="error"
                    max={9}
                    sx={{ "& .MuiBadge-badge": { fontSize: 10, minWidth: 16, height: 16, top: 2, right: 2 } }}
                  >
                    {unreadCount > 0 ? <NotificationsActiveIcon /> : <NotificationsNoneIcon />}
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            <IconButton color="inherit" onClick={openDrawer}>
              <Avatar
                alt={userData.username}
                src={userData.profilePicture || "/logo192.png"}
                sx={{
                  bgcolor: "secondary.main",
                  border: "2px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 0 8px rgba(255,255,255,0.4)",
                  transition: "transform 0.2s ease",
                  "&:hover": { transform: "scale(1.08)" },
                }}
              />
            </IconButton>
          </Box>
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
            width: isMobile ? "70%" : isTablet ? "70%" : 360,
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
                <Box sx={{ textAlign: "center", mt: 2 }}>
                  <Avatar
                    alt={userData.username}
                    src={userData.profilePicture || "/logo192.png"}
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
                {!["ADMIN", "CEO", "SUPERADMIN"].includes(normalizedRole) && (
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
                      <WalletIcon fontSize="small" sx={{ mr: 1, color: "#4CAF50" }} />
                      <Typography component="span" sx={{ flexGrow: 1 }}>
                        E-Wallet
                      </Typography>
                      <Tooltip title="View E-Wallet History">
                        <IconButton
                          onClick={() => setDialog("walletHistory")}
                          size="small"
                          sx={{ color: "#90CAF9" }}
                        >
                          <HistoryIcon />
                        </IconButton>
                      </Tooltip>
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{ color: "#4CAF50", fontWeight: 700 }}
                    >
                      ₱
                      {isNaN(userData.eWallet)
                        ? "0.00"
                        : userData.eWallet.toLocaleString("en-PH", {
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
    { icon: <PurchaseIcon sx={{ color: "#4FC3F7" }} />, label: "Purchase Codes", dialog: "purchase" },
    { icon: <WithdrawIcon sx={{ color: "#FF7043" }} />, label: "Withdrawal", dialog: "withdraw" },
    { icon: <DepositIcon sx={{ color: "#81C784" }} />, label: "Deposit", dialog: "deposit", disabled: true }, // DISABLED: deposits disabled for now
                     { icon: <TransferIcon sx={{ color: "#BA68C8" }} />, label: "Send Money", dialog: "transfer" },
    { icon: <InviteIcon sx={{ color: "#FFB300" }} />, label: "Invite & Earn", dialog: "invite" },
    {
      icon: <VoucherIcon sx={{ color: "#66BB6A" }} />,
      label: "My Vouchers",
      action: () => {
        closeDrawer();
        navigate("/member/vouchers");
      },
      visible: !["ADMIN", "CEO", "SUPERADMIN"].includes(normalizedRole),
    },
    { icon: <LogoutIcon sx={{ color: "#FF5252" }} />, label: "Logout", action: handleOpenLogoutDialog },
  ].filter((item) => item.visible !== false).map((item, i) => {
    const emailLower = (userData.email || "").toLowerCase();
    const isRestrictedUser = restrictedEmails.includes(emailLower);
    const disabledForRestricted = ["Purchase Codes", "Withdrawal", "Invite & Earn"];
    const sendMoneyAllowed = item.label === "Send Money" ? !isRestrictedUser : true;
    const isDisabled =
      (isRestrictedUser && disabledForRestricted.includes(item.label)) ||
      item.disabled === true ||
      !sendMoneyAllowed;

    return (
      <ListItem disablePadding key={i}>
        <ListItemButton
          onClick={() => !isDisabled && (item.dialog ? handleOpenDialog(item.dialog) : item.action?.())}
          sx={{
            opacity: isDisabled ? 0.5 : 1,
            cursor: isDisabled ? "not-allowed" : "pointer",
          }}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText
            primary={item.label}
            sx={{
              color: item.label === "Logout" ? "#FF5252" : "inherit",
              "& .MuiListItemText-primary": {
                fontWeight: item.label === "Logout" ? 600 : "inherit",
              },
            }}
          />
        </ListItemButton>
      </ListItem>
    );
  })}
</List>
              </Box>
            </Box>
          </Slide>
        </Box>
      )}

      {/* 🔹 Dialogs */}
      {dialog === "purchase" && (
        <PurchaseCodesDialog open onClose={handleCloseDialog} userData={userData} availableCodes={availableCodes} db={db} auth={auth} />
      )}
      {dialog === "withdraw" && (
        <WithdrawDialog open onClose={handleCloseDialog} userData={userData} db={db} auth={auth} />
      )}
      {dialog === "deposit" && (
        <DepositDialog open onClose={handleCloseDialog} userData={userData} db={db} auth={auth} />
      )}
      {dialog === "transfer" && (
        <TransferFundsDialog open onClose={handleCloseDialog} userData={userData} db={db} auth={auth} />
      )}
      {dialog === "invite" && (
        <InviteEarnDialog open onClose={handleCloseDialog} userData={userData} availableCodes={availableCodes} db={db} auth={auth} />
      )}
      {dialog === "walletHistory" && (
        <EwalletHistoryDialog open onClose={handleCloseDialog} db={db} auth={auth} />
      )}

      <Drawer
        anchor="right"
        open={notifDrawerOpen}
        onClose={() => setNotifDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 380 },
            borderTopLeftRadius: { xs: 0, sm: 20 },
            borderBottomLeftRadius: { xs: 0, sm: 20 },
            backgroundColor: "#f7f9fc",
          },
        }}
      >
        <Box sx={{ background: "linear-gradient(135deg,#003f8d,#0055ba)", px: 2.5, pt: 3.5, pb: 2.5 }}>
          <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.72)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>
            Inbox
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Notifications</Typography>
          {unreadCount > 0 && (
            <Box
              sx={{
                mt: 0.8,
                display: "inline-flex",
                px: 1,
                py: 0.2,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.22)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              {unreadCount} new
            </Box>
          )}
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 0 }}>
          {notifications.length === 0 ? (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <NotificationsNoneIcon sx={{ fontSize: 48, color: "#c2c6d5", mb: 1 }} />
              <Typography sx={{ fontSize: 13, color: "#8b95a5" }}>No notifications yet.</Typography>
            </Box>
          ) : (
            notifications.map((n) => {
              const isUnread = !n.read;
              const isPasswordRelated = isPasswordRelatedNotification(n);
              const icon = n.type === "reward"
                ? <CelebrationIcon sx={{ fontSize: 20, color: "#105abf" }} />
                : n.type === "success"
                  ? <CheckCircleOutlineIcon sx={{ fontSize: 20, color: "#2e7d32" }} />
                  : <InfoOutlinedIcon sx={{ fontSize: 20, color: "#752a00" }} />;
              const ts = n.createdAt?.seconds
                ? new Date(n.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                : "";
              return (
                <Box key={n.id}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1.5,
                      px: 2,
                      py: 1.8,
                      backgroundColor: isUnread ? "rgba(16,90,191,0.05)" : "#fff",
                      borderLeft: isUnread ? "3px solid #105abf" : "3px solid transparent",
                    }}
                  >
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        backgroundColor: "rgba(16,90,191,0.10)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        mt: 0.2,
                      }}
                    >
                      {icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: isUnread ? 700 : 600, color: "#1f2430", lineHeight: 1.3 }}>
                        {n.title || "Notification"}
                      </Typography>
                      {n.message && (
                        <Typography sx={{ fontSize: 12, color: "#5d646f", mt: 0.3, lineHeight: 1.5 }}>
                          {n.message}
                        </Typography>
                      )}
                      {ts && (
                        <Typography sx={{ fontSize: 10, color: "#8b95a5", mt: 0.5, fontWeight: 600 }}>{ts}</Typography>
                      )}
                      {isAdminLike && isPasswordRelated && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            setNotifDrawerOpen(false);
                            navigate("/admin/password-reset-management");
                          }}
                          sx={{
                            mt: 0.9,
                            borderRadius: 999,
                            textTransform: "none",
                            fontWeight: 700,
                            fontSize: 11,
                            px: 1.4,
                            py: 0.35,
                          }}
                        >
                          Open Password Reset
                        </Button>
                      )}
                    </Box>
                    {isUnread && (
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#105abf", mt: 0.8, flexShrink: 0 }} />
                    )}
                  </Box>
                  <Divider sx={{ ml: 7 }} />
                </Box>
              );
            })
          )}
        </Box>

        <Box sx={{ p: 2, backgroundColor: "#fff", borderTop: "1px solid #eceef1" }}>
          <Button fullWidth onClick={() => setNotifDrawerOpen(false)}>Close</Button>
        </Box>
      </Drawer>

      {/* 🔹 Logout Confirmation Dialog */}
      <Dialog open={logoutDialogOpen} onClose={handleCloseLogoutDialog}>
        <DialogTitle>Confirm Logout</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to logout?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLogoutDialog}>Cancel</Button>
          <Button
            onClick={() => {
              handleCloseLogoutDialog();
              handleLogout();
            }}
            color="error"
          >
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Topbar;