import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "../../firebase";
import { cartCount, cartSubtotal, readCart, saveCart } from "./lib/cartStorage";
import ShopTopNav from "./components/ShopTopNav";
import ShopBottomNav from "./components/ShopBottomNav";
import "./ShopPage.css";

const normalizeCategory = (value) => String(value || "").trim().toLowerCase();

const pickCategoryImageField = (category) => {
  const directUrl =
    category?.imageUrl || category?.iconUrl || category?.categoryImageUrl || category?.image || category?.icon;
  if (typeof directUrl === "string" && directUrl.trim()) {
    return directUrl.trim();
  }

  const storagePath = category?.imagePath || category?.iconPath || category?.storagePath;
  if (typeof storagePath === "string" && storagePath.trim()) {
    return storagePath.trim();
  }

  return "";
};

const getCategoryDisplayName = (entry) => {
  if (entry?.isAll) return "All";
  return String(entry?.name || entry?.id || "Category");
};

const getCategoryInitial = (label) => {
  const cleaned = String(label || "").trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() : "C";
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
  const [shopCategories, setShopCategories] = useState([]);
  const [categoryImages, setCategoryImages] = useState({});

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

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "shopCategories"),
      (snap) => {
        const entries = snap.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter((entry) => entry.displayInShop !== false)
          .sort((a, b) => {
            const aOrder = Number(a.sortOrder ?? a.order ?? a.position ?? Number.MAX_SAFE_INTEGER);
            const bOrder = Number(b.sortOrder ?? b.order ?? b.position ?? Number.MAX_SAFE_INTEGER);
            if (aOrder !== bOrder) return aOrder - bOrder;
            return String(a.name || a.id || "").localeCompare(String(b.name || b.id || ""));
          });

        setShopCategories(entries);
      },
      (err) => {
        console.warn("Failed to load shopCategories:", err?.message || err);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveImages = async () => {
      const updates = {};

      for (const entry of shopCategories) {
        const key = String(entry.id || "");
        if (!key || categoryImages[key]) continue;

        const imageField = pickCategoryImageField(entry);
        if (!imageField) continue;

        if (/^https?:\/\//i.test(imageField) || imageField.startsWith("data:")) {
          updates[key] = imageField;
          continue;
        }

        try {
          const url = await getDownloadURL(storageRef(storage, imageField));
          updates[key] = url;
        } catch (err) {
          if (/^gs:\/\//i.test(imageField)) {
            try {
              const url = await getDownloadURL(storageRef(storage, imageField));
              updates[key] = url;
            } catch {
              // Ignore categories with unresolved storage references.
            }
          }
        }
      }

      if (!cancelled && Object.keys(updates).length > 0) {
        setCategoryImages((prev) => ({ ...prev, ...updates }));
      }
    };

    resolveImages();

    return () => {
      cancelled = true;
    };
  }, [shopCategories, categoryImages]);

  // Notify parent when ShopPage is loaded (for loading screen)
  useEffect(() => {
    if (!onLoaded || hasNotifiedLoadedRef.current) {
      return undefined;
    }

    if (isEmbedded && products.length > 0) {
      hasNotifiedLoadedRef.current = true;
      onLoaded();
      return undefined;
    } else if (!isEmbedded) {
      hasNotifiedLoadedRef.current = true;
      onLoaded();
    }
  }, [products.length, isEmbedded, onLoaded]);

  useEffect(() => {
    const merchantIds = [...new Set(products.map((item) => item.merchantId).filter(Boolean))];
    if (!merchantIds.length) return;

    const unsubscribes = [];

    merchantIds.forEach((merchantId) => {
      if (merchants[merchantId]) return;

      // Use onSnapshot for real-time updates of merchant data
      const unsubscribe = onSnapshot(
        doc(db, "users", merchantId),
        (snap) => {
          if (snap.exists()) {
            setMerchants((prev) => ({ ...prev, [merchantId]: { id: merchantId, ...snap.data() } }));
            return;
          }

          // Fallback to merchants collection if not found in users
          const unsubscribeMerchant = onSnapshot(
            doc(db, "merchants", merchantId),
            (merchantSnap) => {
              if (merchantSnap.exists()) {
                setMerchants((prev) => ({ ...prev, [merchantId]: { id: merchantId, ...merchantSnap.data() } }));
              }
            }
          );
          unsubscribes.push(unsubscribeMerchant);
        }
      );
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
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
    const firestoreCategories = shopCategories.map((entry) => ({
      id: String(entry.id || normalizeCategory(entry.name) || ""),
      name: String(entry.name || entry.id || "Category"),
      key: normalizeCategory(entry.name || entry.id),
      image: categoryImages[String(entry.id || "")] || pickCategoryImageField(entry) || "",
      isAll: false,
    })).filter((entry) => entry.id && entry.key);

    if (firestoreCategories.length > 0) {
      return [{ id: "all", name: "All", key: "all", image: "", isAll: true }, ...firestoreCategories];
    }

    const fallback = [...new Set(products.map((item) => normalizeCategory(item.category)).filter(Boolean))].map((key) => ({
      id: key,
      name: key,
      key,
      image: "",
      isAll: false,
    }));

    return [{ id: "all", name: "All", key: "all", image: "", isAll: true }, ...fallback];
  }, [shopCategories, categoryImages, products]);

  const visibleProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return products
      .filter((item) => {
        const categoryMatch =
          category === "all" || normalizeCategory(item.category) === normalizeCategory(category);
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
    return categories;
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

  // Auto-scroll carousel
  const [carouselIndex, setCarouselIndex] = useState(0);
  
  useEffect(() => {
    if (!isEmbedded || frequentlyBoughtProducts.length === 0) return;
    
    const interval = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % Math.max(1, frequentlyBoughtProducts.slice(0, 3).length));
    }, 4000);
    
    return () => clearInterval(interval);
  }, [isEmbedded, frequentlyBoughtProducts.length]);

  const styles = getStyles(isEmbedded);

  return (
    <main style={styles.page}>
      {/* Header with Location and Cart */}
      {isEmbedded && (
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <div style={styles.locationRow}>
              <div style={styles.locationIcon}>📍</div>
              <div style={styles.locationContent}>
                <div style={styles.deliverLabel}>DELIVER TO</div>
                <div style={styles.locationText}>
                  {(deliveryAddress || deliveryAddressCityProvince || "Set address").length > 45
                    ? (deliveryAddress || deliveryAddressCityProvince || "Set address").substring(0, 45) + "..."
                    : (deliveryAddress || deliveryAddressCityProvince || "Set address")}
                </div>
              </div>
            </div>
            <button 
              style={styles.cartIconBtn}
              onClick={() => navigate("/marketplace/cart")}
              title="Cart"
            >
              🛒
            </button>
          </div>

          {/* Search Bar */}
          <div style={styles.searchContainer}>
            <div style={styles.searchInputWrapper}>
              <span style={styles.searchIconInside}>🔍</span>
              <input
                type="text"
                placeholder="Search for groceries, snacks..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={styles.searchInputField}
              />
            </div>
          </div>
        </header>
      )}

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

      {/* Promotions Carousel - Auto-scrolling */}
      {isEmbedded && frequentlyBoughtProducts.length > 0 && (
        <section style={styles.promoCarousel}>
          <div style={styles.carouselContainer}>
            <div 
              style={{
                ...styles.carouselTrack,
                transform: `translateX(calc(-${carouselIndex * 100}% - ${carouselIndex * 16}px))`,
                transition: "transform 500ms ease-in-out",
              }}
            >
              {frequentlyBoughtProducts.slice(0, 3).map((product, idx) => (
                <div key={idx} style={styles.promoCard}>
                  <img 
                    src={product.image || "/icons/icon-192x192.png"} 
                    alt={product.name || "Promo"}
                    style={styles.promoImage}
                  />
                  <div style={styles.promoOverlay}>
                    <span style={styles.promoBadge}>{idx === 0 ? "New Deal" : "Flash Sale"}</span>
                    <h3 style={styles.promoTitle}>{product.name}</h3>
                    <p style={styles.promoPrice}>Up to 20% off</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Carousel Indicators */}
          <div style={styles.carouselIndicators}>
            {frequentlyBoughtProducts.slice(0, 3).map((_, idx) => (
              <button
                key={idx}
                type="button"
                style={{
                  ...styles.carouselDot,
                  ...(carouselIndex === idx ? styles.carouselDotActive : {}),
                }}
                onClick={() => setCarouselIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Categories Grid - Scrollable */}
      {isEmbedded && (
        <section style={styles.categoriesSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Categories</h2>
            <a style={styles.seeAllLink} onClick={() => setCategory("all")}>See all</a>
          </div>
          <div style={styles.categoriesGridScroll} className="categories-grid-scroll">
            {displayCategories.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setCategory(entry.key)}
                style={{
                  ...styles.categoryCard,
                  ...(category === entry.key ? styles.categoryCardActive : {})
                }}
              >
                <div style={{ 
                  ...styles.categoryIconBox, 
                  backgroundColor: category === entry.key 
                    ? "#fff" 
                    : getCategoryColor(entry.key),
                }}>
                  {entry.image ? (
                    <img
                      src={entry.image}
                      alt={getCategoryDisplayName(entry)}
                      style={styles.categoryImage}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span style={styles.categoryInitial}>{getCategoryInitial(getCategoryDisplayName(entry))}</span>
                  )}
                </div>
                <span style={{
                  ...styles.categoryName,
                  color: category === entry.key ? "#fff" : "#1e293b",
                }}>
                  {getCategoryDisplayName(entry)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Frequently Bought - Show Stores instead of Products */}
      {isEmbedded && (
        <section style={styles.frequentlyBoughtSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Frequently Bought</h2>
            <a style={styles.seeAllLink} href="#">View list</a>
          </div>
          <div style={styles.productsGrid}>
            {visibleStores.length === 0 ? (
              <p style={styles.empty}>No stores available yet.</p>
            ) : null}
            {visibleStores.map((store) => (
              <div key={store.id} style={styles.storeCardItem}>
                <div style={styles.storeBannerContainer}>
                  <img 
                    src={store.storeBannerImage || "/icons/icon-192x192.png"} 
                    alt={store.storeName || "Store"} 
                    style={styles.storeBannerImage}
                    onError={(e) => {
                      e.target.src = "/icons/icon-192x192.png";
                    }}
                  />
                  <button
                    type="button"
                    style={styles.favoriteBtn}
                    onClick={() => setToast({ message: "Added to favorites", type: "success" })}
                    title="Add to favorites"
                  >
                    ❤️
                  </button>
                  <div style={styles.storeLogoOverlay}>
                    <img 
                      src={store.storeLogo || store.businessLogo || "/icons/icon-192x192.png"} 
                      alt={store.storeName || "Store"}
                      style={styles.storeLogoImg}
                      onError={(e) => {
                        e.target.src = "/icons/icon-192x192.png";
                      }}
                    />
                  </div>
                </div>
                <h4 style={styles.storeCardName}>{store.storeName || store.businessName || "Store"}</h4>
                <p style={styles.storeCardCategory}>{store.city || store.address || "Address not set"}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cart Summary Bar */}
      {isEmbedded && itemCount > 0 && (
        <footer style={styles.cartBar}>
          <p style={styles.cartText}>Cart {itemCount} items - {currency(subtotal)}</p>
          <Link to="/marketplace/cart" style={styles.cartCheckout}>
            Checkout
          </Link>
        </footer>
      )}

      {/* Bottom Navigation */}
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

      {/* Toast Notification */}
      {toast.message ? (
        <div style={{ ...styles.toast, ...(toast.type === "error" ? styles.toastError : styles.toastDefault) }}>
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

// Helper function to get category colors
const getCategoryColor = (category) => {
  const colors = {
    "produce": "#dcfce7",
    "dairy": "#dbeafe",
    "bakery": "#fed7aa",
    "meat": "#fecaca",
    "food": "#fef08a",
    "drinks": "#e0e7ff",
    "beverages": "#e0e7ff",
  };
  return colors[String(category || "").toLowerCase()] || "#f1f5f9";
};

const getStyles = (isEmbedded = false) => ({
  page: {
    maxWidth: 460,
    margin: "0 auto",
    padding: isEmbedded ? "0" : "16px 16px 120px",
    fontFamily: "'Plus Jakarta Sans', Segoe UI, sans-serif",
    background: "#f8fafc",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  // CSS for hiding scrollbar
  "@media (max-width: 768px)": {
    categoriesGridScroll: {
      scrollbarWidth: "none",
      msOverflowStyle: "none",
    },
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "#fff",
    backdropFilter: "blur(12px)",
    padding: "12px 16px",
    borderBottom: "none",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  locationRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  locationIcon: {
    fontSize: 24,
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#13ec13",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  locationContent: {
    minWidth: 0,
    flex: 1,
  },
  deliverLabel: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#94a3b8",
    marginBottom: 2,
  },
  locationText: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.2,
  },
  cartIconBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#e8e8e8",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  searchContainer: {
    padding: "0",
  },
  searchInputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIconInside: {
    position: "absolute",
    left: 12,
    fontSize: 16,
    pointerEvents: "none",
    color: "#94a3b8",
  },
  searchInputField: {
    width: "100%",
    padding: "10px 12px 10px 36px",
    fontSize: 13,
    border: "none",
    borderRadius: 10,
    background: "#f1f5f9",
    color: "#1e293b",
    outline: "none",
    fontFamily: "inherit",
  },
  promoCarousel: {
    padding: "12px 0",
    marginTop: 12,
    overflow: "hidden",
  },
  carouselContainer: {
    overflow: "hidden",
    width: "100%",
  },
  carouselTrack: {
    display: "flex",
    gap: 16,
    paddingLeft: 16,
    paddingRight: 16,
    willChange: "transform",
  },
  promoCard: {
    minWidth: "calc(100vw - 32px - 16px * 2)",
    maxWidth: "100%",
    borderRadius: 16,
    overflow: "hidden",
    aspectRatio: "16/9",
    position: "relative",
    background: "#f1f5f9",
    flexShrink: 0,
  },
  promoImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  promoOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to right, rgba(0,0,0,0.6), transparent)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    padding: 16,
    color: "#fff",
  },
  promoBadge: {
    display: "inline-block",
    background: "#13ec13",
    color: "#1e293b",
    fontSize: 10,
    fontWeight: 700,
    padding: "4px 8px",
    borderRadius: 999,
    textTransform: "uppercase",
    marginBottom: 8,
    width: "fit-content",
  },
  promoTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    marginBottom: 4,
  },
  promoPrice: {
    fontSize: 12,
    margin: 0,
    opacity: 0.9,
  },
  carouselIndicators: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    padding: "12px 0",
  },
  carouselDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    border: "none",
    background: "#cbd5e1",
    cursor: "pointer",
    transition: "background-color 200ms ease, transform 200ms ease",
    padding: 0,
  },
  carouselDotActive: {
    background: "#13ec13",
    transform: "scale(1.25)",
  },
  categoriesSection: {
    padding: "12px 16px",
    marginTop: 12,
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
  seeAllLink: {
    fontSize: 13,
    fontWeight: 700,
    color: "#13ec13",
    textDecoration: "none",
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 0,
  },
  categoriesGridScroll: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: 4,
    scrollBehavior: "smooth",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  categoryCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    minWidth: "fit-content",
    flexShrink: 0,
  },
  categoryCardActive: {
    backgroundColor: "#13ec13",
    borderRadius: 16,
    padding: "8px",
  },
  categoryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    transition: "background-color 200ms ease",
    overflow: "hidden",
  },
  categoryImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  categoryInitial: {
    fontSize: 22,
    fontWeight: 700,
    color: "#334155",
  },
  categoryName: {
    fontSize: 11,
    fontWeight: 600,
    color: "#1e293b",
    transition: "color 200ms ease",
  },
  frequentlyBoughtSection: {
    padding: "16px",
    marginTop: 16,
  },
  productsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  storeCardItem: {
    background: "#f8fafc",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #e2e8f0",
  },
  storeBannerContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: "1",
    backgroundColor: "#f1f5f9",
    overflow: "hidden",
  },
  storeBannerImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  storeLogoOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "#fff",
    border: "2px solid #fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  storeLogoImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  storeCardName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
    margin: "8px 12px 4px",
    lineHeight: 1.3,
  },
  storeCardCategory: {
    fontSize: 11,
    color: "#64748b",
    margin: "0 12px 12px",
  },
  productCard: {
    background: "#f8fafc",
    borderRadius: 16,
    padding: 12,
    border: "1px solid #e2e8f0",
  },
  productImageContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: "1",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    background: "#f1f5f9",
  },
  productImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  favoriteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.85)",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(4px)",
  },
  productCategory: {
    fontSize: 11,
    color: "#64748b",
    margin: 0,
    marginBottom: 4,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
    margin: 0,
    marginBottom: 8,
    lineHeight: 1.3,
  },
  productFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 700,
    color: "#13ec13",
    margin: 0,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "#13ec13",
    color: "#1e293b",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(19, 236, 19, 0.3)",
  },
  cartBar: {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: 80,
    zIndex: 30,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    background: "#13ec13",
    color: "#1e293b",
    borderRadius: 999,
    padding: "12px 16px",
    boxShadow: "0 8px 24px rgba(19, 236, 19, 0.35)",
    fontWeight: 700,
    maxWidth: 436,
  },
  cartText: {
    margin: 0,
    fontSize: 13,
  },
  cartCheckout: {
    textDecoration: "none",
    borderRadius: 999,
    background: "#fff",
    color: "#13ec13",
    padding: "8px 16px",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  bottomNav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
    background: "#fff",
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 20,
    maxWidth: 460,
    margin: "0 auto",
  },
  navItem: {
    textDecoration: "none",
    color: "#64748b",
    fontWeight: 600,
    fontSize: 12,
  },
  navItemActive: {
    textDecoration: "none",
    color: "#13ec13",
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
    background: "#13ec13",
  },
  toastError: {
    background: "#dc2626",
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
    color: "#001f5c",
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
  empty: {
    margin: 0,
    color: "#64748b",
  },
});

