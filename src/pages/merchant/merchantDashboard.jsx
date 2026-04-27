// src/pages/merchant/merchantDashboard.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import {
  isMerchantOrderNew,
  isMerchantOrderPreparing,
  isMerchantOrderCompleted,
} from "./lib/merchantOrderFlow";
import MerchantBottomNav from "./components/MerchantBottomNav";

// Material Symbols Icon Component
const MaterialIcon = ({ name, filled = false, weight = 400, size = 24, className = "" }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}`,
      lineHeight: 1,
      fontFamily: "Material Symbols Outlined",
    }}
  >
    {name}
  </span>
);

const MerchantDashboard = () => {
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const [merchantId, setMerchantId] = useState(() => {
    try {
      return auth.currentUser?.uid || localStorage.getItem("uid") || null;
    } catch (err) {
      return auth.currentUser?.uid || null;
    }
  });

  const [merchantName, setMerchantName] = useState("Merchant");
  const [merchantLogo, setMerchantLogo] = useState("");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wallet, setWallet] = useState(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const uid = user?.uid || null;
      setMerchantId(uid);
      if (uid) {
        localStorage.setItem("uid", uid);
      } else {
        localStorage.removeItem("uid");
      }
    });
    return () => unsub();
  }, []);

  // Load merchant info
  useEffect(() => {
    if (!merchantId) return;
    const unsub = onSnapshot(
      doc(db, "users", merchantId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setMerchantName(
            data.merchantProfile?.merchantName ||
            data.storeName ||
            data.name ||
            "Merchant"
          );
          setMerchantLogo(
            data.storeLogo ||
            data.profileImage ||
            data.profilePicture ||
            data.logo ||
            data.merchantProfile?.logo ||
            data.photoURL ||
            ""
          );
          setWallet(Number(data.wallet || 0));
        }
      },
      (err) => console.error("User snapshot error:", err)
    );
    return () => unsub();
  }, [merchantId]);

  // Load products
  useEffect(() => {
    if (!merchantId) return;
    const unsub = onSnapshot(
      query(collection(db, "products"), where("merchantId", "==", merchantId)),
      (snap) => setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Products listener error:", err)
    );
    return () => unsub();
  }, [merchantId]);

  // Load orders
  useEffect(() => {
    if (!merchantId) return;
    const unsub = onSnapshot(
      query(
        collection(db, "orders"),
        where("merchantId", "==", merchantId),
        orderBy("createdAt", "desc")
      ),
      (snap) => setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Orders listener error:", err)
    );
    return () => unsub();
  }, [merchantId]);

  // Metrics
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter((o) => {
      const oDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return oDate >= today;
    });

    const todaySales = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const avgOrderValue = todayOrders.length > 0 ? todaySales / todayOrders.length : 0;

    return {
      todaySales,
      todayOrders: todayOrders.length,
      avgOrderValue: avgOrderValue.toFixed(2),
      newOrders: orders.filter((o) => isMerchantOrderNew(o.status)).length,
      preparingOrders: orders.filter((o) => isMerchantOrderPreparing(o.status)).length,
      completedOrders: orders.filter((o) => isMerchantOrderCompleted(o.status)).length,
    };
  }, [orders]);

  const recentOrders = useMemo(() => orders.slice(0, 4), [orders]);

  const getStatusColor = (status) => {
    if (isMerchantOrderNew(status)) return { bg: "bg-blue-100", text: "text-blue-800", label: "New" };
    if (isMerchantOrderPreparing(status)) return { bg: "bg-amber-100", text: "text-amber-800", label: "Preparing" };
    if (isMerchantOrderCompleted(status)) return { bg: "bg-emerald-100", text: "text-emerald-800", label: "Completed" };
    return { bg: "bg-slate-100", text: "text-slate-800", label: "Pending" };
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Desktop Header */}
      <header className="hidden md:flex justify-between items-center w-full px-6 py-4 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {merchantLogo && (
            <img alt="Logo" className="w-8 h-8 rounded-full object-cover" src={merchantLogo} />
          )}
          <div className="flex flex-col">
            <p className="text-xs text-slate-500">Welcome back,</p>
            <h1 className="text-lg font-semibold text-slate-900">{merchantName}</h1>
          </div>
        </div>
        <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
          <MaterialIcon name="notifications" size={24} />
        </button>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden flex justify-between items-center px-4 py-4 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {merchantLogo && (
            <img alt="Logo" className="w-10 h-10 rounded-full object-cover shadow-sm" src={merchantLogo} />
          )}
          <div>
            <p className="text-xs text-slate-500">Welcome back,</p>
            <h1 className="text-lg font-semibold text-slate-900">{merchantName}</h1>
          </div>
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
          <MaterialIcon name="notifications" size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 mb-20 md:mb-0">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Content - 8 cols */}
          <div className="col-span-1 md:col-span-8 flex flex-col gap-6">
            {/* Top Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Today's Sales */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <MaterialIcon name="payments" size={80} />
                </div>
                <div className="flex flex-col gap-3 relative z-10">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-medium text-slate-600">Today's Sales</h2>
                    <MaterialIcon name="trending_up" size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-slate-900">₱{metrics.todaySales.toFixed(2)}</p>
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <MaterialIcon name="arrow_upward" size={14} />
                      {metrics.todayOrders} orders today
                    </p>
                  </div>
                </div>
              </div>

              {/* Orders Today */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <MaterialIcon name="shopping_bag" size={80} />
                </div>
                <div className="flex flex-col gap-3 relative z-10">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-medium text-slate-600">Orders Today</h2>
                    <MaterialIcon name="bar_chart" size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-slate-900">{metrics.todayOrders}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Avg order: ₱{metrics.avgOrderValue}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Status Overview */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Status</h2>
              <div className="grid grid-cols-3 gap-4">
                {/* New Orders */}
                <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                    <MaterialIcon name="fiber_new" size={20} className="text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{metrics.newOrders}</p>
                  <p className="text-xs text-slate-600 mt-1">New</p>
                </div>

                {/* Preparing */}
                <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                    <MaterialIcon name="soup_kitchen" size={20} className="text-amber-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{metrics.preparingOrders}</p>
                  <p className="text-xs text-slate-600 mt-1">Preparing</p>
                </div>

                {/* Completed */}
                <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                    <MaterialIcon name="check_circle" size={20} className="text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{metrics.completedOrders}</p>
                  <p className="text-xs text-slate-600 mt-1">Completed</p>
                </div>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-900">Recent Orders</h2>
                <button
                  onClick={() => navigate("/merchant/orders")}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All
                </button>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {recentOrders.length > 0 ? (
                      recentOrders.map((order) => {
                        const statusInfo = getStatusColor(order.status);
                        return (
                          <tr key={order.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                            <td className="py-4 px-6 text-sm font-mono text-slate-900">#{order.id?.slice(0, 6)}</td>
                            <td className="py-4 px-6 text-sm text-slate-900">{order.customerName || "N/A"}</td>
                            <td className="py-4 px-6">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}
                              >
                                {statusInfo.label}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right text-sm font-mono text-slate-900">
                              ₱{Number(order.total || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-8 px-6 text-center text-slate-500 text-sm">
                          No orders yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Sidebar - 4 cols */}
          <div className="col-span-1 md:col-span-4 flex flex-col gap-6">
            {/* Wallet Card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-6 shadow-lg text-white relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xs text-white/80 uppercase tracking-wider mb-1">Available Balance</h2>
                    <p className="text-3xl font-bold">₱{wallet.toFixed(2)}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <MaterialIcon name="account_balance_wallet" size={20} />
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <button className="flex-1 bg-white text-blue-600 font-semibold py-2.5 px-4 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                    <MaterialIcon name="account_balance" size={18} />
                    <span className="text-sm">Withdraw</span>
                  </button>
                  <button className="flex-1 border border-white/30 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                    <MaterialIcon name="history" size={18} />
                    <span className="text-sm">Details</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate("/merchant/add-product")}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group"
                >
                  <MaterialIcon name="add_circle" size={24} className="text-blue-600 group-hover:scale-110 transition-transform" />
                  <span className="text-xs text-slate-700 font-medium">New Product</span>
                </button>
                <button
                  onClick={() => navigate("/merchant/products")}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group"
                >
                  <MaterialIcon name="inventory_2" size={24} className="text-blue-600 group-hover:scale-110 transition-transform" />
                  <span className="text-xs text-slate-700 font-medium">Items</span>
                </button>
                <button
                  onClick={() => navigate("/merchant/vouchers")}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group"
                >
                  <MaterialIcon name="card_giftcard" size={24} className="text-blue-600 group-hover:scale-110 transition-transform" />
                  <span className="text-xs text-slate-700 font-medium">Vouchers</span>
                </button>
                <button
                  onClick={() => navigate("/merchant/store-profile")}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group"
                >
                  <MaterialIcon name="settings" size={24} className="text-blue-600 group-hover:scale-110 transition-transform" />
                  <span className="text-xs text-slate-700 font-medium">Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MerchantBottomNav activePath="/merchant/dashboard" />
    </div>
  );
};

export default MerchantDashboard;
