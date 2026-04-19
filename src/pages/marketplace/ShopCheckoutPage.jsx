import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { readCart, saveCart } from "./lib/cartStorage";

const currency = (value) =>
  `P${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ShopCheckoutPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(readCart);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [selectedDeliveryTime, setSelectedDeliveryTime] = useState("today"); // "today" or "tomorrow"
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("applePay");
  const [userId, setUserId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [serviceFee] = useState(10);

  // Check authentication and fetch user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/marketplace");
        return;
      }
      setUserId(user.uid);

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        setUserData(userSnap.data());
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Get delivery fee from localStorage
  useEffect(() => {
    const savedCheckoutData = localStorage.getItem("checkoutData");
    if (savedCheckoutData) {
      try {
        const data = JSON.parse(savedCheckoutData);
        setDeliveryFee(data.deliveryFee || 0);
      } catch (error) {
        console.error("Error parsing checkout data:", error);
      }
    }
  }, []);

  if (!cart.length) {
    return (
      <main style={styles.page}>
        <div style={styles.emptyContainer}>
          <p>Your cart is empty</p>
          <button onClick={() => navigate("/marketplace")} style={styles.backBtn}>
            Back to Shop
          </button>
        </div>
      </main>
    );
  }

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 0)), 0);
  const total = subtotal + deliveryFee + serviceFee;

  const handlePlaceOrder = async () => {
    if (placingOrder) return;

    setPlacingOrder(true);

    try {
      const user = auth.currentUser;
      if (!user?.uid) {
        setToast({ message: "Sign in first to place order", type: "warning" });
        setPlacingOrder(false);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userDataDoc = userSnap.exists() ? userSnap.data() : {};
      const customerName = userDataDoc.username || userDataDoc.name || user.displayName || "Customer";

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

      // Check merchant status
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

      // Place orders for each merchant
      for (const merchantId of merchantIds) {
        const merchantItems = groupedByMerchant[merchantId] || [];
        const merchantSubtotal = merchantItems.reduce(
          (sum, current) => sum + Number(current.price || 0) * Number(current.qty || 0),
          0
        );

        const orderData = {
          customerId: user.uid,
          customerName: customerName,
          merchantId: merchantId,
          items: merchantItems.map((item) => ({
            id: item.id,
            name: item.name || "Product",
            price: Number(item.price || 0),
            qty: Number(item.qty || 1),
            image: item.image || "",
          })),
          subtotal: merchantSubtotal,
          deliveryFee: deliveryFee,
          serviceFee: serviceFee,
          total: merchantSubtotal + deliveryFee + serviceFee,
          deliveryAddress: userDataDoc.deliveryAddress || "",
          deliveryAddressCityProvince: userDataDoc.deliveryAddressCityProvince || "",
          deliveryTime: selectedDeliveryTime,
          paymentMethod: selectedPaymentMethod,
          status: "PENDING",
          createdAt: new Date().toISOString(),
        };

        await addDoc(collection(db, "orders"), orderData);
      }

      // Clear cart
      setCart([]);
      saveCart([]);
      localStorage.removeItem("checkoutData");

      setToast({ message: "Order placed successfully!", type: "success" });
      window.setTimeout(() => navigate("/marketplace"), 2000);
    } catch (error) {
      console.error("Order placement error:", error);
      setToast({ message: "Failed to place order: " + error.message, type: "error" });
      setPlacingOrder(false);
    }
  };

  return (
    <main style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>← Back</button>
        <h1 style={styles.title}>Checkout</h1>
        <div style={{ width: 24 }} />
      </div>

      {/* Order Progress */}
      <section style={styles.section}>
        <div style={styles.progressHeader}>
          <span style={styles.progressLabel}>Order Progress</span>
          <span style={styles.stepBadge}>Step 3 of 4</span>
        </div>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: "75%" }} />
        </div>
      </section>

      {/* Delivery Address */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Delivery Address</h2>
          <button onClick={() => navigate("/marketplace/add-address")} style={styles.editBtn}>Edit</button>
        </div>
        <div style={styles.addressCard}>
          <span style={styles.addressIcon}>📍</span>
          <div style={styles.addressContent}>
            <h3 style={styles.addressType}>{userData?.addressType || "Home"}</h3>
            <p style={styles.addressText}>{userData?.deliveryAddress || "No address set"}</p>
            <p style={styles.addressNote}>Note: {userData?.deliveryAddressNote || "No notes"}</p>
          </div>
        </div>
      </section>

      {/* Delivery Time */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Delivery Time</h2>
        <div style={styles.timeOptions}>
          <label style={styles.timeOption}>
            <input
              type="radio"
              name="delivery-time"
              value="today"
              checked={selectedDeliveryTime === "today"}
              onChange={(e) => setSelectedDeliveryTime(e.target.value)}
              style={styles.radio}
            />
            <span style={styles.timeLabel}>
              <strong>Today, 4 PM - 6 PM</strong>
              <small>Earliest available slot</small>
            </span>
          </label>
          <label style={styles.timeOption}>
            <input
              type="radio"
              name="delivery-time"
              value="tomorrow"
              checked={selectedDeliveryTime === "tomorrow"}
              onChange={(e) => setSelectedDeliveryTime(e.target.value)}
              style={styles.radio}
            />
            <span style={styles.timeLabel}>
              <strong>Tomorrow, 9 AM - 11 AM</strong>
              <small>Schedule for later</small>
            </span>
          </label>
        </div>
      </section>

      {/* Payment Method */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Payment Method</h2>
        <div style={styles.paymentOptions}>
          <label style={styles.paymentOption}>
            <input
              type="radio"
              name="payment"
              value="applePay"
              checked={selectedPaymentMethod === "applePay"}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              style={styles.radio}
            />
            <span style={styles.paymentLabel}>
              <strong>Apple Pay</strong>
              <small>Default payment method</small>
            </span>
          </label>
          <label style={styles.paymentOption}>
            <input
              type="radio"
              name="payment"
              value="card"
              checked={selectedPaymentMethod === "card"}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              style={styles.radio}
            />
            <span style={styles.paymentLabel}>
              <strong>•••• 4242</strong>
              <small>Visa Platinum</small>
            </span>
          </label>
        </div>
      </section>

      {/* Bill Summary */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Bill Details</h2>
        <div style={styles.billDetails}>
          <div style={styles.billRow}>
            <span>Subtotal</span>
            <strong>{currency(subtotal)}</strong>
          </div>
          <div style={styles.billRow}>
            <span>Delivery Fee</span>
            <strong style={styles.freeText}>{deliveryFee === 0 ? "FREE" : currency(deliveryFee)}</strong>
          </div>
          <div style={styles.billRow}>
            <span>Service Fee</span>
            <strong>{currency(serviceFee)}</strong>
          </div>
          <div style={styles.billDivider} />
          <div style={styles.totalRow}>
            <span>Total Amount</span>
            <strong style={styles.totalAmount}>{currency(total)}</strong>
          </div>
        </div>
      </section>

      {/* Place Order Button */}
      <button
        type="button"
        onClick={handlePlaceOrder}
        disabled={placingOrder}
        style={{
          ...styles.placeOrderBtn,
          opacity: placingOrder ? 0.6 : 1,
          cursor: placingOrder ? "not-allowed" : "pointer",
        }}
      >
        {placingOrder ? "Placing order..." : `Place Order  •  ${currency(total)}`}
      </button>

      {/* Toast */}
      {toast.message && (
        <div style={{
          ...styles.toast,
          ...(toast.type === "error" ? styles.toastError : toast.type === "success" ? styles.toastSuccess : styles.toastDefault)
        }}>
          {toast.message}
        </div>
      )}
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 460,
    margin: "0 auto",
    padding: "0 16px 120px",
    fontFamily: "'Plus Jakarta Sans', Segoe UI, sans-serif",
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 16,
    borderBottom: "1px solid #e2e8f0",
    marginBottom: 20,
  },
  backBtn: {
    background: "none",
    border: "none",
    fontSize: 16,
    fontWeight: 600,
    color: "#0f766e",
    cursor: "pointer",
    padding: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1e293b",
    margin: 0,
  },
  emptyContainer: {
    textAlign: "center",
    paddingTop: 40,
  },
  section: {
    marginBottom: 24,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "#64748b",
  },
  stepBadge: {
    fontSize: 12,
    fontWeight: 700,
    color: "#10b981",
    backgroundColor: "#ecfdf5",
    padding: "4px 8px",
    borderRadius: 4,
  },
  progressBar: {
    width: "100%",
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    transition: "width 0.3s ease",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1e293b",
    margin: 0,
  },
  editBtn: {
    background: "none",
    border: "none",
    color: "#0f766e",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  addressCard: {
    display: "flex",
    gap: 12,
    padding: 12,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    border: "1px solid #dcfce7",
  },
  addressIcon: {
    fontSize: 24,
  },
  addressContent: {
    flex: 1,
  },
  addressType: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: "#1e293b",
  },
  addressText: {
    margin: "4px 0",
    fontSize: 13,
    color: "#475569",
  },
  addressNote: {
    margin: "4px 0 0 0",
    fontSize: 12,
    color: "#94a3b8",
  },
  timeOptions: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  timeOption: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  radio: {
    marginTop: 4,
    cursor: "pointer",
  },
  timeLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  paymentOptions: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  paymentOption: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  paymentLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  billDetails: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  billRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
    color: "#64748b",
  },
  freeText: {
    color: "#10b981",
    fontWeight: 700,
  },
  billDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    margin: "8px 0",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 16,
    fontWeight: 700,
    color: "#0f766e",
  },
  totalAmount: {
    fontSize: 18,
    color: "#0f766e",
  },
  placeOrderBtn: {
    width: "100%",
    padding: "14px",
    marginTop: 16,
    marginBottom: 20,
    fontSize: 16,
    fontWeight: 700,
    color: "#fff",
    backgroundColor: "#10b981",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  toast: {
    position: "fixed",
    bottom: 20,
    left: 16,
    right: 16,
    maxWidth: 428,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    textAlign: "center",
    zIndex: 9999,
  },
  toastDefault: {
    backgroundColor: "#e0f2fe",
    color: "#0c4a6e",
  },
  toastSuccess: {
    backgroundColor: "#ecfdf5",
    color: "#166534",
  },
  toastError: {
    backgroundColor: "#fee2e2",
    color: "#7f1d1d",
  },
};
