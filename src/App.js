// src/App.js
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
import AdminWalletToWallet from "./pages/admin/adminWallettoWallet";
import AdminWithdrawals from "./pages/admin/adminWithdrawals";
import AdminDeposits from "./pages/admin/adminDeposits";

// Member pages
import MemberDashboard from "./pages/member/memberDashboard";
import MemberPayback from "./pages/member/memberPayback";
import MemberCapitalShare from "./pages/member/memberCapitalShare";
import MemberProfile from "./pages/member/memberProfile"; // ✅ Added

import "leaflet/dist/leaflet.css";

function App() {
  const [initialized, setInitialized] = useState(false);
  const [role, setRole] = useState(() => localStorage.getItem("userRole"));

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    if (storedRole) setRole(storedRole);
    setInitialized(true);
  }, []);

  if (!initialized) {
    return <div style={{ textAlign: "center", marginTop: "20%" }}>Loading...</div>;
  }

  const AdminRoute = ({ children }) =>
    ["ADMIN", "CEO"].includes(role?.toUpperCase()) ? children : <Navigate to="/login" />;

  const MemberRoute = ({ children }) =>
    ["MASTERMD", "MD", "MS", "MI", "AGENT", "MEMBER"].includes(role?.toUpperCase())
      ? children
      : <Navigate to="/login" />;

  const AutoRedirect = () => {
    const location = useLocation();

    useEffect(() => {
      const userRole = localStorage.getItem("userRole");
      const path = location.pathname;
      const upperRole = userRole?.toUpperCase();

      if (["/damayan-savings/", "/damayan-savings/login"].includes(path)) {
        if (["ADMIN", "CEO"].includes(upperRole)) {
          window.location.replace("/damayan-savings/admin/dashboard");
        } else if (
          ["MASTERMD", "MD", "MS", "MI", "AGENT", "MEMBER"].includes(upperRole)
        ) {
          window.location.replace("/damayan-savings/member/dashboard");
        }
      }
    }, [location]);

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
            <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/generate-codes" element={<AdminRoute><AdminGenerateCode /></AdminRoute>} />
            <Route path="/admin/user-management" element={<AdminRoute><AdminUserManagement /></AdminRoute>} />
            <Route path="/admin/approval-requests" element={<AdminRoute><AdminApprovalRequest /></AdminRoute>} />
            <Route path="/admin/transfer-transactions" element={<AdminRoute><AdminTransferTransaction /></AdminRoute>} />
            <Route path="/admin/wallet-to-wallet" element={<AdminRoute><AdminWalletToWallet /></AdminRoute>} />
            <Route path="/admin/withdrawals" element={<AdminRoute><AdminWithdrawals /></AdminRoute>} />
            <Route path="/admin/deposits" element={<AdminRoute><AdminDeposits /></AdminRoute>} />
            <Route path="/admin/profile" element={<AdminRoute><AdminProfile /></AdminRoute>} />

            {/* Member Routes */}
            <Route path="/member/dashboard" element={<MemberRoute><MemberDashboard /></MemberRoute>} />
            <Route path="/member/income/payback" element={<MemberRoute><MemberPayback /></MemberRoute>} />
            <Route path="/member/income/capital-share" element={<MemberRoute><MemberCapitalShare /></MemberRoute>} />
            <Route path="/member/profile" element={<MemberRoute><MemberProfile /></MemberRoute>} /> {/* ✅ New route */}

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </LocalizationProvider>
    </ParallaxProvider>
  );
}

export default App;