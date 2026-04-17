import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";

const currency = (value) =>
  `P${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StoreDetailsPage() {
  const { id } = useParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("cart") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });

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

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    [cart]
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0),
    [cart]
  );

  const saveCart = (next) => {
    setCart(next);
    localStorage.setItem("cart", JSON.stringify(next));
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

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Store</p>
          <h1 style={styles.heading}>{store?.storeName || store?.businessName || store?.name || "Store"}</h1>
          <p style={styles.copy}>{store?.storeDescription || store?.description || "Browse available products."}</p>
        </div>
        <Link to="/marketplace/shop" style={styles.backLink}>
          Back To Shop
        </Link>
      </header>

      <section style={styles.grid}>
        {products.length === 0 ? <p style={styles.empty}>No products available.</p> : null}
        {products.map((product) => (
          <article key={product.id} style={styles.card}>
            <div style={styles.thumbWrap}>
              <img src={product.image || "/icons/icon-192x192.png"} alt={product.name || "Product"} style={styles.thumb} />
            </div>
            <h3 style={styles.cardTitle}>{product.name || "Product"}</h3>
            <p style={styles.meta}>{product.description || "No description available"}</p>
            <p style={styles.price}>{currency(product.price)}</p>
            <button type="button" style={styles.actionBtn} onClick={() => addToCart(product)}>
              Add To Cart
            </button>
          </article>
        ))}
      </section>

      {itemCount > 0 ? (
        <footer style={styles.cartBar}>
          <p style={styles.cartText}>Cart {itemCount} items - {currency(cartTotal)}</p>
          <Link to="/marketplace/cart" style={styles.cartBtn}>
            View Cart
          </Link>
        </footer>
      ) : null}
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 1060,
    margin: "0 auto",
    padding: "24px 16px 84px",
    fontFamily: "Segoe UI, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  kicker: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#4d6a80",
    fontSize: 12,
    fontWeight: 700,
  },
  heading: {
    margin: "8px 0 6px",
    color: "#10273a",
  },
  copy: {
    margin: 0,
    color: "#4b667c",
    maxWidth: 620,
  },
  backLink: {
    textDecoration: "none",
    border: "1px solid #9ab3c1",
    borderRadius: 10,
    padding: "9px 14px",
    color: "#21485d",
    fontWeight: 700,
    background: "#fff",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 14,
  },
  card: {
    border: "1px solid #d4e0e8",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
  },
  thumbWrap: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    overflow: "hidden",
    background: "#eef3f7",
  },
  thumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  cardTitle: {
    margin: "10px 0 4px",
    color: "#153146",
    fontSize: 17,
  },
  meta: {
    margin: 0,
    color: "#4b667c",
    fontSize: 12,
    minHeight: 34,
  },
  price: {
    margin: "9px 0",
    color: "#135a44",
    fontWeight: 800,
  },
  actionBtn: {
    border: 0,
    borderRadius: 10,
    background: "#0066b3",
    color: "#fff",
    padding: "9px 12px",
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  },
  empty: {
    margin: 0,
    color: "#4d6577",
  },
  cartBar: {
    position: "fixed",
    left: 14,
    right: 14,
    bottom: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    background: "#10354b",
    color: "#fff",
    borderRadius: 999,
    padding: "11px 14px",
    boxShadow: "0 16px 30px rgba(16,53,75,0.35)",
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
    color: "#10354b",
    padding: "7px 12px",
    fontWeight: 700,
    fontSize: 12,
  },
};
