import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Link,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

// ✅ Import assets
import bgImage from "../assets/bg.jpg";
import tclcLogo from "../assets/tclc-logo1.png";
import damayanLogo from "../assets/damayan.png";

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");

  // ✅ Auto redirect if already logged in
  useEffect(() => {
    const role = localStorage.getItem("userRole");
    if (!role) return;

    const upperRole = role.toUpperCase();
    if (upperRole === "ADMIN") {
      window.location.replace("/damayan-savings/admin/dashboard");
    } else if (["MD", "MS", "MI", "AGENT", "MEMBER"].includes(upperRole)) {
      window.location.replace("/damayan-savings/member/dashboard");
    }
  }, []);

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

      // ✅ Use window.location.replace for GH Pages base path
      if (role === "ADMIN") {
        window.location.replace("/damayan-savings/admin/dashboard");
      } else if (["MD", "MS", "MI", "AGENT", "MEMBER"].includes(role)) {
        window.location.replace("/damayan-savings/member/dashboard");
      } else {
        window.location.replace("/damayan-savings/");
      }
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

  // --- SIGNUP HANDLER ---
  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        email,
        code,
        role: "Member",
        createdAt: new Date(),
      });

      localStorage.setItem("userRole", "MEMBER");
      window.location.replace("/damayan-savings/member/dashboard");
    } catch (err) {
      console.error("Signup error:", err.message);
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else {
        setError("Signup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        p: { xs: 2, md: 0 },
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(13, 135, 184, 0.25)",
          zIndex: 0,
        },
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: "100%", maxWidth: 420, zIndex: 1 }}
      >
        <Paper
          elevation={10}
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            textAlign: "center",
            backdropFilter: "blur(18px)",
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            color: "#fff",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* 🪩 Logos */}
          <Box sx={{ mb: 2 }}>
            <Box component="img" src={tclcLogo} alt="TCLC" sx={{ width: 110, height: 100 }} />
            <Box
              component="img"
              src={damayanLogo}
              alt="Damayan"
              sx={{ width: 260, height: 85, mt: -3 }}
            />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <AnimatePresence mode="wait">
            {!isSignup ? (
              // 🔐 LOGIN FORM
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.4 }}
              >
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
                  />
                  <TextField
                    label="Password"
                    type="password"
                    fullWidth
                    required
                    margin="normal"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={textFieldStyle}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={loading}
                    sx={buttonStyle}
                  >
                    {loading ? <CircularProgress size={24} color="inherit" /> : "Login"}
                  </Button>
                </form>
                <Typography mt={2}>
                  Don’t have an account?{" "}
                  <Link
                    component="button"
                    color="rgba(240,224,7,1)"
                    onClick={() => setIsSignup(true)}
                  >
                    Create one
                  </Link>
                </Typography>
              </motion.div>
            ) : (
              // 📝 SIGNUP FORM
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.4 }}
              >
                <form onSubmit={handleSignup}>
                  <TextField
                    label="Email Address"
                    type="email"
                    fullWidth
                    required
                    margin="normal"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    sx={textFieldStyle}
                  />
                  <TextField
                    label="Password"
                    type="password"
                    fullWidth
                    required
                    margin="normal"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={textFieldStyle}
                  />
                  <TextField
                    label="Confirm Password"
                    type="password"
                    fullWidth
                    required
                    margin="normal"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    sx={textFieldStyle}
                  />
                  <TextField
                    label="Registered Code"
                    type="text"
                    fullWidth
                    required
                    margin="normal"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    sx={textFieldStyle}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={loading}
                    sx={buttonStyle}
                  >
                    {loading ? <CircularProgress size={24} color="inherit" /> : "Create Account"}
                  </Button>
                </form>
                <Typography mt={2}>
                  Already have an account?{" "}
                  <Link
                    component="button"
                    color="rgba(240,224,7,1)"
                    onClick={() => setIsSignup(false)}
                  >
                    Login
                  </Link>
                </Typography>
              </motion.div>
            )}
          </AnimatePresence>

          <Typography
            variant="body2"
            sx={{ mt: 3, color: "rgba(255,255,255,0.8)", fontSize: "0.8rem" }}
          >
            © 2025 Damayan Savings. All rights reserved.
          </Typography>
        </Paper>
      </motion.div>
    </Box>
  );
};

// 🔧 Reusable Styles
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
  input: { color: "#fff" },
};

const buttonStyle = {
  mt: 3,
  py: 1.3,
  fontWeight: "bold",
  borderRadius: 2,
  background: "linear-gradient(90deg, #1976d2, #42a5f5)",
};

export default Login;