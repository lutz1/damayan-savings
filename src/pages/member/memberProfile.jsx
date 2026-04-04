// src/pages/member/MemberProfile.jsx
import React, { useState, useEffect, useRef } from "react";
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
  Snackbar,
  Alert,
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
import PinIcon from "@mui/icons-material/Pin";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate } from "react-router-dom";
import { memberPageTopInset, memberShellBackground, memberGlassPanelSx, memberHeroBackground } from "./memberLayout";

const CLOUD_FUNCTIONS_BASE =
  (import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL ||
    "https://us-central1-amayan-savings.cloudfunctions.net").replace(/\/$/, "");

const memberPalette = {
  navy: "#0a1f44",
  royal: "#0f4ea8",
  azure: "#2f7de1",
  cloud: "#d9e9ff",
  gold: "#d4af37",
  softGold: "#f2de9c",
  textPrimary: "#f4f8ff",
  textMuted: "rgba(222,235,255,0.74)",
  inputBg: "rgba(7,22,52,0.62)",
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
  const [profileError, setProfileError] = useState("");

  // MPIN state
  const [mpinDigits, setMpinDigits] = useState(["", "", "", ""]);
  const [confirmMpinDigits, setConfirmMpinDigits] = useState(["", "", "", ""]);
  const [mpinSaving, setMpinSaving] = useState(false);
  const [mpinSuccess, setMpinSuccess] = useState(false);
  const [mpinError, setMpinError] = useState("");
  const [hasMpin, setHasMpin] = useState(false);
  const mpinRefs = [useRef(), useRef(), useRef(), useRef()];
  const confirmMpinRefs = [useRef(), useRef(), useRef(), useRef()];

  const handleMpinDigitChange = (refs, digits, setDigits, index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 3) refs[index + 1].current?.focus();
    if (!value && index > 0) refs[index - 1].current?.focus();
  };

  const handleMpinKeyDown = (refs, digits, index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  };

  const handleSetMpin = async () => {
    const mpinValue = mpinDigits.join("");
    const confirmValue = confirmMpinDigits.join("");
    setMpinError("");
    if (mpinValue.length !== 4) { setMpinError("Please enter all 4 digits."); return; }
    if (mpinValue !== confirmValue) { setMpinError("MPINs do not match. Please try again."); return; }
    setMpinSaving(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(`${CLOUD_FUNCTIONS_BASE}/setMpin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, mpin: mpinValue }),
      });
      const data = await res.json();
      if (!res.ok) { setMpinError(data.error || "Failed to set MPIN."); return; }
      setMpinDigits(["", "", "", ""]);
      setConfirmMpinDigits(["", "", "", ""]);
      setHasMpin(true);
      setMpinSuccess(true);
      setTimeout(() => setMpinSuccess(false), 3500);
    } catch (err) {
      console.error(err);
      if (err?.message?.includes("Failed to fetch")) {
        setMpinError(`Cannot reach server. Please try again. (${CLOUD_FUNCTIONS_BASE})`);
      } else {
        setMpinError("Failed to set MPIN. Please try again.");
      }
    } finally {
      setMpinSaving(false);
    }
  };

  const isPasswordValid = newPassword.length >= 6 && newPassword === confirmPassword;

  const handleLogout = async () => {
    localStorage.removeItem("userRole");
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
      try {
        if (currentUser) {
          setUser(currentUser);
          setProfileError("");
          const snap = await getDoc(doc(db, "users", currentUser.uid));
          if (snap.exists()) {
            setUserData(snap.data());
            setHasMpin(!!snap.data().mpinHash);
          }
        } else {
          setUser(null);
          setUserData(null);
        }
      } catch (err) {
        console.error("[memberProfile] Failed to load user profile:", err);
        if (err?.code === "permission-denied") {
          setProfileError("Profile access denied by Firestore rules. Please re-login or contact admin.");
        } else {
          setProfileError("Unable to load profile right now. Please try again.");
        }
      } finally {
        setLoading(false);
      }
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
    setProfileError("");
    try {
      let photoURL = userData.profilePicture || "";
      if (profilePic) {
        const safeFileName = `${Date.now()}_${profilePic.name}`.replace(/[^a-zA-Z0-9._-]/g, "_");
        const picRef = ref(storage, `users/${user.uid}/profilePictures/${safeFileName}`);
        await uploadBytes(picRef, profilePic, {
          contentType: profilePic.type || "image/jpeg",
        });
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
      if (err?.code === "storage/unauthorized") {
        setProfileError("Profile photo upload is not allowed right now. Please try again after the storage rules update.");
      } else {
        setProfileError("Unable to update your profile right now. Please try again.");
      }
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
    "& .MuiInputBase-input": { color: memberPalette.textPrimary },
    "& .MuiInputLabel-root": { color: "rgba(231,239,255,0.74)" },
    "& .MuiInputLabel-root.Mui-focused": { color: memberPalette.softGold },
    "& .MuiOutlinedInput-root": {
      backgroundColor: memberPalette.inputBg,
      borderRadius: "12px",
      "& fieldset": { borderColor: "rgba(231,239,255,0.22)" },
      "&:hover fieldset": { borderColor: "rgba(212,175,55,0.8)" },
      "&.Mui-focused fieldset": { borderColor: memberPalette.gold },
    },
    "& .MuiOutlinedInput-root.Mui-disabled": {
      backgroundColor: "rgba(6,18,45,0.36)",
    },
    "& .MuiInputBase-input.Mui-disabled": {
      color: "rgba(231,239,255,0.58)",
      WebkitTextFillColor: "rgba(231,239,255,0.58)",
    },
  };

  const panelCardSx = {
    ...memberGlassPanelSx,
    borderRadius: "18px",
    p: 2.5,
    mb: 2,
    border: "1px solid rgba(186,215,255,0.2)",
    boxShadow: "0 16px 30px rgba(5,18,46,0.28)",
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: memberShellBackground,
        pb: 12,
      }}
    >
      {/* ─── Top header ─── */}
      <Box
        sx={{
          maxWidth: 460,
          mx: "auto",
          px: 2.5,
          pt: { xs: memberPageTopInset, sm: 3 },
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
              border: "1.5px solid rgba(212,175,55,0.6)",
              background: "rgba(6,18,45,0.42)",
              borderRadius: "12px",
              p: 0.8,
            }}
          >
            <EditIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>

      {profileError && (
        <Box sx={{ maxWidth: 460, mx: "auto", px: 2.5, pb: 1 }}>
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {profileError}
          </Alert>
        </Box>
      )}

      <Box sx={{ maxWidth: 460, mx: "auto", px: 2.5 }}>
        {/* ─── Azure-style profile hero ─── */}
        <Box
          sx={{
            background: memberHeroBackground,
            border: "1px solid rgba(194,219,255,0.22)",
            borderRadius: "22px",
            p: 2.2,
            mb: 2.2,
            boxShadow: "0 18px 34px rgba(6,20,52,0.33)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.8 }}>
            <Box sx={{ position: "relative" }}>
              <Avatar
                src={preview || userData?.profilePicture}
                sx={{
                  width: 84,
                  height: 84,
                  border: "2px solid rgba(217,233,255,0.95)",
                  boxShadow: "0 8px 18px rgba(6,18,45,0.35)",
                }}
              />
              {editMode && (
                <Box
                  component="label"
                  sx={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "linear-gradient(145deg, #e6f1ff 0%, #b8d5ff 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
                  }}
                >
                  <CameraAltIcon sx={{ fontSize: 16, color: memberPalette.navy }} />
                  <input hidden type="file" accept="image/*" onChange={handleFileChange} />
                </Box>
              )}
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
                {userData?.username || "Member"}
              </Typography>
              <Typography sx={{ fontSize: 12, color: memberPalette.textMuted, mt: 0.4 }}>
                {userData?.email || ""}
              </Typography>
              <Typography sx={{ fontSize: 11, color: "rgba(222,235,255,0.72)", mt: 0.9 }}>
                Financial Profile Center
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            <Box sx={{ background: "rgba(8,26,62,0.45)", border: "1px solid rgba(206,226,255,0.2)", borderRadius: "12px", p: 1.1 }}>
              <Typography sx={{ fontSize: 10, letterSpacing: 0.45, textTransform: "uppercase", color: "rgba(222,235,255,0.68)" }}>
                Verification
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: memberPalette.cloud, mt: 0.2 }}>
                Active Member
              </Typography>
            </Box>
            <Box sx={{ background: "rgba(8,26,62,0.45)", border: "1px solid rgba(206,226,255,0.2)", borderRadius: "12px", p: 1.1 }}>
              <Typography sx={{ fontSize: 10, letterSpacing: 0.45, textTransform: "uppercase", color: "rgba(222,235,255,0.68)" }}>
                Security
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: hasMpin ? "#a4f0b0" : "#ffd28b", mt: 0.2 }}>
                {hasMpin ? "MPIN Enabled" : "MPIN Pending"}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ─── Profile info card ─── */}
        <Box
          sx={panelCardSx}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: memberPalette.softGold, mb: 2, letterSpacing: 0.6, textTransform: "uppercase" }}>
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
                  borderColor: "rgba(231,239,255,0.3)",
                  color: memberPalette.textPrimary,
                  background: "rgba(6,18,45,0.3)",
                  "&:hover": { borderColor: "rgba(217,233,255,0.7)", background: "rgba(6,18,45,0.48)" },
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
                  background: `linear-gradient(90deg, ${memberPalette.azure}, ${memberPalette.royal})`,
                  boxShadow: "0 12px 22px rgba(20,79,163,0.32)",
                }}
              >
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </Box>
          )}

          {saveSuccess && (
            <Typography sx={{ mt: 1.5, fontSize: 13, color: "#91e59f", textAlign: "center", fontWeight: 600 }}>
              Profile updated successfully.
            </Typography>
          )}
        </Box>

        {/* ─── Change password card ─── */}
        <Box
          sx={panelCardSx}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: memberPalette.softGold, mb: 2, letterSpacing: 0.6, textTransform: "uppercase" }}>
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
                    backgroundColor: "rgba(231,239,255,0.2)",
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
                "&.Mui-disabled": { background: "rgba(231,239,255,0.2)", color: "rgba(231,239,255,0.5)" },
              }}
            >
              {saving ? "Updating…" : "Update Password"}
            </Button>
          </Box>
        </Box>

        {/* ─── MPIN Settings card ─── */}
        <Box
          sx={panelCardSx}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <PinIcon sx={{ fontSize: 18, color: memberPalette.softGold }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: memberPalette.softGold, letterSpacing: 0.6, textTransform: "uppercase" }}>
              Security Settings (MPIN)
            </Typography>
            {hasMpin && (
              <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.4 }}>
                <CheckCircleIcon sx={{ fontSize: 15, color: "#4caf50" }} />
                <Typography sx={{ fontSize: 11, color: "#4caf50", fontWeight: 600 }}>MPIN Set</Typography>
              </Box>
            )}
          </Box>

          <Typography sx={{ fontSize: 12, color: memberPalette.textMuted, mb: 2, lineHeight: 1.6 }}>
            {hasMpin
              ? "Your MPIN is active. You can update it below to set a new 4-digit PIN."
              : "Set a 4-digit MPIN to enable quick login without your password."}
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* New MPIN */}
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: memberPalette.textPrimary, mb: 1.2 }}>
                {hasMpin ? "New MPIN" : "Set MPIN"}
              </Typography>
              <Box sx={{ display: "flex", gap: 1.2, justifyContent: "center" }}>
                {mpinDigits.map((d, i) => (
                  <Box
                    key={i}
                    component="input"
                    ref={mpinRefs[i]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleMpinDigitChange(mpinRefs, mpinDigits, setMpinDigits, i, e.target.value)}
                    onKeyDown={(e) => handleMpinKeyDown(mpinRefs, mpinDigits, i, e)}
                    sx={{
                      width: 52,
                      height: 56,
                      borderRadius: "12px",
                      border: d ? `2px solid ${memberPalette.gold}` : `1.5px solid rgba(231,239,255,0.28)`,
                      background: d ? `rgba(212,175,55,0.16)` : "rgba(6,18,45,0.42)",
                      color: memberPalette.textPrimary,
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      textAlign: "center",
                      outline: "none",
                      caretColor: memberPalette.gold,
                      transition: "all 0.18s ease",
                      "&:focus": {
                        border: `2px solid ${memberPalette.gold}`,
                        background: `rgba(212,175,55,0.14)`,
                        boxShadow: `0 0 0 3px rgba(212,175,55,0.2)`,
                      },
                      cursor: "text",
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Confirm MPIN */}
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: memberPalette.textPrimary, mb: 1.2 }}>
                Confirm MPIN
              </Typography>
              <Box sx={{ display: "flex", gap: 1.2, justifyContent: "center" }}>
                {confirmMpinDigits.map((d, i) => (
                  <Box
                    key={i}
                    component="input"
                    ref={confirmMpinRefs[i]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleMpinDigitChange(confirmMpinRefs, confirmMpinDigits, setConfirmMpinDigits, i, e.target.value)}
                    onKeyDown={(e) => handleMpinKeyDown(confirmMpinRefs, confirmMpinDigits, i, e)}
                    sx={{
                      width: 52,
                      height: 56,
                      borderRadius: "12px",
                      border: d ? `2px solid #4f8cff` : `1.5px solid rgba(231,239,255,0.28)`,
                      background: d ? `rgba(79,140,255,0.16)` : "rgba(6,18,45,0.42)",
                      color: memberPalette.textPrimary,
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      textAlign: "center",
                      outline: "none",
                      caretColor: memberPalette.royal,
                      transition: "all 0.18s ease",
                      "&:focus": {
                        border: `2px solid #4f8cff`,
                        background: `rgba(79,140,255,0.14)`,
                        boxShadow: `0 0 0 3px rgba(79,140,255,0.22)`,
                      },
                      cursor: "text",
                    }}
                  />
                ))}
              </Box>
            </Box>

            {mpinError && (
              <Typography sx={{ fontSize: 12, color: "#f44336", fontWeight: 500, textAlign: "center" }}>
                {mpinError}
              </Typography>
            )}

            <Button
              fullWidth
              variant="contained"
              onClick={handleSetMpin}
              disabled={mpinSaving || mpinDigits.join("").length !== 4 || confirmMpinDigits.join("").length !== 4}
              sx={{
                borderRadius: "12px",
                textTransform: "none",
                fontWeight: 700,
                py: 1.2,
                background: `linear-gradient(90deg, ${memberPalette.azure}, ${memberPalette.royal})`,
                color: "#fff",
                boxShadow: "0 12px 22px rgba(20,79,163,0.32)",
                "&.Mui-disabled": { background: "rgba(231,239,255,0.2)", color: "rgba(231,239,255,0.5)" },
              }}
            >
              {mpinSaving ? "Saving…" : hasMpin ? "Update MPIN" : "Set MPIN"}
            </Button>
          </Box>
        </Box>
      </Box>

      <Snackbar open={mpinSuccess} autoHideDuration={3500} onClose={() => setMpinSuccess(false)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" sx={{ borderRadius: "12px" }}>
          MPIN {hasMpin ? "updated" : "set"} successfully! You can now use it to log in.
        </Alert>
      </Snackbar>

        {/* ─── Logout ─── */}
        <Box sx={{ maxWidth: 460, mx: "auto", px: 2.5, mt: 2, mb: 1 }}>
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
              borderColor: "rgba(255,120,120,0.6)",
              color: "#ffb0b0",
              background: "rgba(70,14,20,0.45)",
              "&:hover": {
                borderColor: "#ff8f8f",
                background: "rgba(96,22,30,0.58)",
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
