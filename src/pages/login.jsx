import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import { motion } from "framer-motion";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Visibility, VisibilityOff, Email, Lock, Info } from "@mui/icons-material";
import { InputAdornment, IconButton } from "@mui/material";
import newLogo from "../assets/newlogo.png";
import damayanLogo from "../assets/damayan.png";
import merchantLogo from "../assets/merchantlogo.png";
import Splashscreen from "../components/splashscreen";
import TermsAndConditions from "../components/TermsAndConditions";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [openTerms, setOpenTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [splashLogo, setSplashLogo] = useState(damayanLogo);
  const [postSplashTarget, setPostSplashTarget] = useState(null);
  const [redirecting, setRedirecting] = useState(false);

  // ✅ Redirect users based on role
  const handleRedirect = (role) => { 
    const base = "/damayan-savings";
    const upper = role.toUpperCase();

    // mark that a redirect flow is in progress to avoid duplicate/contradictory redirects
    setRedirecting(true);

    const goTo = (path) => window.location.replace(`${base}${path}`);

    // Show splash for merchants before redirecting
    if (upper === "MERCHANT") {
      setSplashLogo(merchantLogo);
      setPostSplashTarget("/location-access");
      setShowSplash(true);
      return;
    }

    switch (upper) {
        case "ADMIN":
        case "CEO":
          goTo("/admin/dashboard");
        break;
      case "MASTERMD":
      case "MD":
      case "MS":
      case "MI":
      case "AGENT":
      case "MEMBER":
        goTo("/member/dashboard");
        break;
      default:
        goTo("/");
    }
  };

  // ✅ Auto redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        localStorage.removeItem("userRole");
        return;
      }

      // if a redirect flow is already in progress, skip extra redirects
      if (redirecting) return;

      let role = localStorage.getItem("userRole");
      if (!role) { 
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          role = userSnap.data().role || "Member";
          localStorage.setItem("userRole", role.toUpperCase());
        } else return;
      }

      handleRedirect(role);
    });
    return () => unsubscribe();
  }, [redirecting]);

  // --- LOGIN HANDLER ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("User data not found. Please contact the admin.");
        return;
      }

      const userData = userSnap.data();
      const role = (userData.role || "Member").toUpperCase();
      localStorage.setItem("userRole", role);
      handleRedirect(role);
    } catch (err) {
      console.error("Login error:", err.message);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("Invalid email or password.");
      } else if (err.code === "auth/user-not-found") {
        setError("No user found with this email.");
      } else {
        setError("Unable to login. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  // NOTE: do not forcibly hide body overflow here — allow normal scrolling
  // so the background can fill the full viewport height responsively.



  return (
    <Box
      sx={{
        minHeight: "100vh",
        overflow: "auto",
        backgroundImage: `url(${newLogo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: { xs: "scroll", md: "fixed" },
        backgroundRepeat: "no-repeat",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        p: { xs: 2, sm: 3, md: 4 },
        position: "relative",

        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          zIndex: 0,
          // Enhanced blue mesh gradient background
          background: `
            radial-gradient(at 0% 0%, rgba(30, 77, 146, 0.8) 0%, transparent 50%),
            radial-gradient(at 50% 0%, rgba(14, 77, 146, 0.7) 0%, transparent 50%),
            radial-gradient(at 100% 0%, rgba(32, 87, 160, 0.75) 0%, transparent 50%),
            linear-gradient(135deg, #0c4a6e 0%, #0e4d92 50%, #1e5492 100%)
          `,
          backdropFilter: "blur(8px)",
        },
      }}
    >
      {/* Animated mesh overlay */}
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          opacity: 0.15,
          pointerEvents: "none",
          background: `
            linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%),
            linear-gradient(-45deg, transparent 30%, rgba(0,0,0,0.1) 50%, transparent 70%)
          `,
          backgroundSize: "60px 60px",
          zIndex: 0,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: "100%", maxWidth: 420, zIndex: 10 }}
      >
        {/* Glass Panel */}
        <Box
          sx={{
            backdropFilter: "blur(20px)",
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: { xs: "20px", sm: "24px" },
            p: { xs: 3, sm: 4, md: 4 },
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
            position: "relative",
          }}
        >
          {/* Logo and Branding */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, mb: 3 }}>
            {/* New Logo */}
            <Box
              component="img"
              src={newLogo}
              alt="Damayan Logo"
              sx={{
                width: { xs: 48, sm: 56, md: 64 },
                height: "auto",
                filter: "brightness(1.1)",
              }}
            />
            {/* Divider */}
            <Box sx={{ width: 1, height: 36, background: "rgba(255,255,255,0.15)" }} />
            {/* Branding Text */}
            <Box>
              <Typography
                sx={{
                  fontFamily: '"Outfit", sans-serif',
                  fontWeight: 700,
                  fontSize: { xs: "1.4rem", sm: "1.6rem" },
                  color: "#fff",
                  letterSpacing: "-0.5px",
                }}
              >
                Damayan
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.65rem",
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  fontWeight: 600,
                  lineHeight: 1,
                  mt: 0.25,
                }}
              >
                Lingap. Malasakit.
              </Typography>
            </Box>
          </Box>

          {/* Info Alert */}
          <Box
            sx={{
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(96, 165, 250, 0.3)",
              borderRadius: "12px",
              p: 2,
              display: "flex",
              gap: 1.5,
              mb: 3,
              alignItems: "flex-start",
            }}
          >
            <Info
              sx={{
                color: "rgba(147, 197, 253, 0.8)",
                fontSize: "1.2rem",
                flexShrink: 0,
                mt: 0.25,
              }}
            />
            <Typography
              sx={{
                fontSize: { xs: "0.75rem", sm: "0.85rem" },
                color: "rgba(229, 231, 235, 0.9)",
                lineHeight: 1.5,
              }}
            >
              Please use your <strong>official company email</strong> to log in to the employee portal.
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5,
                fontSize: { xs: "0.8rem", sm: "0.9rem" },
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#fca5a5",
              }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            {/* Email Field */}
            <Box sx={{ position: "relative", mb: 3 }}>
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: "rgba(255,255,255,0.5)", fontSize: "1.3rem" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    transition: "all 0.3s ease",
                    paddingLeft: 0,
                    "& fieldset": { border: "none" },
                    "&:hover": {
                      background: "rgba(255,255,255,0.08)",
                      borderColor: "rgba(255,255,255,0.15)",
                    },
                    "&.Mui-focused": {
                      background: "rgba(255,255,255,0.08)",
                      borderColor: "rgba(250, 204, 21, 0.4)",
                      boxShadow: "0 0 15px rgba(250, 204, 21, 0.15)",
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "rgba(255,255,255,0.5)",
                    fontSize: "0.95rem",
                    transform: "translate(48px, 16px) scale(1)",
                    "&.Mui-focused, &.MuiFormLabel-filled": {
                      transform: "translate(48px, -9px) scale(0.85)",
                      color: "rgba(250, 204, 21, 0.8)",
                    },
                  },
                  "& input": {
                    color: "#fff",
                    fontSize: { xs: "0.9rem", sm: "1rem" },
                    padding: "14px 12px 14px 4px",
                  },
                }}
              />
            </Box>

            {/* Password Field */}
            <Box sx={{ position: "relative", mb: 2.5 }}>
              <TextField
                label="Password"
                type={showPassword ? "text" : "password"}
                fullWidth
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: "rgba(255,255,255,0.5)", fontSize: "1.3rem" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        sx={{
                          color: "rgba(255,255,255,0.5)",
                          "&:hover": { color: "rgba(255,255,255,0.8)" },
                        }}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    transition: "all 0.3s ease",
                    paddingLeft: 0,
                    paddingRight: 1,
                    "& fieldset": { border: "none" },
                    "&:hover": {
                      background: "rgba(255,255,255,0.08)",
                      borderColor: "rgba(255,255,255,0.15)",
                    },
                    "&.Mui-focused": {
                      background: "rgba(255,255,255,0.08)",
                      borderColor: "rgba(250, 204, 21, 0.4)",
                      boxShadow: "0 0 15px rgba(250, 204, 21, 0.15)",
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "rgba(255,255,255,0.5)",
                    fontSize: "0.95rem",
                    transform: "translate(48px, 16px) scale(1)",
                    "&.Mui-focused, &.MuiFormLabel-filled": {
                      transform: "translate(48px, -9px) scale(0.85)",
                      color: "rgba(250, 204, 21, 0.8)",
                    },
                  },
                  "& input": {
                    color: "#fff",
                    fontSize: { xs: "0.9rem", sm: "1rem" },
                    padding: "14px 4px",
                  },
                }}
              />
            </Box>

            {/* Remember Me & Forgot Password */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 3,
                px: 1,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <motion.input
                  type="checkbox"
                  whileTap={{ scale: 0.8 }}
                  style={{
                    width: 18,
                    height: 18,
                    cursor: "pointer",
                    accentColor: "#FACC15",
                  }}
                />
                <Typography sx={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>
                  Remember me
                </Typography>
              </Box>
              <Typography
                component="a"
                href="#"
                sx={{
                  fontSize: "0.85rem",
                  color: "rgba(250, 204, 21, 0.8)",
                  textDecoration: "none",
                  fontWeight: 600,
                  "&:hover": { color: "#FACC15" },
                }}
              >
                Forgot Password?
              </Typography>
            </Box>

            {/* Terms & Conditions Checkbox */}
            <Box
              sx={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                p: 2,
                mb: 3,
                display: "flex",
                gap: 1.5,
                alignItems: "flex-start",
                cursor: "pointer",
                transition: "all 0.3s ease",
                "&:hover": {
                  background: "rgba(255,255,255,0.08)",
                  borderColor: acceptedTerms ? "rgba(76, 175, 80, 0.4)" : "rgba(255,255,255,0.15)",
                },
              }}
            >
              <motion.input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  e.stopPropagation();
                  const checked = e.target.checked;
                  if (checked) {
                    setOpenTerms(true);
                  } else {
                    setAcceptedTerms(false);
                  }
                }}
                whileTap={{ scale: 0.7 }}
                style={{
                  width: 18,
                  height: 18,
                  cursor: "pointer",
                  accentColor: acceptedTerms ? "#4CAF50" : "#FACC15",
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
              <Typography
                sx={{
                  fontSize: "0.8rem",
                  color: "rgba(229, 231, 235, 0.8)",
                  lineHeight: 1.5,
                }}
              >
                I agree to the{" "}
                <Box
                  component="span"
                  sx={{
                    color: "#fff",
                    fontWeight: 600,
                    textDecoration: "underline",
                    textDecorationColor: "rgba(250, 204, 21, 0.5)",
                  }}
                >
                  Standard Terms & Conditions
                </Box>{" "}
                and{" "}
                <Box
                  component="span"
                  sx={{
                    color: "#fff",
                    fontWeight: 600,
                    textDecoration: "underline",
                    textDecorationColor: "rgba(250, 204, 21, 0.5)",
                  }}
                >
                  Privacy Policy
                </Box>{" "}
                of the institution.
              </Typography>
            </Box>

            {/* Login Button */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !acceptedTerms}
              sx={{
                background: acceptedTerms
                  ? "linear-gradient(135deg, #FACC15 0%, #F0AF00 100%)"
                  : "rgba(250, 204, 21, 0.3)",
                color: "#0E4D92",
                fontWeight: 700,
                fontSize: { xs: "0.95rem", sm: "1.05rem" },
                py: { xs: 1.6, sm: 1.8 },
                borderRadius: "12px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                boxShadow: acceptedTerms ? "0 8px 24px rgba(250, 204, 21, 0.3)" : "none",
                transition: "all 0.3s ease",
                "&:hover": {
                  background: acceptedTerms
                    ? "linear-gradient(135deg, #FACC15 0%, #D4A100 100%)"
                    : "rgba(250, 204, 21, 0.3)",
                  transform: acceptedTerms ? "translateY(-2px)" : "none",
                },
                "&:active": {
                  transform: "scale(0.98)",
                },
                "&:disabled": {
                  color: "rgba(14, 77, 146, 0.5)",
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Login"}
            </Button>
          </form>

          {/* Footer Links */}
          <Box sx={{ mt: 3, textAlign: "center", space: 2 }}>
            <Typography sx={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", mb: 2 }}>
              Don't have an account?{" "}
              <Box
                component="a"
                href="#"
                sx={{
                  color: "#FACC15",
                  fontWeight: 600,
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Request Access
              </Box>
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
              © 2025 Damayan Savings. All rights reserved.
            </Typography>
          </Box>
        </Box>

        {/* Language Selector Footer */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: 2,
            mt: 3,
            zIndex: 10,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              "&:hover": { color: "rgba(255,255,255,0.8)" },
            }}
          >
            <span style={{ fontSize: "1rem" }}>🌐</span> English
          </Typography>
          <Box sx={{ width: 1, height: 3, background: "rgba(255,255,255,0.2)" }} />
          <Typography
            sx={{
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              "&:hover": { color: "rgba(255,255,255,0.8)" },
            }}
          >
            Filipino
          </Typography>
        </Box>

        {/* Support Button */}
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              background: "linear-gradient(135deg, #FACC15 0%, #F0AF00 100%)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0E4D92",
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(250, 204, 21, 0.4)",
              fontWeight: 700,
              fontSize: "1.4rem",
            }}
          >
            💬
          </Box>
        </motion.div>
      </motion.div>

      {/* Terms & Conditions Dialog */}
      <TermsAndConditions
        open={openTerms}
        onClose={() => setOpenTerms(false)}
        onAccept={() => {
          setAcceptedTerms(true);
          setOpenTerms(false);
        }}
      />
      <Splashscreen
        open={showSplash}
        logo={splashLogo}
        duration={1400}
        overlayColor={splashLogo === merchantLogo ? "#f1f3c7" : undefined}
        onClose={() => {
          setShowSplash(false);
          (function () {
            const base = "/damayan-savings";
            if (postSplashTarget) {
              window.location.replace(`${base}${postSplashTarget}`);
            } else {
              window.location.replace(`${base}/merchant/dashboard`);
            }
          })();
        }}
      />
    </Box>
  );
};

export default Login;