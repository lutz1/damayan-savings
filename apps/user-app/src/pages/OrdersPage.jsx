import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(20));
    const unsubscribe = onSnapshot(ordersQuery, (snap) => {
      setOrders(
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
          <p style={styles.eyebrow}>Orders</p>
          <h1 style={styles.heading}>Track Order Progress</h1>
        </div>
        <Link to="/dashboard" style={styles.backLink}>
          Back To Dashboard
        </Link>
      </div>

      <section style={styles.list}>
        {orders.length === 0 ? <p style={styles.empty}>No orders yet.</p> : null}

        {orders.map((order) => (
          <article key={order.id} style={styles.row}>
            <div>
              <p style={styles.orderId}>Order #{order.id.slice(0, 8)}</p>
              <p style={styles.meta}>Merchant: {order.merchantName || order.merchantId || "-"}</p>
            </div>
            <span style={styles.status}>{order.status || "Pending"}</span>
          </article>
        ))}
      </section>
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 960,
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
  list: {
    display: "grid",
    gap: 10,
  },
  row: {
    border: "1px solid #d4e0e8",
    borderRadius: 12,
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    background: "#fff",
  },
  orderId: {
    margin: 0,
    color: "#17344a",
    fontWeight: 700,
  },
  meta: {
    margin: "5px 0 0",
    color: "#4b667c",
    fontSize: 13,
  },
  status: {
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: "#e6f7f2",
    color: "#0d5f4a",
    whiteSpace: "nowrap",
  },
  empty: {
    margin: 0,
    color: "#4d6577",
  },
};
