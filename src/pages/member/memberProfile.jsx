// src/pages/member/MemberProfile.jsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  CircularProgress,
  useMediaQuery,
  LinearProgress,
  Fade,
  Divider,
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

const MemberProfile = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // States
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [preview, setPreview] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Fetch current user profile
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

  // Upload profile picture
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePic(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  // Save profile updates
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

  // Password strength
  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score += 25;
    if (/[A-Z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd)) score += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };

  // Change password
  const handleChangePassword = async () => {
    if (newPassword.length < 6)
      return toast.warning("Password must be at least 6 characters.");
    if (newPassword !== confirmPassword)
      return toast.error("Passwords do not match.");

    try {
      await updatePassword(auth.currentUser, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully!");
    } catch (err) {
      console.error("Password change failed:", err);
      if (err.code === "auth/requires-recent-login")
        toast.error("Please log out and log in again before changing password.");
      else toast.error("Failed to update password.");
    }
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
          width: isMobile ? "100%" : `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
        }}
      >
        <Toolbar />
        <Fade in={!loading}>
          <Box>
            <Typography
              variant={isMobile ? "h5" : "h4"}
              fontWeight={700}
              sx={{ mb: 3, textAlign: isMobile ? "center" : "left" }}
            >
              My Profile
            </Typography>

            {loading ? (
              <CircularProgress color="inherit" />
            ) : userData ? (
              <>
                {/* Profile Info */}
                <Card
                  sx={{
                    backdropFilter: "blur(18px)",
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 5,
                    p: { xs: 2, sm: 4 },
                    mb: 4,
                    boxShadow: "0 8px 32px rgba(31, 38, 135, 0.37)",
                    color: "white",
                  }}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        mb: 3,
                      }}
                    >
                      <Avatar
                        src={preview || userData.profilePicture}
                        sx={{
                          width: isMobile ? 100 : 120,
                          height: isMobile ? 100 : 120,
                          mb: 2,
                          border: "3px solid rgba(255,255,255,0.6)",
                        }}
                      />
                      {editMode && (
                        <Button
                          variant="contained"
                          component="label"
                          size="small"
                          sx={{
                            mb: 1,
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
                      <Grid item xs={12}>
                        <TextField
                          label="Full Name"
                          fullWidth
                          value={userData.name || ""}
                          onChange={(e) =>
                            setUserData({ ...userData, name: e.target.value })
                          }
                          InputProps={{ readOnly: !editMode }}
                          variant="filled"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Email"
                          fullWidth
                          value={userData.email || ""}
                          InputProps={{ readOnly: true }}
                          variant="filled"
                        />
                      </Grid>
                      <Grid item xs={12}>
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
                          InputProps={{ readOnly: !editMode }}
                          variant="filled"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Address"
                          fullWidth
                          value={userData.address || ""}
                          onChange={(e) =>
                            setUserData({
                              ...userData,
                              address: e.target.value,
                            })
                          }
                          InputProps={{ readOnly: !editMode }}
                          variant="filled"
                        />
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 3, textAlign: "center" }}>
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
                  </CardContent>
                </Card>

                {/* Divider */}
                <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.3)" }} />

                {/* Password Change */}
                <Card
                  sx={{
                    backdropFilter: "blur(18px)",
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 5,
                    p: { xs: 2, sm: 4 },
                    boxShadow: "0 8px 32px rgba(31, 38, 135, 0.37)",
                    color: "white",
                    maxWidth: 600,
                    mx: "auto",
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Change Password
                    </Typography>
                    <TextField
                      label="New Password"
                      type="password"
                      fullWidth
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      sx={{ mb: 2 }}
                      variant="filled"
                    />
                    {newPassword && (
                      <LinearProgress
                        variant="determinate"
                        value={getPasswordStrength(newPassword)}
                        sx={{
                          mb: 2,
                          height: 8,
                          borderRadius: 2,
                          backgroundColor: "rgba(255,255,255,0.3)",
                        }}
                      />
                    )}
                    <TextField
                      label="Confirm Password"
                      type="password"
                      fullWidth
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      sx={{ mb: 2 }}
                      variant="filled"
                    />
                    <Button
                      variant="contained"
                      onClick={handleChangePassword}
                      sx={{
                        background: "linear-gradient(90deg,#ff9966,#ff5e62)",
                        textTransform: "none",
                        px: 4,
                        py: 1.2,
                        borderRadius: "30px",
                      }}
                    >
                      Update Password
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Typography variant="body1">Unable to load profile.</Typography>
            )}
          </Box>
        </Fade>
      </Box>

      <ToastContainer position="top-right" autoClose={3000} theme="colored" />
    </Box>
  );
};

export default MemberProfile;