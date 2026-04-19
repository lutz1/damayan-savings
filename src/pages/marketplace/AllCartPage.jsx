import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { readCart, saveCart } from "./lib/cartStorage";
import { calculateCustomerDeliveryFee, calculateDistance, extractCoordinates } from "../../lib/deliveryPricing";

const currency = (value) =>
  `P${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Inject animations
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes slideUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}

export default function AllCartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(readCart);
  const [merchants, setMerchants] = useState({});
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryCoordinates, setDeliveryCoordinates] = useState(null);
  const [openMenuMerchantId, setOpenMenuMerchantId] = useState(null);

  const currentLocation = localStorage.getItem("selectedDeliveryAddress") || "";
  const currentCityProvince = localStorage.getItem("selectedDeliveryAddressCityProvince") || "";

  useEffect(() => {
    setDeliveryLocation(currentLocation);
    const coords = localStorage.getItem("selectedDeliveryCoordinates");
    if (coords) {
      try {
        setDeliveryCoordinates(JSON.parse(coords));
      } catch {}
    }
  }, []);

  useEffect(() => {
    const onFocus = () => setCart(readCart());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Group cart items by merchantId
  const cartByStore = useMemo(() => {
    const grouped = {};
    cart.forEach((item) => {
      const mId = item.merchantId || "unknown";
      if (!grouped[mId]) grouped[mId] = [];
      grouped[mId].push(item);
    });
    return grouped;
  }, [cart]);

  // Fetch merchant data for all stores in cart
  useEffect(() => {
    const merchantIds = Object.keys(cartByStore).filter((id) => id !== "unknown");
    if (!merchantIds.length) return;

    const fetchMerchants = async () => {
      const newMerchants = {};
      for (const merchantId of merchantIds) {
        try {
          const snap = await getDoc(doc(db, "users", merchantId));
          if (snap.exists()) {
            newMerchants[merchantId] = snap.data();
          }
        } catch (error) {
          console.error(`Error fetching merchant ${merchantId}:`, error);
        }
      }
      setMerchants(newMerchants);
    };

    fetchMerchants();
  }, [cartByStore]);

  const updateQty = (id, qty) => {
    if (qty < 1) {
      const next = cart.filter((item) => item.id !== id);
      setCart(next);
      saveCart(next);
      return;
    }
    const next = cart.map((item) => (item.id === id ? { ...item, qty } : item));
    setCart(next);
    saveCart(next);
  };

  const getTotalForStore = (storeItems) => {
    return storeItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  };

  const handleAddMoreItems = (merchantId) => {
    setOpenMenuMerchantId(null);
    navigate(`/marketplace/store/${merchantId}`);
  };

  const handleDeleteCart = (merchantId) => {
    const filtered = cart.filter((item) => item.merchantId !== merchantId);
    setCart(filtered);
    saveCart(filtered);
    setOpenMenuMerchantId(null);
  };

  const handleViewCart = (merchantId) => {
    // Navigate to CartPage showing only this store's items
    navigate(`/marketplace/cart/${merchantId}`);
  };

  return (
    <main style={styles.page}>
      <header style={styles.topBar}>
        <button type="button" onClick={() => navigate("/marketplace/shop")} style={styles.iconBtn}>
          ←
        </button>
        <div style={styles.headerContent}>
          <h1 style={styles.topTitle}>All carts</h1>
          <p style={styles.deliveryLabel}>Deliver to: <strong>{currentLocation || "Set address"}</strong></p>
        </div>
      </header>

      {cart.length === 0 ? (
        <div style={styles.empty}>
          <p>Your cart is empty</p>
          <button onClick={() => navigate("/marketplace/shop")} style={styles.shopBtn}>
            Continue Shopping
          </button>
        </div>
      ) : (
        <section style={styles.panel}>
          {Object.entries(cartByStore).map(([merchantId, storeItems]) => {
            const merchant = merchants[merchantId] || {};
            const storeName = merchant.storeName || merchant.name || "Store";
            const storeLogo = merchant.storeLogo || merchant.businessLogo || "/icons/icon-192x192.png";
            const prepTime = merchant.preparationTime || "5-20 mins";
            const firstItem = storeItems[0] || {};
            const storeTotal = getTotalForStore(storeItems);

            return (
              <div key={merchantId} style={styles.storeCard}>
                {/* Store Header */}
                <div style={styles.storeHeader}>
                  <img src={storeLogo} alt={storeName} style={styles.storeLogo} />
                  <div style={styles.storeInfo}>
                    <h3 style={styles.storeName}>{storeName}</h3>
                    <p style={styles.prepTime}>⏱️ {prepTime}</p>
                  </div>
                  <div style={styles.storeHeaderRight}>
                    <span style={styles.itemBadge}>{storeItems.length}</span>
                    <button
                      type="button"
                      onClick={() => setOpenMenuMerchantId(openMenuMerchantId === merchantId ? null : merchantId)}
                      style={styles.menuBtn}
                    >
                      ⋮
                    </button>
                  </div>
                </div>

                {/* Store Menu Drawer */}
                {openMenuMerchantId === merchantId && (
                  <>
                    <div
                      style={styles.menuBackdrop}
                      onClick={() => setOpenMenuMerchantId(null)}
                    />
                    <div style={styles.bottomSheet}>
                      <div style={styles.bottomSheetHandle} />
                      <div style={styles.bottomSheetContent}>
                        <button
                          type="button"
                          onClick={() => handleAddMoreItems(merchantId)}
                          style={styles.sheetMenuItem}
                        >
                          ➕ Add more items
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCart(merchantId)}
                          style={styles.sheetMenuItem}
                        >
                          🗑️ Delete cart
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* First Item Preview */}
                <div style={styles.itemPreview}>
                  <div style={styles.itemImageWrapper}>
                    <img
                      src={firstItem.image || "/icons/icon-192x192.png"}
                      alt={firstItem.name}
                      style={styles.itemImage}
                    />
                  </div>
                  <div style={styles.itemDetails}>
                    <p style={styles.itemName}>{firstItem.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/marketplace/store/${merchantId}`)}
                    style={styles.addBtn}
                  >
                    +
                  </button>
                </div>

                {/* Subtotal */}
                <div style={styles.subtotalRow}>
                  <span>Subtotal</span>
                  <strong>{currency(storeTotal)}</strong>
                </div>

                {/* View Cart Button */}
                <button
                  type="button"
                  onClick={() => handleViewCart(merchantId)}
                  style={styles.viewCartBtn}
                >
                  View your cart
                </button>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 460,
    margin: "0 auto",
    padding: "0 12px 100px",
    fontFamily: "'Plus Jakarta Sans', Segoe UI, sans-serif",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 4px",
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 30,
    marginBottom: 12,
    borderBottom: "1px solid #e2e8f0",
  },
  iconBtn: {
    width: 28,
    height: 28,
    border: "none",
    borderRadius: 999,
    background: "transparent",
    color: "#334155",
    fontSize: 18,
    cursor: "pointer",
  },
  headerContent: {
    flex: 1,
  },
  topTitle: {
    margin: "0 0 4px 0",
    color: "#1e293b",
    fontSize: 18,
    fontWeight: 700,
  },
  deliveryLabel: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
    fontWeight: 500,
  },
  panel: {
    display: "grid",
    gap: 12,
  },
  storeCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  storeHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottom: "1px solid #eef2f7",
  },
  storeLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    objectFit: "cover",
    flexShrink: 0,
  },
  storeInfo: {
    flex: 1,
    minWidth: 0,
  },
  storeName: {
    margin: "0 0 4px 0",
    fontSize: 14,
    fontWeight: 700,
    color: "#1e293b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  prepTime: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
  },
  itemBadge: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#1e67da",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  storeHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  menuBtn: {
    width: 28,
    height: 28,
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderRadius: 4,
  },
  menuBackdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.4)",
    zIndex: 999,
    animation: "fadeIn 0.2s ease-out",
  },
  bottomSheet: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fff",
    borderRadius: "16px 16px 0 0",
    boxShadow: "0 -4px 12px rgba(0,0,0,0.15)",
    zIndex: 1000,
    maxHeight: "50vh",
    animation: "slideUp 0.3s ease-out",
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    background: "#cbd5e1",
    borderRadius: 2,
    margin: "12px auto",
  },
  bottomSheetContent: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    padding: "0 0 20px 0",
  },
  sheetMenuItem: {
    padding: "16px 16px",
    border: "none",
    background: "#fff",
    color: "#1e293b",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
    borderBottom: "1px solid #e2e8f0",
    transition: "background 0.2s",
  },
  menuDrawer: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    marginBottom: 8,
    borderTop: "1px solid #eef2f7",
    borderBottom: "1px solid #eef2f7",
  },
  menuItem: {
    padding: "12px 12px",
    border: "none",
    background: "#f8fafc",
    color: "#1e293b",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.2s",
  },
  itemPreview: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  itemImageWrapper: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    background: "#f1f5f9",
    flexShrink: 0,
  },
  itemImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  itemDetails: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemQty: {
    margin: "4px 0 0 0",
    fontSize: 12,
    color: "#64748b",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#1e67da",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
    transition: "all 0.2s ease",
  },
  subtotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    fontSize: 14,
    color: "#1e293b",
    borderBottom: "1px solid #eef2f7",
    marginBottom: 10,
  },
  viewCartBtn: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #1e67da",
    borderRadius: 8,
    background: "#fff",
    color: "#1e67da",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
    gap: 20,
  },
  shopBtn: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: "#1e67da",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
};
