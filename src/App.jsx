
import React, { Suspense, lazy, useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import Splashscreen from "./components/splashscreen";

const Login = lazy(() => import("./pages/login"));
const AdminDashboard = lazy(() => import("./pages/admin/adminDashboard"));
const AdminGenerateCode = lazy(() => import("./pages/admin/adminGenerateCode"));
const AdminUserManagement = lazy(() => import("./pages/admin/adminUserManagement"));
const AdminMerchantManagement = lazy(() => import("./pages/admin/adminMerchantManagement"));
const AdminProfile = lazy(() => import("./pages/admin/adminProfile"));
const AdminTransferTransaction = lazy(() => import("./pages/admin/adminTransferTransaction"));
const AdminWalletToWallet = lazy(() => import("./pages/admin/adminWallettoWallet"));
const AdminWithdrawals = lazy(() => import("./pages/admin/adminWithdrawals"));
const AdminDeposits = lazy(() => import("./pages/admin/adminDeposits"));
const AdminCategoryManagement = lazy(() => import("./pages/admin/adminCategoryManagement"));
const AdminProductManagement = lazy(() => import("./pages/admin/adminProductManagement"));
const AdminPaybackEntries = lazy(() => import("./pages/admin/adminPaybackEntries"));
const MerchantDashboard = lazy(() => import("./pages/merchant/merchantDashboard"));
const MerchantOrders = lazy(() => import("./pages/merchant/merchantOrders"));
const MerchantProducts = lazy(() => import("./pages/merchant/merchantProducts"));
const MerchantVouchers = lazy(() => import("./pages/merchant/merchantVouchers"));
const AddProductPage = lazy(() => import("./pages/merchant/addProduct"));
const EditProductPage = lazy(() => import("./pages/merchant/editProduct"));
const StoreProfilePage = lazy(() => import("./pages/merchant/storeProfile"));
const MerchantProfile = lazy(() => import("./pages/merchant/merchantProfile"));
const LocationAccess = lazy(() => import("./pages/LocationAccess"));
const ShopPage = lazy(() => import("./pages/shop"));
const StoreDetailsPage = lazy(() => import("./pages/storeDetails"));
const AllStoresPage = lazy(() => import("./pages/allStores"));
const AddAddress = lazy(() => import("./pages/addAddress"));
const CartPage = lazy(() => import("./pages/cart"));
const MemberDashboard = lazy(() => import("./pages/member/memberDashboard"));
const MemberPayback = lazy(() => import("./pages/member/memberPayback"));
const MemberCapitalShare = lazy(() => import("./pages/member/memberCapitalShare"));
const MemberOrders = lazy(() => import("./pages/member/memberOrders"));
const MemberProfile = lazy(() => import("./pages/member/memberProfile"));
const MemberVouchers = lazy(() => import("./pages/member/memberVouchers"));
const DepositSuccess = lazy(() => import("./pages/depositSuccess"));
const DepositCancel = lazy(() => import("./pages/depositCancel"));
const RiderDashboard = lazy(() => import("./pages/rider/riderDashboard"));
const RiderProfile = lazy(() => import("./pages/rider/riderProfile"));


function App() {
  const skipSplashAfterLogin = sessionStorage.getItem("skipAppSplash") === "true";
  const [initialized, setInitialized] = useState(false);
  const [role, setRole] = useState(() => localStorage.getItem("userRole"));
  const appBase = window.location.pathname.startsWith("/damayan-savings") ? "/damayan-savings" : "";
  const [showSplash, setShowSplash] = useState(() => !skipSplashAfterLogin);

  useEffect(() => {
    if (skipSplashAfterLogin) {
      sessionStorage.removeItem("skipAppSplash");
    }

    const storedRole = localStorage.getItem("userRole");
    if (storedRole) setRole(storedRole);
    setInitialized(true);
  }, [skipSplashAfterLogin]);

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
    const navigate = useNavigate();

    useEffect(() => {
      const userRole = localStorage.getItem("userRole")?.toUpperCase();
      const locationCompleted = localStorage.getItem('locationCompleted') === 'true';
      const path = location.pathname;

      if (!userRole) return;

      if (path === "/" || path === "/login") {
        if (["ADMIN", "CEO"].includes(userRole)) {
          navigate("/admin/dashboard", { replace: true });
        } else if (userRole === "MERCHANT") {
          if (locationCompleted) {
            navigate("/merchant/dashboard", { replace: true });
          } else {
            navigate("/location-access", { replace: true });
          }
        } else if (userRole === "RIDER") {
          navigate("/rider/dashboard", { replace: true });
        } else if (
          ["MASTERMD", "MD", "MS", "MI", "AGENT", "MEMBER"].includes(userRole)
        ) {
          navigate("/member/dashboard", { replace: true });
        }
      }
    }, [location.pathname, navigate]);

    return null;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterMoment}>
      <Splashscreen
        open={showSplash}
        logo={`${appBase}/damayan.png`}
        duration={0}
        onClose={() => setShowSplash(false)}
      />
      {!showSplash && (
        <Router
          basename={appBase}
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AutoRedirect />

          <Suspense
            fallback={
              <div style={{ textAlign: "center", marginTop: "20%" }}>
                Loading...
              </div>
            }
          >
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
              path="/merchant/vouchers"
              element={
                <MerchantRoute>
                  <MerchantVouchers />
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
              path="/member/orders"
              element={
                <MemberRoute>
                  <MemberOrders />
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
              path="/member/vouchers"
              element={
                <MemberRoute>
                  <MemberVouchers />
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
          </Suspense>
        </Router>
      )}
    </LocalizationProvider>
  );
}

export default App;
