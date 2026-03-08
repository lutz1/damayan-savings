import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import CartPage from "./pages/CartPage";
import AddAddressPage from "./pages/AddAddressPage";
import DashboardPage from "./pages/DashboardPage";
import LoginRequiredPage from "./pages/LoginRequiredPage";
import OrdersPage from "./pages/OrdersPage";
import ShopPage from "./pages/ShopPage";
import StoreDetailsPage from "./pages/StoreDetailsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login-required" element={<LoginRequiredPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/shop"
          element={
            <RequireAuth>
              <ShopPage />
            </RequireAuth>
          }
        />
        <Route
          path="/shop/store/:id"
          element={
            <RequireAuth>
              <StoreDetailsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/orders"
          element={
            <RequireAuth>
              <OrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/cart"
          element={
            <RequireAuth>
              <CartPage />
            </RequireAuth>
          }
        />
        <Route
          path="/add-address"
          element={
            <RequireAuth>
              <AddAddressPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
