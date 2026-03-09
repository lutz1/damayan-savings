import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { createFirebaseClients } from "../../../shared/firebase/firebaseClient";
import RiderLoginPage from "./pages/RiderLoginPage";
import RiderDashboard from "./pages/riderDashboard";
import RiderOrders from "./pages/riderOrders";
import RiderWallet from "./pages/riderWallet";
import RiderProfile from "./pages/riderProfile";
import MemberOrders from "./pages/memberOrders";
import "./App.css";

const { auth, db } = createFirebaseClients("RiderApp");

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
  const [checkingSession, setCheckingSession] = useState(true);
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
          setCheckingSession(false);
          await signOut(auth);
          return;
        }

        const userData = userSnap.data();
        const role = String(userData.role || "").toUpperCase();
        if (role !== "RIDER") {
          setCheckingSession(false);
          await signOut(auth);
          return;
        }

        setRiderName(userData.fullName || userData.displayName || user.email || "Rider");
        setIsLoggedIn(true);
      } catch (sessionError) {
        console.error("Session check error:", sessionError);
      } finally {
        setCheckingSession(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setRiderName("");
  };

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
              <RiderLoginPage />
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
