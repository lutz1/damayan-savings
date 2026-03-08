import ShopPreviewCard from "../components/ShopPreviewCard";

export default function DashboardPage() {
  return (
    <main style={styles.page}>
      <header>
        <p style={styles.eyebrow}>User App Dashboard</p>
        <h1 style={styles.heading}>Member Overview</h1>
        <p style={styles.copy}>
          Keep dashboard focused on account and finance summary, then jump to dedicated shop flows for
          ordering.
        </p>
      </header>

      <ShopPreviewCard />
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "24px 16px 40px",
    display: "grid",
    gap: 20,
    fontFamily: "Segoe UI, sans-serif",
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
    margin: "8px 0 6px",
    color: "#10273a",
  },
  copy: {
    margin: 0,
    color: "#476278",
  },
};
