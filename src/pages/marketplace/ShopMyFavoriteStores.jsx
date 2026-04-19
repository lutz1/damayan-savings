import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { calculateCustomerDeliveryFee, calculateDistance, extractCoordinates } from "../../lib/deliveryPricing";
import "./ShopPage.css";

const normalizeCategory = (value) => String(value || "").trim().toLowerCase();

export default function ShopMyFavoriteStores() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [favoriteStoreIds, setFavoriteStoreIds] = useState([]);
  const [stores, setStores] = useState({});
  const [merchants, setMerchants] = useState({});
  const [storeDeliveryFees, setStoreDeliveryFees] = useState({});
  const [userDeliveryCoords, setUserDeliveryCoords] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "info" });

  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setUserId(user?.uid || ""));
    return () => unsubscribe();
  }, []);

  // Load favorite store IDs from Firestore
  useEffect(() => {
    if (!userId) {
      setFavoriteStoreIds([]);
      return () => {};
    }

    const unsubscribe = onSnapshot(doc(db, "users", userId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() || {};
        setFavoriteStoreIds(data.favoriteStores || []);
      } else {
        setFavoriteStoreIds([]);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Load merchant data for favorite stores
  useEffect(() => {
    if (!favoriteStoreIds.length) {
      setMerchants({});
      return () => {};
    }

    const unsubscribes = [];

    // Keep only currently favorited merchants in state to avoid stale entries.
    setMerchants((prev) => {
      const next = {};
      favoriteStoreIds.forEach((id) => {
        if (prev[id]) next[id] = prev[id];
      });
      return next;
    });

    favoriteStoreIds.forEach((merchantId) => {
      let merchantFallbackUnsub = null;

      const unsubscribeUser = onSnapshot(doc(db, "users", merchantId), (snap) => {
        if (snap.exists()) {
          setMerchants((prev) => ({ ...prev, [merchantId]: { id: merchantId, ...snap.data() } }));
          if (merchantFallbackUnsub) {
            merchantFallbackUnsub();
            merchantFallbackUnsub = null;
          }
          return;
        }

        if (!merchantFallbackUnsub) {
          merchantFallbackUnsub = onSnapshot(doc(db, "merchants", merchantId), (merchantSnap) => {
            if (merchantSnap.exists()) {
              setMerchants((prev) => ({ ...prev, [merchantId]: { id: merchantId, ...merchantSnap.data() } }));
            }
          });
        }
      });

      unsubscribes.push(() => {
        unsubscribeUser();
        if (merchantFallbackUnsub) merchantFallbackUnsub();
      });
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [favoriteStoreIds]);

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

  // Get visible favorite stores
  const visibleStores = useMemo(() => {
    return favoriteStoreIds
      .map((id) => merchants[id])
      .filter(Boolean)
      .slice(0, 8);
  }, [favoriteStoreIds, merchants]);

  // Calculate delivery fees for each store
  useEffect(() => {
    if (!visibleStores.length) {
      setStoreDeliveryFees({});
      return;
    }

    if (!userDeliveryCoords) {
      const defaultFees = {};
      visibleStores.forEach((store) => {
        defaultFees[store.id] = calculateCustomerDeliveryFee(3.5);
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

  const handleRemoveFavorite = async (storeId) => {
    if (!userId) return;

    try {
      const userRef = doc(db, "users", userId);
      const updatedFavorites = favoriteStoreIds.filter((id) => id !== storeId);
      await updateDoc(userRef, { favoriteStores: updatedFavorites });
      setToast({ message: "Removed from My Favorite", type: "success" });
    } catch (error) {
      console.error("Error removing favorite:", error);
      setToast({ message: "Error removing favorite", type: "error" });
    }
  };

  useEffect(() => {
    if (!toast.message) return;
    const timeout = window.setTimeout(() => setToast({ message: "", type: "info" }), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <div
      className="favorites-page"
      style={{
        paddingBottom: "80px",
        animation: "slideInFromRight 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px", backgroundColor: "#1e67da", color: "white", marginBottom: "16px" }}>
        <button
          onClick={() => navigate("/marketplace/shop")}
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
            fontSize: "20px",
            marginRight: "12px",
          }}
        >
          ← Back
        </button>
        <h1 style={{ margin: "8px 0", fontSize: "24px", fontWeight: 600 }}>My Favorite Stores</h1>
      </div>

      {/* Favorites List */}
      {visibleStores.length > 0 ? (
        <section className="nearby-stores-section" style={{ padding: "16px" }}>
          <div className="stores-list">
            {visibleStores.map((store) => {
              const isFavorite = favoriteStoreIds.includes(store.id);
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
                        src={store.storeBannerImage || store.storeBanner || "/icons/icon-192x192.png"} 
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
                          handleRemoveFavorite(store.id);
                        }}
                        title="Remove from favorites"
                        style={{ color: "#e74c3c" }}
                      >
                        ❤️
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

                  {/* Store Info */}
                  <div className="store-card-content-outside">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <h4 className="store-card-name" style={{ flex: 1 }}>{store.storeName || store.businessName || "Store"}</h4>
                      <span className="rating-badge" style={{ whiteSpace: "nowrap", marginLeft: "12px" }}>
                        ⭐ {store.rating || 4.8} {store.reviewCount ? `(${store.reviewCount})` : "(1k+)"}
                      </span>
                    </div>

                    {/* Store Description */}
                    <p style={{ fontSize: "14px", color: "#666", marginBottom: "12px", lineHeight: "1.4" }}>
                      {store.storeDescription || store.description || "Delivering quality products and excellent service to your doorstep."}
                    </p>

                    {/* Categories */}
                    <div className="categories-list">
                      {(store.category ? store.category.split(",").map((c) => c.trim()) : store.categories || ["Restaurant", "Food"]).slice(0, 2).map((cat, idx) => (
                        <span key={idx} className="category-tag">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div style={{ padding: "32px 16px", textAlign: "center", color: "#999" }}>
          <p style={{ fontSize: "18px", marginBottom: "16px" }}>No favorite stores yet</p>
          <button
            onClick={() => navigate("/marketplace/shop")}
            style={{
              padding: "12px 24px",
              backgroundColor: "#1e67da",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            Browse Stores
          </button>
        </div>
      )}

      {/* Toast */}
      {toast.message && (
        <div
          style={{
            position: "fixed",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: toast.type === "success" ? "#4caf50" : "#f44336",
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            zIndex: 1000,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
