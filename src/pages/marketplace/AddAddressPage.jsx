import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function AddAddressPage() {
  const navigate = useNavigate();
  const [address, setAddress] = useState(localStorage.getItem("selectedDeliveryAddress") || "");
  const [cityProvince, setCityProvince] = useState(localStorage.getItem("selectedDeliveryAddressCityProvince") || "");
  const [lat, setLat] = useState(() => {
    try {
      const coords = JSON.parse(localStorage.getItem("selectedDeliveryCoordinates") || "null");
      return coords?.lat || "";
    } catch {
      return "";
    }
  });
  const [lng, setLng] = useState(() => {
    try {
      const coords = JSON.parse(localStorage.getItem("selectedDeliveryCoordinates") || "null");
      return coords?.lng || "";
    } catch {
      return "";
    }
  });

  const handleSave = () => {
    const value = address.trim();
    if (!value) return;

    localStorage.setItem("selectedDeliveryAddress", value);
    localStorage.setItem("selectedDeliveryAddressCityProvince", cityProvince.trim());

    // Save coordinates if provided
    if (lat && lng) {
      const coords = { lat: Number(lat), lng: Number(lng) };
      localStorage.setItem("selectedDeliveryCoordinates", JSON.stringify(coords));
    }

    const savedRaw = localStorage.getItem("savedAddresses") || "[]";
    let saved = [];
    try {
      const parsed = JSON.parse(savedRaw);
      saved = Array.isArray(parsed) ? parsed : [];
    } catch {
      saved = [];
    }

    const normalized = value.toLowerCase();
    const deduped = saved.filter((item) => String(item || "").trim().toLowerCase() !== normalized);
    const next = [value, ...deduped].slice(0, 20);
    localStorage.setItem("savedAddresses", JSON.stringify(next));

    navigate("/marketplace/cart");
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.kicker}>Delivery Setup</p>
        <h1 style={styles.heading}>Add Delivery Address</h1>

        <label style={styles.label} htmlFor="address">
          Street / Barangay / Landmark
        </label>
        <input
          id="address"
          type="text"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          style={styles.input}
          placeholder="Enter full delivery address"
        />

        <label style={styles.label} htmlFor="cityProvince">
          City / Province
        </label>
        <input
          id="cityProvince"
          type="text"
          value={cityProvince}
          onChange={(event) => setCityProvince(event.target.value)}
          style={styles.input}
          placeholder="Optional"
        />

        <label style={styles.label} htmlFor="lat">
          📍 Latitude (for accurate delivery fee)
        </label>
        <input
          id="lat"
          type="text"
          value={lat}
          onChange={(event) => setLat(event.target.value)}
          style={styles.input}
          placeholder="e.g., 14.5994"
        />

        <label style={styles.label} htmlFor="lng">
          📍 Longitude (for accurate delivery fee)
        </label>
        <input
          id="lng"
          type="text"
          value={lng}
          onChange={(event) => setLng(event.target.value)}
          style={styles.input}
          placeholder="e.g., 121.0437"
        />

        <div style={styles.actions}>
          <button type="button" style={styles.primaryBtn} onClick={handleSave} disabled={!address.trim()}>
            Save Address
          </button>
          <Link to="/marketplace/cart" style={styles.secondaryBtn}>
            Cancel
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
    maxWidth: 560,
    background: "#fff",
    border: "1px solid #d8e5ef",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 14px 30px rgba(20, 45, 62, 0.08)",
    display: "grid",
    gap: 10,
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
    margin: "4px 0 8px",
    color: "#10273a",
  },
  label: {
    fontSize: 13,
    color: "#35556c",
    fontWeight: 700,
  },
  input: {
    borderRadius: 10,
    border: "1px solid #bfd1dd",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
  },
  actions: {
    marginTop: 6,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  primaryBtn: {
    border: 0,
    borderRadius: 10,
    background: "#0f766e",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    textDecoration: "none",
    borderRadius: 10,
    border: "1px solid #9ab3c1",
    color: "#21485d",
    padding: "10px 14px",
    fontWeight: 700,
    background: "#fff",
  },
};
