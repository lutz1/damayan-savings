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
  Button,
  Slide,
  Backdrop,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  useMediaQuery,
} from "@mui/material";
import {
  AccountBalanceWallet as WalletIcon,
  Payment as PurchaseIcon,
  Savings as DepositIcon,
  Logout as LogoutIcon,
  Send as TransferIcon,
  MonetizationOn as WithdrawIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  KeyboardArrowRight as CloseIcon,
  Menu as MenuIcon,
  GroupAdd as InviteIcon, // 🆕
  VpnKey as CodeIcon,
} from "@mui/icons-material";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  doc,
  onSnapshot,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot as listenCollection,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import tclcLogo from "../assets/tclc-logo1.png";

const Topbar = ({ open, onToggleSidebar }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [codeType, setCodeType] = useState("");
  const [availableCodes, setAvailableCodes] = useState([]);

   // 🆕 Invite form states
  const [inviteForm, setInviteForm] = useState({
    activationCode: "",
    upline: "",
    username: "",
    fullName: "",
    email: "",
    contact: "",
    address: "",
    role: "member",
    password: "",
  });

  const [userData, setUserData] = useState({
    name: "",
    email: "",
    eWallet: 0,
    lockInBalance: 1000,
    role: "member",
  });

  // ✅ Real-time user info listener
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) return;

      const userRef = doc(db, "users", currentUser.uid);

      const unsubscribeUser = onSnapshot(
        userRef,
        { includeMetadataChanges: true },
        async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            let rawWallet = Number(data.eWallet) || 0;
            let lockInBalance = 0;
            let displayWallet = rawWallet;

            if (rawWallet >= 1000) {
              lockInBalance = 1000;
              displayWallet = rawWallet - 1000;
            }

            if (displayWallet < 0) displayWallet = 0;

            setUserData({
              name: data.name || "Unknown User",
              email: data.email || currentUser.email || "No email",
              eWallet: displayWallet,
              lockInBalance,
              role: data.role || "member",
            });

            // ✅ Listen to available codes
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
        },
        (error) => {
          console.error("Firestore listener error:", error);
          setUserData({
            name: "Unknown User",
            email: currentUser?.email || "",
            eWallet: 0,
            lockInBalance: 0,
            role: "member",
          });
        }
      );

      return () => unsubscribeUser();
    });

    return () => unsubscribeAuth();
  }, []);

  // ✅ Logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // ✅ Drawer open/close
  const openDrawer = () => {
    setDrawerOpen(true);
    setTimeout(() => setSlideIn(true), 50);
  };
  const closeDrawer = () => {
    setSlideIn(false);
    setTimeout(() => setDrawerOpen(false), 300);
  };

  // ✅ Dialog open/close
  const handleOpenDialog = (type) => setDialog(type);
  useEffect(() => {
  if (dialog === "invite" && userData.name) {
    setInviteForm((prev) => ({ ...prev, upline: userData.name }));
  }
}, [dialog, userData.name]);
  const handleCloseDialog = () => {
    setDialog(null);
    setAmount("");
    setRecipient("");
    setCodeType("");
  };

