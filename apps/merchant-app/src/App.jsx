import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { createFirebaseClients } from "../../../shared/firebase/firebaseClient";
import MerchantLoginPage from "./pages/MerchantLoginPage";
import MerchantDashboard from "./pages/merchantDashboard";
import MerchantOrders from "./pages/merchantOrders";
import MerchantProducts from "./pages/merchantProducts";
import MerchantProfile from "./pages/merchantProfile";
import MerchantVouchers from "./pages/MerchantVouchers";
import "./App.css";

const { auth, db } = createFirebaseClients("MerchantApp");

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
  const [checkingSession, setCheckingSession] = useState(true);
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
          console.error("User profile not found");
          await signOut(auth);
          return;
        }

        const userData = userSnap.data();
        const role = String(userData.role || "").toUpperCase();
        if (role !== "MERCHANT") {
          console.error("This account is not a Merchant account.");
          await signOut(auth);
          return;
        }

        setMerchantName(userData.fullName || userData.displayName || user.email || "Merchant");
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
    setMerchantName("");
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
              <MerchantLoginPage />
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
        <Route
          path="/vouchers"
          element={<ProtectedPageRoute isLoggedIn={isLoggedIn} PageComponent={MerchantVouchers} />}
        />
        <Route path="*" element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
