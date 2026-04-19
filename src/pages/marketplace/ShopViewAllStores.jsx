import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { calculateDistance, extractCoordinates } from "../../lib/deliveryPricing";
import "./ShopPage.css";

const normalizeText = (value) => String(value || "").trim().toLowerCase();

export default function ShopViewAllStores() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [products, setProducts] = useState([]);
  const [merchants, setMerchants] = useState({});
  const [favoriteStores, setFavoriteStores] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("cuisine");
  const [userDeliveryCoords, setUserDeliveryCoords] = useState(null);

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

  useEffect(() => {
    const merchantIds = [...new Set(products.map((item) => item.merchantId).filter(Boolean))];
    if (!merchantIds.length) {
      setMerchants({});
      return () => {};
    }

    const unsubscribes = [];

    merchantIds.forEach((merchantId) => {
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
  }, [products]);

  useEffect(() => {
    const coordsStr = localStorage.getItem("selectedDeliveryCoordinates");
    if (!coordsStr) return;

    try {
      setUserDeliveryCoords(JSON.parse(coordsStr));
    } catch {
      setUserDeliveryCoords(null);
    }
  }, []);

  const stores = useMemo(() => {
    const ids = [...new Set(products.map((item) => item.merchantId).filter(Boolean))];
    const searchTerm = normalizeText(search);

    const entries = ids
      .map((id) => merchants[id])
      .filter(Boolean)
      .filter((store) => {
        if (!searchTerm) return true;
        return (
          normalizeText(store.storeName || store.businessName).includes(searchTerm) ||
          normalizeText(store.storeDescription || store.description).includes(searchTerm) ||
          normalizeText(store.category).includes(searchTerm)
        );
      });

    if (activeFilter === "ratings") {
      entries.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    } else if (activeFilter === "recommended") {
      entries.sort((a, b) => Number(b.reviewCount || 0) - Number(a.reviewCount || 0));
    }

    return entries;
  }, [products, merchants, search, activeFilter]);

  const handleToggleFavoriteStore = async (storeId) => {
    if (!userId) return;

    try {
      const isFavorite = favoriteStores.includes(storeId);
      const updatedFavorites = isFavorite
        ? favoriteStores.filter((id) => id !== storeId)
        : [...favoriteStores, storeId];

      await updateDoc(doc(db, "users", userId), { favoriteStores: updatedFavorites });
    } catch (error) {
      console.error("Error updating favorites:", error);
    }
  };

  const getDistanceLabel = (store) => {
    if (!userDeliveryCoords) return "1.2 km";

    const storeCoords = extractCoordinates(store);
    if (!storeCoords) return "1.2 km";

    try {
      const distance = calculateDistance(
        userDeliveryCoords.lat,
        userDeliveryCoords.lng,
        storeCoords.lat,
        storeCoords.lng
      );
      if (!Number.isFinite(distance) || distance <= 0) return "1.2 km";
      return `${distance.toFixed(1)} km`;
    } catch {
      return "1.2 km";
    }
  };

  return (
    <main className="view-all-stores-page">
      <header className="view-all-stores-header">
        <div className="view-all-header-top">
          <button type="button" className="view-all-back" onClick={() => navigate("/marketplace/shop")}>
            ← Back
          </button>
          <h1 className="view-all-title">Popular Stores</h1>
        </div>
        <div className="view-all-search-wrap">
          <input
            type="text"
            className="view-all-search"
            placeholder="Search brands or cuisines..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </header>

      <div className="view-all-filters" role="tablist" aria-label="Store sorting">
        <button
          type="button"
          className={`view-all-chip ${activeFilter === "cuisine" ? "active" : ""}`}
          onClick={() => setActiveFilter("cuisine")}
        >
          Cuisine Type
        </button>
        <button
          type="button"
          className={`view-all-chip ${activeFilter === "ratings" ? "active" : ""}`}
          onClick={() => setActiveFilter("ratings")}
        >
          Ratings
        </button>
        <button
          type="button"
          className={`view-all-chip ${activeFilter === "recommended" ? "active" : ""}`}
          onClick={() => setActiveFilter("recommended")}
        >
          Recommended
        </button>
      </div>

      <section className="view-all-store-list">
        {stores.map((store) => {
          const isFavorite = favoriteStores.includes(store.id);
          return (
            <article key={store.id} className="store-card-wrapper view-all-store-wrapper">
              <div
                className="store-card-item"
                onClick={() => navigate(`/marketplace/store/${store.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    navigate(`/marketplace/store/${store.id}`);
                  }
                }}
              >
                <div className="store-banner-container">
                  <img
                    className="store-banner-image"
                    src={store.storeBannerImage || store.storeBanner || "/icons/icon-192x192.png"}
                    alt={store.storeName || store.businessName || "Store"}
                    onError={(event) => {
                      event.currentTarget.src = "/icons/icon-192x192.png";
                    }}
                  />

                  <button
                    type="button"
                    className="favoriteBtn"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggleFavoriteStore(store.id);
                    }}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    style={{ color: isFavorite ? "#e74c3c" : "#fff" }}
                  >
                    {isFavorite ? "❤️" : "🤍"}
                  </button>

                  <div className="store-logo-overlay">
                    <img
                      src={store.storeLogo || store.businessLogo || "/icons/icon-192x192.png"}
                      alt={store.storeName || "Store"}
                      className="store-logo-img"
                      onError={(event) => {
                        event.currentTarget.src = "/icons/icon-192x192.png";
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="store-card-content-outside view-all-content">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <h4 className="store-card-name" style={{ flex: 1 }}>{store.storeName || store.businessName || "Store"}</h4>
                  <span className="rating-badge" style={{ whiteSpace: "nowrap", marginLeft: "12px" }}>
                    ⭐ {Number(store.rating || 4.8).toFixed(1)}
                  </span>
                </div>

                <p className="view-all-description">
                  {store.storeDescription || store.description || "Quality products and fast delivery."}
                </p>

                <div className="view-all-meta">
                  <span>📍 {getDistanceLabel(store)}</span>
                  <span>⏱️ {store.preparationTime || "20-30 min"}</span>
                </div>

                <div className="categories-list">
                  {(store.category ? store.category.split(",").map((c) => c.trim()) : store.categories || ["Restaurant", "Food"])
                    .slice(0, 2)
                    .map((cat, idx) => (
                      <span key={idx} className="category-tag">
                        {cat}
                      </span>
                    ))}
                </div>
              </div>
            </article>
          );
        })}

        {stores.length === 0 ? <p className="view-all-empty">No stores found.</p> : null}
      </section>
    </main>
  );
}
