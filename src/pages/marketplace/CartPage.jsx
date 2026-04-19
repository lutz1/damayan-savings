import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { cartCount, cartSubtotal, readCart, saveCart } from "./lib/cartStorage";
import { calculateCustomerDeliveryFee, calculateDistance, extractCoordinates } from "../../lib/deliveryPricing";

const currency = (value) =>
  `P${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CartPage() {
  const navigate = useNavigate();
  const { merchantId } = useParams();
  const [cart, setCart] = useState(readCart);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [deliveryFee, setDeliveryFee] = useState(50); // Default fallback
  const [promoCode, setPromoCode] = useState("");
  const [merchantData, setMerchantData] = useState(null);
  const [deliveryCoordinates, setDeliveryCoordinates] = useState(null);
  const [currentLocation, setCurrentLocation] = useState("");
  const [currentCityProvince, setCurrentCityProvince] = useState("");

  // Fetch user's delivery address from Firestore
  useEffect(() => {
    const fetchUserDeliveryData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          console.log("❌ No current user");
          return;
        }

        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) {
          console.log("❌ User document not found in Firestore");
          return;
        }

        const userData = userSnap.data();
        console.log("👤 User Firestore data:", userData);

        // Extract delivery coordinates from user's Firestore document
        const coords = extractCoordinates(userData);
        if (coords) {
          setDeliveryCoordinates(coords);
          console.log("✅ Delivery coordinates from Firestore:", coords);
        } else {
          console.log("⚠️  No delivery coordinates found in Firestore");
        }

        // Also get address info if available
        if (userData.deliveryAddress) {
          setCurrentLocation(userData.deliveryAddress);
          console.log("✅ Delivery address from Firestore:", userData.deliveryAddress);
        }

        if (userData.city || userData.province) {
          setCurrentCityProvince(`${userData.city || ""} ${userData.province || ""}`.trim());
        }
      } catch (error) {
        console.error("❌ Error fetching user delivery data:", error);
      }
    };

    fetchUserDeliveryData();
  }, []);

  // Refresh cart on window focus
  useEffect(() => {
    const onFocus = () => setCart(readCart());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Calculate delivery fee based on store locations
  useEffect(() => {
    const calculateDeliveryFeeForCart = async () => {
      console.log("🚚 DELIVERY FEE CALCULATION START");
      console.log("Cart items:", cart.length);
      console.log("Delivery coordinates:", deliveryCoordinates);
      
      if (!cart.length || !deliveryCoordinates) {
        console.log("⚠️  FALLBACK: No cart items or missing delivery coordinates");
        // Fallback to base fee (0 km distance)
        setDeliveryFee(calculateCustomerDeliveryFee(0));
        return;
      }

      try {
        // Get unique merchants in cart
        const merchantIds = new Set(
          cart.map(item => item.merchantId).filter(Boolean)
        );

        console.log("Merchants in cart:", Array.from(merchantIds));

        if (merchantIds.size === 0) {
          console.log("⚠️  FALLBACK: No merchant IDs found in cart");
          setDeliveryFee(calculateCustomerDeliveryFee(0));
          return;
        }

        // Calculate distance for each merchant
        const distances = [];
        for (const merchantId of merchantIds) {
          const merchantSnap = await getDoc(doc(db, "users", merchantId));
          const merchantData = merchantSnap.exists() ? merchantSnap.data() : null;
          
          console.log(`📦 Merchant ${merchantId}:`, {
            exists: merchantSnap.exists(),
            storeName: merchantData?.storeName || merchantData?.name,
            allKeys: Object.keys(merchantData || {}),
            location: merchantData?.location,
            coordinates: merchantData?.coordinates,
            lat: merchantData?.lat,
            latitude: merchantData?.latitude,
            lng: merchantData?.lng,
            longitude: merchantData?.longitude,
          });
          
          const storeCoords = extractCoordinates(merchantData);
          console.log(`  → Extracted store coordinates:`, storeCoords);
          console.log(`  → User delivery coordinates:`, deliveryCoordinates);

          if (storeCoords && deliveryCoordinates) {
            const dist = calculateDistance(
              deliveryCoordinates.lat,
              deliveryCoordinates.lng,
              storeCoords.lat,
              storeCoords.lng
            );
            console.log(`  → Distance calculated: ${dist} km`);
            distances.push(dist);
          } else {
            console.log(`  ⚠️  SKIPPED: storeCoords=${storeCoords ? 'found' : 'NOT FOUND'}, deliveryCoordinates=${deliveryCoordinates ? 'found' : 'NOT FOUND'}`);
          }
        }

        // Use average distance or fallback to base fee (0km)
        const avgDistance = distances.length > 0
          ? distances.reduce((a, b) => a + b, 0) / distances.length
          : 0;

        const fee = calculateCustomerDeliveryFee(avgDistance);
        console.log(`✅ Final: ${distances.length} distances collected, avg=${avgDistance}km, fee=₱${fee}`);
        setDeliveryFee(fee);
      } catch (error) {
        console.error("Error calculating delivery fee:", error);
        // Fallback to base fee (0km distance)
        setDeliveryFee(calculateCustomerDeliveryFee(0));
      }
    };

    calculateDeliveryFeeForCart();
  }, [cart, deliveryCoordinates]);

  useEffect(() => {
    if (!toast.message) return undefined;
    const timeout = window.setTimeout(() => setToast({ message: "", type: "info" }), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  // Fetch merchant data for the specific store (from URL param) or first store in cart
  useEffect(() => {
    const fetchMerchantData = async () => {
      let targetMerchantId = merchantId;

      // If no merchantId in URL, use the first store's ID from cart
      if (!targetMerchantId) {
        const merchantIds = Object.keys(
          cart.reduce((acc, item) => {
            const mId = item.merchantId || "unknown";
            if (!acc[mId]) acc[mId] = [];
            acc[mId].push(item);
            return acc;
          }, {})
        );
        targetMerchantId = merchantIds[0];
      }

      if (targetMerchantId && targetMerchantId !== "unknown") {
        try {
          const merchantSnap = await getDoc(doc(db, "users", targetMerchantId));
          if (merchantSnap.exists()) {
            setMerchantData(merchantSnap.data());
          }
        } catch (error) {
          console.error("Error fetching merchant data:", error);
        }
      }
    };

    fetchMerchantData();
  }, [cart, merchantId]);

  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);
  const itemCount = useMemo(() => cartCount(cart), [cart]);
  const serviceFee = 10; // Fixed service fee
  const total = subtotal + deliveryFee + serviceFee;

  // Group cart items by merchantId
  const cartByStore = useMemo(() => {
    const grouped = {};
    cart.forEach((item) => {
      const mId = item.merchantId || "unknown";
      if (!grouped[mId]) grouped[mId] = [];
      grouped[mId].push(item);
    });

    // If merchantId is specified in URL, show only that store's items
    if (merchantId && merchantId !== "unknown") {
      return grouped[merchantId] ? { [merchantId]: grouped[merchantId] } : {};
    }

    // Otherwise, show only the first store
    const firstMerchantId = Object.keys(grouped)[0];
    return firstMerchantId ? { [firstMerchantId]: grouped[firstMerchantId] } : {};
  }, [cart, merchantId]);

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
        
        // Calculate merchant-specific delivery fee based on store location
        let merchantDeliveryFee = deliveryFee;
        try {
          if (deliveryCoordinates) {
            const merchantSnap = await getDoc(doc(db, "users", merchantId));
            const merchantData = merchantSnap.exists() ? merchantSnap.data() : null;
            const storeCoords = extractCoordinates(merchantData);

            if (storeCoords) {
              const distance = calculateDistance(
                deliveryCoordinates.lat,
                deliveryCoordinates.lng,
                storeCoords.lat,
                storeCoords.lng
              );
              merchantDeliveryFee = calculateCustomerDeliveryFee(distance);
            }
          }
        } catch (error) {
          console.error("Error calculating merchant delivery fee:", error);
          // Use the pre-calculated average delivery fee
        }

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
      <header style={styles.topBar}>
        <button type="button" onClick={() => navigate("/marketplace/shop")} style={styles.iconBtn}>
          ←
        </button>
        <h1 style={styles.topTitle}>View Cart</h1>
        <div style={{ width: 28 }} />
      </header>

      {/* Step Progress */}
      <div style={styles.stepProgress}>
        <div style={styles.step}>
          <div style={styles.stepNum}>✓</div>
          <span style={styles.stepLabel}>Menu</span>
        </div>
        <div style={styles.stepConnector}></div>
        <div style={{...styles.step, ...styles.stepActive}}>
          <div style={{...styles.stepNum, ...styles.stepNumActive}}>2</div>
          <span style={{...styles.stepLabel, ...styles.stepLabelActive}}>Cart</span>
        </div>
        <div style={styles.stepConnector}></div>
        <div style={styles.step}>
          <div style={styles.stepNum}>3</div>
          <span style={styles.stepLabel}>Checkout</span>
        </div>
      </div>

      <section style={styles.panel}>
        {cart.length === 0 ? <p style={styles.empty}>Your cart is empty.</p> : null}

        {/* Render only the selected store's cart */}
        {Object.entries(cartByStore).map(([mId, storeItems]) => (
          <div key={mId} style={styles.storeSection}>
            <div style={styles.storeHeaderContainer}>
              <h3 style={styles.storeHeader}>📦 {merchantData?.storeName || merchantData?.name || "Order from Store"}</h3>
              <button
                type="button"
                onClick={() => navigate(`/marketplace/store/${mId}`)}
                style={styles.addMoreBtn}
              >
                + Add More
              </button>
            </div>
            {storeItems.map((item) => (
              <article key={item.id} style={styles.row}>
                <div style={styles.itemLeft}>
                  <div style={styles.thumbWrap}>
                    <img
                      src={item.image || "/icons/icon-192x192.png"}
                      alt={item.name || "Product"}
                      style={styles.thumb}
                    />
                  </div>
                  <div>
                    <p style={styles.name}>{item.name}</p>
                    <p style={styles.meta}>{String(item.category || "Fresh").toUpperCase()}</p>
                    <p style={styles.price}>{currency(item.price)}</p>
                  </div>
                </div>
                <div style={styles.qtyWrap}>
                  <button type="button" onClick={() => updateQty(item.id, Number(item.qty || 1) - 1)} style={styles.qtyBtnSub}>
                    -
                  </button>
                  <span style={styles.qtyValue}>{item.qty}</span>
                  <button type="button" onClick={() => updateQty(item.id, Number(item.qty || 1) + 1)} style={styles.qtyBtnAdd}>
                    +
                  </button>
                </div>
              </article>
            ))}
            <div style={styles.storeSummary}>
              <p style={styles.summaryLine}><span>Subtotal</span><strong>{currency(storeItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0))}</strong></p>
            </div>
          </div>
        ))}

        <div style={styles.promoWrap}>
          <span style={styles.promoIcon}>🏷️</span>
          <input
            type="text"
            placeholder="Enter promo code"
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
            style={styles.promoInput}
          />
          <button type="button" style={styles.applyBtn}>Apply</button>
        </div>

        <div style={styles.summary}>
          <h3 style={styles.summaryTitle}>Bill Details</h3>
          <p style={styles.summaryLine}><span>Item Total</span><strong>{currency(subtotal)}</strong></p>
          <p style={styles.summaryLine}><span>Standard Delivery Fee</span><strong>{currency(deliveryFee)}</strong></p>
          <p style={styles.summaryLine}><span>Service Fee</span><strong>{currency(serviceFee)}</strong></p>
          <p style={styles.total}><span>Total Amount</span><span>{currency(total)}</span></p>

          <button type="button" onClick={handleCheckout} style={styles.checkoutBtn} disabled={placingOrder || cart.length === 0}>
            {placingOrder ? "Placing order..." : "Proceed to Checkout  →"}
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
    maxWidth: 460,
    margin: "0 auto",
    padding: "0 12px 24px",
    fontFamily: "'Plus Jakarta Sans', Segoe UI, sans-serif",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  topBar: {
    height: 48,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 4px",
    position: "sticky",
    top: 0,
    background: "#f8fafc",
    zIndex: 30,
    marginBottom: 10,
  },
  iconBtn: {
    width: 28,
    height: 28,
    border: "none",
    borderRadius: 999,
    background: "transparent",
    color: "#334155",
    fontSize: 18,
    cursor: "pointer",
  },
  topTitle: {
    margin: 0,
    color: "#1e293b",
    fontSize: 16,
    fontWeight: 700,
  },
  stepProgress: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "12px 10px",
    marginBottom: 12,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
  },
  step: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    opacity: 0.5,
  },
  stepActive: {
    opacity: 1,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#e2e8f0",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
  },
  stepNumActive: {
    background: "#1e67da",
    color: "#fff",
  },
  stepLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 500,
  },
  stepLabelActive: {
    color: "#1e67da",
    fontWeight: 600,
  },
  stepConnector: {
    width: 24,
    height: 2,
    background: "#e2e8f0",
    margin: "0 2px",
  },
  storeSection: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    background: "#f8fafc",
  },
  storeHeader: {
    margin: "0 0 10px 0",
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
  },
  storeHeaderContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  addMoreBtn: {
    padding: "6px 12px",
    background: "#1e67da",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s ease",
    whiteSpace: "nowrap",
  },
  storeSummary: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 8,
    marginTop: 8,
  },
  panel: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 10,
    background: "#fff",
    display: "grid",
    gap: 12,
  },
  row: {
    borderBottom: "1px solid #e6eef3",
    padding: "6px 0 10px",
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  itemLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    flex: 1,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    background: "#eef2f7",
    border: "1px solid #e2e8f0",
    flexShrink: 0,
  },
  thumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  name: {
    margin: 0,
    color: "#1e293b",
    fontWeight: 700,
    fontSize: 14,
  },
  meta: {
    margin: "2px 0 1px",
    color: "#16a34a",
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  price: {
    margin: 0,
    color: "#16a34a",
    fontSize: 18,
    fontWeight: 800,
  },
  qtyWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  qtyBtnSub: {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "none",
    background: "#e2e8f0",
    color: "#64748b",
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnAdd: {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "none",
    background: "#1e67da",
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: {
    minWidth: 14,
    textAlign: "center",
    fontWeight: 700,
    color: "#1e293b",
    fontSize: 12,
  },
  promoWrap: {
    marginTop: 2,
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "8px 10px",
  },
  promoIcon: {
    fontSize: 14,
  },
  promoInput: {
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#475569",
    fontSize: 12,
    flex: 1,
  },
  applyBtn: {
    border: "none",
    borderRadius: 8,
    background: "#1e67da",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    padding: "7px 12px",
    cursor: "pointer",
  },
  summary: {
    marginTop: 4,
    display: "grid",
    gap: 7,
  },
  summaryTitle: {
    margin: "2px 0 4px",
    color: "#334155",
    fontSize: 15,
    fontWeight: 700,
  },
  summaryLine: {
    margin: 0,
    color: "#64748b",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
  },
  total: {
    margin: "2px 0 0",
    color: "#1e293b",
    fontWeight: 800,
    fontSize: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deliveryBadge: {
    marginTop: 6,
    textAlign: "center",
    background: "#e8f9ee",
    color: "#16a34a",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    padding: "8px 10px",
  },
  checkoutBtn: {
    marginTop: 4,
    border: 0,
    borderRadius: 10,
    background: "#1e67da",
    color: "#fff",
    padding: "12px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  empty: {
    margin: 0,
    color: "#4d6577",
    textAlign: "center",
    padding: "12px 0",
  },
  toast: {
    position: "fixed",
    left: "50%",
    bottom: 16,
    transform: "translateX(-50%)",
    color: "#fff",
    fontWeight: 700,
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 12,
    zIndex: 1000,
  },
  toastDefault: {
    background: "#1e67da",
  },
  toastError: {
    background: "#b42318",
  },
};
