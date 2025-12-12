import React, { useState, useEffect } from "react";
import usePwaInstall from "../hooks/usePwaInstall";
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
import bgImage from "../assets/bg.jpg";
import tclcLogo from "../assets/tclc-logo1.png";
import damayanLogo from "../assets/damayan.png";
import merchantLogo from "../assets/merchantlogo.jpg";
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
  const { isInstallable, promptInstall } = usePwaInstall();

  
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

  useEffect(() => {
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = "auto";
  };
}, []);



  return (
   <Box
      sx={{
       height: { xs: "85vh", sm: "95vh", md: "100vh" }, // 🔥 reduced mobile height
        overflow: "hidden",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: { xs: "scroll", md: "fixed" },
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        p: { xs: 2, sm: 3, md: 0 },
        position: "relative",

        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background: {
            xs: "rgba(13,135,184,0.45)",
            sm: "rgba(13,135,184,0.35)",
            md: "rgba(13,135,184,0.28)",
          },
          backdropFilter: { xs: "blur(0px)", md: "blur(2px)" },
        },
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: "100%", maxWidth: 430, zIndex: 1 }}
      >
        <Paper
          elevation={10}
          sx={{
            p: { xs: "18px 20px", sm: 4, md: 3.5 },  // 🔥 reduced mobile top/bottom padding
            maxHeight: { md: 650 },
            borderRadius: 4,
            textAlign: "center",
            backdropFilter: "blur(18px)",
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            color: "#fff",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            overflowY: "auto",
          }}
        >
          {/* LOGOS */}
          <Box sx={{ mb: 3 }}>
            <Box
              component="img"
              src={tclcLogo}
              alt="TCLC"
              sx={{ width: { xs: 80, sm: 100, md: 110 }, height: "auto" }}
            />
            <Box
              component="img"
              src={damayanLogo}
              alt="Damayan"
              sx={{
                width: { xs: 190, sm: 230, md: 260 },
                height: "auto",
                mt: -2,
              }}
            />
          </Box>
          {isInstallable && (
            <>
              <Button
                variant="outlined"
                sx={{ mb: 0.5, color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
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
              <Typography
                variant="caption"
                sx={{ display: "block", color: "rgba(255,255,255,0.8)", mb: 1 }}
              >
                Install for faster access and a home-screen shortcut.
              </Typography>
            </>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2, fontSize: { xs: "0.8rem", sm: "0.9rem" } }}>
              {error}
            </Alert>
          )}

            <Alert
              severity="info"
              sx={{
                mb: 1.5,
                fontSize: { xs: "0.75rem", sm: "0.85rem" },
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.3)",
                backdropFilter: "blur(4px)",
                "& .MuiAlert-icon": { color: "#fff" }
              }}
            >
              Please use your <strong>official company email</strong> to log in.
            </Alert>


          <form onSubmit={handleLogin}>
            <TextField
                label="Email Address"
                type="email"
                fullWidth
                required
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={textFieldStyle}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: "#fff" }} />
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
                sx={textFieldStyle}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: "#fff" }} /> {/* optional default icon */}
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        sx={{ color: "#fff" }}
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
            sx={buttonStyle}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : "Login"}
          </Button>
          </form>

          <Typography
            variant="body2"
            sx={{
              mt: 4,
              color: "rgba(255,255,255,0.8)",
              fontSize: { xs: "0.7rem", sm: "0.8rem" },
            }}
          >
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

// Styles
const textFieldStyle = {
  "& .MuiOutlinedInput-root": {
    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
    "&:hover fieldset": { borderColor: "#fff" },
    "&.Mui-focused fieldset": { borderColor: "#fff" },
  },
  "& .MuiInputLabel-root": {
    color: "rgba(255,255,255,0.7)",
    "&.Mui-focused": { color: "#fff" },
  },
  input: { color: "#fff", fontSize: { xs: "0.8rem", sm: "1rem" } },
};

const buttonStyle = {
  mt: 3,
  py: { xs: 1.1, sm: 1.3 },
  fontWeight: "bold",
  borderRadius: 2,
  fontSize: { xs: "0.85rem", sm: "1rem" },
  background: "linear-gradient(90deg, #1976d2, #42a5f5)",
};

export default Login;