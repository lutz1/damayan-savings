import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../../firebase";

const currency = (value) =>
  `P${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StoreDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const [userId, setUserId] = useState("");
  const [favoriteStores, setFavoriteStores] = useState([]);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("cart") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setUserId(user?.uid || ""));
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
    const loadStore = async () => {
      const userSnap = await getDoc(doc(db, "users", id));
      if (userSnap.exists()) {
        setStore({ id, ...userSnap.data() });
        return;
      }
      const merchantSnap = await getDoc(doc(db, "merchants", id));
      if (merchantSnap.exists()) {
        setStore({ id, ...merchantSnap.data() });
      }
    };
    loadStore().catch((error) => console.error("Failed to load store", error));
  }, [id]);

  useEffect(() => {
    if (!id) return () => {};

    const productsQuery = query(
      collection(db, "products"),
      where("merchantId", "==", id),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(productsQuery, (snap) => {
      const list = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      setProducts(list);
    });

    return () => unsubscribe();
  }, [id]);

  // Filter cart to only show items from current store
  const storeCart = useMemo(
    () => cart.filter((item) => item.merchantId === id),
    [cart, id]
  );

  const itemCount = useMemo(
    () => storeCart.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    [storeCart]
  );

  const saveCart = (next) => {
    setCart(next);
    localStorage.setItem("cart", JSON.stringify(next));
  };

  const addToCart = (product) => {
    // Check if cart has items from a different store
    const cartMerchantIds = new Set(cart.map((item) => item.merchantId).filter(Boolean));
    
    // If cart has items from a different store, replace the entire cart
    if (cartMerchantIds.size > 0 && !cartMerchantIds.has(id)) {
      // Silent replace - clear and add new item
      const next = [
        {
          id: product.id,
          merchantId: id,
          name: product.name || "Product",
          image: product.image || "",
          price: Number(product.price || 0),
          qty: 1,
        },
      ];
      saveCart(next);
      return;
    }

    const existing = cart.find((item) => item.id === product.id);
    let next;
    if (existing) {
      next = cart.map((item) => (item.id === product.id ? { ...item, qty: Number(item.qty || 0) + 1 } : item));
    } else {
      next = [
        ...cart,
        {
          id: product.id,
          merchantId: id,
          name: product.name || "Product",
          image: product.image || "",
          price: Number(product.price || 0),
          qty: 1,
        },
      ];
    }
    saveCart(next);
  };

  const getProductQty = (productId) => {
    const item = storeCart.find((entry) => entry.id === productId);
    return Number(item?.qty || 0);
  };

  const changeCartQty = (product, delta) => {
    const current = getProductQty(product.id);
    const nextQty = Math.max(0, current + delta);

    if (nextQty === 0) {
      const next = cart.filter((entry) => entry.id !== product.id);
      saveCart(next);
      return;
    }

    const exists = cart.some((entry) => entry.id === product.id);
    const next = exists
      ? cart.map((entry) => (entry.id === product.id ? { ...entry, qty: nextQty } : entry))
      : [
          ...cart,
          {
            id: product.id,
            merchantId: id,
            name: product.name || "Product",
            image: product.image || "",
            price: Number(product.price || 0),
            qty: nextQty,
          },
        ];

    saveCart(next);
  };

  const handleToggleFavoriteStore = async () => {
    if (!userId || !id) return;

    try {
      const isFavorite = favoriteStores.includes(id);
      const updatedFavorites = isFavorite
        ? favoriteStores.filter((entry) => entry !== id)
        : [...favoriteStores, id];

      await updateDoc(doc(db, "users", userId), { favoriteStores: updatedFavorites });
    } catch (error) {
      console.error("Error updating favorites:", error);
    }
  };

  const categories = useMemo(() => {
    const list = [...new Set(products.map((item) => String(item.category || "").trim()).filter(Boolean))];
    return ["All Products", ...list];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch =
        activeCategory === "all" ||
        String(product.category || "").trim().toLowerCase() === activeCategory;
      if (!categoryMatch) return false;
      if (!q) return true;

      return (
        String(product.name || "").toLowerCase().includes(q) ||
        String(product.description || "").toLowerCase().includes(q) ||
        String(product.category || "").toLowerCase().includes(q)
      );
    });
  }, [products, search, activeCategory]);

  const storeName = store?.storeName || store?.businessName || store?.name || "Store";
  const storeDescription = store?.storeDescription || store?.description || "Locally sourced products delivered fresh.";
  const bannerImage = store?.storeBannerImage || store?.storeBanner || "/icons/icon-192x192.png";
  const storeLogo = store?.storeLogo || store?.businessLogo || "/icons/icon-192x192.png";
  const rating = Number(store?.rating || 4.9).toFixed(1);
  const distance = store?.distanceKm ? `${Number(store.distanceKm).toFixed(1)}km away` : "12km away";
  const prepTime = store?.preparationTime || "20-30 min";
  const isStoreFavorite = favoriteStores.includes(id);

  return (
    <main style={styles.page}>
      <header style={styles.topBar}>
        <button type="button" onClick={() => navigate("/marketplace/shop")} style={styles.iconButton}>
          ←
        </button>
        <h1 style={styles.topTitle}>{storeName}</h1>
        <div style={styles.topActions}>
          <button
            type="button"
            style={styles.iconButton}
            onClick={() => searchInputRef.current?.focus()}
            title="Search products"
          >
            ⌕
          </button>
        </div>
      </header>

      <section style={styles.heroWrap}>
        <img src={bannerImage} alt={storeName} style={styles.heroImage} />
      </section>

      <section style={styles.storeInfoCard}>
        <div style={styles.storeTopRow}>
          <div style={styles.logoWrap}>
            <img src={storeLogo} alt={storeName} style={styles.logoImage} />
          </div>
          <button
            type="button"
            style={{ ...styles.followBtn, ...(isStoreFavorite ? styles.followBtnActive : null) }}
            onClick={handleToggleFavoriteStore}
          >
            {isStoreFavorite ? "Added to Favorites" : "Add to Favorites"}
          </button>
        </div>

        <h2 style={styles.storeHeading}>{storeName}</h2>
        <div style={styles.storeMetaRow}>
          <span>⭐ {rating}</span>
          <span>•</span>
          <span>📍 {distance}</span>
          <span>•</span>
          <span>⏱️ {prepTime}</span>
        </div>
        <p style={styles.storeCopy}>{storeDescription}</p>
      </section>

      <section style={styles.categoryTabsWrap}>
        <div style={styles.searchRow}>
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products..."
            style={styles.searchInput}
          />
        </div>
        <div style={styles.categoryTabsScroll}>
          {categories.map((cat) => {
            const key = cat === "All Products" ? "all" : cat.toLowerCase();
            const active = activeCategory === key;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(key)}
                style={{ ...styles.tabBtn, ...(active ? styles.tabBtnActive : null) }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      <div style={styles.productsHeader}>
        <h3 style={styles.productsTitle}>Our Products</h3>
        <button type="button" style={styles.sortBtn}>Sort ≡</button>
      </div>

      <section style={styles.grid}>
        {filteredProducts.length === 0 ? <p style={styles.empty}>No products available.</p> : null}
        {filteredProducts.map((product) => (
          <article key={product.id} style={styles.card}>
            <div style={styles.thumbWrap}>
              <img src={product.image || "/icons/icon-192x192.png"} alt={product.name || "Product"} style={styles.thumb} />
              <button type="button" style={styles.productHeart}>♡</button>
            </div>
            <p style={styles.productTag}>{String(product.category || "Fresh").toUpperCase()}</p>
            <h3 style={styles.cardTitle}>{product.name || "Product"}</h3>
            <p style={styles.price}>{currency(product.price)}</p>
            {getProductQty(product.id) > 0 ? (
              <div style={styles.qtyControls}>
                <button
                  type="button"
                  style={styles.qtyBtn}
                  onClick={() => changeCartQty(product, -1)}
                  title="Decrease quantity"
                >
                  -
                </button>
                <span style={styles.qtyValue}>{getProductQty(product.id)}</span>
                <button
                  type="button"
                  style={styles.qtyBtn}
                  onClick={() => changeCartQty(product, 1)}
                  title="Increase quantity"
                >
                  +
                </button>
              </div>
            ) : (
              <button type="button" style={styles.actionBtn} onClick={() => addToCart(product)} title="Add to cart">
                +
              </button>
            )}
          </article>
        ))}
      </section>

      {itemCount > 0 ? (
        <footer style={styles.cartFloatingWrap}>
          <Link to="/marketplace/cart" style={styles.cartBubble}>
            🛍
            <span style={styles.cartBadge}>{itemCount}</span>
          </Link>
        </footer>
      ) : null}

    </main>
  );
}

const styles = {
  page: {
    maxWidth: 460,
    margin: "0 auto",
    padding: "0 0 86px",
    fontFamily: "'Plus Jakarta Sans', Segoe UI, sans-serif",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  topBar: {
    height: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 40,
  },
  topTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: "#1e293b",
  },
  topActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 28,
    height: 28,
    border: "none",
    borderRadius: 999,
    background: "transparent",
    color: "#334155",
    fontSize: 18,
    cursor: "pointer",
  },
  heroWrap: {
    height: 168,
    background: "#e2e8f0",
    overflow: "hidden",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  storeInfoCard: {
    margin: "-28px 12px 10px",
    background: "#ffffff",
    borderRadius: 14,
    padding: 12,
    boxShadow: "0 10px 20px rgba(15, 23, 42, 0.12)",
    position: "relative",
    zIndex: 3,
  },
  storeTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: "hidden",
    background: "#eef2f7",
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  followBtn: {
    border: "none",
    borderRadius: 999,
    background: "#1e67da",
    color: "#ffffff",
    padding: "8px 16px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  followBtnActive: {
    background: "#1357c4",
  },
  storeHeading: {
    margin: "0 0 4px",
    fontSize: 34,
    fontWeight: 700,
    lineHeight: 1.1,
    color: "#334155",
  },
  storeMetaRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: 600,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  storeCopy: {
    margin: 0,
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
  },
  categoryTabsWrap: {
    padding: "0 12px",
    marginBottom: 10,
  },
  searchRow: {
    marginBottom: 8,
  },
  searchInput: {
    width: "100%",
    border: "none",
    borderRadius: 10,
    background: "#ffffff",
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.08)",
    color: "#334155",
    fontSize: 13,
    padding: "10px 12px",
    outline: "none",
  },
  categoryTabsScroll: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 2,
  },
  tabBtn: {
    border: "none",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#64748b",
    padding: "7px 12px",
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "#1e67da",
    color: "#ffffff",
  },
  productsHeader: {
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  productsTitle: {
    margin: 0,
    fontSize: 30,
    fontWeight: 700,
    color: "#334155",
  },
  sortBtn: {
    border: "none",
    background: "transparent",
    color: "#1e67da",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    padding: "0 12px",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 8,
    background: "#fff",
    position: "relative",
  },
  thumbWrap: {
    width: "100%",
    height: 108,
    borderRadius: 10,
    overflow: "hidden",
    background: "#f1f5f9",
    position: "relative",
  },
  thumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  productHeart: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "none",
    background: "rgba(255,255,255,0.9)",
    fontSize: 12,
    color: "#64748b",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  productTag: {
    margin: "8px 0 4px",
    color: "#16a34a",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  cardTitle: {
    margin: "0 0 6px",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  price: {
    margin: "0 0 2px",
    color: "#0f172a",
    fontWeight: 700,
    fontSize: 28,
  },
  actionBtn: {
    border: 0,
    borderRadius: 8,
    background: "#1e67da",
    color: "#fff",
    width: 26,
    height: 26,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 20,
    lineHeight: 1,
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyControls: {
    marginLeft: "auto",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#f1f5f9",
    border: "1px solid #dbe4ef",
    borderRadius: 999,
    padding: "2px 6px",
  },
  qtyBtn: {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "none",
    background: "#1e67da",
    color: "#fff",
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
    fontSize: 12,
    fontWeight: 700,
    color: "#1e293b",
  },
  empty: {
    margin: "8px 0",
    color: "#4d6577",
    gridColumn: "1 / -1",
    textAlign: "center",
  },
  cartFloatingWrap: {
    position: "fixed",
    right: 12,
    bottom: 14,
    zIndex: 50,
  },
  cartBubble: {
    textDecoration: "none",
    width: 44,
    height: 44,
    borderRadius: 999,
    background: "#1e67da",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.3)",
    fontSize: 18,
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    background: "#ef4444",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  },
};
