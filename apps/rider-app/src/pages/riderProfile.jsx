import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, updatePassword } from "firebase/auth";
import { Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Dialog, DialogContent, DialogTitle, Paper, Stack, TextField, Typography, IconButton } from "@mui/material";
import { ArrowBack, Warning, CheckCircle, Home, ReceiptLong, AccountBalanceWallet, Person } from "@mui/icons-material";
import { createFirebaseClients } from "../../../../shared/firebase/firebaseClient";

const { auth, db } = createFirebaseClients("RiderApp");

export default function RiderProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [passwordDlg, setPasswordDlg] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [passwordMsg, setPasswordMsg] = useState("");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserData(null);
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }

      const loadUser = async () => {
        try {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          const userProfile = userSnap.exists() ? userSnap.data() || {} : {};
          setUserData(userProfile);
          setFormValues(userProfile);
        } catch (error) {
          console.error("Error loading profile:", error);
        } finally {
          setLoading(false);
        }
      };

      loadUser();
    });

    return () => unsubAuth();
  }, [navigate]);

  const handleSaveProfile = async () => {
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), formValues);
        setUserData(formValues);
        setEditMode(false);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMsg("");

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMsg("New passwords do not match.");
      return;
    }

    if (passwordForm.new.length < 6) {
      setPasswordMsg("New password must be at least 6 characters.");
      return;
    }

    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, passwordForm.new);
        setPasswordMsg("Password successfully updated.");
        setTimeout(() => {
          setPasswordDlg(false);
          setPasswordForm({ current: "", new: "", confirm: "" });
        }, 1000);
      }
    } catch (error) {
      setPasswordMsg(error.message || "Failed to update password.");
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const membershipTier = useMemo(() => {
    const deliveries = Number(userData?.completedDeliveries || 0);
    if (deliveries >= 100) return { name: "Platinum", color: "#e879f9" };
    if (deliveries >= 50) return { name: "Gold", color: "#eab308" };
    if (deliveries >= 20) return { name: "Silver", color: "#a8a29e" };
    return { name: "Bronze", color: "#b45309" };
  }, [userData]);

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#f8fafc", pb: 12 }}>
      <Container maxWidth="sm" disableGutters sx={{ minHeight: "100dvh", bgcolor: "#fff" }}>
        <Paper sx={{ position: "sticky", top: 0, zIndex: 10, p: 2, borderRadius: 0, borderBottom: "1px solid #e2e8f0" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={() => navigate("/dashboard")} size="small" sx={{ p: 0.5 }}>
              <ArrowBack sx={{ fontSize: 22 }} />
            </IconButton>
            <Typography sx={{ fontSize: 20, fontWeight: 900 }}>Profile</Typography>
          </Stack>
        </Paper>

        {loading ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <CircularProgress size={30} />
          </Box>
        ) : (
          <Box sx={{ p: 2 }}>
            <Box sx={{ textAlign: "center", mb: 2.5 }}>
              <Avatar
                src={userData?.avatar}
                sx={{ width: 90, height: 90, margin: "0 auto", mb: 1.2, border: "3px solid #e2e8f0" }}
              />
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.6, mb: 0.4 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 900 }}>{userData?.fullName || "Rider Name"}</Typography>
                {userData?.verified && <CheckCircle sx={{ fontSize: 20, color: "#5bec13" }} />}
              </Box>
              <Typography sx={{ fontSize: 13, color: "#64748b" }}>{userData?.email || ""}</Typography>
              <Box sx={{ mt: 1 }}>
                <Typography sx={{ fontSize: 11, color: "#64748b" }}>Membership Tier</Typography>
                <Chip
                  label={membershipTier.name}
                  sx={{ bgcolor: membershipTier.color, color: "#000", fontWeight: 900, mt: 0.5 }}
                />
              </Box>
            </Box>

            <Stack direction="row" spacing={1.2} sx={{ mb: 2 }}>
              <Card sx={{ flex: 1, borderRadius: 2.5 }}>
                <CardContent sx={{ py: 1.4 }}>
                  <Typography sx={{ fontSize: 11, color: "#64748b" }}>DELIVERIES</Typography>
                  <Typography sx={{ fontSize: 21, fontWeight: 900, color: "#5bec13" }}>{userData?.completedDeliveries || 0}</Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, borderRadius: 2.5 }}>
                <CardContent sx={{ py: 1.4 }}>
                  <Typography sx={{ fontSize: 11, color: "#64748b" }}>RATING</Typography>
                  <Typography sx={{ fontSize: 21, fontWeight: 900, color: "#2563eb" }}>{(userData?.rating || 0).toFixed(1)}</Typography>
                </CardContent>
              </Card>
            </Stack>

            <Paper sx={{ p: 2, borderRadius: 2.5, border: "1px solid #e2e8f0", mb: 1.5 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1.2 }}>Personal Information</Typography>
              {editMode ? (
                <Stack spacing={1.2}>
                  <TextField
                    label="Full Name"
                    size="small"
                    fullWidth
                    value={formValues.fullName || ""}
                    onChange={(e) => setFormValues({ ...formValues, fullName: e.target.value })}
                  />
                  <TextField
                    label="Phone"
                    size="small"
                    fullWidth
                    value={formValues.phone || ""}
                    onChange={(e) => setFormValues({ ...formValues, phone: e.target.value })}
                  />
                  <TextField
                    label="Address"
                    size="small"
                    fullWidth
                    value={formValues.address || ""}
                    onChange={(e) => setFormValues({ ...formValues, address: e.target.value })}
                  />
                  <TextField
                    label="City"
                    size="small"
                    fullWidth
                    value={formValues.city || ""}
                    onChange={(e) => setFormValues({ ...formValues, city: e.target.value })}
                  />
                  <TextField
                    label="Vehicle Type"
                    size="small"
                    fullWidth
                    value={formValues.vehicleType || ""}
                    onChange={(e) => setFormValues({ ...formValues, vehicleType: e.target.value })}
                  />
                  <TextField
                    label="License Plate"
                    size="small"
                    fullWidth
                    value={formValues.licensePlate || ""}
                    onChange={(e) => setFormValues({ ...formValues, licensePlate: e.target.value })}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" fullWidth onClick={handleSaveProfile} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 800 }}>
                      Save Changes
                    </Button>
                    <Button variant="outlined" fullWidth onClick={() => setEditMode(false)} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 800 }}>
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <>
                  <Stack spacing={1}>
                    <Box sx={{ pb: 1, borderBottom: "1px solid #e2e8f0" }}>
                      <Typography sx={{ fontSize: 11, color: "#64748b" }}>FULL NAME</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{userData?.fullName || "Not set"}</Typography>
                    </Box>
                    <Box sx={{ pb: 1, borderBottom: "1px solid #e2e8f0" }}>
                      <Typography sx={{ fontSize: 11, color: "#64748b" }}>PHONE</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{userData?.phone || "Not set"}</Typography>
                    </Box>
                    <Box sx={{ pb: 1, borderBottom: "1px solid #e2e8f0" }}>
                      <Typography sx={{ fontSize: 11, color: "#64748b" }}>ADDRESS</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{userData?.address || "Not set"}</Typography>
                    </Box>
                    <Box sx={{ pb: 1, borderBottom: "1px solid #e2e8f0" }}>
                      <Typography sx={{ fontSize: 11, color: "#64748b" }}>CITY</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{userData?.city || "Not set"}</Typography>
                    </Box>
                    <Box sx={{ pb: 1, borderBottom: "1px solid #e2e8f0" }}>
                      <Typography sx={{ fontSize: 11, color: "#64748b" }}>VEHICLE TYPE</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{userData?.vehicleType || "Not set"}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 11, color: "#64748b" }}>LICENSE PLATE</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{userData?.licensePlate || "Not set"}</Typography>
                    </Box>
                  </Stack>
                  <Button fullWidth variant="contained" onClick={() => setEditMode(true)} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 800, mt: 1.5 }}>
                    Edit Profile
                  </Button>
                </>
              )}
            </Paper>

            <Stack spacing={1} sx={{ mb: 1.5 }}>
              <Button fullWidth variant="outlined" onClick={() => setPasswordDlg(true)} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 800 }}>
                Change Password
              </Button>
              <Button fullWidth variant="outlined" color="error" onClick={handleLogout} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 800 }}>
                Sign Out
              </Button>
            </Stack>
          </Box>
        )}

        <Dialog open={passwordDlg} onClose={() => setPasswordDlg(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 900 }}>Change Password</DialogTitle>
          <DialogContent sx={{ py: 2 }}>
            <Stack spacing={1.5}>
              <TextField
                label="Current Password"
                type="password"
                fullWidth
                size="small"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
              />
              <TextField
                label="New Password"
                type="password"
                fullWidth
                size="small"
                value={passwordForm.new}
                onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
              />
              <TextField
                label="Confirm New Password"
                type="password"
                fullWidth
                size="small"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              />
              {passwordMsg && (
                <Box sx={{ p: 1.2, borderRadius: 1, bgcolor: passwordMsg.includes("success") || passwordMsg.includes("updated") ? "#dcfce7" : "#fee2e2", display: "flex", gap: 0.8 }}>
                  <Warning sx={{ fontSize: 18, color: passwordMsg.includes("success") || passwordMsg.includes("updated") ? "#16a34a" : "#dc2626", flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 12, color: passwordMsg.includes("success") || passwordMsg.includes("updated") ? "#16a34a" : "#dc2626" }}>{passwordMsg}</Typography>
                </Box>
              )}
              <Stack direction="row" spacing={1}>
                <Button fullWidth variant="contained" onClick={handlePasswordChange} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 800 }}>
                  Update
                </Button>
                <Button fullWidth variant="outlined" onClick={() => { setPasswordDlg(false); setPasswordMsg(""); }} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 800 }}>
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
        </Dialog>

        <Box sx={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, width: "100%", maxWidth: 600, borderTop: "1px solid rgba(91,236,19,0.15)", bgcolor: "#fff", px: 1, pt: 1, pb: 1.8, zIndex: 30 }}>
          <Stack direction="row" spacing={0.3}>
            <Button onClick={() => navigate("/dashboard")} sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><Home sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 700 }}>Home</Typography></Button>
            <Button onClick={() => navigate("/orders")} sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><ReceiptLong sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 700 }}>Orders</Typography></Button>
            <Button onClick={() => navigate("/wallet")} sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><AccountBalanceWallet sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 700 }}>Wallet</Typography></Button>
            <Button onClick={() => navigate("/profile")} sx={{ flex: 1, minWidth: 0, color: "#5bec13", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><Person sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 900 }}>Profile</Typography></Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
