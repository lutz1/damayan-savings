import React, { useState, useEffect } from "react";
import usePwaInstall from "../hooks/usePwaInstall";
import "./login.css";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert,
} from "@mui/material";
import { motion } from "framer-motion";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Visibility, VisibilityOff, Email, Lock} from "@mui/icons-material";
import { InputAdornment, IconButton } from "@mui/material";
import bgImage from "../assets/newlogo.png";
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
  const { isInstallable, promptInstall } = usePwaInstall();

  // iOS detection and standalone check (for Add to Home Screen guidance)
  const isIos = typeof window !== "undefined" && /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode =
    typeof window !== "undefined" && (window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  
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
    className="login-container"
    sx={{
        backgroundImage: `url(${bgImage})`,
    }}
  >
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="login-form-wrapper"
      >
        <Paper
          elevation={10}
          className="login-card"
        >
          {/* LOGO */}
          <Box className="login-logo-container">
            <Box
              component="img"
              src={newlogo}
              alt="Damayan Savings"
              className="login-main-logo"
            />
            <Typography className="login-logo-subtitle">
              Savings & Credit
            </Typography>
          </Box>
          {isIos && !isInStandaloneMode ? (
            <>
              <Typography className="login-ios-instructions-title">
                On iPhone/iPad the browser must be Safari to add the app to your Home Screen.
              </Typography>
              <Typography className="login-ios-instructions">
                Steps: 1) Open this page in Safari. 2) Tap the Share button (box with up-arrow). 3) Choose "Add to Home Screen".
              </Typography>
              <Button
                variant="outlined"
                className="login-install-button"
                onClick={copyLink}
              >
                Copy Link (Open in Safari)
              </Button>
            </>
          ) : isInstallable ? (
            <>
              <Button
                variant="outlined"
                className="login-install-button"
                onClick={async () => {
                  try {
                    await promptInstall();
                  } catch (err) {
                    console.error("PWA install failed:", err);
                  }
                }}
              >
                Install App
              </Button>
              <Typography className="login-install-caption">
                Install for faster access and a home-screen shortcut.
              </Typography>
            </>
          ) : null}

          {error && (
            <Alert severity="error" className="login-info-alert">
              {error}
            </Alert>
          )}

            <Alert
              severity="info"
              className="login-company-email-alert"
            >
              Please use your <strong>official company email</strong> to log in.
            </Alert>


          <form onSubmit={handleLogin} className="login-form">
            <TextField
                label="Email Address"
                type="email"
                fullWidth
                required
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-textfield"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email className="login-textfield-icon" />
                    </InputAdornment>
                  ),
                }}
              />
            <TextField
                label="Password"
                type={showPassword ? "text" : "password"}
                fullWidth
                required
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-textfield"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock className="login-textfield-icon" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        className="login-visibility-button"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

            {/* Terms & Conditions */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              style={{ width: "100%" }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  mt: 1.5,
                  cursor: "pointer",
                  color: acceptedTerms ? "#f8f8faff" : "#fff", // turns green when accepted
                  fontSize: "0.85rem",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  transition: "0.25s ease",
                  border: acceptedTerms
                    ? "1px solid #2aa2f3ff"
                    : "1px solid rgba(255,255,255,0.2)",
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.15)",
                  },
                }}
              >
                <motion.input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    e.stopPropagation(); // Prevent row click
                    const checked = e.target.checked;

                    if (checked) {
                      // Only open dialog when CHECKING
                      setOpenTerms(true);
                    } else {
                      // If unchecked, just remove acceptance without opening dialog
                      setAcceptedTerms(false);
                    }
                  }}
                  whileTap={{ scale: 0.7 }}
                  style={{
                    marginRight: "10px",
                    width: 20,
                    height: 20,
                    cursor: "pointer",
                    accentColor: acceptedTerms ? "#2aa2f3ff" : "#1976d2",
                  }}
                />
                <Typography
                  sx={{
                    textDecoration: "underline",
                    userSelect: "none",
                    fontSize: "0.88rem",
                  }}
                >
                  I agree to the Standard Terms & Conditions Policy
                </Typography>
              </Box>
            </motion.div>

           <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || !acceptedTerms}
            className="login-button"
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : "Login"}
          </Button>
          </form>

          <Typography className="login-footer">
            © 2025 Damayan Savings. All rights reserved.
          </Typography>
        </Paper>

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
      </motion.div>
    </Box>
  );
};

export default Login;