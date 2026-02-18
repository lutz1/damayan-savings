import React, { useState, useEffect } from "react";
import "./login.css";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  Container,
} from "@mui/material";
import { motion } from "framer-motion";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { 
  Visibility, 
  VisibilityOff, 
  Mail, 
  Lock,
  ArrowForward,
  VerifiedUser,
  Shield,
} from "@mui/icons-material";
import newlogo from "../assets/newlogo.png";
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
  const [splashLogo, setSplashLogo] = useState(newlogo);
  const [postSplashTarget, setPostSplashTarget] = useState(null);
  const [redirecting, setRedirecting] = useState(false);

  // ✅ Redirect users based on role
  const handleRedirect = (role) => { 
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
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
    <Box className="login-page-container">
      <Container maxWidth="sm" sx={{ py: { xs: 2, md: 2 }, px: { xs: 2, md: 3 } }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Main Card */}
          <Paper elevation={8} className="login-card-new">
            {/* Logo Header */}
            <Box sx={{ display: "flex", justifyContent: "center", mb: { xs: 1, sm: 3, md: 4 } }}>
              <Box
                component="img"
                src={newlogo}
                alt="Damayan Logo"
                sx={{
                  height: { xs: 150, sm: 100, md: 140 },
                  width: "auto",
                  objectFit: "contain",
                }}
              />
            </Box>

            {/* Info Alert */}
            <Alert 
              icon={false}
              className="login-info-box"
              sx={{
                mb: { xs: 2, sm: 2.5, md: 3 },
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: 2,
                px: { xs: 1.5, sm: 2 },
                py: { xs: 1.5, sm: 2 },
              }}
            >
              <Box sx={{ display: "flex", gap: { xs: 1, sm: 1.5 } }}>
                <Box sx={{ flexShrink: 0 }}>
                  <Mail sx={{ color: "#3B82F6", fontSize: { xs: 18, sm: 20 }, mt: 0.25 }} />
                </Box>
                <Typography sx={{ color: "#3B82F6", fontSize: { xs: "0.8rem", sm: "0.9rem" }, fontWeight: 500 }}>
                  Please use your <strong>official company email</strong> to log in.
                </Typography>
              </Box>
            </Alert>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Form */}
            <Box component="form" onSubmit={handleLogin} sx={{ mt: 2 }}>
              {/* Email Field */}
              <Box sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Typography sx={{ fontSize: { xs: "0.75rem", sm: "0.85rem" }, fontWeight: 600, color: "#E5E7EB", mb: 0.75 }}>
                  Email Address
                </Typography>
                <TextField
                  fullWidth
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  InputProps={{
                    startAdornment: <Mail sx={{ color: "#9CA3AF", mr: 1, fontSize: { xs: 18, sm: 20 } }} />,
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      borderRadius: 1.5,
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      "& fieldset": { border: "none" },
                      "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.12)" },
                      "&.Mui-focused": { 
                        backgroundColor: "rgba(255, 255, 255, 0.12)",
                        "& fieldset": { border: "1px solid #3B82F6" },
                      },
                    },
                    "& .MuiInputBase-input": {
                      fontSize: { xs: "0.8rem", sm: "0.9rem" },
                      color: "#E5E7EB",
                      "&::placeholder": {
                        color: "#9CA3AF",
                        opacity: 1,
                      },
                    },
                  }}
                />
              </Box>

              {/* Password Field */}
              <Box sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                  <Typography sx={{ fontSize: { xs: "0.75rem", sm: "0.85rem" }, fontWeight: 600, color: "#E5E7EB" }}>
                    Password
                  </Typography>
                  <Typography
                    component="a"
                    href="#"
                    sx={{
                      fontSize: { xs: "0.65rem", sm: "0.75rem" },
                      fontWeight: 700,
                      color: "#3B82F6",
                      textDecoration: "none",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    Forgot Password?
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: <Lock sx={{ color: "#9CA3AF", mr: 1, fontSize: { xs: 18, sm: 20 } }} />,
                    endAdornment: (
                      <Button
                        onClick={() => setShowPassword(!showPassword)}
                        sx={{ minWidth: 0, p: 0.5, color: "#9CA3AF" }}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </Button>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      borderRadius: 1.5,
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      "& fieldset": { border: "none" },
                      "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.12)" },
                      "&.Mui-focused": { 
                        backgroundColor: "rgba(255, 255, 255, 0.12)",
                        "& fieldset": { border: "1px solid #3B82F6" },
                      },
                    },
                    "& .MuiInputBase-input": {
                      fontSize: { xs: "0.8rem", sm: "0.9rem" },
                      color: "#E5E7EB",
                      "&::placeholder": {
                        color: "#9CA3AF",
                        opacity: 1,
                      },
                    },
                  }}
                />
              </Box>

              {/* Terms Checkbox */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={acceptedTerms}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setOpenTerms(true);
                      } else {
                        setAcceptedTerms(false);
                      }
                    }}
                    sx={{
                      color: "#6B7280",
                      "&.Mui-checked": { color: "#3B82F6" },
                      scale: { xs: 0.9, sm: 1 },
                    }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: { xs: "0.65rem", sm: "0.75rem" }, color: "#B0B8D4" }}>
                    I agree to the{" "}
                    <Box
                      component="a"
                      href="#"
                      onClick={() => setOpenTerms(true)}
                      sx={{
                        color: "#3B82F6",
                        textDecoration: "none",
                        fontWeight: 600,
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      Standard Terms & Conditions Policy
                    </Box>
                  </Typography>
                }
                sx={{ mb: { xs: 2, sm: 2.5, md: 3 } }}
              />

              {/* Login Button */}
              <Button
                fullWidth
                type="submit"
                disabled={loading || !acceptedTerms}
                sx={{
                  backgroundColor: "#3B82F6",
                  color: "white",
                  fontWeight: 700,
                  py: { xs: 1.4, sm: 1.6, md: 1.8 },
                  borderRadius: 1.5,
                  fontSize: { xs: "0.8rem", sm: "0.9rem", md: "0.95rem" },
                  boxShadow: "0 4px 12px rgba(0, 102, 204, 0.25)",
                  "&:hover": {
                    backgroundColor: "#0052A3",
                    boxShadow: "0 6px 16px rgba(0, 102, 204, 0.35)",
                  },
                  "&:active": { transform: "scale(0.98)" },
                  transition: "all 0.2s ease",
                  display: "flex",
                  gap: { xs: 0.5, sm: 1 },
                }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  <>
                    LOGIN
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.5 }}
                    >
                      <ArrowForward sx={{ fontSize: 18 }} />
                    </motion.div>
                  </>
                )}
              </Button>
            </Box>

            {/* Footer */}
            <Typography sx={{ textAlign: "center", mt: { xs: 3, sm: 3.5, md: 4 }, fontSize: { xs: "0.6rem", sm: "0.7rem" }, color: "#6B7280", fontWeight: 500 }}>
              © 2025 Damayan Savings. All rights reserved.
            </Typography>
          </Paper>

          {/* Bottom Badges */}
          <Box sx={{ display: "flex", justifyContent: "center", gap: { xs: 2, sm: 3, md: 4 }, mt: { xs: 2, sm: 3, md: 4 }, opacity: 0.6, "&:hover": { opacity: 1 }, transition: "opacity 0.3s", flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1 }, color: "#B0B8D4" }}>
              <VerifiedUser sx={{ fontSize: { xs: 14, sm: 18 } }} />
              <Typography sx={{ fontSize: { xs: "0.55rem", sm: "0.65rem" }, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Secure Banking
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1 }, color: "#B0B8D4" }}>
              <Shield sx={{ fontSize: { xs: 14, sm: 18 } }} />
              <Typography sx={{ fontSize: { xs: "0.55rem", sm: "0.65rem" }, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                FDIC Insured
              </Typography>
            </Box>
          </Box>
        </motion.div>
      </Container>

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
            const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
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