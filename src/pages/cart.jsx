import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const currency = (value) => `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const readCartFromStorage = () => {
  try {
    const raw = JSON.parse(localStorage.getItem("cart") || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => ({
      ...item,
      qty: Math.max(1, Number(item.qty || 1)),
      price: Number(item.price || 0),
    }));
  } catch {
    return [];
  }
};

export default function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(readCartFromStorage);
  const [currentLocation, setCurrentLocation] = useState(() => localStorage.getItem("selectedDeliveryAddress") || "");
  const [currentCityProvince, setCurrentCityProvince] = useState(() => localStorage.getItem("selectedDeliveryAddressCityProvince") || "");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: "success", message: "" });

  const saveCart = (newCart) => {
    setCart(newCart);
    try {
      localStorage.setItem("cart", JSON.stringify(newCart));
    } catch (error) {
      console.error("Failed saving cart:", error);
    }
  };

  useEffect(() => {
    const syncFromStorage = () => {
      setCart(readCartFromStorage());
      setCurrentLocation(localStorage.getItem("selectedDeliveryAddress") || "");
      setCurrentCityProvince(localStorage.getItem("selectedDeliveryAddressCityProvince") || "");
    };

    const onStorage = (event) => {
      if (["cart", "selectedDeliveryAddress", "selectedDeliveryAddressCityProvince"].includes(event.key)) {
        syncFromStorage();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", syncFromStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!toast.open) return undefined;
    const timeout = window.setTimeout(() => setToast((prev) => ({ ...prev, open: false })), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast.open]);

  const updateQty = (id, qty) => {
    if (qty < 1) {
      removeFromCart(id);
      return;
    }
    const next = cart.map((item) => (item.id === id ? { ...item, qty } : item));
    saveCart(next);
  };

  const removeFromCart = (id) => {
    const next = cart.filter((item) => item.id !== id);
    saveCart(next);
    setToast({ open: true, severity: "info", message: "Item removed from cart" });
  };

  const clearCart = () => {
    saveCart([]);
    setToast({ open: true, severity: "info", message: "Cart cleared" });
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0),
    [cart]
  );
  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + Number(item.qty || 0), 0), [cart]);
  const deliveryFee = cart.length > 0 ? 39 : 0;
  const total = subtotal + deliveryFee;

  const handleCheckout = async () => {
    if (placingOrder) return;

    if (!cart.length) {
      setToast({ open: true, severity: "warning", message: "Your cart is empty" });
      return;
    }

    if (!currentLocation) {
      setToast({ open: true, severity: "warning", message: "Set your delivery address first" });
      navigate("/add-address");
      return;
    }

    const user = auth.currentUser;
    if (!user?.uid) {
      setToast({ open: true, severity: "warning", message: "Please sign in to place your order" });
      navigate("/login");
      return;
    }

    setPlacingOrder(true);

    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const customerName = userData.username || userData.name || user.displayName || "Customer";
      const customerEmail = userData.email || user.email || "";

      const productMerchantMap = {};
      for (const item of cart) {
        const productId = String(item.id || "");
        if (!productId || productMerchantMap[productId]) continue;

        const productSnap = await getDoc(doc(db, "products", productId));
        if (productSnap.exists()) {
          const productData = productSnap.data();
          productMerchantMap[productId] = productData.merchantId || null;
        } else {
          productMerchantMap[productId] = null;
        }
      }

      const groupedByMerchant = cart.reduce((acc, item) => {
        const productId = String(item.id || "");
        const merchantId = productMerchantMap[productId];
        if (!merchantId) return acc;
        if (!acc[merchantId]) acc[merchantId] = [];
        acc[merchantId].push(item);
        return acc;
      }, {});

      const merchantIds = Object.keys(groupedByMerchant);
      if (!merchantIds.length) {
        setToast({ open: true, severity: "error", message: "Unable to place order: product merchant data missing" });
        setPlacingOrder(false);
        return;
      }

      for (const merchantId of merchantIds) {
        const merchantUserSnap = await getDoc(doc(db, "users", merchantId));
        const merchantUser = merchantUserSnap.exists() ? merchantUserSnap.data() || {} : {};
        const merchantApproved = String(merchantUser.merchantStatus || "PENDING_APPROVAL").toUpperCase() === "APPROVED";
        const merchantOpen = Boolean(merchantUser.open === true);

        if (!merchantApproved || !merchantOpen) {
          setToast({
            open: true,
            severity: "error",
            message: `Store ${merchantUser.storeName || merchantUser.name || merchantId.slice(0, 6)} is currently unavailable`,
          });
          setPlacingOrder(false);
          return;
        }
      }

      const createdOrderIds = [];
      for (const merchantId of merchantIds) {
        const merchantItems = groupedByMerchant[merchantId] || [];
        const merchantSubtotal = merchantItems.reduce(
          (sum, current) => sum + Number(current.price || 0) * Number(current.qty || 0),
          0
        );
        const merchantDeliveryFee = 39;
        const merchantTotal = merchantSubtotal + merchantDeliveryFee;

        const orderDoc = await addDoc(collection(db, "orders"), {
          merchantId,
          customerId: user.uid,
          riderId: null,
          customerName,
          customerEmail,
          subtotal: merchantSubtotal,
          deliveryFee: merchantDeliveryFee,
          total: merchantTotal,
          status: "NEW",
          paymentMethod: "COD",
          paymentStatus: "UNPAID",
          pickupLocation: {
            merchantId,
          },
          dropoffLocation: {
            address: currentLocation,
            cityProvince: currentCityProvince || "",
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await Promise.all(
          merchantItems.map((entry) => {
            const payload = {
              orderId: orderDoc.id,
              merchantId,
              customerId: user.uid,
              productId: entry.id,
              name: entry.name || "Product",
              image: entry.image || "",
              price: Number(entry.price || 0),
              quantity: Number(entry.qty || 1),
              total: Number(entry.price || 0) * Number(entry.qty || 1),
              createdAt: serverTimestamp(),
            };

            return Promise.all([
              addDoc(collection(db, "orders", orderDoc.id, "items"), payload),
              addDoc(collection(db, "orderItems"), payload),
            ]);
          })
        );

        createdOrderIds.push(orderDoc.id);
      }

      const orderDraft = {
        id: `ORD-${Date.now()}`,
        createdAt: new Date().toISOString(),
        status: "PENDING",
        items: cart,
        subtotal,
        deliveryFee,
        total,
        deliveryAddress: currentLocation,
        cityProvince: currentCityProvince,
        orderIds: createdOrderIds,
      };

      try {
        const previous = JSON.parse(localStorage.getItem("orderDrafts") || "[]");
        const nextDrafts = [orderDraft, ...(Array.isArray(previous) ? previous : [])].slice(0, 20);
        localStorage.setItem("orderDrafts", JSON.stringify(nextDrafts));
        localStorage.setItem("lastOrderDraft", JSON.stringify(orderDraft));
        localStorage.setItem("lastCheckoutAt", String(Date.now()));
      } catch (error) {
        console.error("Failed to save local order draft:", error);
      }

      saveCart([]);
      setToast({
        open: true,
        severity: "success",
        message: `Order placed (${createdOrderIds.length} store${createdOrderIds.length > 1 ? "s" : ""})`,
      });
      window.setTimeout(() => navigate("/shop"), 550);
    } catch (error) {
      console.error("Checkout failed:", error);
      setToast({ open: true, severity: "error", message: "Checkout failed. Please try again." });
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-32">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold">Your Cart</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{itemCount} item{itemCount === 1 ? "" : "s"}</p>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-sm font-semibold text-rose-600 dark:text-rose-400"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2b8cee]/10 text-[#2b8cee] flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[20px]">location_on</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Delivery Address</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {currentLocation || "No delivery address selected"}
              </p>
              {currentCityProvince && <p className="text-xs text-slate-500 dark:text-slate-400">{currentCityProvince}</p>}
            </div>
            <button
              type="button"
              onClick={() => navigate("/add-address")}
              className="text-sm font-semibold text-[#2b8cee]"
            >
              {currentLocation ? "Change" : "Set"}
            </button>
          </div>
        </section>

        {cart.length === 0 ? (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto mb-3 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-500">shopping_cart</span>
            </div>
            <h2 className="text-base font-bold mb-1">Your cart is empty</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Add items from nearby stores to continue.</p>
            <button
              type="button"
              onClick={() => navigate("/shop")}
              className="px-5 py-2.5 rounded-xl bg-[#2b8cee] text-white font-semibold"
            >
              Browse Stores
            </button>
          </section>
        ) : (
          <>
            <section className="space-y-3">
              {cart.map((item) => (
                <article
                  key={item.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3"
                >
                  <div className="flex gap-3">
                    <img
                      src={item.image || "/icons/icon-192x192.png"}
                      alt={item.name || "Product"}
                      className="w-20 h-20 rounded-xl object-cover bg-slate-100 dark:bg-slate-800"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm line-clamp-2">{item.name || "Product"}</h3>
                      <p className="text-[#2b8cee] font-bold mt-1 text-sm">{currency(item.price)}</p>

                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, (item.qty || 1) - 1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-sm font-semibold">{item.qty || 1}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, (item.qty || 1) + 1)}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold"
                        >
                          +
                        </button>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="ml-auto text-xs font-semibold text-rose-600 dark:text-rose-400"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
              <h2 className="font-bold text-sm">Order Summary</h2>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Subtotal ({itemCount} items)</span>
                <span className="font-semibold">{currency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Delivery Fee</span>
                <span className="font-semibold">{currency(deliveryFee)}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
              <div className="flex items-center justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold text-[#2b8cee]">{currency(total)}</span>
              </div>
            </section>
          </>
        )}
      </main>

      {cart.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Payment</p>
              <p className="text-lg font-bold text-[#2b8cee]">{currency(total)}</p>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={placingOrder}
              className="bg-[#2b8cee] text-white font-bold px-5 py-3 rounded-xl min-w-[170px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {placingOrder ? "Placing..." : "Place Order"}
            </button>
          </div>
        </footer>
      )}

      {toast.open && (
        <div className={`fixed top-4 left-4 right-4 z-[60] px-4 py-3 rounded-xl text-white font-semibold shadow-lg ${
          toast.severity === "success"
            ? "bg-emerald-500"
            : toast.severity === "warning"
            ? "bg-amber-500"
            : toast.severity === "info"
            ? "bg-blue-500"
            : "bg-rose-500"
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