// ✅ Updated Invite & Earn Registration — with Pending Approval
const handleInviteRegister = async () => {
  try {
    const {
      activationCode,
      username,
      fullName,
      email,
      contact,
      address,
      role,
    } = inviteForm;

    if (!activationCode)
      return alert("Please select an activation code.");
    if (!username || !fullName || !email)
      return alert("Please fill all required fields.");

    const q = query(
      collection(db, "purchaseCodes"),
      where("code", "==", activationCode),
      where("used", "==", false)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("Invalid or already used activation code.");
      return;
    }

    const codeDoc = snapshot.docs[0];
    const codeRef = codeDoc.ref;

    // ✅ Create pending registration (not yet in users)
    const pendingData = {
      activationCode,
      upline: userData.name,
      username,
      fullName,
      email,
      contact,
      address,
      role,
      status: "pending",
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "pendingInvites"), pendingData);

    // Mark activation code temporarily as reserved
    await updateDoc(codeRef, { used: true });

    alert(
      `✅ Registration submitted for approval!\nOnce approved by admin, the account will be created.`
    );
    handleCloseDialog();
  } catch (error) {
    console.error("Invite registration failed:", error);
    alert("Registration failed. Please try again.");
  }
};

  // ✅ Handle submit for all dialogs
  const handleSubmitAction = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return alert("User not authenticated.");

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return alert("User not found in database.");

      const data = snap.data();
      const currentWallet = Number(data.eWallet) || 0;

      if (dialog === "purchase") {
        if (!codeType) return alert("Please select a code type to purchase.");
        if (currentWallet < 500) {
          alert("Insufficient wallet balance. ₱500 is required to purchase a code.");
          return;
        }

        // Deduct ₱500
        await updateDoc(userRef, {
          eWallet: currentWallet - 500,
        });

        // Generate random code
        const randomCode = `TCLC-${Math.random()
          .toString(36)
          .substring(2, 10)
          .toUpperCase()}`;

        // Save to Firestore
        await addDoc(collection(db, "purchaseCodes"), {
          userId: user.uid,
          name: data.name || "Unknown User",
          email: data.email || user.email,
          code: randomCode,
          type: codeType,
          used: false,
          amount: 500,
          createdAt: serverTimestamp(),
        });

        alert(
          `✅ Purchase successful!\nType: ${codeType}\nCode: ${randomCode}\n₱500 has been deducted from your wallet.`
        );
      } else {
        alert(
          `Action: ${dialog}\nAmount: ₱${amount}\nRecipient: ${recipient || "N/A"}`
        );
      }

      handleCloseDialog();
    } catch (error) {
      console.error("Transaction failed:", error);
      alert("Transaction failed. Please try again.");
    }
  };

  return (
    <>
      {/* ✅ AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: {
            xs: "100%",
            md: `calc(100% - ${open ? 240 : 60}px)`,
          },
          ml: {
            xs: 0,
            md: `${open ? 240 : 60}px`,
          },
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
              <IconButton color="inherit" onClick={onToggleSidebar} sx={{ mr: 1 }}>
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
                alt={userData.name || "User"}
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

      {/* ✅ Backdrop */}
      <Backdrop
        open={drawerOpen}
        sx={{
          zIndex: 1200,
          backgroundColor: "rgba(0,0,0,0.3)",
          backdropFilter: "blur(5px)",
        }}
        onClick={closeDrawer}
      />

      {/* ✅ Slide Drawer */}
      {drawerOpen && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            right: 0,
            height: "100vh",
            width: 350,
            zIndex: 1300,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            pointerEvents: "none",
          }}
        >
          <Slide direction="left" in={slideIn} mountOnEnter unmountOnExit>
            <Box
              sx={{
                width: 330,
                height: "95%",
                borderRadius: "20px 0 0 20px",
                background: "rgba(30,30,30,0.75)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 8px 25px rgba(0,0,0,0.4)",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                p: 2.5,
                position: "relative",
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
              <Box sx={{ textAlign: "center", mb: 0, mt: 0 }}>
                <Avatar
                  alt={userData.name}
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
                  {userData.name}
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

              <Divider sx={{ borderColor: "rgba(255,255,255,0.2)", mb: 2 }} />

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
                    <WalletIcon fontSize="small" sx={{ mr: 1, color: "#4CAF50" }} />
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
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 1,
                      display: "flex",
                      alignItems: "center",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    <LockIcon fontSize="small" sx={{ mr: 0.5 }} />
                    Lock-in Balance: ₱
                    {userData.lockInBalance.toLocaleString("en-PH", {
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
                    <CodeIcon fontSize="small" sx={{ mr: 1, color: "#FFD54F" }} />
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
                        mb: 0.5,
                      }}
                    >
                      {code.type}: {code.code}
                    </Typography>
                  ))}
                </Box>
              )}

              {/* Drawer List */}
              <List>
  {/* ✅ Purchase Codes (enabled) */}
  <ListItem disablePadding>
    <ListItemButton onClick={() => handleOpenDialog("purchase")}>
      <ListItemIcon>
        <PurchaseIcon sx={{ color: "#4FC3F7" }} />
      </ListItemIcon>
      <ListItemText primary="Purchase Codes" />
    </ListItemButton>
  </ListItem>

  {/* 🚫 Disabled Features */}
  <ListItem disablePadding>
    <ListItemButton disabled>
      <ListItemIcon>
        <WithdrawIcon sx={{ color: "gray" }} />
      </ListItemIcon>
      <ListItemText
        primary="Withdrawal (Disabled)"
        sx={{ color: "rgba(255,255,255,0.4)" }}
      />
    </ListItemButton>
  </ListItem>

  <ListItem disablePadding>
    <ListItemButton disabled>
      <ListItemIcon>
        <DepositIcon sx={{ color: "gray" }} />
      </ListItemIcon>
      <ListItemText
        primary="Deposit (Disabled)"
        sx={{ color: "rgba(255,255,255,0.4)" }}
      />
    </ListItemButton>
  </ListItem>

  <ListItem disablePadding>
    <ListItemButton disabled>
      <ListItemIcon>
        <TransferIcon sx={{ color: "gray" }} />
      </ListItemIcon>
      <ListItemText
        primary="Transfer Funds (Disabled)"
        sx={{ color: "rgba(255,255,255,0.4)" }}
      />
    </ListItemButton>
  </ListItem>

  {/* 🆕 Invite & Earn */}
  <ListItem disablePadding>
    <ListItemButton onClick={() => handleOpenDialog("invite")}>
      <ListItemIcon>
        <InviteIcon sx={{ color: "#FFB300" }} />
      </ListItemIcon>
      <ListItemText primary="Invite & Earn" />
    </ListItemButton>
  </ListItem>
