// src/pages/member/MemberProfile.jsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Avatar,
  Button,
  TextField,
  CircularProgress,
  Backdrop,
  LinearProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { onAuthStateChanged, updatePassword, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../../firebase";
import MemberBottomNav from "../../components/MemberBottomNav";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import HomeIcon from "@mui/icons-material/Home";
import LockIcon from "@mui/icons-material/Lock";
import EditIcon from "@mui/icons-material/Edit";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import { useNavigate } from "react-router-dom";

const memberPalette = {
  navy: "#0b1f5e",
  royal: "#173a8a",
  gold: "#d4af37",
  softGold: "#f2de9c",
  surface: "#f7f9fc",
};

const MemberProfile = () => {
  const navigate = useNavigate();
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
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isPasswordValid = newPassword.length >= 6 && newPassword === confirmPassword;

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  useEffect(() => {
    const errors = {};
    if (newPassword && newPassword.length < 6)
      errors.length = "Password must be at least 6 characters.";
    if (newPassword && confirmPassword && newPassword !== confirmPassword)
      errors.match = "Passwords do not match.";
    setPasswordErrors(errors);
  }, [newPassword, confirmPassword]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const snap = await getDoc(doc(db, "users", currentUser.uid));
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
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error updating profile:", err);
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
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  if (loading)
    return (
      <Backdrop open>
        <CircularProgress color="inherit" />
      </Backdrop>
    );

  const fieldSx = {
    "& .MuiInputBase-input": { color: memberPalette.navy },
    "& .MuiInputLabel-root": { color: "rgba(11,31,94,0.6)" },
    "& .MuiInputLabel-root.Mui-focused": { color: memberPalette.navy },
    "& .MuiOutlinedInput-root": {
      backgroundColor: "#fff",
      borderRadius: "12px",
      "& fieldset": { borderColor: "rgba(11,31,94,0.15)" },
      "&:hover fieldset": { borderColor: memberPalette.gold },
      "&.Mui-focused fieldset": { borderColor: memberPalette.gold },
    },
    "& .MuiOutlinedInput-root.Mui-disabled": {
      backgroundColor: "rgba(247,249,252,0.9)",
    },
    "& .MuiInputBase-input.Mui-disabled": { color: "rgba(11,31,94,0.5)", WebkitTextFillColor: "rgba(11,31,94,0.5)" },
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${memberPalette.navy} 0%, ${memberPalette.royal} 30%, ${memberPalette.surface} 65%, ${memberPalette.softGold} 100%)`,
        pb: 12,
      }}
    >
      {/* ─── Top header ─── */}
      <Box
        sx={{
          maxWidth: 460,
          mx: "auto",
          px: 2.5,
          pt: 3,
          pb: 2,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <IconButton
          onClick={() => navigate("/member/dashboard")}
          sx={{ color: "#fff", p: 0.5 }}
        >
          <ArrowBackIosNewIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#fff", flex: 1 }}>
          My Profile
        </Typography>
        {!editMode && (
          <IconButton
            onClick={() => setEditMode(true)}
            sx={{
              color: memberPalette.gold,
              border: "1.5px solid rgba(212,175,55,0.5)",
              borderRadius: "12px",
              p: 0.8,
            }}
          >
            <EditIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>

      <Box sx={{ maxWidth: 460, mx: "auto", px: 2.5 }}>
        {/* ─── Avatar section ─── */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
          <Box sx={{ position: "relative" }}>
            <Avatar
              src={preview || userData?.profilePicture}
              sx={{
                width: 96,
                height: 96,
                border: `3px solid ${memberPalette.gold}`,
                boxShadow: "0 4px 20px rgba(212,175,55,0.4)",
              }}
            />
            {editMode && (
              <Box
                component="label"
                sx={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: memberPalette.gold,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                }}
              >
                <CameraAltIcon sx={{ fontSize: 16, color: memberPalette.navy }} />
                <input hidden type="file" accept="image/*" onChange={handleFileChange} />
              </Box>
            )}
          </Box>
          <Typography sx={{ mt: 1.5, fontSize: 17, fontWeight: 700, color: "#fff" }}>
            {userData?.username || "Member"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
            {userData?.email || ""}
          </Typography>
        </Box>

        {/* ─── Profile info card ─── */}
        <Box
          sx={{
            backgroundColor: "#fff",
            borderRadius: "24px",
            p: 2.5,
            boxShadow: "0 8px 28px rgba(11,31,94,0.10)",
            mb: 2,
          }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: memberPalette.navy, mb: 2, letterSpacing: 0.6, textTransform: "uppercase" }}>
            Personal Information
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.8 }}>
            <TextField
              label="Username"
              fullWidth
              value={userData?.username || ""}
              onChange={(e) => setUserData({ ...userData, username: e.target.value })}
              disabled={!editMode}
              variant="outlined"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ fontSize: 18, color: memberPalette.gold }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldSx}
            />
            <TextField
              label="Full Name"
              fullWidth
              value={userData?.name || ""}
              onChange={(e) => setUserData({ ...userData, name: e.target.value })}
              disabled={!editMode}
              variant="outlined"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ fontSize: 18, color: memberPalette.gold }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldSx}
            />
            <TextField
              label="Email"
              fullWidth
              value={userData?.email || ""}
              disabled
              variant="outlined"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ fontSize: 18, color: memberPalette.gold }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldSx}
            />
            <TextField
              label="Contact Number"
              fullWidth
              value={userData?.contactNumber || ""}
              onChange={(e) => setUserData({ ...userData, contactNumber: e.target.value })}
              disabled={!editMode}
              variant="outlined"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon sx={{ fontSize: 18, color: memberPalette.gold }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldSx}
            />
            <TextField
              label="Address"
              fullWidth
              value={userData?.address || ""}
              onChange={(e) => setUserData({ ...userData, address: e.target.value })}
              disabled={!editMode}
              variant="outlined"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <HomeIcon sx={{ fontSize: 18, color: memberPalette.gold }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldSx}
            />
          </Box>

          {editMode && (
            <Box sx={{ display: "flex", gap: 1.5, mt: 2.5 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => { setEditMode(false); setProfilePic(null); setPreview(null); }}
                sx={{
                  borderRadius: "12px",
                  textTransform: "none",
                  fontWeight: 600,
                  borderColor: "rgba(11,31,94,0.25)",
                  color: memberPalette.navy,
                }}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                variant="contained"
                onClick={handleSaveProfile}
                disabled={saving}
                sx={{
                  borderRadius: "12px",
                  textTransform: "none",
                  fontWeight: 700,
                  background: `linear-gradient(90deg, ${memberPalette.navy}, ${memberPalette.royal})`,
                  boxShadow: "0 4px 14px rgba(11,31,94,0.3)",
                }}
              >
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </Box>
          )}

          {saveSuccess && (
            <Typography sx={{ mt: 1.5, fontSize: 13, color: "#4caf50", textAlign: "center", fontWeight: 600 }}>
              Profile updated successfully.
            </Typography>
          )}
        </Box>

        {/* ─── Change password card ─── */}
        <Box
          sx={{
            backgroundColor: "#fff",
            borderRadius: "24px",
            p: 2.5,
            boxShadow: "0 8px 28px rgba(11,31,94,0.10)",
          }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: memberPalette.navy, mb: 2, letterSpacing: 0.6, textTransform: "uppercase" }}>
            Change Password
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.8 }}>
            <TextField
              label="New Password"
              type="password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              variant="outlined"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ fontSize: 18, color: memberPalette.gold }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldSx}
            />

            {newPassword && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={getPasswordStrength(newPassword)}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    flexGrow: 1,
                    backgroundColor: "rgba(11,31,94,0.1)",
                    "& .MuiLinearProgress-bar": {
                      backgroundColor: getPasswordColor(getPasswordStrength(newPassword)),
                    },
                  }}
                />
                <Typography sx={{ fontSize: 11, color: getPasswordColor(getPasswordStrength(newPassword)), minWidth: 48, fontWeight: 700 }}>
                  {getPasswordStrength(newPassword) < 50 ? "Weak" : getPasswordStrength(newPassword) < 75 ? "Medium" : "Strong"}
                </Typography>
              </Box>
            )}

            <TextField
              label="Confirm Password"
              type="password"
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              variant="outlined"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ fontSize: 18, color: memberPalette.gold }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldSx}
            />

            {Object.values(passwordErrors).map((err, i) => (
              <Typography key={i} sx={{ fontSize: 12, color: "#f44336", fontWeight: 500 }}>
                {err}
              </Typography>
            ))}

            <Button
              fullWidth
              variant="contained"
              onClick={handleChangePassword}
              disabled={!isPasswordValid || saving}
              sx={{
                borderRadius: "12px",
                textTransform: "none",
                fontWeight: 700,
                py: 1.2,
                background: `linear-gradient(90deg, ${memberPalette.gold}, ${memberPalette.softGold})`,
                color: memberPalette.navy,
                boxShadow: "0 4px 14px rgba(212,175,55,0.3)",
                "&.Mui-disabled": { background: "rgba(11,31,94,0.1)", color: "rgba(11,31,94,0.4)" },
              }}
            >
              {saving ? "Updating…" : "Update Password"}
            </Button>
          </Box>
        </Box>
      </Box>

        {/* ─── Logout ─── */}
        <Box sx={{ mt: 2, mb: 1 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleLogout}
            sx={{
              borderRadius: "14px",
              textTransform: "none",
              fontWeight: 700,
              py: 1.3,
              fontSize: 15,
              borderColor: "rgba(244,67,54,0.5)",
              color: "#f44336",
              background: "rgba(244,67,54,0.06)",
              "&:hover": {
                borderColor: "#f44336",
                background: "rgba(244,67,54,0.12)",
              },
            }}
          >
            Log Out
          </Button>
        </Box>

      <MemberBottomNav />
    </Box>
  );
};

export default MemberProfile;
