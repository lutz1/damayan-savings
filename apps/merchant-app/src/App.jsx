import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { createFirebaseClients } from "../../../shared/firebase/firebaseClient";
import MerchantDashboard from "./pages/merchantDashboard";
import MerchantOrders from "./pages/merchantOrders";
import MerchantProducts from "./pages/merchantProducts";
import MerchantProfile from "./pages/merchantProfile";
import "./App.css";

const { auth, db } = createFirebaseClients("MerchantApp");

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
    <main className="merchant-auth-page">
      <section className="merchant-auth-card" aria-live="polite">
        <header className="merchant-auth-header">
          <p className="merchant-auth-kicker">Damayan Merchant Portal</p>
          <h1>Merchant Login</h1>
          <p>Sign in using your official merchant account credentials.</p>
        </header>

        {checkingSession ? (
          <div className="merchant-loading">Checking your session...</div>
        ) : (
          <form className="merchant-auth-form" onSubmit={handleLogin}>
            <label htmlFor="merchant-email">Email</label>
            <input
              id="merchant-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              required
            />

            <label htmlFor="merchant-password">Password</label>
            <input
              id="merchant-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />

            {error ? <div className="merchant-error">{error}</div> : null}

            <button type="submit" disabled={loading} className="merchant-primary-btn">
              {loading ? "Logging in..." : "Login as Merchant"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function MerchantDashboardRoute({ isLoggedIn, merchantName, onLogout }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn) {
    return null;
  }

  return <MerchantDashboard merchantName={merchantName} onLogout={onLogout} />;
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
  const [merchantName, setMerchantName] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsLoggedIn(false);
        setMerchantName("");
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
        if (role !== "MERCHANT") {
          setError("This account is not a Merchant account.");
          await signOut(auth);
          return;
        }

        setMerchantName(userData.fullName || userData.displayName || user.email || "Merchant");
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
      if (role !== "MERCHANT") {
        setError("This account is not a Merchant account.");
        await signOut(auth);
        return;
      }

      setMerchantName(userData.fullName || userData.displayName || credential.user.email || "Merchant");
      setIsLoggedIn(true);
      setPassword("");
    } catch (loginError) {
      console.error("Merchant login error:", loginError);
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
    setMerchantName("");
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
            <MerchantDashboardRoute
              isLoggedIn={isLoggedIn}
              merchantName={merchantName}
              onLogout={handleLogout}
            />
          }
        />
        <Route
          path="/orders"
          element={<ProtectedPageRoute isLoggedIn={isLoggedIn} PageComponent={MerchantOrders} />}
        />
        <Route
          path="/products"
          element={<ProtectedPageRoute isLoggedIn={isLoggedIn} PageComponent={MerchantProducts} />}
        />
        <Route
          path="/profile"
          element={<ProtectedPageRoute isLoggedIn={isLoggedIn} PageComponent={MerchantProfile} />}
        />
        <Route path="*" element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
