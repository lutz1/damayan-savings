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
import plezzIcon from "../../assets/plezzicon.png";
import riderLogo from "../../assets/plezzicon.png";
import "./RiderLoginPage.css";

const toRiderLoginEmail = (riderId = "") => {
  const normalized = String(riderId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  return normalized ? `${normalized}@plezzrider.local` : "";
};

export default function RiderLoginPage() {
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

    const riderId = String(identifier || "").trim().toUpperCase();
    const loginEmail = toRiderLoginEmail(riderId);

    if (!riderId) {
      setError("Please enter your Rider ID.");
      setLoading(false);
      return;
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const userRef = doc(db, "users", credential.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("Rider profile not found. Please contact admin.");
        await signOut(auth);
        setLoading(false);
        return;
      }

      const userData = userSnap.data();
      const role = String(userData.role || "").toUpperCase();
      if (role !== "RIDER") {
        setError("This account is not a Rider account.");
        await signOut(auth);
        setLoading(false);
        return;
      }

      localStorage.setItem("userRole", "RIDER");
      sessionStorage.setItem("skipAppSplash", "true");
      navigate("/rider/location-access", { replace: true });
      return;
    } catch (loginError) {
      console.error("Rider login error:", loginError);
      if (loginError.code === "auth/invalid-credential" || loginError.code === "auth/wrong-password") {
        setError("Invalid Rider ID or password.");
      } else if (loginError.code === "auth/user-not-found") {
        setError("No approved rider account found for this Rider ID.");
      } else {
        setError("Unable to login right now. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const openApplicationPage = () => {
    setInfoOpen(false);
    const safeIdentifier = String(identifier || "").trim();
    const prefill = /@|^09\d{9}$/.test(safeIdentifier) ? { identifier: safeIdentifier } : undefined;

    navigate("/rider/apply", {
      state: {
        from: "/rider/login",
        ...(prefill ? { prefill } : {}),
      },
    });
  };

  return (
    <div className="rider-login-page">
      <div className="rider-login-shell">
        <div className="rider-login-topbar">
          <button type="button" onClick={() => navigate("/login")} className="rider-login-brand">
            <img src={plezzIcon} alt="PLEZZ Rider" className="rider-login-brand-icon" />
            <span>PLEZZRIDER</span>
          </button>

          <button
            type="button"
            className="rider-login-info-button"
            onClick={() => setInfoOpen((prev) => !prev)}
            aria-label="Show rider login information"
          >
            <InfoOutlined sx={{ fontSize: 17 }} />
          </button>
        </div>


        <div className="rider-login-card">
          <div className="rider-login-hero">
            <div className="rider-login-logo-badge">
              <img src={riderLogo} alt="Rider logo" className="rider-login-logo-image" />
            </div>

            <h1 className="rider-login-title">Welcome back!</h1>
            <p className="rider-login-subtitle">Use your Rider ID and password to continue.</p>
          </div>

          <form onSubmit={handleLogin} className="rider-login-form">
            <div>
              <label className="rider-login-field-label">Rider ID</label>
              <div className="rider-login-input-wrap">
                <span className="rider-login-input-icon">
                  <AlternateEmailRounded sx={{ fontSize: 18 }} />
                </span>
                <input
                  type="text"
                  placeholder="RIDER-123456"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value.toUpperCase())}
                  required
                  className="rider-login-input"
                />
              </div>
            </div>

            <div>
              <label className="rider-login-field-label">Password</label>
              <div className="rider-login-input-wrap">
                <span className="rider-login-input-icon">
                  <LockOutlined sx={{ fontSize: 18 }} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rider-login-input rider-login-input--with-toggle"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="rider-login-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <VisibilityOffRounded sx={{ fontSize: 18 }} /> : <VisibilityRounded sx={{ fontSize: 18 }} />}
                </button>
              </div>
            </div>

            {error ? <div className="rider-login-error">{error}</div> : null}

            <div className="rider-login-forgot-row">
              <button
                type="button"
                onClick={() => setError("Please contact support to reset your password.")}
                className="rider-login-link-btn"
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" disabled={loading} className="rider-login-submit">
              <span>{loading ? "Signing In..." : "Sign in to Dashboard"}</span>
              {!loading && <ArrowForwardRounded sx={{ fontSize: 18 }} />}
            </button>

            <button type="button" onClick={() => navigate("/login")} className="rider-login-back-btn">
              Back to Main Login
            </button>
          </form>
        </div>

        <div className="rider-login-promo-card">
          <div className="rider-login-promo-badge">JOIN THE FLEET</div>
          <div className="rider-login-promo-content">
            <div className="rider-login-promo-title">Ready to hit the road?</div>
            <p className="rider-login-promo-text">
              Join the PLEZZ Rider fleet and start earning on your own schedule today.
            </p>
            <button
              type="button"
              onClick={openApplicationPage}
              className="rider-login-promo-btn"
            >
              Apply Now
            </button>
          </div>

          <img src={plezzIcon} alt="" className="rider-login-promo-art" />
        </div>
      </div>

      <Drawer
        anchor="bottom"
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        PaperProps={{ className: "rider-login-drawer-paper" }}
      >
        <div className="rider-login-drawer-sheet">
          <div className="rider-login-drawer-handle" />
          <div className="rider-login-drawer-header">
            <div>
              <div className="rider-login-drawer-title">Rider Login Information</div>
              <div className="rider-login-drawer-subtitle">Quick onboarding guide</div>
            </div>
            <button
              type="button"
              className="rider-login-info-close"
              onClick={() => setInfoOpen(false)}
              aria-label="Close rider login information"
            >
              <CloseRounded sx={{ fontSize: 18 }} />
            </button>
          </div>

          <div className="rider-login-drawer-list">
            <div className="rider-login-drawer-item">
              <span>1</span>
              <p>Use your approved Rider ID and default password to access the dashboard.</p>
            </div>
            <div className="rider-login-drawer-item">
              <span>2</span>
              <p>If you still need an account, tap <strong>Apply Now</strong> to complete the rider application flow.</p>
            </div>
            <div className="rider-login-drawer-item">
              <span>3</span>
              <p>Prepare your ID, license, and selfie photo for faster application review.</p>
            </div>
          </div>

          <div className="rider-login-drawer-actions">
            <button
              type="button"
              className="rider-login-drawer-primary"
              onClick={openApplicationPage}
            >
              Start Application
            </button>
            <button
              type="button"
              className="rider-login-drawer-secondary"
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
