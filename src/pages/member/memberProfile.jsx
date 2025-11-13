// src/pages/member/MemberProfile.jsx
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
import { onAuthStateChanged, updatePassword } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../../firebase";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Icons
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import HomeIcon from "@mui/icons-material/Home";
import LockIcon from "@mui/icons-material/Lock";

const MemberProfile = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [preview, setPreview] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState({});

  const isPasswordValid =
    newPassword.length >= 6 && newPassword === confirmPassword;

  // Real-time password validation
  useEffect(() => {
    const errors = {};
    if (newPassword && newPassword.length < 6)
      errors.length = "Password must be at least 6 characters.";
    if (newPassword && confirmPassword && newPassword !== confirmPassword)
      errors.match = "Passwords do not match.";
    setPasswordErrors(errors);
  }, [newPassword, confirmPassword]);

  // Load user profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const docRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) setUserData(snap.data());
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePic(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !userData) return;
    setSaving(true);
    try {
      let photoURL = userData.profilePicture || "";
      if (profilePic) {
        const picRef = ref(storage, `profilePictures/${user.uid}`);
        await uploadBytes(picRef, profilePic);
        photoURL = await getDownloadURL(picRef);
      }

      await updateDoc(doc(db, "users", user.uid), {
        username: userData.username,
        name: userData.name,
        contactNumber: userData.contactNumber,
        address: userData.address,
        profilePicture: photoURL,
        updatedAt: new Date().toISOString(),
      });

      setUserData({ ...userData, profilePicture: photoURL });
      setEditMode(false);
      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error("Error updating profile:", err);
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
      if (err.code === "auth/requires-recent-login")
        toast.error(
          "Please log out and log in again before changing password."
        );
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
      {/* Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Sidebar */}
      <Box
        sx={{
          zIndex: 5,
          position: isMobile ? "fixed" : "relative",
          height: "100%",
        }}
      >
        <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 4 },
          mt: 1,
          color: "white",
          minHeight: "100vh",
          width: isMobile
            ? "100%"
            : `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
        }}
      >
        <Toolbar />
        <Fade in={!loading}>
          <Box
            sx={{
              maxWidth: 800,
              mx: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <Typography
              variant={isMobile ? "h5" : "h4"}
              fontWeight={700}
              sx={{ textAlign: "center" }}
            >
              My Profile
            </Typography>

            {userData ? (
              <>
                {/* Profile Card */}
                <Card
                  sx={{
                    backdropFilter: "blur(18px)",
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 5,
                    p: { xs: 2, sm: 4 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Avatar
                      src={preview || userData.profilePicture}
                      sx={{
                        width: isMobile ? 100 : 120,
                        height: isMobile ? 100 : 120,
                        border: "3px solid rgba(255,255,255,0.6)",
                      }}
                    />
                    {editMode && (
                      <Button
                        variant="contained"
                        component="label"
                        size="small"
                        sx={{
                          textTransform: "none",
                          borderRadius: "20px",
                          background: "linear-gradient(90deg,#4facfe,#00f2fe)",
                        }}
                      >
                        Upload Photo
                        <input hidden type="file" onChange={handleFileChange} />
                      </Button>
                    )}
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 600, textTransform: "capitalize" }}
                    >
                      {userData.username}
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    {/* Username */}
                    <Grid item xs={12} width={"100%"}>
                      <TextField
                        label="Username"
                        fullWidth
                        value={userData.username || ""}
                        onChange={(e) =>
                          setUserData({
                            ...userData,
                            username: e.target.value,
                          })
                        }
                        InputProps={{
                          readOnly: !editMode,
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonIcon sx={{ color: "white" }} />
                            </InputAdornment>
                          ),
                        }}
                        variant="filled"
                        sx={textFieldStyles}
                      />
                    </Grid>

                    {/* Full Name */}
                    <Grid item xs={12} width={"100%"}>
                      <TextField
                        label="Full Name"
                        fullWidth
                        value={userData.name || ""}
                        onChange={(e) =>
                          setUserData({ ...userData, name: e.target.value })
                        }
                        InputProps={{
                          readOnly: !editMode,
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonIcon sx={{ color: "white" }} />
                            </InputAdornment>
                          ),
                        }}
                        variant="filled"
                        sx={textFieldStyles}
                      />
                    </Grid>

                    {/* Email */}
                    <Grid item xs={12} width={"100%"}>
                      <TextField
                        label="Email"
                        fullWidth
                        value={userData.email || ""}
                        InputProps={{
                          readOnly: true,
                          startAdornment: (
                            <InputAdornment position="start">
                              <EmailIcon sx={{ color: "white" }} />
                            </InputAdornment>
                          ),
                        }}
                        variant="filled"
                        sx={textFieldStyles}
                      />
                    </Grid>

                    {/* Contact Number */}
                    <Grid item xs={12} width={"100%"}>
                      <TextField
                        label="Contact Number"
                        fullWidth
                        value={userData.contactNumber || ""}
                        onChange={(e) =>
                          setUserData({
                            ...userData,
                            contactNumber: e.target.value,
                          })
                        }
                        InputProps={{
                          readOnly: !editMode,
                          startAdornment: (
                            <InputAdornment position="start">
                              <PhoneIcon sx={{ color: "white" }} />
                            </InputAdornment>
                          ),
                        }}
                        variant="filled"
                        sx={textFieldStyles}
                      />
                    </Grid>

                    {/* Address */}
                    <Grid item xs={12} width={"100%"}>
                      <TextField
                        label="Address"
                        fullWidth
                        value={userData.address || ""}
                        onChange={(e) =>
                          setUserData({ ...userData, address: e.target.value })
                        }
                        InputProps={{
                          readOnly: !editMode,
                          startAdornment: (
                            <InputAdornment position="start">
                              <HomeIcon sx={{ color: "white" }} />
                            </InputAdornment>
                          ),
                        }}
                        variant="filled"
                        sx={textFieldStyles}
                      />
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
                    {!editMode ? (
                      <Button
                        variant="contained"
                        onClick={() => setEditMode(true)}
                        sx={{
                          px: 4,
                          py: 1.2,
                          borderRadius: "30px",
                          textTransform: "none",
                          background: "linear-gradient(90deg,#4facfe,#00f2fe)",
                        }}
                      >
                        Edit Profile
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={handleSaveProfile}
                        disabled={saving}
                        sx={{
                          px: 4,
                          py: 1.2,
                          borderRadius: "30px",
                          textTransform: "none",
                          background: "linear-gradient(90deg,#43e97b,#38f9d7)",
                        }}
                      >
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                    )}
                  </Box>
                </Card>

                <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.3)" }} />

                {/* Change Password Card */}
                <Card
                  sx={{
                    backdropFilter: "blur(18px)",
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 5,
                    p: { xs: 2, sm: 4 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    Change Password
                  </Typography>

                  {/* New Password */}
                  <TextField
                    label="New Password"
                    type="password"
                    fullWidth
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    sx={textFieldStyles}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: "white" }} />
                        </InputAdornment>
                      ),
                    }}
                    variant="filled"
                  />

                  {/* Password Strength */}
                  {newPassword && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={getPasswordStrength(newPassword)}
                        sx={{
                          height: 8,
                          borderRadius: 2,
                          flexGrow: 1,
                          backgroundColor: "rgba(255,255,255,0.3)",
                          "& .MuiLinearProgress-bar": {
                            backgroundColor: getPasswordColor(
                              getPasswordStrength(newPassword)
                            ),
                          },
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ color: "#fff", minWidth: 80 }}
                      >
                        {getPasswordStrength(newPassword) < 50
                          ? "Weak"
                          : getPasswordStrength(newPassword) < 75
                          ? "Medium"
                          : "Strong"}
                      </Typography>
                    </Box>
                  )}

                  {/* Confirm Password */}
                  <TextField
                    label="Confirm Password"
                    type="password"
                    fullWidth
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    sx={textFieldStyles}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: "white" }} />
                        </InputAdornment>
                      ),
                    }}
                    variant="filled"
                  />

                  {/* Error Messages */}
                  {Object.values(passwordErrors).map((err, i) => (
                    <Typography
                      key={i}
                      variant="body2"
                      sx={{ color: "#ff5252", fontSize: 13 }}
                    >
                      {err}
                    </Typography>
                  ))}

                  {/* Update Button */}
                  <Button
                    variant="contained"
                    onClick={handleChangePassword}
                    sx={{
                      background: "linear-gradient(90deg,#ff9966,#ff5e62)",
                      textTransform: "none",
                      px: 4,
                      py: 1.2,
                      borderRadius: "30px",
                      alignSelf: "center",
                    }}
                    disabled={!isPasswordValid || saving}
                  >
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

export default MemberProfile;