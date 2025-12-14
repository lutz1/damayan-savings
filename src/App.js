import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { ParallaxProvider } from "react-scroll-parallax";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import Splashscreen from "./components/splashscreen";

/* ======================
   PUBLIC
====================== */
// Landing page removed — redirect root to login
import Login from "./pages/login";

/* ======================
   ADMIN
====================== */
import AdminDashboard from "./pages/admin/adminDashboard";
import AdminGenerateCode from "./pages/admin/adminGenerateCode";
import AdminProfile from "./pages/admin/adminProfile";
import AdminUserManagement from "./pages/admin/adminUserManagement";
import AdminTransferTransaction from "./pages/admin/adminTransferTransaction";
import AdminWalletToWallet from "./pages/admin/adminWallettoWallet";
import AdminWithdrawals from "./pages/admin/adminWithdrawals";
import AdminDeposits from "./pages/admin/adminDeposits";
import AdminMerchantManagement from "./pages/admin/adminMerchantManagement";

/* ======================
   MERCHANT (PWA)
====================== */
import MerchantDashboard from "./pages/merchant/merchantDashboard";
import AddProductPage from "./pages/merchant/addProduct";
import MerchantProfile from "./pages/merchant/merchantProfile";
import LocationAccess from "./pages/LocationAccess";

/* ======================
   MEMBER
====================== */
import MemberDashboard from "./pages/member/memberDashboard";
import MemberPayback from "./pages/member/memberPayback";
import MemberCapitalShare from "./pages/member/memberCapitalShare";
import MemberProfile from "./pages/member/memberProfile";

import "leaflet/dist/leaflet.css";

function App() {
  const [initialized, setInitialized] = useState(false);
  const [role, setRole] = useState(() => localStorage.getItem("userRole"));
  const [showSplash, setShowSplash] = useState(() => {
    // Show splash on standalone app launch (iOS or Android PWA)
    const isStandalone =
      window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    const splashShown = sessionStorage.getItem("splash_shown");
    return isStandalone && !splashShown;
  });

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    if (storedRole) setRole(storedRole);
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (showSplash) {
      sessionStorage.setItem("splash_shown", "true");
    }
  }, [showSplash]);

  if (!initialized) {
    return (
      <div style={{ textAlign: "center", marginTop: "20%" }}>
        Loading...
      </div>
    );
  }

  /* ======================
     ROUTE GUARDS
  ====================== */

  const AdminRoute = ({ children }) =>
    ["ADMIN", "CEO"].includes(role?.toUpperCase())
      ? children
      : <Navigate to="/login" replace />;

  const MerchantRoute = ({ children }) =>
    role?.toUpperCase() === "MERCHANT"
      ? children
      : <Navigate to="/login" replace />;

  const MemberRoute = ({ children }) =>
    ["MASTERMD", "MD", "MS", "MI", "AGENT", "MEMBER"].includes(
      role?.toUpperCase()
    )
      ? children
      : <Navigate to="/login" replace />;

  /* ======================
     AUTO REDIRECT
  ====================== */

  const AutoRedirect = () => {
    const location = useLocation();

    useEffect(() => {
      const base = process.env.PUBLIC_URL || "";
      const userRole = localStorage.getItem("userRole")?.toUpperCase();
      const locationCompleted = localStorage.getItem('locationCompleted') === 'true';
      const path = location.pathname;

      if (!userRole) return;

      if (path === "/" || path === "/login") {
        if (["ADMIN", "CEO"].includes(userRole)) {
          window.location.replace(`${base}/admin/dashboard`);
        } else if (userRole === "MERCHANT") {
          // Ensure merchant completes the LocationAccess flow before landing on dashboard
          if (locationCompleted) {
            window.location.replace(`${base}/merchant/dashboard`);
          } else {
            window.location.replace(`${base}/location-access`);
          }
        } else if (
          ["MASTERMD", "MD", "MS", "MI", "AGENT", "MEMBER"].includes(userRole)
        ) {
          window.location.replace(`${base}/member/dashboard`);
        }
      }
    }, [location]);

    return null;
  };

  return (
    <ParallaxProvider>
      <LocalizationProvider dateAdapter={AdapterMoment}>
        <Splashscreen
          open={showSplash}
          logo="/damayan-savings/damayan.png"
          duration={2000}
          onClose={() => setShowSplash(false)}
        />
        {!showSplash && (
          <Router basename={process.env.PUBLIC_URL || ""}>
            <AutoRedirect />

            <Routes>
            {/* ======================
                PUBLIC
            ====================== */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            {/* Mobile install handled inline on the login page */}
            <Route path="/location-access" element={<LocationAccess />} />

            {/* ======================
                ADMIN
            ====================== */}
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/generate-codes"
              element={
                <AdminRoute>
                  <AdminGenerateCode />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/user-management"
              element={
                <AdminRoute>
                  <AdminUserManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/transfer-transactions"
              element={
                <AdminRoute>
                  <AdminTransferTransaction />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/wallet-to-wallet"
              element={
                <AdminRoute>
                  <AdminWalletToWallet />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/withdrawals"
              element={
                <AdminRoute>
                  <AdminWithdrawals />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/deposits"
              element={
                <AdminRoute>
                  <AdminDeposits />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <AdminRoute>
                  <AdminProfile />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/merchants"
              element={
                <AdminRoute>
                  <AdminMerchantManagement />
                </AdminRoute>
              }
            />

            {/* ======================
                MERCHANT (PWA)
            ====================== */}
           <Route
              path="/merchant/dashboard"
              element={
                <MerchantRoute>
                  <MerchantDashboard /> 
                </MerchantRoute>
              }
            />
            <Route
              path="/merchant/add-product"
              element={
                <MerchantRoute>
                  <AddProductPage />
                </MerchantRoute>
              }
            />
            <Route
              path="/merchant/products"
              element={
                <MerchantRoute>
                  <MerchantDashboard /> 
                </MerchantRoute>
              }
            />
            <Route
              path="/merchant/profile"
              element={
                <MerchantRoute>
                  <MerchantProfile />
                </MerchantRoute>
              }
            />

            {/* ======================
                MEMBER
            ====================== */}
            <Route
              path="/member/dashboard"
              element={
                <MemberRoute>
                  <MemberDashboard />
                </MemberRoute>
              }
            />
            <Route
              path="/member/income/payback"
              element={
                <MemberRoute>
                  <MemberPayback />
                </MemberRoute>
              }
            />
            <Route
              path="/member/income/capital-share"
              element={
                <MemberRoute>
                  <MemberCapitalShare />
                </MemberRoute>
              }
            />
            <Route
              path="/member/profile"
              element={
                <MemberRoute>
                  <MemberProfile />
                </MemberRoute>
              }
            />

            {/* ======================
                FALLBACK
            ====================== */}
            <Route path="*" element={<Navigate to="/" replace />} />
            {/* ======================
                FALLBACK
            ====================== */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Router>
        )}
      </LocalizationProvider>
    </ParallaxProvider>
  );
}

export default App;