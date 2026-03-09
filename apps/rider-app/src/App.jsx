import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { createFirebaseClients } from "../../../shared/firebase/firebaseClient";
import RiderDashboard from "./pages/riderDashboard";
import RiderOrders from "./pages/riderOrders";
import RiderWallet from "./pages/riderWallet";
import RiderProfile from "./pages/riderProfile";
import MemberOrders from "./pages/memberOrders";
import "./App.css";

const { auth, db } = createFirebaseClients("RiderApp");

function LoginPage({
  email,
  setEmail,
  password,
  setPassword,
  error,
  loading,
  checkingSession,
  handleLogin,
}) {
  return (
    <main className="rider-auth-page">
      <section className="rider-auth-card" aria-live="polite">
        <header className="rider-auth-header">
          <p className="rider-auth-kicker">Damayan Rider Portal</p>
          <h1>Rider Login</h1>
          <p>Sign in using your official rider account credentials.</p>
        </header>

        {checkingSession ? (
          <div className="rider-loading">Checking your session...</div>
        ) : (
          <form className="rider-auth-form" onSubmit={handleLogin}>
            <label htmlFor="rider-email">Email</label>
            <input
              id="rider-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              required
            />

            <label htmlFor="rider-password">Password</label>
            <input
              id="rider-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />

            {error ? <div className="rider-error">{error}</div> : null}

            <button type="submit" disabled={loading} className="rider-primary-btn">
              {loading ? "Logging in..." : "Login as Rider"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function RiderDashboardRoute({ isLoggedIn, riderName, onLogout }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn) {
    return null;
  }

  return <RiderDashboard riderName={riderName} onLogout={onLogout} />;
}

function ProtectedPageRoute({ isLoggedIn, PageComponent }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn) {
    return null;
  }

  return <PageComponent />;
}

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [riderName, setRiderName] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsLoggedIn(false);
        setRiderName("");
        setCheckingSession(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setError("User profile not found. Please contact admin.");
          await signOut(auth);
          return;
        }

        const userData = userSnap.data();
        const role = String(userData.role || "").toUpperCase();
        if (role !== "RIDER") {
          setError("This account is not a Rider account.");
          await signOut(auth);
          return;
        }

        setRiderName(userData.fullName || userData.displayName || user.email || "Rider");
        setIsLoggedIn(true);
        setError("");
      } catch (sessionError) {
        console.error("Session check error:", sessionError);
        setError("Unable to validate your session right now.");
      } finally {
        setCheckingSession(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userRef = doc(db, "users", credential.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("User profile not found. Please contact admin.");
        await signOut(auth);
        return;
      }

      const userData = userSnap.data();
      const role = String(userData.role || "").toUpperCase();
      if (role !== "RIDER") {
        setError("This account is not a Rider account.");
        await signOut(auth);
        return;
      }

      setRiderName(userData.fullName || userData.displayName || credential.user.email || "Rider");
      setIsLoggedIn(true);
      setPassword("");
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

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setRiderName("");
    setEmail("");
    setPassword("");
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />}
        />
        <Route
          path="/login"
          element={
            isLoggedIn ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                error={error}
                loading={loading}
                checkingSession={checkingSession}
                handleLogin={handleLogin}
              />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            <RiderDashboardRoute
              isLoggedIn={isLoggedIn}
              riderName={riderName}
              onLogout={handleLogout}
            />
          }
        />
        <Route
          path="/orders"
          element={<ProtectedPageRoute isLoggedIn={isLoggedIn} PageComponent={RiderOrders} />}
        />
        <Route
          path="/member-orders"
          element={<ProtectedPageRoute isLoggedIn={isLoggedIn} PageComponent={MemberOrders} />}
        />
        <Route
          path="/wallet"
          element={<ProtectedPageRoute isLoggedIn={isLoggedIn} PageComponent={RiderWallet} />}
        />
        <Route
          path="/profile"
          element={<ProtectedPageRoute isLoggedIn={isLoggedIn} PageComponent={RiderProfile} />}
        />
        <Route path="*" element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
