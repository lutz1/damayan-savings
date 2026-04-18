import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { cartCount, cartSubtotal, readCart, saveCart } from "./lib/cartStorage";
import ShopTopNav from "./components/ShopTopNav";
import ShopBottomNav from "./components/ShopBottomNav";

const getCategoryIcon = (category) => {
  const icons = {
    "all": "🏪",
    "food": "🍔",
    "meals": "🍱",
    "rice": "🍚",
    "noodles": "🍜",
    "drinks": "🥤",
    "beverages": "🧃",
    "desserts": "🍰",
    "snacks": "🥐",
    "bakery": "🥖",
    "coffee": "☕",
    "tea": "🫖",
    "juice": "🧃",
    "burger": "🍔",
    "pizza": "🍕",
    "seafood": "🦐",
    "chicken": "🍗",
    "beef": "🥩",
    "vegetables": "🥦",
    "fruit": "🍎",
    "dairy": "🧈",
    "frozen": "🧊",
    "grill": "🔥",
    "korean": "🍱",
    "japanese": "🍣",
    "chinese": "🥡",
    "thai": "🌶️",
    "indian": "🍛",
    "italian": "🍝",
  };
  return icons[String(category || "all").toLowerCase()] || "📦";
};

const currency = (value) =>
  `P${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const mapContainerStyle = {
  width: "100%",
  height: "220px",
  borderRadius: "12px",
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const extractCoords = (payload) => {
  if (!payload || typeof payload !== "object") return null;

  const lat = toNumber(payload.lat);
  const lng = toNumber(payload.lng);
  if (lat != null && lng != null) return { lat, lng };

  const nested = payload.location || payload.currentLocation || payload.coordinates || payload.dropoffLocation;
  if (nested && typeof nested === "object") {
    const nLat = toNumber(nested.lat);
    const nLng = toNumber(nested.lng);
    if (nLat != null && nLng != null) return { lat: nLat, lng: nLng };
  }

  return null;
};

export default function ShopPage({
  isEmbedded = false,
  onLoaded = null,
  onRequestLocationPicker = null,
}) {
  const hasNotifiedLoadedRef = useRef(false);
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [products, setProducts] = useState([]);
  const [merchants, setMerchants] = useState({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState(readCart);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [trackingRider, setTrackingRider] = useState(null);
  const [activeShopTab, setActiveShopTab] = useState("food");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryAddressCityProvince, setDeliveryAddressCityProvince] = useState("");

  const googleMapsApiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: "user-app-shop-map",
    googleMapsApiKey,
  });

  const riderCoords = useMemo(
    () => extractCoords(trackingRider) || extractCoords(activeDelivery),
    [trackingRider, activeDelivery]
  );

  const customerCoords = useMemo(() => {
    const fromDropoff = extractCoords(activeDelivery?.dropoffLocation);
    if (fromDropoff) return fromDropoff;
    return extractCoords(activeDelivery);
  }, [activeDelivery]);

  const mapCenter = riderCoords || customerCoords || null;
  const routePath = riderCoords && customerCoords ? [riderCoords, customerCoords] : [];

  // Skip splashscreen when navigating in marketplace
  useEffect(() => {
    sessionStorage.setItem('skipAppSplash', 'true');
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setUserId(user?.uid || ""));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const productsQuery = query(collection(db, "products"), where("status", "==", "active"));
    const unsubscribe = onSnapshot(productsQuery, (snap) => {
      const entries = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      setProducts(entries);
    });
    return () => unsubscribe();
  }, []);

  // Notify parent when ShopPage is loaded (for loading screen)
  useEffect(() => {
    if (!onLoaded || hasNotifiedLoadedRef.current) {
      return undefined;
    }

    if (isEmbedded && products.length > 0) {
      const timer = setTimeout(() => {
        hasNotifiedLoadedRef.current = true;
        onLoaded();
      }, 300);
      return () => clearTimeout(timer);

    } else if (!isEmbedded) {
      hasNotifiedLoadedRef.current = true;
      onLoaded();
    }
  }, [products.length, isEmbedded, onLoaded]);

  useEffect(() => {
    const merchantIds = [...new Set(products.map((item) => item.merchantId).filter(Boolean))];
    if (!merchantIds.length) return;

    merchantIds.forEach((merchantId) => {
      if (merchants[merchantId]) return;

      getDoc(doc(db, "users", merchantId)).then((snap) => {
        if (snap.exists()) {
          setMerchants((prev) => ({ ...prev, [merchantId]: { id: merchantId, ...snap.data() } }));
          return;
        }

        getDoc(doc(db, "merchants", merchantId)).then((merchantSnap) => {
          if (merchantSnap.exists()) {
            setMerchants((prev) => ({ ...prev, [merchantId]: { id: merchantId, ...merchantSnap.data() } }));
          }
        });
      });
    });
  }, [products, merchants]);

  useEffect(() => {
    if (!userId) {
      setActiveDelivery(null);
      return () => {};
    }

    const deliveryQuery = query(collection(db, "deliveries"), where("customerId", "==", userId));
    const unsubscribe = onSnapshot(deliveryQuery, (snap) => {
      const list = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      const candidate = list
        .filter((delivery) => {
          const normalized = String(delivery.status || "").toUpperCase();
          return normalized !== "DELIVERED" && normalized !== "CANCELLED";
        })
        .sort((a, b) => {
          const aMs = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
          const bMs = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
          return bMs - aMs;
        })[0];

      setActiveDelivery(candidate || null);
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setDeliveryAddress("");
      setDeliveryAddressCityProvince("");
      return () => {};
    }

    const unsubscribe = onSnapshot(doc(db, "users", userId), (snap) => {
      if (!snap.exists()) {
        setDeliveryAddress("");
        setDeliveryAddressCityProvince("");
        return;
      }

      const data = snap.data() || {};
      setDeliveryAddress(String(data.deliveryAddress || ""));
      setDeliveryAddressCityProvince(String(data.deliveryAddressCityProvince || ""));
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!activeDelivery?.riderId) {
      setTrackingRider(null);
      return () => {};
    }

    const unsubscribe = onSnapshot(doc(db, "users", activeDelivery.riderId), (snap) => {
      setTrackingRider(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });

    return () => unsubscribe();
  }, [activeDelivery?.riderId]);

  useEffect(() => {
    if (!toast.message) return undefined;
    const timeout = window.setTimeout(() => setToast({ message: "", type: "info" }), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const categories = useMemo(() => {
    const raw = [...new Set(products.map((item) => String(item.category || "").trim()).filter(Boolean))];
    return ["all", ...raw];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return products
      .filter((item) => {
        const categoryMatch =
          category === "all" || String(item.category || "").toLowerCase() === category.toLowerCase();
        if (!categoryMatch) return false;
        if (!searchTerm) return true;
        return (
          String(item.name || "").toLowerCase().includes(searchTerm) ||
          String(item.category || "").toLowerCase().includes(searchTerm) ||
          String(item.description || "").toLowerCase().includes(searchTerm)
        );
      })
      .slice(0, 80);
  }, [products, search, category]);

  const visibleStores = useMemo(() => {
    const ids = [...new Set(visibleProducts.map((item) => item.merchantId).filter(Boolean))];
    return ids.map((id) => merchants[id]).filter(Boolean).slice(0, 8);
  }, [visibleProducts, merchants]);

  const frequentlyBoughtProducts = useMemo(() => {
    return visibleProducts.slice(0, 8);
  }, [visibleProducts]);

  const displayCategories = useMemo(() => {
    return categories.slice(0, 5);
  }, [categories]);

  const itemCount = useMemo(() => cartCount(cart), [cart]);
  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);

  const handleShopTabChange = (tab) => {
    setActiveShopTab(tab);

    if (tab === "cart") {
      navigate("/marketplace/cart");
      return;
    }

    if (tab === "account") {
      navigate("/member/profile");
      return;
    }

    if (tab === "grocery" || tab === "leisure") {
      setToast({ message: `${tab.charAt(0).toUpperCase() + tab.slice(1)} is coming soon`, type: "info" });
      return;
    }
  };

  const addToCart = (product) => {
    const existing = cart.find((item) => item.id === product.id);
    let next;
    if (existing) {
      next = cart.map((item) => (item.id === product.id ? { ...item, qty: Number(item.qty || 0) + 1 } : item));
    } else {
      next = [
        ...cart,
        {
          id: product.id,
          name: product.name || "Product",
          image: product.image || "",
          price: Number(product.price || 0),
          qty: 1,
          merchantId: product.merchantId || null,
        },
      ];
    }

    setCart(next);
    saveCart(next);
    setToast({ message: "Added to cart", type: "success" });
  };

  const styles = getStyles(isEmbedded);

  return (
    <main style={styles.page}>
      {isEmbedded ? (
        <ShopTopNav
          search={search}
          onSearchChange={(event) => setSearch(event.target.value)}
          locationText="Current Location"
          locationSubtext={deliveryAddressCityProvince || deliveryAddress || "Set your delivery address"}
          onLocationClick={() => {
            if (typeof onRequestLocationPicker === "function") {
              onRequestLocationPicker();
              return;
            }
            navigate("/marketplace/add-address");
          }}
          onBackClick={() => navigate("/member/dashboard")}
          cartCount={itemCount}
          onCartClick={() => navigate("/marketplace/cart")}
        />
      ) : null}

      {!isEmbedded && (
        <header style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>Food Market</p>
            <h1 style={styles.heading}>Order From Nearby Stores</h1>
            <p style={styles.subheading}>One place for merchant discovery, cart, and checkout.</p>
          </div>
          <div style={styles.heroActions}>
            <Link to="/marketplace/add-address" style={styles.addressBtn}>
              {deliveryAddressCityProvince || deliveryAddress ? "Change Address" : "Set Address"}
            </Link>
            <Link to="/dashboard" style={styles.backLink}>
              Dashboard
            </Link>
          </div>
        </header>
      )}

      <section style={styles.promo}>
        <span style={styles.promoBadgeEmoji}>🎉</span>
        <div>
          <p style={styles.promoTitle}>First order deal</p>
          <p style={styles.promoCopy}>Use code FIRSTBITE at checkout to unlock a welcome discount.</p>
        </div>
      </section>

      {activeDelivery ? (
        <section style={styles.trackingCard}>
          <div style={styles.trackingTopRow}>
            <p style={styles.trackingKicker}>Live Delivery</p>
            <span style={styles.trackingStatus}>{String(activeDelivery.status || "NEW")}</span>
          </div>
          <p style={styles.trackingLine}>
            Order: {activeDelivery.orderId ? `#${String(activeDelivery.orderId).slice(0, 8)}` : "In progress"}
          </p>
          <p style={styles.trackingLine}>
            Rider: {trackingRider?.name || (activeDelivery.riderId ? `ID ${String(activeDelivery.riderId).slice(0, 8)}` : "Looking for rider")}
          </p>

          {!googleMapsApiKey ? (
            <p style={styles.mapFallback}>Add VITE_GOOGLE_MAPS_API_KEY to enable live map tracking.</p>
          ) : !mapCenter ? (
            <p style={styles.mapFallback}>Waiting for rider and destination coordinates.</p>
          ) : isMapLoaded ? (
            <div style={{ marginTop: 10 }}>
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter}
                zoom={15}
                options={{
                  mapTypeControl: false,
                  streetViewControl: false,
                  fullscreenControl: false,
                  clickableIcons: false,
                }}
              >
                {riderCoords ? <MarkerF position={riderCoords} title="Rider" /> : null}
                {customerCoords ? <MarkerF position={customerCoords} title="Delivery" /> : null}
                {routePath.length === 2 ? (
                  <PolylineF
                    path={routePath}
                    options={{
                      strokeColor: "#16a34a",
                      strokeOpacity: 0.9,
                      strokeWeight: 4,
                    }}
                  />
                ) : null}
              </GoogleMap>
            </div>
          ) : (
            <p style={styles.mapFallback}>Loading map...</p>
          )}
        </section>
      ) : null}

      {!isEmbedded && <section style={styles.searchWrap}>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search dishes, categories, stores"
          style={styles.searchInput}
        />
      </section>}

      <section style={styles.categorySection}>
        <h2 style={styles.sectionTitleSmall}>Categories</h2>
        <div style={styles.categoryGrid}>
          {displayCategories.slice(0, 4).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setCategory(entry)}
              style={{ ...styles.categoryGridItem, ...(category === entry ? styles.categoryGridItemActive : {}) }}
            >
              <span style={styles.categoryIcon}>{getCategoryIcon(entry)}</span>
              <span style={styles.categoryLabel}>{entry === "all" ? "All" : entry}</span>
            </button>
          ))}
        </div>
        {categories.length > 5 && (
          <button
            type="button"
            onClick={() => setCategory("all")}
            style={styles.seeAllBtn}
          >
            See all categories →
          </button>
        )}
      </section>

      {!isEmbedded && (
        <section style={styles.categoryFilterRow}>
          {categories.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setCategory(entry)}
              style={{ ...styles.categoryChip, ...(category === entry ? styles.categoryChipActive : {}) }}
            >
              {entry === "all" ? "All" : entry}
            </button>
          ))}
        </section>
      )}

      {visibleStores.length > 0 ? (
        <section style={styles.storesWrap}>
          <h2 style={styles.sectionTitle}>Top Stores</h2>
          <div style={styles.storeGrid}>
            {visibleStores.map((store) => (
              <article key={store.id} style={styles.storeCard}>
                <h3 style={styles.cardTitle}>{store.storeName || store.businessName || store.name || "Store"}</h3>
                <p style={styles.meta}>{store.city || store.address || "Address not set"}</p>
                <Link to={`/marketplace/store/${store.id}`} style={styles.storeBtn}>
                  Open Store
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section style={styles.productsWrap}>
        <h2 style={styles.sectionTitle}>Frequently Bought</h2>
        <div style={styles.productGrid}>
          {frequentlyBoughtProducts.length === 0 ? (
            <p style={styles.empty}>No products available yet.</p>
          ) : null}
          {frequentlyBoughtProducts.map((product) => (
            <article key={product.id} style={styles.productCard}>
              <div style={styles.thumbWrap}>
                <img 
                  src={product.image || "/icons/icon-192x192.png"} 
                  alt={product.name || "Product"} 
                  style={styles.thumb} 
                />
                <button
                  type="button"
                  style={styles.favoriteBtn}
                  onClick={() => setToast({ message: "Added to wishlist", type: "success" })}
                  title="Add to wishlist"
                >
                  ❤️
                </button>
              </div>
              <h3 style={styles.cardTitle}>{product.name || "Product"}</h3>
              <p style={styles.meta}>{product.category || "General"}</p>
              <div style={styles.productFooter}>
                <p style={styles.price}>{currency(product.price)}</p>
                <button 
                  type="button" 
                  style={styles.actionBtn} 
                  onClick={() => addToCart(product)}
                >
                  + Add
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {itemCount > 0 ? (
        <footer style={styles.cartBar}>
          <p style={styles.cartText}>Cart {itemCount} items - {currency(subtotal)}</p>
          <Link to="/marketplace/cart" style={styles.cartBtn}>
            Checkout
          </Link>
        </footer>
      ) : null}

      {isEmbedded ? (
        <ShopBottomNav value={activeShopTab} onChange={handleShopTabChange} cartCount={itemCount} />
      ) : (
        <nav style={styles.bottomNav}>
          <Link to="/marketplace/shop" style={styles.navItemActive}>
            Shop
          </Link>
          <Link to="/orders" style={styles.navItem}>
            Orders
          </Link>
          <Link to="/dashboard" style={styles.navItem}>
            Account
          </Link>
        </nav>
      )}

      {toast.message ? (
        <div style={{ ...styles.toast, ...(toast.type === "error" ? styles.toastError : styles.toastDefault) }}>
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

const getStyles = (isEmbedded = false) => ({
  page: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: isEmbedded ? "116px 16px 112px" : "16px 16px 120px",
    fontFamily: "Segoe UI, sans-serif",
    background: "#f8fafc",
    minHeight: isEmbedded ? "auto" : "100vh",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 14,
    borderRadius: 20,
    border: "1px solid #cbd5e1",
    background: "linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 45%, #fef9f3 100%)",
    padding: 16,
  },
  heroActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#0f766e",
    fontSize: 12,
    fontWeight: 700,
  },
  heading: {
    margin: "8px 0 4px",
    color: "#0f3f35",
  },
  subheading: {
    margin: 0,
    color: "#475569",
    fontSize: 14,
  },
  backLink: {
    textDecoration: "none",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "9px 14px",
    color: "#1e293b",
    fontWeight: 700,
    background: "#fff",
  },
  addressBtn: {
    textDecoration: "none",
    border: "1px solid #86efac",
    borderRadius: 10,
    padding: "9px 14px",
    color: "#15803d",
    fontWeight: 700,
    background: "#f0fdf4",
  },
  promo: {
    marginBottom: 12,
    borderRadius: 16,
    border: "1px solid #d4d4d8",
    background: "linear-gradient(135deg, #fef2f2 0%, #fef9e7 100%)",
    padding: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  promoBadgeEmoji: {
    fontSize: 40,
    lineHeight: 1,
  },
  promoTitle: {
    margin: 0,
    color: "#7c2d12",
    fontWeight: 800,
  },
  promoCopy: {
    margin: "2px 0 0",
    color: "#b45309",
    fontSize: 13,
  },
  trackingCard: {
    marginBottom: 12,
    borderRadius: 14,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    padding: 12,
  },
  trackingTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  trackingKicker: {
    margin: 0,
    color: "#047857",
    fontWeight: 800,
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: "0.06em",
  },
  trackingStatus: {
    borderRadius: 999,
    background: "#d1fae5",
    color: "#065f46",
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 800,
  },
  trackingLine: {
    margin: "4px 0 0",
    color: "#0f3f35",
    fontSize: 13,
  },
  mapFallback: {
    margin: "8px 0 0",
    color: "#0f766e",
    fontSize: 12,
  },
  searchWrap: {
    marginBottom: 10,
  },
  searchInput: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
  },
  categorySection: {
    marginBottom: 20,
  },
  sectionTitleSmall: {
    margin: "0 0 12px",
    color: "#0f3f35",
    fontSize: 16,
    fontWeight: 700,
  },
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
    marginBottom: 12,
  },
  categoryGridItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  categoryGridItemActive: {
    background: "#0f766e",
    borderColor: "#0f766e",
    color: "#fff",
  },
  categoryIcon: {
    fontSize: 28,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: 600,
    textAlign: "center",
    color: "#475569",
  },
  categoryGridItemActive_label: {
    color: "#fff",
  },
  seeAllBtn: {
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 10,
    background: "#fff",
    color: "#0f766e",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  },
  categoryFilterRow: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 6,
    marginBottom: 12,
  },
  categoryChip: {
    border: "1px solid #e2e8f0",
    borderRadius: 999,
    padding: "7px 12px",
    background: "#fff",
    color: "#475569",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 600,
    fontSize: 12,
  },
  categoryChipActive: {
    background: "#0f766e",
    color: "#fff",
    borderColor: "#0f766e",
  },
  storesWrap: {
    display: "grid",
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f3f35",
    fontSize: 18,
    fontWeight: 700,
  },
  storeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
    gap: 10,
  },
  storeCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
  },
  productsWrap: {
    display: "grid",
    gap: 10,
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
  },
  productCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 10,
    background: "#fff",
    transition: "all 0.2s ease",
  },
  thumbWrap: {
    position: "relative",
    width: "100%",
    height: 140,
    borderRadius: 10,
    overflow: "hidden",
    background: "#f1f5f9",
    marginBottom: 8,
  },
  thumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  favoriteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    border: "none",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.9)",
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
  },
  cardTitle: {
    margin: "0 0 4px",
    color: "#0f3f35",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  meta: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    marginBottom: 8,
  },
  productFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 6,
  },
  price: {
    margin: 0,
    color: "#0f766e",
    fontWeight: 700,
    fontSize: 14,
  },
  actionBtn: {
    border: 0,
    borderRadius: 8,
    background: "#0f766e",
    color: "#fff",
    padding: "6px 10px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  },
  storeBtn: {
    display: "inline-block",
    marginTop: 10,
    textDecoration: "none",
    borderRadius: 10,
    background: "#0f766e",
    color: "#fff",
    padding: "8px 12px",
    fontWeight: 700,
    fontSize: 13,
  },
  empty: {
    margin: 0,
    color: "#64748b",
  },
  cartBar: {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: 58,
    zIndex: 30,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    background: "#0f766e",
    color: "#fff",
    borderRadius: 999,
    padding: "11px 14px",
    boxShadow: "0 16px 30px rgba(15, 118, 110, 0.35)",
  },
  cartText: {
    margin: 0,
    fontWeight: 700,
    fontSize: 13,
  },
  cartBtn: {
    textDecoration: "none",
    borderRadius: 999,
    background: "#fff",
    color: "#0f766e",
    padding: "7px 12px",
    fontWeight: 700,
    fontSize: 12,
  },
  bottomNav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    height: 50,
    background: "#fff",
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 20,
  },
  navItem: {
    textDecoration: "none",
    color: "#64748b",
    fontWeight: 600,
    fontSize: 12,
  },
  navItemActive: {
    textDecoration: "none",
    color: "#0f766e",
    fontWeight: 700,
    fontSize: 12,
  },
  toast: {
    position: "fixed",
    right: 14,
    bottom: 110,
    color: "#fff",
    fontWeight: 700,
    borderRadius: 10,
    padding: "10px 14px",
    zIndex: 40,
  },
  toastDefault: {
    background: "#0f766e",
  },
  toastError: {
    background: "#dc2626",
  },
});
