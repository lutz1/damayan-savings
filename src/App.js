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

import LandingPage from "./pages/LandingPage";
import Login from "./pages/login";

// Admin pages
import AdminDashboard from "./pages/admin/adminDashboard";
import AdminGenerateCode from "./pages/admin/adminGenerateCode";
import AdminProfile from "./pages/admin/adminProfile";
import AdminUserManagement from "./pages/admin/adminUserManagement";
import AdminApprovalRequest from "./pages/admin/adminApprovalRequest";
import AdminTransferTransaction from "./pages/admin/adminTransferTransaction";

// Member pages
import MemberDashboard from "./pages/member/memberDashboard";
import MemberCashback from "./pages/member/memberPayback";

import "leaflet/dist/leaflet.css";

function App() {
  const [initialized, setInitialized] = useState(false);
  const [role, setRole] = useState(() => localStorage.getItem("userRole"));

  // ✅ Initialize role on mount only
  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    if (storedRole) setRole(storedRole);
    setInitialized(true);
  }, []); // ✅ Empty dependency to avoid ESLint warnings

  if (!initialized) {
    return (
      <div style={{ textAlign: "center", marginTop: "20%" }}>Loading...</div>
    );
  }

  // ✅ Route Guards
  const AdminRoute = ({ children }) =>
    role?.toUpperCase() === "ADMIN" ? children : <Navigate to="/login" />;

  const MemberRoute = ({ children }) =>
    ["MD", "MS", "MI", "AGENT", "MEMBER"].includes(role?.toUpperCase())
      ? children
      : <Navigate to="/login" />;

  // ✅ Auto-redirect if logged in and visiting root/login
  const AutoRedirect = () => {
    const location = useLocation();

    useEffect(() => {
      const userRole = localStorage.getItem("userRole");
      const path = location.pathname;

      if (["/damayan-savings/", "/damayan-savings/login"].includes(path)) {
        const upperRole = userRole?.toUpperCase();
        if (upperRole === "ADMIN") {
          window.location.replace("/damayan-savings/admin/dashboard");
        } else if (["MD", "MS", "MI", "AGENT", "MEMBER"].includes(upperRole)) {
          window.location.replace("/damayan-savings/member/dashboard");
        }
      }
    }, [location]); // ✅ only depend on path changes

    return null;
  };

  return (
    <ParallaxProvider>
      <LocalizationProvider dateAdapter={AdapterMoment}>
        <Router basename="/damayan-savings">
          <AutoRedirect />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />

            {/* Admin Routes */}
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
              path="/admin/approval-requests"
              element={
                <AdminRoute>
                  <AdminApprovalRequest />
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
              path="/admin/profile"
              element={
                <AdminRoute>
                  <AdminProfile />
                </AdminRoute>
              }
            />

            {/* Member Routes */}
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
                  <MemberCashback />
                </MemberRoute>
              }
            />

            {/* Catch-all Route */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </LocalizationProvider>
    </ParallaxProvider>
  );
}

export default App;