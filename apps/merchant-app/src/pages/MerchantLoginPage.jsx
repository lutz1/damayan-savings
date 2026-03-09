import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { CircularProgress } from "@mui/material";
import { createFirebaseClients } from "../../../../shared/firebase/firebaseClient";

const { auth, db } = createFirebaseClients("MerchantApp");

export default function MerchantLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBackToMainLogin = () => {
    const isProduction = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
    if (isProduction) {
      window.location.href = "/damayan-savings/";
    } else {
      window.location.href = "/";
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check user data in Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("User data not found. Please contact support.");
        setLoading(false);
        return;
      }

      const userData = userSnap.data();
      const role = (userData.role || "").toUpperCase();

      // Validate merchant role
      if (role !== "MERCHANT") {
        setError("This account is not authorized as a Merchant. Please use your Merchant credentials.");
        setLoading(false);
        return;
      }

      // Store preferences if remember me is checked
      if (rememberMe) {
        localStorage.setItem("merchantRememberMe", "true");
        localStorage.setItem("merchantEmail", email);
      } else {
        localStorage.removeItem("merchantRememberMe");
        localStorage.removeItem("merchantEmail");
      }

      // Navigate to dashboard
      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err.message);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("Invalid email or password.");
      } else if (err.code === "auth/user-not-found") {
        setError("No merchant account found with this email.");
      } else {
        setError("Unable to login. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(135deg, #f6f8f6 0%, #e8f5e8 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "white",
          borderRadius: "0.75rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "white",
            padding: "1rem",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <button
            onClick={handleBackToMainLogin}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "2.5rem",
              height: "2.5rem",
              borderRadius: "50%",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "1.5rem",
              color: "#64748b",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#f1f5f9")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2
            style={{
              fontSize: "1.125rem",
              fontWeight: "700",
              marginLeft: "0.5rem",
              flex: 1,
              color: "#0f172a",
            }}
          >
            Merchant Portal
          </h2>
        </div>

        {/* Hero Section */}
        <div
          style={{
            position: "relative",
            height: "12rem",
            backgroundColor: "rgba(91, 236, 19, 0.1)",
            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 480"><rect fill="%235bec13" opacity="0.1" width="1200" height="480"/><path fill="%235bec13" opacity="0.05" d="M0,300 Q300,200 600,300 T1200,300 L1200,480 L0,480 Z"/></svg>')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "linear-gradient(to top, white, transparent)",
            }}
          />
        </div>

        {/* Content */}
        <div style={{ padding: "0.5rem 2rem 2rem 2rem" }}>
          <div style={{ marginBottom: "2rem" }}>
            <h1
              style={{
                fontSize: "1.875rem",
                fontWeight: "700",
                letterSpacing: "-0.02em",
                lineHeight: "1.2",
                color: "#0f172a",
                marginBottom: "0.5rem",
              }}
            >
              Merchant Login
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#64748b",
                marginTop: "0.5rem",
              }}
            >
              Manage your restaurant dashboard, orders, and menu in one place.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              style={{
                padding: "0.75rem 1rem",
                marginBottom: "1.25rem",
                backgroundColor: "#fee2e2",
                border: "1px solid #fecaca",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                color: "#991b1b",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Email Field */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: "#475569",
                }}
              >
                Email Address
              </label>
              <div style={{ position: "relative" }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    position: "absolute",
                    left: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#cbd5e1",
                    fontSize: "1.25rem",
                  }}
                >
                  mail
                </span>
                <input
                  type="email"
                  required
                  placeholder="manager@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    paddingLeft: "2.5rem",
                    paddingRight: "1rem",
                    paddingTop: "0.75rem",
                    paddingBottom: "0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    fontSize: "0.95rem",
                    transition: "all 0.2s",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#5bec13";
                    e.target.style.boxShadow = "0 0 0 3px rgba(91, 236, 19, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#e2e8f0";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <label
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#475569",
                  }}
                >
                  Password
                </label>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#5bec13",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => (e.target.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.target.style.textDecoration = "none")}
                >
                  Forgot password?
                </a>
              </div>
              <div style={{ position: "relative" }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    position: "absolute",
                    left: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#cbd5e1",
                    fontSize: "1.25rem",
                  }}
                >
                  lock
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    paddingLeft: "2.5rem",
                    paddingRight: "2.5rem",
                    paddingTop: "0.75rem",
                    paddingBottom: "0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    fontSize: "0.95rem",
                    transition: "all 0.2s",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#5bec13";
                    e.target.style.boxShadow = "0 0 0 3px rgba(91, 236, 19, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#e2e8f0";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#cbd5e1",
                    fontSize: "1.25rem",
                    padding: 0,
                  }}
                  onMouseEnter={(e) => (e.target.style.color = "#94a3b8")}
                  onMouseLeave={(e) => (e.target.style.color = "#cbd5e1")}
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  width: "1rem",
                  height: "1rem",
                  cursor: "pointer",
                  accentColor: "#5bec13",
                }}
              />
              <label
                htmlFor="remember"
                style={{
                  marginLeft: "0.5rem",
                  fontSize: "0.875rem",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                Stay logged in for 30 days
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                backgroundColor: loading ? "#cbd5e1" : "#5bec13",
                color: "#0f172a",
                fontWeight: "700",
                padding: "1rem",
                borderRadius: "0.5rem",
                border: "none",
                boxShadow: "0 10px 15px -3px rgba(91, 236, 19, 0.2)",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "0.95rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                transition: "all 0.2s",
                marginTop: "1rem",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = "rgba(91, 236, 19, 0.9)";
                  e.target.style.boxShadow = "0 15px 20px -3px rgba(91, 236, 19, 0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = "#5bec13";
                  e.target.style.boxShadow = "0 10px 15px -3px rgba(91, 236, 19, 0.2)";
                }
              }}
            >
              {loading ? (
                <>
                  <CircularProgress size={16} sx={{ color: "#0f172a" }} />
                  Logging in...
                </>
              ) : (
                <>
                  <span>Login as Merchant</span>
                  <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>
                    login
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Registration Link */}
          <div
            style={{
              marginTop: "2rem",
              paddingTop: "1.5rem",
              borderTop: "1px solid #f1f5f9",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
              New to the platform?{" "}
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                style={{
                  color: "#5bec13",
                  fontWeight: "700",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => (e.target.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.target.style.textDecoration = "none")}
              >
                Register your restaurant
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "2rem 1rem 1rem 1rem",
          background: "linear-gradient(to top, rgba(255, 255, 255, 1), transparent)",
        }}
      >
        <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.5rem" }}>
          © 2025 Damayan Merchant Solutions. All rights reserved.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              fontSize: "0.75rem",
              color: "#cbd5e1",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => (e.target.style.color = "#5bec13")}
            onMouseLeave={(e) => (e.target.style.color = "#cbd5e1")}
          >
            Support
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              fontSize: "0.75rem",
              color: "#cbd5e1",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => (e.target.style.color = "#5bec13")}
            onMouseLeave={(e) => (e.target.style.color = "#cbd5e1")}
          >
            Privacy Policy
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              fontSize: "0.75rem",
              color: "#cbd5e1",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => (e.target.style.color = "#5bec13")}
            onMouseLeave={(e) => (e.target.style.color = "#cbd5e1")}
          >
            Terms of Service
          </a>
        </div>
      </div>

    </div>
  );
}
