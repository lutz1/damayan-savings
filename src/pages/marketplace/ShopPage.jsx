import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import { collection, doc, getDoc, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "../../firebase";
import { cartCount, cartSubtotal, readCart, saveCart } from "./lib/cartStorage";
import { calculateCustomerDeliveryFee, calculateDistance, extractCoordinates } from "../../lib/deliveryPricing";
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
  const [favoriteStores, setFavoriteStores] = useState([]);
  const [storeDeliveryFees, setStoreDeliveryFees] = useState({}); // Store ID -> delivery fee
  const [userDeliveryCoords, setUserDeliveryCoords] = useState(null);

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

    if (products.length > 0) {
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

  // Load favorite stores from Firestore
  useEffect(() => {
    if (!userId) {
      setFavoriteStores([]);
      return () => {};
    }

    const unsubscribe = onSnapshot(doc(db, "users", userId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() || {};
        setFavoriteStores(data.favoriteStores || []);
      } else {
        setFavoriteStores([]);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Load user delivery coordinates
  useEffect(() => {
    const coordsStr = localStorage.getItem("selectedDeliveryCoordinates");
    if (coordsStr) {
      try {
        setUserDeliveryCoords(JSON.parse(coordsStr));
      } catch (error) {
        console.error("Error parsing delivery coordinates:", error);
        setUserDeliveryCoords(null);
      }
    }
  }, []);

  const categories = useMemo(() => {
    const firestoreCategories = shopCategories.map((entry) => ({
      id: String(entry.id || normalizeCategory(entry.name) || ""),
      name: String(entry.name || entry.id || "Category"),
      key: normalizeCategory(entry.name || entry.id),
      image: categoryImages[String(entry.id || "")] || pickCategoryImageField(entry) || "",
      isAll: false,
    })).filter((entry) => entry.id && entry.key);

    if (firestoreCategories.length > 0) {
      return firestoreCategories;
    }

    const fallback = [...new Set(products.map((item) => normalizeCategory(item.category)).filter(Boolean))].map((key) => ({
      id: key,
      name: key,
      key,
      image: "",
      isAll: false,
    }));

    return fallback;
  }, [shopCategories, categoryImages, products]);

  const visibleProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return products
      .filter((item) => {
        const categoryMatch =
          !category || category === "all" || normalizeCategory(item.category) === normalizeCategory(category);
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

  // Calculate delivery fees for each visible store
  useEffect(() => {
    if (!visibleStores.length) {
      setStoreDeliveryFees({});
      return;
    }

    if (!userDeliveryCoords) {
      // Use default delivery fees if no coordinates
      const defaultFees = {};
      visibleStores.forEach(store => {
        defaultFees[store.id] = calculateCustomerDeliveryFee(3.5); // Default 3.5 km
      });
      setStoreDeliveryFees(defaultFees);
      return;
    }

    const calculateFees = async () => {
      const fees = {};

      for (const store of visibleStores) {
        try {
          const storeCoords = extractCoordinates(store);
          
          if (storeCoords) {
            const distance = calculateDistance(
              userDeliveryCoords.lat,
              userDeliveryCoords.lng,
              storeCoords.lat,
              storeCoords.lng
            );
            fees[store.id] = calculateCustomerDeliveryFee(distance);
          } else {
            // Fallback to default
            fees[store.id] = calculateCustomerDeliveryFee(3.5);
          }
        } catch (error) {
          console.error(`Error calculating fee for store ${store.id}:`, error);
          fees[store.id] = calculateCustomerDeliveryFee(3.5);
        }
      }

      setStoreDeliveryFees(fees);
    };

    calculateFees();
  }, [userDeliveryCoords, visibleStores]);

  const frequentlyBoughtProducts = useMemo(() => {
    // Show promotional products regardless of category filter
    return products.slice(0, 8);
  }, [products]);

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

  const handleLocationClick = (addressData) => {
    if (addressData?.address) {
      setDeliveryAddress(addressData.address);
      if (addressData.cityProvince) {
        setDeliveryAddressCityProvince(addressData.cityProvince);
      }
    }
  };

  const handleBackClick = () => {
    navigate("/");
  };

  const handleToggleFavoriteStore = async (storeId) => {
    if (!userId) return;
    
    try {
      const isFavorite = favoriteStores.includes(storeId);
      const updatedFavorites = isFavorite
        ? favoriteStores.filter(id => id !== storeId)
        : [...favoriteStores, storeId];
      
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { favoriteStores: updatedFavorites });
      
      setToast({
        message: isFavorite ? "Removed from My Favorite" : "Added to My Favorite",
        type: "success"
      });
    } catch (error) {
      console.error("Error updating favorites:", error);
      setToast({
        message: "Error updating favorites",
        type: "error"
      });
    }
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

  return (
    <main className="shop-page" style={{ paddingTop: "140px" }}>
      {/* ShopTopNav Component - Unified Header with Location & Search */}
      <ShopTopNav
        search={search}
        onSearchChange={(event) => setSearch(event.target.value)}
        headerHidden={false}
        locationText="Deliver to"
        locationSubtext={deliveryAddressCityProvince || deliveryAddress || "Set address"}
        adHidden={false}
        onLocationClick={handleLocationClick}
        onBackClick={handleBackClick}
        cartCount={itemCount}
        onCartClick={() => navigate("/marketplace/cart")}
        favoriteStores={favoriteStores}
      />

      {/* Promotions Carousel - Advertisements Display */}
      {frequentlyBoughtProducts.length > 0 && (
        <section className="promo-carousel" style={{ position: "relative" }}>
          <div className="carousel-container">
            <div 
              className="carousel-track"
              style={{
                transform: `translateX(calc(-${carouselIndex * 100}% - ${carouselIndex * 16}px))`,
                transition: "transform 500ms ease-in-out",
              }}
            >
              {frequentlyBoughtProducts.slice(0, 3).map((product, idx) => (
                <div key={idx} className="promo-card">
                  <img 
                    src={product.image || "/icons/icon-192x192.png"} 
                    alt={product.name || "Promo"}
                    className="promo-image"
                  />
                  <div className="promo-overlay">
                    <span className="promo-badge">{idx === 0 ? "New Deal" : "Flash Sale"}</span>
                    <h3 className="promo-title">{product.name}</h3>
                    <p className="promo-price">Up to 20% off</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Carousel Indicators */}
          <div className="carousel-indicators">
            {frequentlyBoughtProducts.slice(0, 3).map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`carousel-dot ${carouselIndex === idx ? 'carousel-dot-active' : ''}`}
                onClick={() => setCarouselIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Categories Grid - Scrollable */}
      {displayCategories && displayCategories.length > 0 ? (
        <section className="categories-section">
          <div className="categories-grid-scroll">
            {displayCategories.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  // Toggle: if already selected, deselect and show all; otherwise select it
                  setCategory(category === entry.key ? "all" : entry.key);
                }}
                className={`category-card ${!entry.isAll && category === entry.key ? "category-card-active" : ""}`}
              >
                <div 
                  className="category-icon-box"
                  style={{ 
                    backgroundColor: getCategoryColor(entry.key),
                  }}
                >
                  {entry.image ? (
                    <img
                      src={entry.image}
                      alt={getCategoryDisplayName(entry)}
                      className="category-image"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="category-initial">{getCategoryInitial(getCategoryDisplayName(entry))}</span>
                  )}
                </div>
                <span
                  className={`category-name ${!entry.isAll && category === entry.key ? "category-name-active" : ""}`}
                  style={{
                    color: "#1e293b",
                  }}
                >
                  {getCategoryDisplayName(entry)}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Frequently Bought - Show Stores instead of Products */}
      {visibleStores.length > 0 && (
        <section className="frequently-bought-section">
          <div className="section-header">
            <h2 className="section-title">Popular Stores</h2>
            <a className="see-all-link" href="#">View all</a>
          </div>
          <div className="products-grid-vertical">
            {visibleStores.length === 0 ? (
              <p className="empty">No stores available yet.</p>
            ) : null}
            {visibleStores.map((store) => {
              const isFavorite = favoriteStores.includes(store.id);

              return (
                <div key={store.id} className="store-card-wrapper">
                  <div 
                    className="store-card-item"
                    onClick={() => navigate(`/marketplace/store/${store.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        navigate(`/marketplace/store/${store.id}`);
                      }
                    }}
                  >
                    <div className="store-banner-container">
                      <img 
                        src={store.storeBannerImage || "/icons/icon-192x192.png"} 
                        alt={store.storeName || "Store"} 
                        className="store-banner-image"
                        onError={(e) => {
                          e.target.src = "/icons/icon-192x192.png";
                        }}
                      />
                      
                      {/* Badges */}
                      <div className="badges-container">
                        {store.isPopular && <span className="popular-badge">POPULAR</span>}
                        {store.hasPromo && <span className="promo-badge-large">PROMO</span>}
                      </div>

                      {/* Favorite Button */}
                      <button
                        type="button"
                        className="favoriteBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavoriteStore(store.id);
                        }}
                        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        style={{ color: isFavorite ? "#e74c3c" : "#fff" }}
                      >
                        {isFavorite ? "❤️" : "🤍"}
                      </button>

                      {/* Store Logo */}
                      <div className="store-logo-overlay">
                        <img 
                          src={store.storeLogo || store.businessLogo || "/icons/icon-192x192.png"} 
                          alt={store.storeName || "Store"}
                          className="store-logo-img"
                          onError={(e) => {
                            e.target.src = "/icons/icon-192x192.png";
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Store Info - Outside Card */}
                  <div className="store-card-content-outside">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <h4 className="store-card-name" style={{ flex: 1 }}>{store.storeName || store.businessName || "Store"}</h4>
                      <span className="rating-badge" style={{ whiteSpace: "nowrap", marginLeft: "12px" }}>
                        ⭐ {store.rating || 4.8} {store.reviewCount ? `(${store.reviewCount})` : "(1k+)"}
                      </span>
                    </div>
                    {/* Preparation Time & Delivery Fee (stacked left) */}
                    <div className="store-info-row" style={{ display: "block", marginBottom: "4px" }}>
                      <span className="delivery-time" style={{ display: "block" }}>⏱️ {store.preparationTime || "20-30 min"}</span>
                      <span className="delivery-fee" style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#1e67da", marginTop: "2px" }}>
                        🚚 Delivery: ₱50+
                      </span>
                    </div>
                    {/* Categories */}
                    <div className="categories-list">
                      {(store.category ? store.category.split(",").map(c => c.trim()) : store.categories || ["Restaurant", "Food"]).slice(0, 2).map((cat, idx) => (
                        <span key={idx} className="category-tag">{cat}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Most Bought Products Section */}
      {visibleProducts.length > 0 && (
        <section className="frequently-bought-products-section">
          <div className="section-header">
            <h2 className="section-title">Most Bought Products</h2>
            <a className="see-all-link" href="#">View all</a>
          </div>
          <div className="products-grid-2col">
            {visibleProducts.slice(0, 6).map((product) => (
              <div key={product.id} className="product-card">
                <div className="product-image-wrapper">
                  <img 
                    src={product.image || "/icons/icon-192x192.png"} 
                    alt={product.name || "Product"} 
                    className="product-image"
                    onError={(e) => {
                      e.target.src = "/icons/icon-192x192.png";
                    }}
                  />
                  <button
                    type="button"
                    className="favorite-btn-small"
                    onClick={() => setToast({ message: "Added to favorites", type: "success" })}
                    title="Add to favorites"
                  >
                    ❤️
                  </button>
                </div>
                <div className="product-info">
                  <p className="product-category">{product.category || "Product"}</p>
                  <h4 className="product-name">{product.name || "Product"}</h4>
                  <div className="product-footer-info">
                    <span className="product-price">{currency(product.price || 0)}</span>
                    <button
                      type="button"
                      className="add-to-cart-btn"
                      onClick={() => addToCart(product)}
                      title="Add to cart"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cart Summary Bar */}
      {itemCount > 0 && (
        <footer className="cart-bar">
          <p className="cart-text">Cart {itemCount} items - {currency(subtotal)}</p>
          <Link to="/marketplace/cart" className="cart-checkout">
            Checkout
          </Link>
        </footer>
      )}

      {/* Bottom Navigation */}
      <ShopBottomNav value={activeShopTab} onChange={handleShopTabChange} cartCount={itemCount} />

      {/* Toast Notification */}
      {toast.message ? (
        <div className={`toast ${toast.type === "error" ? 'toast-error' : 'toast-default'}`}>
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

