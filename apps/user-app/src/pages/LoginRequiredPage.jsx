import { Link, useLocation } from "react-router-dom";

export default function LoginRequiredPage() {
  const location = useLocation();
  const from = location.state?.from || "/dashboard";

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.kicker}>Authentication Required</p>
        <h1 style={styles.heading}>Please sign in first</h1>
        <p style={styles.copy}>
          This route requires an authenticated account. After signing in from your main app, return here.
        </p>
        <p style={styles.path}>Requested path: {from}</p>
        <div style={styles.actions}>
          <Link to="/dashboard" style={styles.primaryBtn}>
            Back to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 16,
    background: "linear-gradient(145deg, #f2faf9 0%, #edf4ff 100%)",
    fontFamily: "Segoe UI, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    border: "1px solid #d8e5ef",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 14px 30px rgba(20, 45, 62, 0.08)",
  },
  kicker: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#416079",
    fontSize: 12,
    fontWeight: 700,
  },
  heading: {
    margin: "8px 0 10px",
    color: "#10273a",
  },
  copy: {
    margin: 0,
    color: "#4b667c",
  },
  path: {
    margin: "10px 0 0",
    color: "#6b8497",
    fontSize: 13,
  },
  actions: {
    marginTop: 16,
  },
  primaryBtn: {
    display: "inline-block",
    textDecoration: "none",
    borderRadius: 10,
    background: "#0f766e",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 700,
  },
};
