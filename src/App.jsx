
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
const AdminCapitalShareEntriesManagement = lazy(() => import("./pages/admin/adminCapitalShareEntriesManagement"));
const AdminVoucherRecords = lazy(() => import("./pages/admin/adminVoucherRecords"));
const AdminPasswordResetManagement = lazy(() => import("./pages/admin/adminPasswordResetManagement"));
const AdminRiderApplications = lazy(() => import("./pages/admin/adminRiderApplications"));
const MemberDashboard = lazy(() => import("./pages/member/memberDashboard"));
const MemberPayback = lazy(() => import("./pages/member/memberPayback"));
const MemberCapitalShare = lazy(() => import("./pages/member/memberCapitalShare"));
const MemberProfile = lazy(() => import("./pages/member/memberProfile"));
const MemberVouchers = lazy(() => import("./pages/member/memberVouchers"));
const MemberCashIn = lazy(() => import("./pages/member/memberCashIn"));
const MemberMarketplace = lazy(() => import("./pages/member/memberMarketplace"));
const RiderLoginPage = lazy(() => import("./pages/rider/RiderLoginPage"));
const RiderDashboard = lazy(() => import("./pages/rider/riderDashboard"));
const RiderOrders = lazy(() => import("./pages/rider/riderOrders"));
const RiderWallet = lazy(() => import("./pages/rider/riderWallet"));
const RiderProfile = lazy(() => import("./pages/rider/riderProfile"));
const RiderMemberOrders = lazy(() => import("./pages/rider/memberOrders"));
const RiderLocationAccess = lazy(() => import("./pages/rider/LocationAccess"));
const RiderApplicationPage = lazy(() => import("./pages/rider/RiderApplicationPage"));
const MarketplaceShop = lazy(() => import("./pages/marketplace/ShopPage"));
const MarketplaceMyFavoriteStores = lazy(() => import("./pages/marketplace/ShopMyFavoriteStores"));
const MarketplaceStore = lazy(() => import("./pages/marketplace/StoreDetailsPage"));
const MarketplaceCart = lazy(() => import("./pages/marketplace/CartPage"));
const MarketplaceAddAddress = lazy(() => import("./pages/marketplace/AddAddressPage"));
const MerchantLoginPage = lazy(() => import("./pages/merchant/MerchantLoginPage"));
const MerchantDashboard = lazy(() => import("./pages/merchant/merchantDashboard"));
const MerchantOrders = lazy(() => import("./pages/merchant/merchantOrders"));
const MerchantProducts = lazy(() => import("./pages/merchant/merchantProducts"));
const MerchantProfile = lazy(() => import("./pages/merchant/merchantProfile"));
const MerchantStoreSettings = lazy(() => import("./pages/merchant/MerchantStoreSettings"));
const MerchantVouchers = lazy(() => import("./pages/merchant/MerchantVouchers"));


