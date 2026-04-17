import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { cartCount, cartSubtotal, readCart, saveCart } from "./lib/cartStorage";

const currency = (value) =>
  `P${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(readCart);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  const currentLocation = localStorage.getItem("selectedDeliveryAddress") || "";
  const currentCityProvince = localStorage.getItem("selectedDeliveryAddressCityProvince") || "";

  useEffect(() => {
    const onFocus = () => setCart(readCart());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (!toast.message) return undefined;
    const timeout = window.setTimeout(() => setToast({ message: "", type: "info" }), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);
  const itemCount = useMemo(() => cartCount(cart), [cart]);
  const deliveryFee = cart.length ? 39 : 0;
  const total = subtotal + deliveryFee;

  const updateQty = (id, qty) => {
    if (qty < 1) {
      const next = cart.filter((item) => item.id !== id);
      setCart(next);
      saveCart(next);
      return;
    }
    const next = cart.map((item) => (item.id === id ? { ...item, qty } : item));
    setCart(next);
    saveCart(next);
  };

  const handleCheckout = async () => {
    if (placingOrder) return;
    if (!cart.length) {
      setToast({ message: "Your cart is empty", type: "warning" });
      return;
    }

    const user = auth.currentUser;
    if (!user?.uid) {
      setToast({ message: "Sign in first to checkout", type: "warning" });
      return;
    }

    if (!currentLocation) {
      setToast({ message: "Set delivery address first", type: "warning" });
      window.setTimeout(() => navigate("/marketplace/add-address"), 350);
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

        if (item.merchantId) {
          productMerchantMap[productId] = item.merchantId;
          continue;
        }

        const productSnap = await getDoc(doc(db, "products", productId));
        productMerchantMap[productId] = productSnap.exists() ? productSnap.data()?.merchantId || null : null;
      }

      const groupedByMerchant = cart.reduce((acc, item) => {
        const merchantId = productMerchantMap[String(item.id || "")];
        if (!merchantId) return acc;
        if (!acc[merchantId]) acc[merchantId] = [];
        acc[merchantId].push(item);
        return acc;
      }, {});

      const merchantIds = Object.keys(groupedByMerchant);
      if (!merchantIds.length) {
        setToast({ message: "Merchant mapping missing for cart items", type: "error" });
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
            message: `Store unavailable: ${merchantUser.storeName || merchantUser.name || merchantId.slice(0, 6)}`,
            type: "error",
          });
          setPlacingOrder(false);
          return;
        }
      }

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
          pickupLocation: { merchantId },
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
      }

      setCart([]);
      saveCart([]);
      setToast({ message: "Order placed successfully", type: "success" });
      window.setTimeout(() => navigate("/orders"), 500);
    } catch (error) {
      console.error("Checkout failed:", error);
      setToast({ message: "Checkout failed", type: "error" });
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Checkout</p>
          <h1 style={styles.heading}>Your Cart</h1>
          <p style={styles.copy}>{itemCount} item(s) ready for checkout.</p>
        </div>
        <Link to="/marketplace/shop" style={styles.backLink}>
          Back To Shop
        </Link>
      </header>

      <section style={styles.panel}>
        {cart.length === 0 ? <p style={styles.empty}>Your cart is empty.</p> : null}

        {cart.map((item) => (
          <article key={item.id} style={styles.row}>
            <div>
              <p style={styles.name}>{item.name}</p>
              <p style={styles.meta}>{currency(item.price)} each</p>
            </div>
            <div style={styles.qtyWrap}>
              <button type="button" onClick={() => updateQty(item.id, Number(item.qty || 1) - 1)} style={styles.qtyBtn}>
                -
              </button>
              <span style={styles.qtyValue}>{item.qty}</span>
              <button type="button" onClick={() => updateQty(item.id, Number(item.qty || 1) + 1)} style={styles.qtyBtn}>
                +
              </button>
            </div>
          </article>
        ))}

        <div style={styles.summary}>
          <p style={styles.summaryLine}>Subtotal: {currency(subtotal)}</p>
          <p style={styles.summaryLine}>Delivery Fee: {currency(deliveryFee)}</p>
          <p style={styles.total}>Total: {currency(total)}</p>
          <button type="button" onClick={handleCheckout} style={styles.checkoutBtn} disabled={placingOrder || cart.length === 0}>
            {placingOrder ? "Placing order..." : "Place Order"}
          </button>
        </div>
      </section>

      {toast.message ? (
        <div style={{ ...styles.toast, ...(toast.type === "error" ? styles.toastError : styles.toastDefault) }}>
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "24px 16px 40px",
    fontFamily: "Segoe UI, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  kicker: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#4d6a80",
    fontSize: 12,
    fontWeight: 700,
  },
  heading: {
    margin: "8px 0 4px",
    color: "#10273a",
  },
  copy: {
    margin: 0,
    color: "#4b667c",
  },
  backLink: {
    textDecoration: "none",
    border: "1px solid #9ab3c1",
    borderRadius: 10,
    padding: "9px 14px",
    color: "#21485d",
    fontWeight: 700,
    background: "#fff",
  },
  panel: {
    border: "1px solid #d4e0e8",
    borderRadius: 16,
    padding: 14,
    background: "#fff",
    display: "grid",
    gap: 10,
  },
  row: {
    borderBottom: "1px solid #e6eef3",
    paddingBottom: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  name: {
    margin: 0,
    color: "#153146",
    fontWeight: 700,
  },
  meta: {
    margin: "4px 0 0",
    color: "#4b667c",
    fontSize: 13,
  },
  qtyWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    border: "1px solid #9ab8c8",
    background: "#fff",
    cursor: "pointer",
  },
  qtyValue: {
    minWidth: 22,
    textAlign: "center",
    fontWeight: 700,
    color: "#21485d",
  },
  summary: {
    marginTop: 6,
    display: "grid",
    gap: 5,
  },
  summaryLine: {
    margin: 0,
    color: "#37566d",
  },
  total: {
    margin: "2px 0 0",
    color: "#133449",
    fontWeight: 800,
    fontSize: 18,
  },
  checkoutBtn: {
    marginTop: 8,
    border: 0,
    borderRadius: 10,
    background: "#0f766e",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  empty: {
    margin: 0,
    color: "#4d6577",
  },
  toast: {
    position: "fixed",
    right: 16,
    bottom: 16,
    color: "#fff",
    fontWeight: 700,
    borderRadius: 10,
    padding: "10px 14px",
  },
  toastDefault: {
    background: "#0f766e",
  },
  toastError: {
    background: "#b42318",
  },
};
