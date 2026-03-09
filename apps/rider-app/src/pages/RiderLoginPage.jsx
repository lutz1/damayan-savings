import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createFirebaseClients } from "../../../../shared/firebase/firebaseClient";

const { auth, db } = createFirebaseClients("RiderApp");

export default function RiderLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userRef = doc(db, "users", credential.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("User profile not found. Please contact admin.");
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

      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      console.error("Rider login error:", loginError);
      if (loginError.code === "auth/invalid-credential" || loginError.code === "auth/wrong-password") {
        setError("Invalid email or password.");
      } else if (loginError.code === "auth/user-not-found") {
        setError("No account found for this email.");
      } else {
        setError("Unable to login right now. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    page: {
      minHeight: "100dvh",
      background: "linear-gradient(170deg, #f7fbf4 0%, #eef7e9 55%, #f4f7f3 100%)",
      fontFamily: "Inter, 'Trebuchet MS', 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px 14px 28px",
      position: "relative",
    },
    topBarWrap: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "5px",
      background: "rgba(91, 236, 19, 0.2)",
      zIndex: 20,
    },
    topBarFill: {
      width: "34%",
      height: "100%",
      background: "#5bec13",
    },
    card: {
      width: "100%",
      maxWidth: "420px",
      background: "#ffffff",
      borderRadius: "16px",
      border: "1px solid #e8eee3",
      boxShadow: "0 18px 40px rgba(16, 24, 40, 0.10)",
      padding: "26px 22px 22px",
    },
    iconCircle: {
      width: "66px",
      height: "66px",
      borderRadius: "9999px",
      background: "#5bec13",
      display: "grid",
      placeItems: "center",
      color: "#ffffff",
      boxShadow: "0 10px 26px rgba(91, 236, 19, 0.38)",
    },
    label: {
      fontSize: "13px",
      fontWeight: 600,
      color: "#334155",
      marginBottom: "8px",
    },
    inputWrap: {
      position: "relative",
      display: "flex",
      alignItems: "center",
    },
    inputIcon: {
      position: "absolute",
      left: "13px",
      top: "50%",
      transform: "translateY(-50%)",
      fontSize: "19px",
      color: "#94a3b8",
    },
    input: {
      width: "100%",
      height: "46px",
      borderRadius: "10px",
      border: "1px solid #dbe4d5",
      background: "#ffffff",
      padding: "0 14px 0 42px",
      color: "#0f172a",
      fontSize: "14px",
      outline: "none",
      boxSizing: "border-box",
    },
    eyeButton: {
      position: "absolute",
      right: "0",
      top: "0",
      height: "100%",
      width: "44px",
      border: "0",
      background: "transparent",
      color: "#94a3b8",
      cursor: "pointer",
      display: "grid",
      placeItems: "center",
    },
    primaryButton: {
      width: "100%",
      height: "48px",
      border: "0",
      borderRadius: "10px",
      background: loading ? "rgba(91, 236, 19, 0.65)" : "#5bec13",
      color: "#0f172a",
      fontSize: "15px",
      fontWeight: 800,
      letterSpacing: "0.01em",
      boxShadow: "0 12px 26px rgba(91, 236, 19, 0.27)",
      cursor: loading ? "not-allowed" : "pointer",
      transition: "filter 0.2s ease",
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBarWrap}>
        <div style={styles.topBarFill} />
      </div>

      <div style={styles.card}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "26px" }}>
          <div style={styles.iconCircle}>
            <span className="material-symbols-outlined" style={{ fontSize: "36px" }}>
              delivery_dining
            </span>
          </div>
          <h2 style={{ margin: "16px 0 6px", fontSize: "31px", lineHeight: 1.08, color: "#0f172a", fontWeight: 800 }}>Rider Login</h2>
          <p style={{ margin: 0, fontSize: "14px", color: "#64748b", textAlign: "center" }}>
            Welcome back! Please enter your details.
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={styles.label}>Email or Phone Number</label>
            <div style={styles.inputWrap}>
              <span className="material-symbols-outlined" style={styles.inputIcon}>person</span>
              <input
                type="email"
                placeholder="Enter your rider ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.input}
              />
            </div>
          </div>

          <div>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrap}>
              <span className="material-symbols-outlined" style={styles.inputIcon}>lock</span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ ...styles.input, paddingRight: "48px" }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {error ? (
            <div style={{ borderRadius: "10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: "10px 12px", fontSize: "13px" }}>
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setError("Please contact support to reset your password.")}
              style={{ border: 0, background: "transparent", color: "#4d9f1a", fontWeight: 600, fontSize: "13px", cursor: "pointer", padding: 0 }}
            >
              Forgot Password?
            </button>
          </div>

          <button type="submit" disabled={loading} style={styles.primaryButton}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #eef2ec", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
            Want to earn with us?{" "}
            <button
              type="button"
              onClick={() => setError("Signup flow is not yet available in Rider app.")}
              style={{ border: 0, background: "transparent", color: "#4d9f1a", fontWeight: 700, fontSize: "13px", cursor: "pointer", padding: 0 }}
            >
              Sign up to Deliver
            </button>
          </p>
        </div>
      </div>

      <div style={{ marginTop: "18px", display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "12px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>language</span>
          <span>English (US)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "12px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>help_outline</span>
          <span>Help Center</span>
        </div>
      </div>
    </div>
  );
}
