import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function ShopPage() {
  const [merchants, setMerchants] = useState([]);

  useEffect(() => {
    const merchantQuery = query(
      collection(db, "users"),
      where("role", "==", "MERCHANT"),
      orderBy("username", "asc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(merchantQuery, (snap) => {
      setMerchants(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    });

    return () => unsubscribe();
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.topRow}>
        <div>
          <p style={styles.eyebrow}>Shop</p>
          <h1 style={styles.heading}>Browse Merchants</h1>
        </div>
        <Link to="/dashboard" style={styles.backLink}>
          Back To Dashboard
        </Link>
      </div>

      <section style={styles.grid}>
        {merchants.length === 0 ? <p style={styles.empty}>No merchants found yet.</p> : null}

        {merchants.map((merchant) => (
          <article key={merchant.id} style={styles.card}>
            <h3 style={styles.cardTitle}>{merchant.storeName || merchant.username || "Merchant"}</h3>
            <p style={styles.meta}>Role: {merchant.role || "MERCHANT"}</p>
            <p style={styles.meta}>Address: {merchant.address || "No address yet"}</p>
            <button type="button" style={styles.actionBtn}>
              Create Order
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 1060,
    margin: "0 auto",
    padding: "24px 16px 40px",
    fontFamily: "Segoe UI, sans-serif",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  eyebrow: {
    margin: 0,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontSize: 12,
    color: "#4d6a80",
    fontWeight: 700,
  },
  heading: {
    margin: "8px 0 0",
    color: "#10273a",
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
    padding: 14,
    background: "#fff",
    boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
  },
  cardTitle: {
    margin: 0,
    color: "#153146",
    fontSize: 18,
  },
  meta: {
    margin: "8px 0 0",
    color: "#4b667c",
    fontSize: 13,
  },
  actionBtn: {
    marginTop: 12,
    border: 0,
    borderRadius: 10,
    background: "#0066b3",
    color: "#fff",
    padding: "9px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  empty: {
    margin: 0,
    color: "#4d6577",
  },
};