function App() {
  const skipSplashAfterLogin = sessionStorage.getItem("skipAppSplash") === "true";
  const splashAlreadyShown = sessionStorage.getItem("appSplashShown") === "true";
  const [initialized, setInitialized] = useState(false);
  const [role, setRole] = useState(() => localStorage.getItem("userRole"));
  const appBase = window.location.pathname.startsWith("/damayan-savings") ? "/damayan-savings" : "";
  const [showSplash, setShowSplash] = useState(() => !skipSplashAfterLogin && !splashAlreadyShown);

  useEffect(() => {
    if (skipSplashAfterLogin) {
      sessionStorage.removeItem("skipAppSplash");
      sessionStorage.setItem("appSplashShown", "true");
    }

    const storedRole = localStorage.getItem("userRole");
    if (storedRole) setRole(storedRole);
    setInitialized(true);

    // Listen for custom role update events from login/logout
    const handleRoleChange = (e) => {
      setRole(e.detail.role);
    };

    window.addEventListener("roleChanged", handleRoleChange);
    return () => window.removeEventListener("roleChanged", handleRoleChange);
  }, [skipSplashAfterLogin]);

  const handleSplashClose = () => {
    sessionStorage.setItem("appSplashShown", "true");
    setShowSplash(false);
  };

  if (!initialized) {
    return (
      <div style={{ textAlign: "center", marginTop: "20%" }}>
        Loading...
      </div>
    );
  }

  const AdminRoute = ({ children }) =>
    ["ADMIN", "CEO", "SUPERADMIN"].includes(role?.toUpperCase())
      ? children
      : <Navigate to="/login" replace />;

  const MemberRoute = ({ children }) =>
    ["MASTERMD", "MD", "MS", "MI", "AGENT", "MEMBER"].includes(
      role?.toUpperCase()
    )
      ? children
      : <Navigate to="/login" replace />;

  const RiderRoute = ({ children }) =>
    ["RIDER"].includes(role?.toUpperCase())
      ? children
      : <Navigate to="/rider/login" replace />;

  const MerchantRoute = ({ children }) =>
    ["MERCHANT"].includes(role?.toUpperCase())
      ? children
      : <Navigate to="/login/merchant" replace />;

  const AutoRedirect = () => {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
      const userRole = localStorage.getItem("userRole")?.toUpperCase();
      const locationCompleted = localStorage.getItem('locationCompleted') === 'true';
      const path = location.pathname;

      if (!userRole) return;

      if (path === "/" || path === "/login" || path === "/login/merchant" || path === "/login/rider" || path === "/rider/login") {
        if (["ADMIN", "CEO", "SUPERADMIN"].includes(userRole)) {
          navigate("/admin/dashboard", { replace: true });
        } else if (userRole === "MERCHANT") {
          navigate("/merchant/dashboard", { replace: true });
        } else if (userRole === "RIDER") {
          navigate("/rider/location-access", { replace: true });
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
            <Route path="/login/merchant" element={<MerchantLoginPage />} />
            <Route path="/login/rider" element={<Navigate to="/rider/login" replace />} />
            <Route path="/rider/login" element={<RiderLoginPage />} />
            <Route path="/rider/apply" element={<RiderApplicationPage />} />

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
              path="/admin/capital-share-entries-management"
              element={
                <AdminRoute>
                  <AdminCapitalShareEntriesManagement />
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
              path="/admin/voucher-records"
              element={
                <AdminRoute>
                  <AdminVoucherRecords />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/password-reset-management"
              element={
                <AdminRoute>
                  <AdminPasswordResetManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/rider-applications"
              element={
                <AdminRoute>
                  <AdminRiderApplications />
                </AdminRoute>
              }
            />
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
              path="/member/vouchers"
              element={
                <MemberRoute>
                  <MemberVouchers />
                </MemberRoute>
              }
            />
            <Route
              path="/member/cash-in"
              element={
                <MemberRoute>
                  <MemberCashIn />
                </MemberRoute>
              }
            />
            <Route
              path="/member/marketplace"
              element={
                <MemberRoute>
                  <MemberMarketplace />
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
              path="/rider/orders"
              element={
                <RiderRoute>
                  <RiderOrders />
                </RiderRoute>
              }
            />
            <Route
              path="/rider/member-orders"
              element={
                <RiderRoute>
                  <RiderMemberOrders />
                </RiderRoute>
              }
            />
            <Route
              path="/rider/wallet"
              element={
                <RiderRoute>
                  <RiderWallet />
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
            <Route
              path="/rider/location-access"
              element={
                <RiderRoute>
                  <RiderLocationAccess role="RIDER" nextPath="/rider/dashboard" />
                </RiderRoute>
              }
            />

            <Route path="/marketplace/shop" element={<MarketplaceShop isEmbedded={true} />} />
            <Route path="/marketplace/favorites" element={<MarketplaceMyFavoriteStores />} />
            <Route path="/marketplace/store/:id" element={<MarketplaceStore />} />
            <Route path="/marketplace/cart" element={<MarketplaceCart />} />
            <Route path="/marketplace/add-address" element={<MarketplaceAddAddress />} />

            <Route
              path="/merchant/login"
              element={<MerchantLoginPage />}
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
              path="/merchant/products"
              element={
                <MerchantRoute>
                  <MerchantProducts />
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
            <Route
              path="/merchant/store-profile"
              element={
                <MerchantRoute>
                  <MerchantStoreSettings />
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

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>

      <Splashscreen
        open={showSplash}
        logo={`${appBase}/damayan.png`}
        duration={0}
        onClose={handleSplashClose}
      />
    </LocalizationProvider>
  );
}

export default App;
