
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
import Login from "./pages/login";
import AdminDashboard from "./pages/admin/adminDashboard";
import AdminGenerateCode from "./pages/admin/adminGenerateCode";
import AdminUserManagement from "./pages/admin/adminUserManagement";
import AdminMerchantManagement from "./pages/admin/adminMerchantManagement";

import AdminProfile from "./pages/admin/adminProfile";
import AdminTransferTransaction from "./pages/admin/adminTransferTransaction";
import AdminWalletToWallet from "./pages/admin/adminWallettoWallet";
import AdminWithdrawals from "./pages/admin/adminWithdrawals";
import AdminDeposits from "./pages/admin/adminDeposits";

import AdminCategoryManagement from "./pages/admin/adminCategoryManagement";
import AdminProductManagement from "./pages/admin/adminProductManagement";

import AdminPaybackEntries from "./pages/admin/adminPaybackEntries";

import MerchantDashboard from "./pages/merchant/merchantDashboard";
import MerchantOrders from "./pages/merchant/merchantOrders";
import MerchantProducts from "./pages/merchant/merchantProducts";

import AddProductPage from "./pages/merchant/addProduct";
import EditProductPage from "./pages/merchant/editProduct";

import StoreProfilePage from "./pages/merchant/storeProfile";

import MerchantProfile from "./pages/merchant/merchantProfile";

import LocationAccess from "./pages/LocationAccess";

import ShopPage from "./pages/shop";

import StoreDetailsPage from "./pages/storeDetails";

import AllStoresPage from "./pages/allStores";

import AddAddress from "./pages/addAddress";

import CartPage from "./pages/cart";
import MemberDashboard from "./pages/member/memberDashboard";
import MemberPayback from "./pages/member/memberPayback";
import MemberCapitalShare from "./pages/member/memberCapitalShare";

import MemberProfile from "./pages/member/memberProfile";
import DepositSuccess from "./pages/depositSuccess";
import DepositCancel from "./pages/depositCancel";

import RiderDashboard from "./pages/rider/riderDashboard";
import RiderProfile from "./pages/rider/riderProfile";


function App() {
  const [initialized, setInitialized] = useState(false);
  const [role, setRole] = useState(() => localStorage.getItem("userRole"));
  const appBase = window.location.pathname.startsWith("/damayan-savings") ? "/damayan-savings" : "";
  const [showSplash, setShowSplash] = useState(() => {
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

  const RiderRoute = ({ children }) =>
    role?.toUpperCase() === "RIDER"
      ? children
      : <Navigate to="/login" replace />;

  const AutoRedirect = () => {
    const location = useLocation();

    useEffect(() => {
      const base = appBase;
      const userRole = localStorage.getItem("userRole")?.toUpperCase();
      const locationCompleted = localStorage.getItem('locationCompleted') === 'true';
      const path = location.pathname;

      if (!userRole) return;

      if (path === "/" || path === "/login") {
        if (["ADMIN", "CEO"].includes(userRole)) {
          window.location.replace(`${base}/admin/dashboard`);
        } else if (userRole === "MERCHANT") {
          if (locationCompleted) {
            window.location.replace(`${base}/merchant/dashboard`);
          } else {
            window.location.replace(`${base}/location-access`);
          }
        } else if (userRole === "RIDER") {
          window.location.replace(`${base}/rider/dashboard`);
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
          logo={`${appBase}/damayan.png`}
          duration={2000}
          onClose={() => setShowSplash(false)}
        />
        {!showSplash && (
          <Router basename={appBase}>
            <AutoRedirect />

            <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/location-access" element={<LocationAccess />} />
            <Route path="/deposit-success" element={<DepositSuccess />} />
            <Route path="/deposit-cancel" element={<DepositCancel />} />

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
            <Route
              path="/admin/payback-entries"
              element={
                <AdminRoute>
                  <AdminPaybackEntries />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <AdminRoute>
                  <AdminCategoryManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <AdminRoute>
                  <AdminProductManagement />
                </AdminRoute>
              }
            />

           <Route
              path="/merchant/dashboard"
              element={
                <MerchantRoute>
                  <MerchantDashboard /> 
                </MerchantRoute>
              }
            />
            <Route
              path="/merchant/orders"
              element={
                <MerchantRoute>
                  <MerchantOrders />
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
              path="/merchant/edit-product/:productId"
              element={
                <MerchantRoute>
                  <EditProductPage />
                </MerchantRoute>
              }
            />
            <Route
              path="/merchant/products"
              element={
                <MerchantRoute>
                  <MerchantProducts />
                </MerchantRoute>
              }
            />
            <Route
              path="/merchant/store-profile"
              element={
                <MerchantRoute>
                  <StoreProfilePage />
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

            <Route path="/shop" element={<ShopPage />} />
            <Route path="/store/:id" element={<StoreDetailsPage />} />
            <Route path="/all-stores" element={<AllStoresPage />} />
            <Route path="/shop/add-address" element={<AddAddress />} />
            <Route path="/cart" element={<CartPage />} />

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

            <Route
              path="/rider/dashboard"
              element={
                <RiderRoute>
                  <RiderDashboard />
                </RiderRoute>
              }
            />
            <Route
              path="/rider/profile"
              element={
                <RiderRoute>
                  <RiderProfile />
                </RiderRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Router>
        )}
      </LocalizationProvider>
    </ParallaxProvider>
  );
}

export default App;
