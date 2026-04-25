import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";

const currency = (value) =>
  `P${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ShopCheckoutConfirm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userId, setUserId] = useState(null);

  // Check authentication and fetch latest order
  useEffect(() => {
    console.log("ShopCheckoutConfirm: useEffect called");
    let isMounted = true;
    let timeoutId = null;

    const fetchOrderData = async () => {
      console.log("fetchOrderData: Starting");
      
      try {
        const user = auth.currentUser;
        console.log("fetchOrderData: Current user:", user?.uid);

        if (!user) {
          console.log("No current user, waiting for auth state...");
          return;
        }

        console.log("User authenticated:", user.uid);
        if (isMounted) setUserId(user.uid);

        // Fetch user data
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          console.log("User data found");
          if (isMounted) setUserData(userSnap.data());
        }

        // Try to get order ID from localStorage/sessionStorage first
        const savedOrderId = localStorage.getItem("lastOrderId") || sessionStorage.getItem("lastOrderId");
        console.log("Saved order ID (localStorage or sessionStorage):", savedOrderId);

        if (savedOrderId) {
          console.log("Fetching order by ID:", savedOrderId);
          const orderSnap = await getDoc(doc(db, "orders", savedOrderId));
          if (orderSnap.exists()) {
            const orderData = {
              id: orderSnap.id,
              ...orderSnap.data()
            };
            console.log("Order found by ID:", orderData);
            if (isMounted) {
              setOrder(orderData);
              setLoading(false);
            }
            return;
          }
        }

        // Fallback: query all orders
        console.log("Querying all orders for user:", user.uid);
        const ordersSnap = await getDocs(
          query(
            collection(db, "orders"),
            where("customerId", "==", user.uid)
          )
        );

        console.log("Total orders found:", ordersSnap.size);
        
        if (ordersSnap.size > 0) {
          const allOrders = ordersSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Sort by createdAt descending
          allOrders.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });

          const latestOrder = allOrders[0];
          console.log("Latest order:", latestOrder);
          
          if (isMounted) {
            setOrder(latestOrder);
          }
        } else {
          console.log("No orders found for user");
        }
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        if (isMounted) {
          console.log("Setting loading to false");
          setLoading(false);
        }
      }
    };

    // Listen for auth state changes
    console.log("Setting up auth state listener");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed, user:", user?.uid);
      if (user) {
        fetchOrderData();
      } else {
        console.log("No user, redirecting");
        if (isMounted) {
          navigate("/marketplace");
        }
      }
    });

    // Safety timeout - force stop loading after 10 seconds
    timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn("Timeout: forcing loading to stop");
        setLoading(false);
      }
    }, 10000);

    return () => {
      console.log("Cleaning up auth listener");
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <main style={styles.confirmPage}>
        <p style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>Loading your order...</p>
        <p style={{ textAlign: "center", fontSize: "12px", color: "#94a3b8", padding: "0 20px" }}>
          Check browser console for details if this takes too long (F12)
        </p>
        <p style={{ textAlign: "center", fontSize: "10px", color: "#cbd5e1", padding: "0 20px", marginTop: "20px" }}>
          If stuck longer than 10 seconds, refresh the page
        </p>
      </main>
    );
  }

  if (!order) {
    return (
      <main style={styles.confirmPage}>
        <div style={styles.emptyContainer}>
          <h2>No order found</h2>
          <p>Your recent orders will appear here.</p>
          <button onClick={() => navigate("/marketplace")} style={styles.homeBtn}>
            Back to Marketplace
          </button>
        </div>
      </main>
    );
  }

  const total = (order.subtotal || 0) + (order.deliveryFee || 0) + (order.serviceFee || 0);

  return (
    <main style={styles.confirmPage}>
      {/* Back Button */}
      <header style={styles.confirmHeader}>
        <button type="button" onClick={() => navigate("/marketplace")} style={styles.confirmBackBtn}>
          ← Order Confirmed
        </button>
      </header>

      {/* Checkmark Circle */}
      <div style={styles.checkmarkCircle}>
        <div style={styles.checkmark}>✓</div>
      </div>

      {/* Confirmation Message */}
      <h1 style={styles.confirmTitle}>Order placed successfully!</h1>
      <p style={styles.confirmSubtitle}>Thank you for your order, {userData?.username || "Guest"}.</p>

      {/* Status Section */}
      <div style={styles.statusSection}>
        <div style={styles.statusLabel}>STATUS</div>
        <div style={styles.statusTime}>Arriving in 25–30 mins</div>
      </div>

      {/* Order Summary */}
      <section style={styles.section}>
        <div style={styles.orderHeader}>
          <h2 style={styles.sectionTitle}>Order Summary</h2>
          <span style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</span>
        </div>

        {/* Order Items */}
        <div style={styles.itemsList}>
          {(order.items || []).map((item, index) => (
            <div key={index} style={styles.itemRow}>
              {item.image && (
                <img src={item.image} alt={item.name} style={styles.itemImage} />
              )}
              <div style={styles.itemInfo}>
                <div style={styles.itemName}>{item.name}</div>
                <div style={styles.itemDetails}>
                  {item.qty}x • {currency(Number(item.price || 0))}
                </div>
              </div>
              <div style={styles.itemPrice}>{currency(Number(item.price || 0) * Number(item.qty || 1))}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bill Details */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Bill Details</h2>
        <div style={styles.billDetails}>
          <div style={styles.billRow}>
            <span>Subtotal</span>
            <strong>{currency(order.subtotal || 0)}</strong>
          </div>
          <div style={styles.billRow}>
            <span>Delivery Fee</span>
            <strong style={styles.freeText}>{order.deliveryFee === 0 ? "FREE" : currency(order.deliveryFee || 0)}</strong>
          </div>
          <div style={styles.billRow}>
            <span>Service Fee & Tax</span>
            <strong>{currency(order.serviceFee || 0)}</strong>
          </div>
          <div style={styles.billDivider} />
          <div style={styles.totalRow}>
            <span>Total Amount</span>
            <strong style={styles.totalAmount}>{currency(total)}</strong>
          </div>
        </div>
      </section>

      {/* Delivery Address */}
      <section style={styles.section}>
        <div style={styles.deliveryHeader}>
          <span style={styles.deliveryIcon}>📍</span>
          <div style={styles.deliveryContent}>
            <div style={styles.deliveryLabel}>DELIVERING TO</div>
            <div style={styles.deliveryAddress}>
              {order.deliveryAddress || userData?.deliveryAddress || "Address not set"}
            </div>
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      <div style={styles.buttonContainer}>
        <button
          onClick={() => navigate(`/marketplace/track-order/${order.id}`)}
          style={styles.trackBtn}
        >
          Track Order
        </button>
        <button
          onClick={() => navigate("/marketplace")}
          style={styles.homeBtn}
        >
          Back to Home
        </button>
      </div>
    </main>
  );
}

const styles = {
  confirmPage: {
    maxWidth: 460,
    margin: "0 auto",
    padding: "16px 16px 60px",
    fontFamily: "'Plus Jakarta Sans', Segoe UI, sans-serif",
    backgroundColor: "#fff8f5",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  confirmHeader: {
    display: "flex",
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 8,
  },
  confirmBackBtn: {
    background: "none",
    border: "none",
    fontSize: 14,
    fontWeight: 600,
    color: "#d91e63",
    cursor: "pointer",
    padding: 0,
  },
  checkmarkCircle: {
    width: 100,
    height: 100,
    borderRadius: "50%",
    backgroundColor: "#f5d4e6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    marginLeft: "auto",
    marginRight: "auto",
  },
  checkmark: {
    fontSize: 48,
    color: "#d91e63",
    fontWeight: 700,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: "#1e293b",
    margin: 0,
    marginBottom: 8,
    textAlign: "center",
  },
  confirmSubtitle: {
    fontSize: 14,
    color: "#64748b",
    margin: 0,
    marginBottom: 24,
    textAlign: "center",
  },
  statusSection: {
    width: "100%",
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: "0.05em",
  },
  statusTime: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1e293b",
  },
  orderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  orderId: {
    fontSize: 13,
    fontWeight: 700,
    color: "#d91e63",
    backgroundColor: "#f5d4e6",
    padding: "4px 12px",
    borderRadius: 4,
  },
  itemsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  itemRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    objectFit: "cover",
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1e293b",
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 12,
    color: "#64748b",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1e293b",
  },
  deliveryHeader: {
    display: "flex",
    gap: 12,
  },
  deliveryIcon: {
    fontSize: 24,
  },
  deliveryContent: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#d91e63",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 4,
  },
  deliveryAddress: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: 600,
  },
  buttonContainer: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 24,
  },
  trackBtn: {
    width: "100%",
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    color: "#fff",
    backgroundColor: "#d91e63",
    border: "none",
    borderRadius: 9999,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  homeBtn: {
    width: "100%",
    padding: "14px",
    fontSize: 16,
    fontWeight: 700,
    color: "#d91e63",
    backgroundColor: "#f5d4e6",
    border: "none",
    borderRadius: 9999,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  section: {
    marginBottom: 24,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1e293b",
    margin: 0,
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
  emptyContainer: {
    textAlign: "center",
    paddingTop: 40,
  },
};
