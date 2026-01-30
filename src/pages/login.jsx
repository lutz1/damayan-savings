import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Visibility, VisibilityOff, Email, Lock, Info } from "@mui/icons-material";
import newLogo from "../assets/newlogo.png";
import merchantLogo from "../assets/merchantlogo.png";
import Splashscreen from "../components/splashscreen";
import TermsAndConditions from "../components/TermsAndConditions";
import "./login.css";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [openTerms, setOpenTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
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
    <div className="login-container">
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: "100%", maxWidth: 420, zIndex: 10, padding: "1rem" }}
      >
        {/* Glass Panel */}
        <div className="glass-panel">
          {/* Logo Section */}
          <div className="logo-section">
            <img src={newLogo} alt="Damayan Logo" className="logo-image" />
            <div className="logo-divider" />
            <div className="logo-text">
              <h1 className="logo-title">Damayan</h1>
              <p className="logo-subtitle">Lingap. Malasakit. Kalinga.</p>
            </div>
          </div>

          {/* Info Alert */}
          <div className="info-alert">
            <Info className="info-icon" />
            <p className="info-text">
              Please use your <strong>official company email</strong> to log in to the employee portal.
            </p>
          </div>

          {/* Error Alert */}
          {error && <div className="error-alert">{error}</div>}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="login-form">
            {/* Email Field */}
            <div className="form-field">
              <Email className="input-icon" />
              <input
                type="email"
                placeholder=" "
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label htmlFor="email">Email Address</label>
            </div>

            {/* Password Field */}
            <div className="form-field">
              <Lock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder=" "
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <label htmlFor="password">Password</label>
              <button
                type="button"
                className="visibility-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </button>
            </div>

            {/* Form Actions */}
            <div className="form-actions">
              <div className="remember-me">
                <input type="checkbox" id="remember" />
                <label htmlFor="remember">Remember me</label>
              </div>
              <button type="button" className="forgot-password" onClick={() => {}}>Forgot Password?</button>
            </div>

            {/* Terms & Conditions */}
            <label className={`terms-box ${acceptedTerms ? "checked" : ""}`}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  if (e.target.checked) {
                    setOpenTerms(true);
                  } else {
                    setAcceptedTerms(false);
                  }
                }}
              />
              <p className="terms-text">
                I agree to the <strong>Standard Terms & Conditions</strong> and{" "}
                <strong>Privacy Policy</strong> of the institution.
              </p>
            </label>

            {/* Login Button */}
            <button
              type="submit"
              className="login-button"
              disabled={loading || !acceptedTerms}
            >
              {loading ? <div className="spinner" /> : "Login"}
            </button>
          </form>

          {/* Footer Links */}
          <div className="footer-links">
            <p>
              Don't have an account?{" "}
              <button type="button" className="footer-link" onClick={() => {}}>Request Access</button>
            </p>
            <p className="copyright">© 2025 Damayan Savings. All rights reserved.</p>
          </div>
        </div>

        {/* Language Selector */}
        <div className="language-selector">
          <button className="language-btn">🌐 English</button>
          <div className="language-divider" />
          <button className="language-btn">Filipino</button>
        </div>

        {/* Support Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="support-button"
          aria-label="Support"
        >
          💬
        </motion.button>
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

      {/* Splash Screen */}
      <Splashscreen
        open={showSplash}
        logo={merchantLogo}
        duration={1400}
        overlayColor="#f1f3c7"
        onClose={() => {
          setShowSplash(false);
          const base = "/damayan-savings";
          const target = postSplashTarget || "/merchant/dashboard";
          window.location.replace(`${base}${target}`);
        }}
      />
    </div>
  );
};

export default Login;