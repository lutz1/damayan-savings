import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from "firebase/auth";
import { auth, db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import VerifiedIcon from "@mui/icons-material/Verified";
import StarIcon from "@mui/icons-material/Star";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import ElectricScooterIcon from "@mui/icons-material/ElectricScooter";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import LanguageIcon from "@mui/icons-material/Language";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LogoutIcon from "@mui/icons-material/Logout";
import HomeIcon from "@mui/icons-material/Home";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PersonIcon from "@mui/icons-material/Person";

const RiderProfile = () => {
  const [riderData, setRiderData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [loading, setLoading] = useState(true);

  const [passwordDialog, setPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setRiderData(null);
        setEditData({});
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }
      loadRiderProfile(user.uid);
    });

    return () => unsubscribe();
  }, [navigate]);

  const loadRiderProfile = async (uid) => {
    try {
      setLoading(true);
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        const data = userSnap.data() || {};
        setRiderData(data);
        setEditData(data);
      }
    } catch (error) {
      console.error("Error loading rider profile:", error);
      setSnack({ open: true, severity: "error", message: "Failed to load profile." });
    } finally {
      setLoading(false);
    }
  };

  const deliveriesCompleted = useMemo(() => {
    const count = Number(riderData?.completedDeliveries || riderData?.totalDeliveries || 0);
    return Number.isFinite(count) ? count : 0;
  }, [riderData]);

  const profileRating = useMemo(() => {
    const value = Number(riderData?.rating || 4.9);
    return Number.isFinite(value) ? value.toFixed(1) : "4.9";
  }, [riderData]);

  const membershipLevel = useMemo(() => {
    const completed = deliveriesCompleted;
    if (completed >= 1000) return "Gold";
    if (completed >= 300) return "Silver";
    return "Bronze";
  }, [deliveriesCompleted]);

  const handleEditChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const payload = {
        name: String(editData.name || "").trim(),
        contactNumber: String(editData.contactNumber || "").trim(),
        phone: String(editData.phone || editData.contactNumber || "").trim(),
        address: String(editData.address || "").trim(),
        city: String(editData.city || "").trim(),
        vehicleType: String(editData.vehicleType || "Electric Scooter").trim(),
        plateNumber: String(editData.plateNumber || "").trim(),
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, "users", user.uid), payload);
      const merged = { ...riderData, ...payload };
      setRiderData(merged);
      setEditData(merged);
      setEditMode(false);
      setSnack({ open: true, severity: "success", message: "Profile updated successfully." });
    } catch (error) {
      console.error("Error saving profile:", error);
      setSnack({ open: true, severity: "error", message: "Failed to update profile." });
    }
  };

  const handlePasswordChange = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      setSnack({ open: true, severity: "error", message: "Signed-in account has no email." });
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setSnack({ open: true, severity: "error", message: "Please fill all password fields." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setSnack({ open: true, severity: "error", message: "New passwords do not match." });
      return;
    }

    if (newPassword.length < 6) {
      setSnack({ open: true, severity: "error", message: "Password must be at least 6 characters." });
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setPasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSnack({ open: true, severity: "success", message: "Password updated successfully." });
    } catch (error) {
      console.error("Error changing password:", error);
      setSnack({
        open: true,
        severity: "error",
        message: "Could not update password. Ensure current password is correct.",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      setSnack({ open: true, severity: "error", message: "Failed to log out." });
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: "center" }}>
          <CircularProgress size={34} sx={{ mb: 2 }} />
          <Typography sx={{ fontWeight: 800 }}>Loading Rider Profile</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Getting your account information...
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#f6f8f6", pb: 12 }}>
      <Container
        maxWidth="sm"
        disableGutters
        sx={{ minHeight: "100dvh", bgcolor: "#ffffff", borderLeft: "1px solid #edf2ec", borderRight: "1px solid #edf2ec" }}
      >
        <Box sx={{ position: "sticky", top: 0, zIndex: 20, bgcolor: "#fff", borderBottom: "1px solid rgba(91,236,19,0.15)" }}>
          <Box sx={{ display: "flex", alignItems: "center", px: 1.5, py: 1.4 }}>
            <IconButton onClick={() => navigate("/rider/dashboard")}>
              <ArrowBackIcon />
            </IconButton>
            <Typography sx={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 18 }}>
              Rider Profile
            </Typography>
            <IconButton onClick={() => setEditMode((v) => !v)}>
              <EditIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ px: 2, py: 3 }}>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ position: "relative" }}>
              <Avatar
                src={riderData?.profilePicture || ""}
                alt={riderData?.name || "Rider"}
                sx={{ width: 128, height: 128, border: "4px solid rgba(91,236,19,0.2)", bgcolor: "#1f2937" }}
              >
                {String(riderData?.name || "R").charAt(0).toUpperCase()}
              </Avatar>
              <Box
                sx={{
                  position: "absolute",
                  right: 4,
                  bottom: 4,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  bgcolor: "#5bec13",
                  border: "2px solid #fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <VerifiedIcon sx={{ color: "#0f172a", fontSize: 18 }} />
              </Box>
            </Box>

            <Typography sx={{ fontWeight: 900, fontSize: 28, lineHeight: 1.1 }}>
              {riderData?.name || "Rider"}
            </Typography>

            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.7, px: 1.6, py: 0.8, borderRadius: 999, bgcolor: "rgba(91,236,19,0.12)" }}>
              <StarIcon sx={{ color: "#5bec13", fontSize: 16 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{profileRating}</Typography>
              <Typography sx={{ fontSize: 11, color: "#64748b" }}>({deliveriesCompleted}+ deliveries)</Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.2} sx={{ mt: 2.5 }}>
            <Card sx={{ flex: 1, borderRadius: 2.5, border: "1px solid rgba(91,236,19,0.15)", bgcolor: "rgba(91,236,19,0.05)" }}>
              <Box sx={{ p: 1.6 }}>
                <Typography sx={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Level
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 900 }}>{membershipLevel}</Typography>
              </Box>
            </Card>
            <Card sx={{ flex: 1, borderRadius: 2.5, border: "1px solid rgba(91,236,19,0.15)", bgcolor: "rgba(91,236,19,0.05)" }}>
              <Box sx={{ p: 1.6 }}>
                <Typography sx={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Earnings
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 900 }}>
                  P{Number(riderData?.earningsToday || riderData?.totalEarnings || 0).toFixed(2)}
                </Typography>
              </Box>
            </Card>
          </Stack>

          <Typography sx={{ mt: 3, mb: 1.2, px: 1, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#6b7280" }}>
            PERSONAL INFORMATION
          </Typography>
          <Paper sx={{ borderRadius: 2.5, bgcolor: "#f6f8f6", overflow: "hidden" }}>
            {editMode ? (
              <Box sx={{ p: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Full Name"
                  value={editData.name || ""}
                  onChange={(e) => handleEditChange("name", e.target.value)}
                  sx={{ mb: 1.2 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Email"
                  value={editData.email || ""}
                  disabled
                  sx={{ mb: 1.2 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Phone Number"
                  value={editData.contactNumber || ""}
                  onChange={(e) => handleEditChange("contactNumber", e.target.value)}
                  sx={{ mb: 1.2 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Address"
                  value={editData.address || ""}
                  onChange={(e) => handleEditChange("address", e.target.value)}
                  sx={{ mb: 1.2 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="City"
                  value={editData.city || ""}
                  onChange={(e) => handleEditChange("city", e.target.value)}
                />

                <Stack direction="row" spacing={1} sx={{ mt: 1.6 }}>
                  <Button
                    variant="contained"
                    onClick={handleSaveProfile}
                    sx={{ flex: 1, bgcolor: "#5bec13", color: "#102010", fontWeight: 800, "&:hover": { bgcolor: "#4cd70d" } }}
                  >
                    Save Changes
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setEditData(riderData || {});
                      setEditMode(false);
                    }}
                    sx={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Box>
            ) : (
              <>
                <Box sx={{ display: "flex", alignItems: "center", p: 1.8, gap: 1.5 }}>
                  <MailOutlineIcon sx={{ color: "#5bec13" }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11, color: "#6b7280" }}>Email Address</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{riderData?.email || "Not provided"}</Typography>
                  </Box>
                </Box>
                <Divider />
                <Box sx={{ display: "flex", alignItems: "center", p: 1.8, gap: 1.5 }}>
                  <PhoneIphoneIcon sx={{ color: "#5bec13" }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11, color: "#6b7280" }}>Phone Number</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                      {riderData?.contactNumber || riderData?.phone || "Not provided"}
                    </Typography>
                  </Box>
                </Box>
              </>
            )}
          </Paper>

          <Typography sx={{ mt: 3, mb: 1.2, px: 1, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#6b7280" }}>
            VEHICLE DETAILS
          </Typography>
          <Paper sx={{ borderRadius: 2.5, bgcolor: "#f6f8f6", p: 1.8 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: "rgba(91,236,19,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ElectricScooterIcon sx={{ color: "#102010" }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{riderData?.vehicleType || "Electric Scooter"}</Typography>
                <Typography sx={{ fontSize: 12, color: "#6b7280" }}>
                  Plate: {riderData?.plateNumber || "Not provided"}
                </Typography>
              </Box>
              <InfoOutlinedIcon sx={{ color: "#94a3b8" }} />
            </Box>
          </Paper>

          <Typography sx={{ mt: 3, mb: 1.2, px: 1, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#6b7280" }}>
            ACCOUNT SETTINGS
          </Typography>
          <Paper sx={{ borderRadius: 2.5, bgcolor: "#f6f8f6", overflow: "hidden" }}>
            <Button
              fullWidth
              onClick={() => setSnack({ open: true, severity: "info", message: "Notification settings will be available soon." })}
              sx={{ justifyContent: "space-between", px: 1.8, py: 1.6, borderBottom: "1px solid rgba(91,236,19,0.08)", textTransform: "none", color: "#111827" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <NotificationsNoneIcon sx={{ color: "#6b7280" }} />
                <Typography sx={{ fontWeight: 700 }}>Notifications</Typography>
              </Box>
              <ChevronRightIcon sx={{ color: "#9ca3af" }} />
            </Button>

            <Button
              fullWidth
              onClick={() => setSnack({ open: true, severity: "info", message: "App language currently set to English." })}
              sx={{ justifyContent: "space-between", px: 1.8, py: 1.6, borderBottom: "1px solid rgba(91,236,19,0.08)", textTransform: "none", color: "#111827" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <LanguageIcon sx={{ color: "#6b7280" }} />
                <Typography sx={{ fontWeight: 700 }}>App Language</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontSize: 11, color: "#9ca3af" }}>English</Typography>
                <ChevronRightIcon sx={{ color: "#9ca3af" }} />
              </Box>
            </Button>

            <Button
              fullWidth
              onClick={() => setPasswordDialog(true)}
              sx={{ justifyContent: "space-between", px: 1.8, py: 1.6, textTransform: "none", color: "#111827" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <ShieldOutlinedIcon sx={{ color: "#6b7280" }} />
                <Typography sx={{ fontWeight: 700 }}>Security</Typography>
              </Box>
              <ChevronRightIcon sx={{ color: "#9ca3af" }} />
            </Button>
          </Paper>

          <Paper sx={{ mt: 2.5, borderRadius: 2.5, bgcolor: "#f6f8f6", overflow: "hidden" }}>
            <Button
              fullWidth
              onClick={() => setSnack({ open: true, severity: "info", message: "Support center coming soon." })}
              sx={{ justifyContent: "space-between", px: 1.8, py: 1.6, borderBottom: "1px solid rgba(91,236,19,0.08)", textTransform: "none", color: "#111827" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <HelpOutlineIcon sx={{ color: "#6b7280" }} />
                <Typography sx={{ fontWeight: 700 }}>Help & Support</Typography>
              </Box>
              <ChevronRightIcon sx={{ color: "#9ca3af" }} />
            </Button>

            <Button
              fullWidth
              onClick={() => setSnack({ open: true, severity: "info", message: "Legal page coming soon." })}
              sx={{ justifyContent: "space-between", px: 1.8, py: 1.6, textTransform: "none", color: "#111827" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <DescriptionOutlinedIcon sx={{ color: "#6b7280" }} />
                <Typography sx={{ fontWeight: 700 }}>Legal</Typography>
              </Box>
              <ChevronRightIcon sx={{ color: "#9ca3af" }} />
            </Button>
          </Paper>

          <Box sx={{ mt: 3 }}>
            <Button
              fullWidth
              onClick={handleLogout}
              sx={{ py: 1.6, borderRadius: 2.5, bgcolor: "#f1f5f9", color: "#dc2626", textTransform: "none", fontWeight: 900, "&:hover": { bgcolor: "#fee2e2" } }}
              startIcon={<LogoutIcon />}
            >
              Log Out
            </Button>
            <Typography sx={{ textAlign: "center", color: "#9ca3af", fontSize: 11, mt: 2.5, mb: 8 }}>
              App Version 2.4.12-pro
            </Typography>
          </Box>
        </Box>

        <Box sx={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, width: "100%", maxWidth: 600, borderTop: "1px solid rgba(91,236,19,0.15)", bgcolor: "#fff", px: 1, pt: 1, pb: 1.8, zIndex: 30 }}>
          <Stack direction="row" spacing={0.3}>
            <Button
              onClick={() => navigate("/rider/dashboard")}
              sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}
            >
              <HomeIcon sx={{ fontSize: 23 }} />
              <Typography sx={{ fontSize: 10, fontWeight: 700 }}>Home</Typography>
            </Button>
            <Button
              onClick={() => navigate("/rider/orders")}
              sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}
            >
              <ReceiptLongIcon sx={{ fontSize: 23 }} />
              <Typography sx={{ fontSize: 10, fontWeight: 700 }}>Orders</Typography>
            </Button>
            <Button
              onClick={() => navigate("/rider/wallet")}
              sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}
            >
              <AccountBalanceWalletIcon sx={{ fontSize: 23 }} />
              <Typography sx={{ fontSize: 10, fontWeight: 700 }}>Wallet</Typography>
            </Button>
            <Button
              onClick={() => navigate("/rider/profile")}
              sx={{ flex: 1, minWidth: 0, color: "#5bec13", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}
            >
              <PersonIcon sx={{ fontSize: 23 }} />
              <Typography sx={{ fontSize: 10, fontWeight: 900 }}>Profile</Typography>
            </Button>
          </Stack>
        </Box>

        <Dialog open={passwordDialog} onClose={() => setPasswordDialog(false)} fullWidth maxWidth="xs">
          <DialogTitle sx={{ fontWeight: 800 }}>Update Password</DialogTitle>
          <DialogContent>
            <TextField
              margin="dense"
              fullWidth
              type="password"
              label="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <TextField
              margin="dense"
              fullWidth
              type="password"
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <TextField
              margin="dense"
              fullWidth
              type="password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handlePasswordChange} sx={{ bgcolor: "#5bec13", color: "#102010" }}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snack.open}
          autoHideDuration={3200}
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity={snack.severity} onClose={() => setSnack((prev) => ({ ...prev, open: false }))}>
            {snack.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
};

export default RiderProfile;