</List>

              <Box sx={{ flexGrow: 1 }} />
              <Divider sx={{ borderColor: "rgba(255,255,255,0.2)", mb: 2 }} />

              <Button
                fullWidth
                variant="outlined"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{
                  color: "#FF5252",
                  borderColor: "rgba(255,255,255,0.3)",
                  "&:hover": {
                    borderColor: "#FF5252",
                    background: "rgba(255,82,82,0.1)",
                  },
                }}
              >
                Logout
              </Button>
            </Box>
          </Slide>
        </Box>
      )}

      {/* ✅ Dialog */}
      <Dialog open={Boolean(dialog)} onClose={handleCloseDialog}>
        <DialogTitle sx={{ textTransform: "capitalize" }}>
          {dialog === "purchase" ? "Purchase Code" : `${dialog} Form`}
        </DialogTitle>
        <DialogContent dividers>
          {dialog === "purchase" && (
            <>
              <TextField
                select
                fullWidth
                margin="dense"
                label="Select Code Type"
                value={codeType}
                onChange={(e) => setCodeType(e.target.value)}
              >
                <MenuItem value="Activate Capital Share">
                  Activate Capital Share
                </MenuItem>
                <MenuItem value="Activate Genealogy Tree">
                  Activate Genealogy Tree
                </MenuItem>
                <MenuItem value="Downline Code">Downline Code</MenuItem>
              </TextField>
              <Typography variant="body2" sx={{ mt: 1.5, color: "gray" }}>
                Each code costs ₱500. Purchased codes will appear under “Available
                Codes”.
              </Typography>
            </>
          )}

          {dialog === "transfer" && (
            <TextField
              fullWidth
              margin="dense"
              label="Recipient Username or ID"
              variant="outlined"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          )}

          {dialog !== "purchase" && (
            <TextField
              fullWidth
              margin="dense"
              label="Amount (₱)"
              variant="outlined"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmitAction} variant="contained">
            Submit
          </Button>
        </DialogActions>
      </Dialog>
      {/* 🆕 Invite & Earn Registration Dialog */}
<Dialog open={dialog === "invite"} onClose={handleCloseDialog}>
  <DialogTitle>Invite & Earn Registration</DialogTitle>
  <DialogContent dividers>
    {/* ✅ Activation Code Dropdown */}
    <TextField
      select
      fullWidth
      label="Select Activation Code"
      margin="dense"
      value={inviteForm.activationCode}
      onChange={(e) =>
        setInviteForm({ ...inviteForm, activationCode: e.target.value })
      }
    >
      {availableCodes.length > 0 ? (
        availableCodes.map((code, index) => (
          <MenuItem key={index} value={code.code}>
            {code.type} — {code.code}
          </MenuItem>
        ))
      ) : (
        <MenuItem disabled>No available codes</MenuItem>
      )}
    </TextField>

    {/* ✅ Upline auto-filled */}
    <TextField
      fullWidth
      label="Upline"
      margin="dense"
      value={userData.name}
      InputProps={{ readOnly: true }}
    />

    <TextField
      fullWidth
      label="Username"
      margin="dense"
      value={inviteForm.username}
      onChange={(e) =>
        setInviteForm({ ...inviteForm, username: e.target.value })
      }
    />
    <TextField
      fullWidth
      label="Full Name"
      margin="dense"
      value={inviteForm.fullName}
      onChange={(e) =>
        setInviteForm({ ...inviteForm, fullName: e.target.value })
      }
    />
    <TextField
      fullWidth
      label="Email"
      margin="dense"
      value={inviteForm.email}
      onChange={(e) =>
        setInviteForm({ ...inviteForm, email: e.target.value })
      }
    />
    <TextField
      fullWidth
      label="Contact Number"
      margin="dense"
      value={inviteForm.contact}
      onChange={(e) =>
        setInviteForm({ ...inviteForm, contact: e.target.value })
      }
    />
    <TextField
      fullWidth
      label="Address"
      margin="dense"
      value={inviteForm.address}
      onChange={(e) =>
        setInviteForm({ ...inviteForm, address: e.target.value })
      }
    />

    {/* ✅ Role dropdown updated */}
    <TextField
      select
      fullWidth
      label="Role"
      margin="dense"
      value={inviteForm.role}
      onChange={(e) =>
        setInviteForm({ ...inviteForm, role: e.target.value })
      }
    >
      <MenuItem value="MD">MD</MenuItem>
      <MenuItem value="MS">MS</MenuItem>
      <MenuItem value="MI">MI</MenuItem>
      <MenuItem value="Agent">Agent</MenuItem>
      <MenuItem value="Member">Member</MenuItem>
    </TextField>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleCloseDialog}>Cancel</Button>
    <Button variant="contained" onClick={handleInviteRegister}>
      Register
    </Button>
  </DialogActions>
</Dialog>
    </>
  );
};

export default Topbar;