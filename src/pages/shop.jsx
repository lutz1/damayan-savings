import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import ShopLocationDialog from "../components/ShopLocationDialog";

const currency = (n) =>
  typeof n === "number"
    ? `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "₱0.00";

export default function ShopPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [merchants, setMerchants] = useState({});
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cart") || "[]");
    } catch {
      return [];
    }
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });
  const [showCartDialog, setShowCartDialog] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("savedAddresses") || "[]");
    } catch {
      return [];
    }
  });
  const [currentLocation, setCurrentLocation] = useState(() => {
    try {
      return localStorage.getItem("selectedDeliveryAddress") || null;
    } catch {
      return null;
    }
  });
  const [currentLocationCityProvince, setCurrentLocationCityProvince] = useState(() => {
    try {
      return localStorage.getItem("selectedDeliveryAddressCityProvince") || null;
    } catch {
      return null;
    }
  });
  const [shopCategories, setShopCategories] = useState([]);
  const fetchedMerchants = useRef(new Set());
  const normalizeText = (value) => (value || "").toString().trim().toLowerCase();

  // Load shop categories
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "shopCategories"), where("displayInShop", "==", true)),
      (snap) => {
        const cats = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setShopCategories(cats);
      },
      (err) => {
        console.error("Error loading shop categories:", err);
      }
    );
    return unsubscribe;
  }, []);

  // Load products
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "products"), where("status", "==", "active"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(list);

        const merchantIds = [...new Set(list.map((p) => p.merchantId))];
        merchantIds.forEach((mid) => {
          if (mid && !fetchedMerchants.current.has(mid)) {
            fetchedMerchants.current.add(mid);
            getDoc(doc(db, "users", mid)).then((userSnap) => {
              if (userSnap.exists()) {
                const userData = userSnap.data();
                const normalizedProfile = {
                  ...userData,
                  storeName: userData.storeName || userData.businessName || userData.name || "",
                  storeDescription: userData.storeDescription || userData.description || "",
                  coverImage: userData.coverImage || userData.coverPhoto || "",
                  logo: userData.logo || userData.photoURL || "",
                  location:
                    userData.location ||
                    [userData.address, userData.city].filter(Boolean).join(", ") ||
                    "",
                  rating:
                    userData.rating ||
                    userData.averageRating ||
                    userData.storeRating ||
                    userData.ratingsAverage ||
                    "",
                  deliveryTime:
                    userData.deliveryTime ||
                    userData.estimatedDeliveryTime ||
                    userData.eta ||
                    "",
                };

                if (
                  normalizedProfile.storeName ||
                  normalizedProfile.coverImage ||
                  normalizedProfile.storeDescription
                ) {
                  setMerchants((prev) => ({ ...prev, [mid]: normalizedProfile }));
                  return;
                }
              }

              getDoc(doc(db, "merchants", mid)).then((merchantSnap) => {
                if (merchantSnap.exists()) {
                  const merchantData = merchantSnap.data();
                  const normalizedMerchant = {
                    ...merchantData,
                    storeName:
                      merchantData.storeName || merchantData.businessName || merchantData.name || "",
                    storeDescription:
                      merchantData.storeDescription || merchantData.description || "",
                    coverImage: merchantData.coverImage || merchantData.coverPhoto || "",
                    location:
                      merchantData.location ||
                      [merchantData.address, merchantData.city].filter(Boolean).join(", ") ||
                      "",
                    rating:
                      merchantData.rating ||
                      merchantData.averageRating ||
                      merchantData.storeRating ||
                      "",
                    deliveryTime:
                      merchantData.deliveryTime ||
                      merchantData.estimatedDeliveryTime ||
                      merchantData.eta ||
                      "",
                  };
                  setMerchants((prev) => ({ ...prev, [mid]: normalizedMerchant }));
                }
              });
            });
          }
        });

        setLoading(false);
      },
      (err) => {
        console.error(err);
        setSnack({ open: true, severity: "error", message: "Failed to load products" });
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  // Filter products
  const visibleProducts = useMemo(() => {
    const selectedCategory = normalizeText(category);
    const searchTerm = normalizeText(search);

    return products
      .filter((product) => {
        const productStatus = normalizeText(product.status);
        const productApproval = (product.approvalStatus || "APPROVED").toString().toUpperCase();
        if (productStatus !== "active" || productApproval !== "APPROVED") return false;

        const matchesCategory =
          selectedCategory === "all" || normalizeText(product.category) === selectedCategory;

        const matchesSearch =
          !searchTerm ||
          normalizeText(product.name).includes(searchTerm) ||
          normalizeText(product.description).includes(searchTerm) ||
          normalizeText(product.category).includes(searchTerm);

        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bTime = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
  }, [products, category, search]);

  const visibleStores = useMemo(() => {
    const selectedCategory = normalizeText(category);
    const searchTerm = normalizeText(search);

    const eligibleProducts = products.filter((product) => {
      const productStatus = normalizeText(product.status);
      const productApproval = (product.approvalStatus || "APPROVED").toString().toUpperCase();
      return productStatus === "active" && productApproval === "APPROVED";
    });

    const categoryProducts = eligibleProducts.filter((product) => {
      if (selectedCategory === "all") return true;
      return normalizeText(product.category) === selectedCategory;
    });

    const scopedProducts =
      categoryProducts.length > 0 || selectedCategory === "all"
        ? categoryProducts
        : eligibleProducts;

    const uniqueMerchantIds = [
      ...new Set(scopedProducts.map((product) => product.merchantId).filter(Boolean)),
    ];

    return uniqueMerchantIds
      .map((merchantId) => ({
        id: merchantId,
        ...(merchants[merchantId] || {}),
      }))
      .filter((store) => {
        if (Object.keys(store).length <= 1) return false;
        if (!searchTerm) return true;

        return (
          normalizeText(store.storeName).includes(searchTerm) ||
          normalizeText(store.location).includes(searchTerm) ||
          normalizeText(store.description).includes(searchTerm)
        );
      });
  }, [products, merchants, category, search]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0),
    [cart]
  );

  // Cart management
  const saveCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const addToCart = () => {
    if (!selectedProduct || quantity < 1) return;

    const existing = cart.find((item) => item.id === selectedProduct.id);
    let newCart;
    if (existing) {
      newCart = cart.map((item) =>
        item.id === selectedProduct.id ? { ...item, qty: item.qty + quantity } : item
      );
    } else {
      newCart = [
        ...cart,
        {
          id: selectedProduct.id,
          name: selectedProduct.name,
          price: selectedProduct.price,
          image: selectedProduct.image,
          qty: quantity,
        },
      ];
    }
    saveCart(newCart);
    setSnack({ open: true, severity: "success", message: `${selectedProduct.name} added to cart` });
    setSelectedProduct(null);
    setQuantity(1);
  };

  const removeFromCart = (id) => {
    const newCart = cart.filter((item) => item.id !== id);
    saveCart(newCart);
  };

  const updateQty = (id, qty) => {
    if (qty < 1) {
      removeFromCart(id);
      return;
    }
    const newCart = cart.map((item) => (item.id === id ? { ...item, qty } : item));
    saveCart(newCart);
  };

  return (
    <div className="bg-gray-50 dark:bg-slate-900 min-h-screen flex flex-col pb-24">
      {/* Header */}
      <header className="bg-primary pt-12 pb-24 px-4 relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3 text-white">
            <button
              onClick={() => navigate("/member/dashboard")}
              className="hover:opacity-80 transition"
            >
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </button>
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                Delivery To
              </p>
              <div
                className="flex items-center cursor-pointer hover:opacity-80"
                onClick={() => setLocationDialogOpen(true)}
              >
                <span className="material-symbols-outlined text-sm mr-1">location_on</span>
                <span className="text-sm font-bold truncate">
                  {currentLocationCityProvince || currentLocation || "Set location"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-white">
            <button
              onClick={() => setShowCartDialog(true)}
              className="relative hover:opacity-80 transition"
            >
              <span className="material-symbols-outlined text-2xl">shopping_cart</span>
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
            <button className="hover:opacity-80 transition">
              <span className="material-symbols-outlined text-2xl">notifications</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="absolute -bottom-6 left-4 right-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg flex items-center px-4 py-3 border border-gray-100 dark:border-slate-700">
            <span className="material-symbols-outlined text-gray-400 mr-3">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 text-sm w-full text-gray-600 dark:text-gray-300 placeholder-gray-500"
              placeholder="Search for dishes, cuisines or restaurants"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
            />
            <span className="material-symbols-outlined text-gray-400">mic</span>
          </div>
        </div>
      </header>

      <main className="mt-10 px-4 flex-1 pb-4 max-w-2xl mx-auto w-full">
        {/* Promo Banner */}
        <div className="mt-4 bg-orange-50 dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-orange-100 dark:border-slate-700 flex items-center relative overflow-hidden mb-6">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-400/10 rounded-full blur-2xl"></div>
          <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center text-white shrink-0 mr-4 shadow-lg shadow-orange-500/20">
            <span className="material-symbols-outlined text-3xl">local_offer</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-orange-500 text-lg">50% off your first meal</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs">Use code: FIRSTBITE at checkout</p>
            <div className="flex space-x-1.5 mt-2">
              <div className="w-4 h-1.5 rounded-full bg-orange-500"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-slate-600"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-slate-600"></div>
            </div>
          </div>
        </div>

        {/* Categories */}
        {!loading && shopCategories.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">Explore Cuisines</h2>
            <div className="flex overflow-x-auto no-scrollbar space-x-4 pb-2">
              <div className="flex flex-col items-center space-y-3 shrink-0">
                <button
                  onClick={() => setCategory("all")}
                  className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center shadow-md transition ${
                    category === "all" ? "border-blue-500 bg-blue-50" : "border-primary bg-white dark:bg-slate-800"
                  }`}
                >
                  <span className="material-symbols-outlined text-primary text-3xl">restaurant_menu</span>
                </button>
                <span className="text-xs font-bold text-primary uppercase tracking-tight">All</span>
              </div>

              {shopCategories.map((cat) => (
                <div key={cat.id} className="flex flex-col items-center space-y-3 shrink-0">
                  <button
                    onClick={() => setCategory(cat.name)}
                    className={`w-20 h-20 rounded-2xl overflow-hidden border-2 shadow-md transition ${
                      category === cat.name ? "border-blue-500" : "border-gray-100 dark:border-slate-700"
                    }`}
                  >
                    {cat.imageUrl ? (
                      <img
                        alt={cat.name}
                        className="w-full h-full object-cover"
                        src={cat.imageUrl}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                        <span className="material-symbols-outlined">restaurant</span>
                      </div>
                    )}
                  </button>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-tight">
                    {cat.name}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Stores Grid */}
        {!loading && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">
                {category === "all" ? "Popular Near You" : `${category} Stores`}
              </h2>
              <button
                onClick={() => navigate("/all-stores")}
                className="text-accent text-sm font-semibold hover:opacity-80 transition"
              >
                View All Stores
              </button>
            </div>

            {visibleStores.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 text-gray-500 font-semibold">
                No stores available for this category.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {visibleStores.slice(0, 8).map((store) => {
                  const rating = Number(
                    store.rating ||
                    store.averageRating ||
                    store.storeRating ||
                    4.8
                  ).toFixed(1);

                  const deliveryTime =
                    store.deliveryTime ||
                    store.estimatedDeliveryTime ||
                    store.eta ||
                    "25-35 min";

                  const rawLocation =
                    store.city ||
                    store.location ||
                    [store.address, store.city].filter(Boolean).join(", ") ||
                    "";

                  const shortLocation = rawLocation
                    ? rawLocation
                        .split(",")
                        .map((part) => part.trim())
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(", ")
                    : "";

                  return (
                  <div
                    key={store.id}
                    onClick={() => navigate(`/store/${store.id}`)}
                    className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-lg transition"
                  >
                    <div className="h-32 bg-gray-200 relative overflow-hidden">
                      <img
                        alt={store.storeName || "Store"}
                        className="w-full h-full object-cover"
                        src={store.coverImage || store.logo || "/icons/icon-192x192.png"}
                      />
                      <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        className="absolute top-2 right-2 bg-white/90 dark:bg-slate-900/90 rounded-full p-1.5 flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-red-500 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                          favorite
                        </span>
                      </button>
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-bold truncate text-gray-900 dark:text-white mb-1">
                        {store.storeName || "Store"}
                      </h4>
                      {shortLocation && (
                        <div className="flex items-center text-[11px] text-gray-500 dark:text-gray-400 truncate mb-1">
                          <span className="material-symbols-outlined text-xs mr-1">location_on</span>
                          <span className="truncate">{shortLocation}</span>
                        </div>
                      )}
                      <div className="flex items-center mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                        <span className="material-symbols-outlined text-sm text-yellow-400 mr-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                          star
                        </span>
                        <span className="font-bold text-gray-700 dark:text-slate-300">{rating}</span>
                        <span className="mx-1">•</span>
                        <span>{deliveryTime}</span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* View All Stores Button */}
        <button
          onClick={() => navigate("/all-stores")}
          className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition flex justify-between items-center mb-6"
        >
          <span>View All Stores</span>
          <span className="material-symbols-outlined text-gray-400">chevron_right</span>
        </button>
      </main>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end">
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedProduct.name}
              </h2>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <img
              alt={selectedProduct.name}
              className="w-full h-48 object-cover rounded-2xl mb-4"
              src={selectedProduct.image || "/icons/icon-192x192.png"}
            />

            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              {selectedProduct.description || "No description available."}
            </p>

            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-4">
              {currency(Number(selectedProduct.price || 0))}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white w-10 h-10 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-slate-600 transition"
              >
                −
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 w-16 text-center"
                min="1"
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white w-10 h-10 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-slate-600 transition"
              >
                +
              </button>
            </div>

            <button
              onClick={addToCart}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition mb-3"
            >
              Add to Cart
            </button>
            <button
              onClick={() => setSelectedProduct(null)}
              className="w-full bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white font-bold py-3 rounded-xl hover:bg-gray-300 dark:hover:bg-slate-600 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {showCartDialog && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end">
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Your Cart ({cart.length})
              </h2>
              <button
                onClick={() => setShowCartDialog(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">Your cart is empty</p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600"
                    >
                      <img
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                        src={item.image || "/icons/icon-192x192.png"}
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{item.name}</h4>
                        <p className="text-green-600 dark:text-green-400 font-bold">
                          {currency(Number(item.price || 0))}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQty(item.id, item.qty - 1)}
                            className="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 w-6 h-6 rounded text-sm font-bold hover:bg-red-200 dark:hover:bg-red-800 transition"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-gray-900 dark:text-white">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => updateQty(item.id, item.qty + 1)}
                            className="bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 w-6 h-6 rounded text-sm font-bold hover:bg-green-200 dark:hover:bg-green-800 transition"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="ml-auto text-red-600 dark:text-red-400 text-xs font-semibold hover:text-red-700 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mb-4">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    Subtotal: {currency(cartTotal)}
                  </div>
                </div>

                <button className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition mb-3">
                  Checkout
                </button>
                <button
                  onClick={() => setShowCartDialog(false)}
                  className="w-full bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white font-bold py-3 rounded-xl hover:bg-gray-300 dark:hover:bg-slate-600 transition"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 px-6 py-3 flex justify-between items-center z-50">
        <button className="flex flex-col items-center space-y-1 text-primary">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            restaurant
          </span>
          <span className="text-[10px] font-bold">Food</span>
        </button>
        <button className="flex flex-col items-center space-y-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <span className="material-symbols-outlined text-2xl">shopping_basket</span>
          <span className="text-[10px] font-medium">Grocery</span>
        </button>
        <button className="flex flex-col items-center space-y-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <span className="material-symbols-outlined text-2xl">local_activity</span>
          <span className="text-[10px] font-medium">Offers</span>
        </button>
        <button className="flex flex-col items-center space-y-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <span className="material-symbols-outlined text-2xl">history</span>
          <span className="text-[10px] font-medium">Orders</span>
        </button>
        <button className="flex flex-col items-center space-y-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <span className="material-symbols-outlined text-2xl">person</span>
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>

      {/* Dialogs */}
      <ShopLocationDialog
        open={locationDialogOpen}
        onClose={() => setLocationDialogOpen(false)}
        savedAddresses={savedAddresses}
        onSelectAddress={(data) => {
          const address = typeof data === "string" ? data : data.address;
          const cityProvince = typeof data === "string" ? "" : data.cityProvince;
          localStorage.setItem("selectedDeliveryAddress", address);
          if (cityProvince) {
            localStorage.setItem("selectedDeliveryAddressCityProvince", cityProvince);
            setCurrentLocationCityProvince(cityProvince);
          }
          setCurrentLocation(address);
          setLocationDialogOpen(false);
          setSnack({ open: true, severity: "success", message: `Delivery location set to: ${address}` });
        }}
        onAddAddress={({ success, address }) => {
          if (success && address.trim()) {
            const newAddresses = [...savedAddresses, address];
            setSavedAddresses(newAddresses);
            localStorage.setItem("savedAddresses", JSON.stringify(newAddresses));
            setSnack({ open: true, severity: "success", message: "Address added successfully" });
          }
        }}
      />

      {/* Toast Notifications */}
      {snack.open && (
        <div className={`fixed top-4 left-4 right-4 p-4 rounded-lg text-white font-semibold z-50 ${
          snack.severity === "success" ? "bg-green-500" :
          snack.severity === "error" ? "bg-red-500" :
          snack.severity === "warning" ? "bg-yellow-500" :
          "bg-blue-500"
        }`}>
          {snack.message}
        </div>
      )}
    </div>
  );
}
