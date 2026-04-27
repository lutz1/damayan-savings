import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer } from "@mui/material";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowForwardRounded,
  AlternateEmailRounded,
  CloseRounded,
  InfoOutlined,
  LockOutlined,
  VisibilityOffRounded,
  VisibilityRounded,
} from "@mui/icons-material";
import { auth, db } from "../../firebase";
import merchantIcon from "../../assets/merchanticon.png";
import merchantLogo from "../../assets/merchantlogo.png";
import "./MerchantLoginPage.css";

export default function MerchantLoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const email = String(identifier || "").trim().toLowerCase();

    if (!email) {
      setError("Please enter your email.");
      setLoading(false);
      return;
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, "users", credential.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("Merchant profile not found. Please contact admin.");
        localStorage.removeItem("uid");
        await signOut(auth);
        setLoading(false);
        return;
      }

      const userData = userSnap.data();
      const role = String(userData.role || "").toUpperCase();
      if (role !== "MERCHANT") {
        setError("This account is not a Merchant account.");
        localStorage.removeItem("uid");
        await signOut(auth);
        setLoading(false);
        return;
      }

      localStorage.setItem("uid", credential.user.uid);
      localStorage.setItem("userRole", "MERCHANT");
      sessionStorage.setItem("skipAppSplash", "true");
      
      // Dispatch custom event to update App component's role state immediately
      window.dispatchEvent(
        new CustomEvent("roleChanged", { detail: { role: "MERCHANT" } })
      );
      
      navigate("/merchant/dashboard", { replace: true });
      return;
    } catch (loginError) {
      console.error("Merchant login error:", loginError);
      if (loginError.code === "auth/invalid-credential" || loginError.code === "auth/wrong-password") {
        setError("Invalid email or password.");
      } else if (loginError.code === "auth/user-not-found") {
        setError("No approved merchant account found for this email.");
      } else {
        setError("Unable to login right now. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const openApplicationPage = () => {
    setInfoOpen(false);
    navigate("/merchant/apply", {
      state: {
        from: "/merchant/login",
      },
    });
  };

  return (
    <div className="merchant-login-page">
      <div className="merchant-login-shell">
        <div className="merchant-login-topbar">
          <button type="button" onClick={() => navigate("/login")} className="merchant-login-brand">
            <img src={merchantIcon} alt="Merchant" className="merchant-login-brand-icon" />
            <span>MERCHANT</span>
          </button>

          <button
            type="button"
            className="merchant-login-info-button"
            onClick={() => setInfoOpen((prev) => !prev)}
            aria-label="Show merchant login information"
          >
            <InfoOutlined sx={{ fontSize: 17 }} />
          </button>
        </div>

        <div className="merchant-login-card">
          <div className="merchant-login-hero">
            <div className="merchant-login-logo-badge">
              <img src={merchantLogo} alt="Merchant logo" className="merchant-login-logo-image" />
            </div>

            <h1 className="merchant-login-title">Welcome back!</h1>
            <p className="merchant-login-subtitle">Use your email and password to continue.</p>
          </div>

          <form onSubmit={handleLogin} className="merchant-login-form">
            <div>
              <label className="merchant-login-field-label">Email</label>
              <div className="merchant-login-input-wrap">
                <span className="merchant-login-input-icon">
                  <AlternateEmailRounded sx={{ fontSize: 18 }} />
                </span>
                <input
                  type="email"
                  placeholder="merchant@store.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value.toLowerCase())}
                  required
                  className="merchant-login-input"
                />
              </div>
            </div>

            <div>
              <label className="merchant-login-field-label">Password</label>
              <div className="merchant-login-input-wrap">
                <span className="merchant-login-input-icon">
                  <LockOutlined sx={{ fontSize: 18 }} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="merchant-login-input merchant-login-input--with-toggle"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="merchant-login-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <VisibilityOffRounded sx={{ fontSize: 18 }} /> : <VisibilityRounded sx={{ fontSize: 18 }} />}
                </button>
              </div>
            </div>

            {error ? <div className="merchant-login-error">{error}</div> : null}

            <div className="merchant-login-forgot-row">
              <button
                type="button"
                onClick={() => setError("Please contact support to reset your password.")}
                className="merchant-login-link-btn"
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" disabled={loading} className="merchant-login-submit">
              <span>{loading ? "Signing In..." : "Sign in to Dashboard"}</span>
              {!loading && <ArrowForwardRounded sx={{ fontSize: 18 }} />}
            </button>

            <button type="button" onClick={() => navigate("/login")} className="merchant-login-back-btn">
              Back to Main Login
            </button>
          </form>
        </div>

        <div className="merchant-login-promo-card">
          <div className="merchant-login-promo-badge">JOIN OUR NETWORK</div>
          <div className="merchant-login-promo-content">
            <div className="merchant-login-promo-title">Ready to sell online?</div>
            <p className="merchant-login-promo-text">
              Join PLEZZ Merchant network and start selling to thousands of customers today.
            </p>
            <button
              type="button"
              onClick={openApplicationPage}
              className="merchant-login-promo-btn"
            >
              Apply Now
            </button>
          </div>

          <img src={merchantIcon} alt="" className="merchant-login-promo-art" />
        </div>
      </div>

      <Drawer
        anchor="bottom"
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        PaperProps={{ className: "merchant-login-drawer-paper" }}
      >
        <div className="merchant-login-drawer-sheet">
          <div className="merchant-login-drawer-handle" />
          <div className="merchant-login-drawer-header">
            <div>
              <div className="merchant-login-drawer-title">Merchant Login Information</div>
              <div className="merchant-login-drawer-subtitle">Quick onboarding guide</div>
            </div>
            <button
              type="button"
              className="merchant-login-info-close"
              onClick={() => setInfoOpen(false)}
              aria-label="Close merchant login information"
            >
              <CloseRounded sx={{ fontSize: 18 }} />
            </button>
          </div>

          <div className="merchant-login-drawer-list">
            <div className="merchant-login-drawer-item">
              <span>1</span>
              <p>Use your approved merchant email and password to access the dashboard.</p>
            </div>
            <div className="merchant-login-drawer-item">
              <span>2</span>
              <p>If you still need an account, tap <strong>Apply Now</strong> to complete the merchant application flow.</p>
            </div>
            <div className="merchant-login-drawer-item">
              <span>3</span>
              <p>Prepare your business info and documents for faster application review.</p>
            </div>
          </div>

          <div className="merchant-login-drawer-actions">
            <button
              type="button"
              className="merchant-login-drawer-primary"
              onClick={openApplicationPage}
            >
              Start Application
            </button>
            <button
              type="button"
              className="merchant-login-drawer-secondary"
              onClick={() => setInfoOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
