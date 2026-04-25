import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { cartCount, cartSubtotal, readCart, saveCart } from "./lib/cartStorage";
import { calculateCustomerDeliveryFee, getRoadDistance, extractCoordinates, geocodeAddress } from "../../lib/deliveryPricing";
import ShopLocationDialog from "./components/ShopLocationDialog";

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
  const [currentView, setCurrentView] = useState("cart"); // "cart" or "checkout"
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("applePay");
  const [userData, setUserData] = useState(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [merchants, setMerchants] = useState({});
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState(new Date().toISOString().split("T")[0]);

  // Fetch user's delivery address from Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.log("❌ No authenticated user");
        return;
      }

      console.log("✅ User authenticated:", user.uid);

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) {
          console.log("❌ User document not found in Firestore");
          return;
        }

        const userDataFromFirestore = userSnap.data();
        setUserData(userDataFromFirestore);
        console.log("👤 User Firestore data:", userDataFromFirestore);

        // Try to extract coordinates directly from user document
        let coords = extractCoordinates(userDataFromFirestore);
        
        if (coords) {
          setDeliveryCoordinates(coords);
          console.log("✅ Delivery coordinates from Firestore (direct):", coords);
        } else if (userDataFromFirestore.deliveryAddress || userDataFromFirestore.address) {
          // If no coordinates but address exists, geocode the address
          const addressToGeocode = userDataFromFirestore.deliveryAddress || userDataFromFirestore.address;
          console.log("🔍 Geocoding address:", addressToGeocode);
          coords = await geocodeAddress(addressToGeocode);
          
          if (coords) {
            setDeliveryCoordinates(coords);
            console.log("✅ Delivery coordinates from geocoding:", coords);
          } else {
            console.log("❌ Could not geocode address");
          }
        } else {
          console.log("⚠️  No delivery coordinates or address found in Firestore");
        }

        // Set address info
        if (userDataFromFirestore.deliveryAddress) {
          setCurrentLocation(userDataFromFirestore.deliveryAddress);
          console.log("✅ Delivery address from Firestore:", userDataFromFirestore.deliveryAddress);
        } else if (userDataFromFirestore.address) {
          setCurrentLocation(userDataFromFirestore.address);
          console.log("✅ Delivery address from Firestore:", userDataFromFirestore.address);
        }

        if (userDataFromFirestore.city || userDataFromFirestore.province) {
          setCurrentCityProvince(`${userDataFromFirestore.city || ""} ${userDataFromFirestore.province || ""}`.trim());
        }
      } catch (error) {
        console.error("❌ Error fetching user delivery data:", error);
      }
    });

    return unsubscribe;
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
            shopLocation: merchantData?.shopLocation,
            location: merchantData?.location,
            coordinates: merchantData?.coordinates,
            lat: merchantData?.lat,
            latitude: merchantData?.latitude,
            lng: merchantData?.lng,
            longitude: merchantData?.longitude,
            shopAddress: merchantData?.shopAddress,
            geoPoint: merchantData?._latitude ? {lat: merchantData._latitude, lng: merchantData._longitude} : 'N/A',
            fullData: merchantData
          });
          
          const storeCoords = extractCoordinates(merchantData);
          console.log(`  → Extracted store coordinates:`, storeCoords);
          console.log(`  → User delivery coordinates:`, deliveryCoordinates);

          if (storeCoords && deliveryCoordinates) {
            // Use getRoadDistance instead of calculateDistance (Haversine)
            // getRoadDistance returns actual road distance via Google Directions API
            const dist = await getRoadDistance(
              deliveryCoordinates.lat,
              deliveryCoordinates.lng,
              storeCoords.lat,
              storeCoords.lng
            );
            
            if (dist !== null) {
              console.log(`  → Road distance from Google API: ${dist} km`);
              distances.push(dist);
            } else {
              console.log(`  ⚠️  FALLBACK: Google Directions API failed, using 0 km`);
              distances.push(0);
            }
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

  // Load merchants and saved addresses for ShopLocationDialog
  useEffect(() => {
    const loadMerchantsAndAddresses = async () => {
      try {
        // Load all merchants
        const merchantsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "MERCHANT")));
        const merchantsData = {};
        merchantsSnap.forEach((doc) => {
          merchantsData[doc.id] = doc.data();
        });
        setMerchants(merchantsData);

        // Load saved addresses from localStorage
        const savedAddrs = localStorage.getItem("savedAddresses");
        if (savedAddrs) {
          try {
            setSavedAddresses(JSON.parse(savedAddrs));
          } catch (e) {
            console.log("Error parsing saved addresses:", e);
          }
        }
      } catch (error) {
        console.error("Error loading merchants and addresses:", error);
      }
    };

    loadMerchantsAndAddresses();
  }, []);

  const handleLocationDialogClose = () => {
    setShowLocationDialog(false);
  };

  const handleAddressSelect = (addressData) => {
    // addressData should contain: address, cityProvince, coordinates
    if (addressData && addressData.address) {
      setCurrentLocation(addressData.address);
      if (addressData.cityProvince) {
        setCurrentCityProvince(addressData.cityProvince);
      }
      if (addressData.coordinates) {
        setDeliveryCoordinates(addressData.coordinates);
      }
      setShowLocationDialog(false);
      setToast({ message: "Address updated successfully", type: "success" });
    }
  };

  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);
  const itemCount = useMemo(() => cartCount(cart), [cart]);
  const serviceFee = 8; // Fixed service fee
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

    // Switch to checkout view
    setCurrentView("checkout");
  };

  const handleBackFromCheckout = () => {
    setCurrentView("cart");
  };

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
      let firstOrderId = null;
      for (const merchantId of merchantIds) {
        const merchantItems = groupedByMerchant[merchantId] || [];
        const merchantSubtotal = merchantItems.reduce(
          (sum, current) => sum + Number(current.price || 0) * Number(current.qty || 0),
          0
        );
        const serviceFee = 10;

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
          deliveryDate: selectedDeliveryDate,
          paymentMethod: selectedPaymentMethod,
          status: "PENDING",
          createdAt: new Date().toISOString(),
        };

        const docRef = await addDoc(collection(db, "orders"), orderData);
        if (!firstOrderId) {
          firstOrderId = docRef.id;
          // Save the first order ID to both localStorage and sessionStorage for reliability
          localStorage.setItem("lastOrderId", firstOrderId);
          sessionStorage.setItem("lastOrderId", firstOrderId);
          console.log("✅ Order created, ID saved to storage:", firstOrderId);
          console.log("   localStorage check:", localStorage.getItem("lastOrderId"));
          console.log("   sessionStorage check:", sessionStorage.getItem("lastOrderId"));
        }
      }

      // Clear cart
      setCart([]);
      saveCart([]);

      setToast({ message: "Order placed successfully!", type: "success" });
      setPlacingOrder(false);
      
      // Navigate to checkout confirmation page instead of marketplace
      window.setTimeout(() => {
        setCurrentView("cart");
        console.log("Navigating to checkout-confirm with order ID:", firstOrderId);
        navigate("/marketplace/checkout-confirm");
      }, 500);
    } catch (error) {
      console.error("Order placement error:", error);
      setToast({ message: "Failed to place order: " + error.message, type: "error" });
      setPlacingOrder(false);
    }
  };

  return (
    <main style={styles.page}>
      <header style={styles.topBar}>
        <button type="button" onClick={() => currentView === "checkout" ? handleBackFromCheckout() : navigate("/marketplace/shop")} style={styles.iconBtn}>
          ←
        </button>
        <h1 style={styles.topTitle}>{currentView === "checkout" ? "Checkout" : "View Cart"}</h1>
        <div style={{ width: 28 }} />
      </header>

      {/* Step Progress */}
      <div style={styles.stepProgress}>
        <div style={styles.step}>
          <div style={styles.stepNum}>✓</div>
          <span style={styles.stepLabel}>Menu</span>
        </div>
        <div style={styles.stepConnector}></div>
        <div style={{...styles.step, ...(currentView === "cart" ? styles.stepActive : {})}}>
          <div style={{...styles.stepNum, ...(currentView === "cart" ? styles.stepNumActive : {})}}>2</div>
          <span style={{...styles.stepLabel, ...(currentView === "cart" ? styles.stepLabelActive : {})}}>Cart</span>
        </div>
        <div style={styles.stepConnector}></div>
        <div style={{...styles.step, ...(currentView === "checkout" ? styles.stepActive : {})}}>
          <div style={{...styles.stepNum, ...(currentView === "checkout" ? styles.stepNumActive : {})}}>3</div>
          <span style={{...styles.stepLabel, ...(currentView === "checkout" ? styles.stepLabelActive : {})}}>Checkout</span>
        </div>
      </div>

      {/* CART VIEW */}
      {currentView === "cart" && (
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
      )}

      {/* CHECKOUT VIEW */}
      {currentView === "checkout" && (
        <section style={styles.checkoutPanel}>
          {/* Delivery Address */}
          <div style={styles.checkoutSection}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Delivery Address</h2>
              <button onClick={() => setShowLocationDialog(true)} style={styles.editBtn}>Edit</button>
            </div>
            <div style={styles.addressCard}>
              <span style={styles.addressIcon}>📍</span>
              <div style={styles.addressContent}>
                <h3 style={styles.addressType}>{userData?.addressType || "Home"}</h3>
                <p style={styles.addressText}>{currentLocation || "No address set"}</p>
              </div>
            </div>
          </div>

          {/* Payment Method - COD Only */}
          <div style={styles.checkoutSection}>
            <h2 style={styles.sectionTitle}>Payment Method</h2>
            <div style={styles.paymentCard}>
              <span style={styles.paymentCardIcon}>💳</span>
              <div style={styles.paymentCardInfo}>
                <strong style={styles.paymentCardTitle}>Cash on Delivery (COD)</strong>
                <p style={styles.paymentCardDesc}>Pay when your order arrives</p>
              </div>
            </div>
          </div>

          {/* Bill Summary */}
          <div style={styles.checkoutSection}>
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
          </div>
        </section>
      )}

      {/* BOTTOM SHEET - Place Order */}
      {currentView === "checkout" && (
        <div style={styles.bottomSheet}>
          <div style={styles.bottomSheetContent}>
            <div style={styles.bottomSheetHandle} />
            <div style={styles.bottomSheetBody}>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={placingOrder}
                style={{
                  ...styles.bottomSheetBtn,
                  opacity: placingOrder ? 0.6 : 1,
                  cursor: placingOrder ? "not-allowed" : "pointer",
                }}
              >
                {placingOrder ? "Placing order..." : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.message ? (
        <div style={{ ...styles.toast, ...(toast.type === "error" ? styles.toastError : toast.type === "success" ? styles.toastSuccess : styles.toastDefault) }}>
          {toast.message}
        </div>
      ) : null}

      {/* Location Dialog */}
      <ShopLocationDialog
        open={showLocationDialog}
        onClose={handleLocationDialogClose}
        savedAddresses={savedAddresses}
        onSelectAddress={handleAddressSelect}
        merchants={merchants}
      />
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 460,
    margin: "0 auto",
    padding: "0 12px 120px",
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
    background: "#fff",
    zIndex: 30,
    marginBottom: 12,
    borderBottom: "1px solid #e2e8f0",
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
    marginBottom: 14,
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
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    background: "#fff",
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
    boxShadow: "0 1px 3px rgba(30, 103, 218, 0.15)",
  },
  storeSummary: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 9,
    marginTop: 9,
    background: "#f8fafc",
    padding: "9px 10px",
    borderRadius: 6,
    marginLeft: -12,
    marginRight: -12,
    marginBottom: -12,
    paddingLeft: 12,
    paddingRight: 12,
  },
  panel: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
    display: "grid",
    gap: 12,
    marginBottom: 12,
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
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    fontWeight: 600,
  },
  qtyBtnAdd: {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "none",
    background: "#1e67da",
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    fontWeight: 600,
    boxShadow: "0 1px 3px rgba(30, 103, 218, 0.15)",
  },
  qtyValue: {
    minWidth: 14,
    textAlign: "center",
    fontWeight: 700,
    color: "#1e293b",
    fontSize: 12,
  },
  promoWrap: {
    marginTop: 4,
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#f0f9ff",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "10px 11px",
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
    fontFamily: "inherit",
  },
  applyBtn: {
    border: "none",
    borderRadius: 7,
    background: "#1e67da",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    padding: "7px 12px",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    boxShadow: "0 1px 3px rgba(30, 103, 218, 0.15)",
  },
  summary: {
    marginTop: 10,
    display: "grid",
    gap: 7,
    backgroundColor: "#f0f9ff",
    padding: "14px 12px",
    borderRadius: 10,
    border: "1px solid #bfdbfe",
  },
  summaryTitle: {
    margin: "2px 0 7px 0",
    color: "#1e293b",
    fontSize: 14,
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
    margin: "4px 0 0 0",
    color: "#1e293b",
    fontWeight: 800,
    fontSize: 16,
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
    width: "100%",
    marginTop: 8,
    border: 0,
    borderRadius: 10,
    background: "#1e67da",
    color: "#fff",
    padding: "13px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
    transition: "background-color 0.2s ease",
    boxShadow: "0 2px 8px rgba(30, 103, 218, 0.15)",
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
    bottom: 100,
    transform: "translateX(-50%)",
    color: "#fff",
    fontWeight: 600,
    borderRadius: 8,
    padding: "11px 16px",
    fontSize: 13,
    zIndex: 1000,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
  },
  toastDefault: {
    background: "#1e67da",
  },
  toastError: {
    background: "#dc2626",
  },
  toastSuccess: {
    background: "#16a34a",
  },
  // Checkout view styles - Enhanced theme matching Cart Step 2
  checkoutPanel: {
    padding: "12px 0 120px",
  },
  progressSection: {
    marginBottom: 14,
    backgroundColor: "#fff",
    padding: "14px 12px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
  },
  stepBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: "#1e67da",
    backgroundColor: "#dbeafe",
    padding: "4px 8px",
    borderRadius: 6,
  },
  progressBar: {
    width: "100%",
    height: 5,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#1e67da",
    transition: "width 0.3s ease",
  },
  checkoutSection: {
    marginBottom: 14,
    backgroundColor: "#fff",
    padding: "14px 12px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 11,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1e293b",
    margin: 0,
  },
  editBtn: {
    background: "none",
    border: "none",
    color: "#1e67da",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
  },
  addressCard: {
    display: "flex",
    gap: 10,
    padding: 11,
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    border: "1px solid #bfdbfe",
  },
  addressIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  addressContent: {
    flex: 1,
  },
  addressType: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: "#1e293b",
  },
  addressText: {
    margin: "3px 0",
    fontSize: 12,
    color: "#475569",
    lineHeight: 1.4,
  },
  timeOptions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  timeOption: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    padding: 11,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
    background: "#fff",
  },
  radio: {
    marginTop: 3,
    cursor: "pointer",
    accentColor: "#1e67da",
  },
  timeLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  paymentOptions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  paymentOption: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    padding: 11,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
    background: "#fff",
  },
  paymentLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  billDetails: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  billRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#64748b",
  },
  freeText: {
    color: "#16a34a",
    fontWeight: 700,
  },
  billDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    margin: "7px 0",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 15,
    fontWeight: 800,
    color: "#1e293b",
  },
  totalAmount: {
    fontSize: 17,
    color: "#1e67da",
  },
  placeOrderBtn: {
    width: "calc(100% - 32px)",
    padding: "13px 14px",
    margin: "14px 16px",
    position: "fixed",
    bottom: 20,
    left: 0,
    right: 0,
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
    backgroundColor: "#1e67da",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    boxShadow: "0 2px 8px rgba(30, 103, 218, 0.2)",
  },
  // Date Picker Styles
  datePickerWrap: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: 11,
    backgroundColor: "#f0f9ff",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
  },
  dateIcon: {
    fontSize: 20,
    flexShrink: 0,
  },
  dateInput: {
    flex: 1,
    border: "none",
    background: "transparent",
    color: "#1e293b",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  dateHint: {
    margin: "8px 0 0 0",
    fontSize: 12,
    color: "#64748b",
  },
  // Bottom Sheet Styles
  bottomSheet: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 999,
    animation: "slideUp 0.3s ease-out",
  },
  bottomSheetContent: {
    position: "relative",
    marginTop: "auto",
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80vh",
    overflowY: "auto",
    boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#cbd5e1",
    borderRadius: 2,
    margin: "12px auto",
  },
  bottomSheetBody: {
    padding: "16px 16px 24px",
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1e293b",
    margin: "0 0 12px 0",
  },
  orderSummaryRows: {
    display: "grid",
    gap: 10,
    marginBottom: 16,
    backgroundColor: "#f0f9ff",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #bfdbfe",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
    color: "#475569",
  },
  bottomSheetTotalSection: {
    backgroundColor: "#f0f9ff",
    padding: "16px 12px",
    borderRadius: 8,
    border: "1px solid #bfdbfe",
    marginBottom: 16,
    textAlign: "center",
  },
  bottomSheetTotalLabel: {
    fontSize: 12,
    color: "#64748b",
    margin: "0 0 4px 0",
    fontWeight: 500,
  },
  bottomSheetTotalValue: {
    fontSize: 24,
    fontWeight: 800,
    color: "#1e67da",
    margin: 0,
  },
  paymentCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    backgroundColor: "#f0f9ff",
  },
  paymentCardIcon: {
    fontSize: 24,
  },
  paymentCardInfo: {
    flex: 1,
  },
  paymentCardTitle: {
    display: "block",
    fontSize: 14,
    color: "#1e293b",
    margin: 0,
  },
  paymentCardDesc: {
    fontSize: 12,
    color: "#64748b",
    margin: "2px 0 0 0",
  },
  bottomSheetBtn: {
    width: "100%",
    padding: "14px 16px",
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
    backgroundColor: "#1e67da",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    boxShadow: "0 2px 8px rgba(30, 103, 218, 0.2)",
  },
};

// Add keyframe animation for bottom sheet
if (typeof document !== "undefined" && !document.getElementById("cartPageStyles")) {
  const style = document.createElement("style");
  style.id = "cartPageStyles";
  style.textContent = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(100px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    input[type="date"] {
      accent-color: #1e67da;
    }
  `;
  document.head.appendChild(style);
}
