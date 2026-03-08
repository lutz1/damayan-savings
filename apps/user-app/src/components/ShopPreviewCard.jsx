import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";

export default function ShopPreviewCard() {
  const [merchantCount, setMerchantCount] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setUserId(user?.uid || ""));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const merchantQuery = query(collection(db, "users"), where("role", "==", "MERCHANT"), limit(30));
    const unsubscribe = onSnapshot(merchantQuery, (snap) => {
      setMerchantCount(snap.size || 0);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setActiveOrders(0);
      return () => {};
    }

    const activeOrderQuery = query(
      collection(db, "orders"),
      where("customerId", "==", userId),
      limit(20)
    );

    const unsubscribe = onSnapshot(activeOrderQuery, (snap) => {
      const activeStatuses = new Set(["Pending", "Accepted", "Preparing", "For Delivery", "NEW"]);
      const count = snap.docs.filter((doc) => activeStatuses.has(String(doc.data()?.status || ""))).length;
      setActiveOrders(count);
    });

    return () => unsubscribe();
  }, [userId]);

  const subtitle = useMemo(() => {
    if (!merchantCount && !activeOrders) return "No shop activity yet.";
    return `${merchantCount} merchants live, ${activeOrders} active orders now.`;
  }, [merchantCount, activeOrders]);

  return (
    <section style={styles.card}>
      <div>
        <p style={styles.kicker}>Shop</p>
        <h2 style={styles.title}>Order Essentials Fast</h2>
        <p style={styles.subtitle}>{subtitle}</p>
      </div>

      <div style={styles.actions}>
        <Link to="/shop" style={styles.primaryBtn}>
          Go To Shop
        </Link>
        <Link to="/orders" style={styles.secondaryBtn}>
          Track Orders
        </Link>
      </div>
    </section>
  );
}

const styles = {
  card: {
    background: "linear-gradient(135deg, #f8fff5 0%, #e7f7ff 45%, #fff8ef 100%)",
    border: "1px solid #d6e4ea",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 12px 28px rgba(17, 40, 59, 0.08)",
    display: "grid",
    gap: 14,
  },
  kicker: {
    margin: 0,
    letterSpacing: "0.08em",
    fontSize: 12,
    textTransform: "uppercase",
    color: "#36536b",
    fontWeight: 700,
  },
  title: {
    margin: "6px 0 4px",
    fontSize: 28,
    lineHeight: 1.15,
    color: "#0e2a3d",
  },
  subtitle: {
    margin: 0,
    color: "#3f5f74",
    fontSize: 14,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryBtn: {
    textDecoration: "none",
    background: "#0f766e",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 10,
    fontWeight: 700,
  },
  secondaryBtn: {
    textDecoration: "none",
    background: "#fff",
    color: "#0f4a59",
    border: "1px solid #9ac1ce",
    padding: "10px 16px",
    borderRadius: 10,
    fontWeight: 700,
  },
};
