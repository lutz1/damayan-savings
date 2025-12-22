// src/pages/admin/AdminProfile.jsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Grid,
  Card,
  TextField,
  Button,
  Avatar,
  CircularProgress,
  useMediaQuery,
  LinearProgress,
  Fade,
  Divider,
  InputAdornment,
  Backdrop,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { doc, getDocs, query, collection, where, updateDoc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updatePassword, onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "../../firebase";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import bgImage from "../../assets/bg.jpg";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Icons
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LockIcon from "@mui/icons-material/Lock";

const AdminProfile = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  const [user, setUser] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [preview, setPreview] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState({});

  const isPasswordValid = newPassword.length >= 6 && newPassword === confirmPassword;

  // Password validation
  useEffect(() => {
    const errors = {};
    if (newPassword && newPassword.length < 6) errors.length = "Password must be at least 6 characters.";
    if (newPassword && confirmPassword && newPassword !== confirmPassword) errors.match = "Passwords do not match.";
    setPasswordErrors(errors);
  }, [newPassword, confirmPassword]);

  // Load admin profile
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const q = query(collection(db, "users"), where("email", "==", currentUser.email));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const adminDoc = snapshot.docs[0];
            const docRef = doc(db, "users", adminDoc.id);
            const unsubSnapshot = onSnapshot(docRef, (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                setAdminData(data);
                setForm(data);
                setLoading(false);
              }
            });
            return () => unsubSnapshot();
          }
        } catch (err) {
          console.error(err);
          setLoading(false);
        }
      } else setLoading(false);
    });
    return () => unsubAuth();
  }, []);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePic(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !adminData) return;
    setSaving(true);
    try {
      let photoURL = adminData.profilePicture || "";
      if (profilePic) {
        const picRef = ref(storage, `profilePictures/${user.uid}`);
        await uploadBytes(picRef, profilePic);
        photoURL = await getDownloadURL(picRef);
      }

      const q = query(collection(db, "users"), where("email", "==", user.email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docRef = doc(db, "users", snapshot.docs[0].id);
        await updateDoc(docRef, {
          username: form.username,
          name: form.name,
          contactNumber: form.contactNumber,
          profilePicture: photoURL,
          updatedAt: new Date().toISOString(),
        });
        setAdminData({ ...form, profilePicture: photoURL });
        setEditMode(false);
        toast.success("Profile updated successfully!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile.");
    }
    setSaving(false);
  };

  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score += 25;
    if (/[A-Z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd)) score += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };

  const getPasswordColor = (strength) => {
    if (strength < 50) return "#f44336";
    if (strength < 75) return "#ff9800";
    return "#4caf50";
  };

  const handleChangePassword = async () => {
    if (!isPasswordValid) return;
    setSaving(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully!");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/requires-recent-login") toast.error("Please log out and log in again before changing password.");
      else toast.error("Failed to update password.");
    }
    setSaving(false);
  };

  if (loading)
    return (
      <Backdrop open>
        <CircularProgress color="inherit" />
      </Backdrop>
    );

  const textFieldStyles = {
    "& .MuiInputBase-input": { color: "white" },
    "& .MuiInputLabel-root": { color: "white" },
    "& .MuiInputLabel-root.Mui-focused": { color: "white" },
    "& .MuiFilledInput-root": {
      backgroundColor: "rgba(255,255,255,0.1)",
      "&:hover": { backgroundColor: "rgba(255,255,255,0.15)" },
    },
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>
      <Box sx={{ zIndex: 5, position: isMobile ? "fixed" : "relative", height: "100%" }}>
        <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 4 },
          mt: 1,
          color: "white",
          minHeight: "100vh",
          width: isMobile ? "100%" : `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
        }}
      >
        <Toolbar />
        <Fade in={!loading}>
          <Box sx={{ maxWidth: 800, mx: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700} sx={{ textAlign: "center" }}>
              Admin Profile
            </Typography>

            {adminData ? (
              <>
                {/* Profile Card */}
                <Card sx={{ backdropFilter: "blur(18px)", background: "rgba(255,255,255,0.2)", borderRadius: 5, p: { xs: 2, sm: 4 }, display: "flex", flexDirection: "column", gap: 3 }}>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <Avatar src={preview || adminData.profilePicture} sx={{ width: isMobile ? 100 : 120, height: isMobile ? 100 : 120, border: "3px solid rgba(255,255,255,0.6)" }} />
                    {editMode && (
                      <Button variant="contained" component="label" size="small" sx={{ textTransform: "none", borderRadius: "20px", background: "linear-gradient(90deg,#4facfe,#00f2fe)" }}>
                        Upload Photo
                        <input hidden type="file" onChange={handleFileChange} />
                      </Button>
                    )}
                    <Typography variant="h6" sx={{ fontWeight: 600, textTransform: "capitalize" }}>
                      {adminData.username}
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} width={"100%"}>
                      <TextField label="Username" fullWidth value={form.username || ""} InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: "white" }} /></InputAdornment>, }} variant="filled" sx={textFieldStyles} />
                    </Grid>

                    <Grid item xs={12} sm={6} width={"100%"}>
                      <TextField label="Full Name" fullWidth value={form.name || ""} onChange={(e) => handleChange("name", e.target.value)} InputProps={{ readOnly: !editMode, startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: "white" }} /></InputAdornment> }} variant="filled" sx={textFieldStyles} />
                    </Grid>

                    <Grid item xs={12} sm={6} width={"100%"}>
                      <TextField label="Email" fullWidth value={form.email || ""} onChange={(e) => handleChange("email", e.target.value)} InputProps={{ readOnly: !editMode, startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: "white" }} /></InputAdornment> }} variant="filled" sx={textFieldStyles} />
                    </Grid>

                    <Grid item xs={12} sm={6} width={"100%"}>
                      <TextField label="Contact Number" fullWidth value={form.contactNumber || ""} onChange={(e) => handleChange("contactNumber", e.target.value)} InputProps={{ readOnly: !editMode, startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ color: "white" }} /></InputAdornment> }} variant="filled" sx={textFieldStyles} />
                    </Grid>

                    <Grid item xs={12} sm={6} width={"100%"}>
                      <TextField label="Role" fullWidth value={form.role || "admin"} InputProps={{ readOnly: true, style: { color: "white" } }} variant="filled" sx={textFieldStyles} />
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
                    {!editMode ? (
                      <Button variant="contained" onClick={() => setEditMode(true)} sx={{ px: 4, py: 1.2, borderRadius: "30px", textTransform: "none", background: "linear-gradient(90deg,#4facfe,#00f2fe)" }}>
                        Edit Profile
                      </Button>
                    ) : (
                      <Button variant="contained" onClick={handleSaveProfile} disabled={saving} sx={{ px: 4, py: 1.2, borderRadius: "30px", textTransform: "none", background: "linear-gradient(90deg,#43e97b,#38f9d7)" }}>
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                    )}
                  </Box>
                </Card>

                <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.3)" }} />

                {/* Change Password Card */}
                <Card sx={{ backdropFilter: "blur(18px)", background: "rgba(255,255,255,0.2)", borderRadius: 5, p: { xs: 2, sm: 4 }, display: "flex", flexDirection: "column", gap: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Change Password
                  </Typography>

                  <TextField label="New Password" type="password" fullWidth value={newPassword} onChange={(e) => setNewPassword(e.target.value)} sx={textFieldStyles} InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: "white" }} /></InputAdornment> }} variant="filled" />

                  {newPassword && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <LinearProgress variant="determinate" value={getPasswordStrength(newPassword)} sx={{ height: 8, borderRadius: 2, flexGrow: 1, backgroundColor: "rgba(255,255,255,0.3)", "& .MuiLinearProgress-bar": { backgroundColor: getPasswordColor(getPasswordStrength(newPassword)) } }} />
                      <Typography variant="caption" sx={{ color: "#fff", minWidth: 80 }}>
                        {getPasswordStrength(newPassword) < 50 ? "Weak" : getPasswordStrength(newPassword) < 75 ? "Medium" : "Strong"}
                      </Typography>
                    </Box>
                  )}

                  <TextField label="Confirm Password" type="password" fullWidth value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} sx={textFieldStyles} InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: "white" }} /></InputAdornment> }} variant="filled" />

                  {Object.values(passwordErrors).map((err, i) => (
                    <Typography key={i} variant="body2" sx={{ color: "#ff5252", fontSize: 13 }}>
                      {err}
                    </Typography>
                  ))}

                  <Button variant="contained" onClick={handleChangePassword} sx={{ background: "linear-gradient(90deg,#ff9966,#ff5e62)", textTransform: "none", px: 4, py: 1.2, borderRadius: "30px", alignSelf: "center" }} disabled={!isPasswordValid || saving}>
                    {saving ? "Updating..." : "Update Password"}
                  </Button>
                </Card>
              </>
            ) : (
              <Typography variant="body1" textAlign="center">
                Unable to load profile.
              </Typography>
            )}
          </Box>
        </Fade>
      </Box>

      <ToastContainer position="top-right" autoClose={3000} theme="colored" />
    </Box>
  );
};

export default AdminProfile;