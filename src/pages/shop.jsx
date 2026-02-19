import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardMedia,
  Stack,
  Typography,
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField as MuiTextField,
  Container,
  IconButton,
  InputAdornment,
  Badge,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  FavoriteBorder as FavoriteBorderIcon,
  AccessTime as AccessTimeIcon,
  Timer as TimerIcon,
  LocalShipping as LocalShippingIcon,
  LocationOn as LocationOnIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import { collection, query, where, onSnapshot, doc, getDoc} from "firebase/firestore";
import { db } from "../firebase";
import ShopBottomNav from "../components/ShopBottomNav";
import ShopLocationDialog from "../components/ShopLocationDialog";

const MaterialIcon = ({ name, filled = false, size = 24, sx = {} }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400`,
      ...sx,
    }}
  >
    {name}
  </span>
);

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
  const [headerHidden, setHeaderHidden] = useState(false);
  const [adHidden, setAdHidden] = useState(false);
  const [navValue, setNavValue] = useState("none");
  const [cartDialogOpen, setCartDialogOpen] = useState(false);
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
  const lastScrollY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const normalizeText = (value) => (value || "").toString().trim().toLowerCase();
  const categoryToNav = (cat) => {
    if (!cat) return "none";
    const lookup = {
      Food: "food",
      Grocery: "grocery",
      Leisure: "leisure",
    };
    return lookup[cat] || "none";
  };

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "products"),
      where("status", "==", "active")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(list);
        
        // Load merchant info for each unique merchantId
        const merchantIds = [...new Set(list.map((p) => p.merchantId))];
        merchantIds.forEach((mid) => {
          if (mid && !fetchedMerchants.current.has(mid)) {
            fetchedMerchants.current.add(mid);
            getDoc(doc(db, "merchants", mid)).then((snap) => {
              if (snap.exists()) {
                setMerchants((prev) => ({ ...prev, [mid]: snap.data() }));
              }
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

  // Hide top nav on scroll down, show on scroll up; fade ad based on direction
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          const diff = y - lastScrollY.current;
          
          // Show ad when at the top
          if (y < 50) {
            setAdHidden(false);
          } else if (Math.abs(diff) > 3) {
            if (y > 50 && diff > 5) {
              setHeaderHidden(true);
            } else if (diff < -5) {
              setHeaderHidden(false);
            }
            
            if (diff > 3) {
              setAdHidden(true); // scrolling down hides ad
            } else if (diff < -3 && y < 200) {
              setAdHidden(false); // scrolling up near top shows ad
            }
          }
          
          lastScrollY.current = y;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Pull-to-refresh gesture detection
  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    // Show loading indicator for a moment, then reload
    setTimeout(() => {
      window.location.href = "/shop";
    }, 500);
  }, [isRefreshing]);

  useEffect(() => {
    let startY = 0;
    let startX = 0;
    let isVerticalGesture = false;

    const handleTouchStart = (e) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      isVerticalGesture = false;
    };

    const handleTouchMove = (e) => {
      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const distanceY = currentY - startY;
      const distanceX = Math.abs(currentX - startX);
      
      // Determine if this is primarily a vertical gesture
      // Only set this once per gesture to avoid switching mid-swipe
      if (!isVerticalGesture && (Math.abs(distanceY) > 10 || distanceX > 10)) {
        isVerticalGesture = Math.abs(distanceY) > distanceX;
      }
      
      // Only show pull indicator when:
      // 1. At top of page
      // 2. Pulling down
      // 3. Gesture is primarily vertical (not horizontal scroll)
      if (window.scrollY === 0 && distanceY > 0 && isVerticalGesture) {
        setPullDistance(Math.min(distanceY, 100));
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > 60 && isVerticalGesture) {
        await handleRefresh();
      }
      setPullDistance(0);
      isVerticalGesture = false;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, handleRefresh]);

  useEffect(() => {
    setNavValue(categoryToNav(category));
  }, [category]);

  // Derived: categories (use only admin-configured shopCategories)
  const categories = useMemo(() => {
    if (shopCategories.length > 0) {
      return shopCategories.map((c) => c.name);
    }
    // If no configured categories, show none to avoid default labels
    return [];
  }, [shopCategories]);

  const visibleProducts = useMemo(() => {
    const selectedCategory = normalizeText(category);
    const searchTerm = normalizeText(search);

    return products
      .filter((product) => {
        const productStatus = normalizeText(product.status);
        const productApproval = (product.approvalStatus || "PENDING").toString().toUpperCase();
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

  // Derived: ordered merchant list for store headers
  const merchantList = useMemo(() => {
    const ids = [...new Set(visibleProducts.map((p) => p.merchantId).filter(Boolean))];
    return ids
      .map((id) => ({ id, ...(merchants[id] || {}) }))
      .filter((m) => Object.keys(m).length > 1);
  }, [visibleProducts, merchants]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0),
    [cart]
  );

  const handleBottomNavChange = (value) => {
    if (!value) return;

    // Navigate to shop.jsx for all bottom nav items and reset state
    if (value === "food" || value === "grocery" || value === "leisure") {
      // Reset category and search to default
      setCategory("all");
      setSearch("");
      setNavValue(value);
      navigate("/shop");
      // Scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (value === "cart") {
      setSnack({ open: true, severity: "info", message: "Coming soon! Stay tuned." });
      setNavValue("none");
    } else if (value === "account") {
      navigate("/login");
    }
  };

  const handleSelectAddress = (locationData) => {
    // Handle both object and string formats for backward compatibility
    const address = typeof locationData === "string" ? locationData : locationData.address;
    const cityProvince = typeof locationData === "string" ? "" : locationData.cityProvince;
    
    localStorage.setItem("selectedDeliveryAddress", address);
    if (cityProvince) {
      localStorage.setItem("selectedDeliveryAddressCityProvince", cityProvince);
      setCurrentLocationCityProvince(cityProvince);
    }
    setCurrentLocation(address);
    setLocationDialogOpen(false);
    setSnack({ open: true, severity: "success", message: `Delivery location set to: ${address}` });
  };

  const handleLocationDialogAddAddress = ({ success, address }) => {
    if (success && address.trim()) {
      const newAddresses = [...savedAddresses, address];
      setSavedAddresses(newAddresses);
      localStorage.setItem("savedAddresses", JSON.stringify(newAddresses));
      setSnack({ open: true, severity: "success", message: "Address added successfully" });
    } else {
      setSnack({ open: true, severity: "warning", message: "Please enter a valid address" });
    }
  };

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

  const locationText = currentLocation 
    ? (currentLocation.split(",")[0] || "My Location")
    : "Location";
  const locationSubtext = currentLocationCityProvince || currentLocation || "Set delivery location";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f4f4f5",
        pb: 14,
        overscrollBehaviorY: "contain",
        overflowX: "hidden",
      }}
    >
      <Box
        sx={{
          bgcolor: "#3b4a6b",
          pt: 6,
          pb: 4,
          px: 2,
          borderBottomLeftRadius: "32px",
          borderBottomRightRadius: "32px",
          boxShadow: "0 12px 26px rgba(15, 23, 42, 0.25)",
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            <IconButton
              onClick={() => navigate("/member/dashboard")}
              sx={{ color: "white" }}
              aria-label="back"
            >
              <MaterialIcon name="arrow_back" size={22} />
            </IconButton>
            <Box
              onClick={() => setLocationDialogOpen(true)}
              sx={{ cursor: "pointer", minWidth: 0 }}
            >
              <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#cbd5f5" }}>
                Current Location
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: "white" }}>
                <MaterialIcon name="location_on" size={16} />
                <Typography
                  sx={{ fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {locationSubtext}
                </Typography>
              </Stack>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ color: "white" }}>
            <IconButton onClick={() => setCartDialogOpen(true)} sx={{ color: "white" }}>
              <Badge
                color="error"
                badgeContent={cart.length}
                overlap="circular"
                sx={{ "& .MuiBadge-badge": { fontSize: "0.55rem" } }}
              >
                <MaterialIcon name="shopping_cart" size={22} />
              </Badge>
            </IconButton>
            <IconButton sx={{ color: "white" }}>
              <MaterialIcon name="notifications" size={22} />
            </IconButton>
          </Stack>
        </Stack>

        <MuiTextField
          fullWidth
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <MaterialIcon name="search" size={20} sx={{ color: "#94a3b8" }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <MaterialIcon name="mic" size={20} sx={{ color: "#94a3b8" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: "#f8fafc",
              borderRadius: 3,
              fontSize: "0.9rem",
              "& fieldset": { border: "none" },
              "&:hover": { bgcolor: "#f1f5f9" },
              "&.Mui-focused": { bgcolor: "#ffffff", boxShadow: "0 0 0 2px rgba(124, 58, 237, 0.15)" },
            },
          }}
        />
      </Box>

      {/* Pull-to-Refresh Indicator */}
      <Box
        sx={{
          position: "fixed",
          top: 120,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 100,
          opacity: pullDistance > 20 ? Math.min(pullDistance / 60, 1) : 0,
          transform: `translateY(${Math.min(pullDistance * 0.5, 40)}px)`,
          transition: isRefreshing ? "none" : "opacity 150ms ease, transform 150ms ease",
          pointerEvents: "none",
        }}
      >
        <Box
          sx={{
            bgcolor: "rgba(255, 255, 255, 0.95)",
            borderRadius: "50%",
            p: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <CircularProgress
            size={32}
            thickness={4}
            sx={{
              color: "#1976d2",
            }}
          />
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ mt: -3, pb: 2 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 4,
            bgcolor: "#ffffff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 14px 26px rgba(15, 23, 42, 0.08)",
            display: "flex",
            gap: 2,
            alignItems: "center",
            mb: 3,
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              bgcolor: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 18px rgba(124, 58, 237, 0.25)",
              color: "white",
            }}
          >
            <MaterialIcon name="bolt" size={30} filled />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, color: "#7c3aed", fontSize: "1rem" }}>
              Flash sale today only
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#64748b", mt: 0.5 }}>
              Limited time offers. Shop now!
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#e2e8f0" }} />
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#e2e8f0" }} />
              <Box sx={{ width: 24, height: 6, borderRadius: 6, bgcolor: "#7c3aed" }} />
            </Stack>
          </Box>
        </Paper>

        {!loading && categories.length > 0 && (
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            <Typography sx={{ fontWeight: 800, color: "#1f2937", fontSize: "1.1rem", px: 0.5 }}>
              What’s your mood for food?
            </Typography>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                overflowX: "auto",
                pb: 1,
                scrollBehavior: "smooth",
                "&::-webkit-scrollbar": { display: "none" },
                msOverflowStyle: "none",
                scrollbarWidth: "none",
              }}
            >
              <Stack alignItems="center" spacing={1} sx={{ minWidth: 80 }}>
                <Button
                  onClick={() => {
                    setCategory("all");
                    setNavValue("none");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  sx={{
                    width: 80,
                    height: 80,
                    p: 0,
                    borderRadius: 3,
                    overflow: "hidden",
                    border: category === "all" ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                    bgcolor: "#ffffff",
                    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
                  }}
                >
                  <MaterialIcon name="restaurant" size={32} />
                </Button>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: category === "all" ? "#2563eb" : "#475569" }}>
                  All
                </Typography>
              </Stack>

              {categories.map((cat) => {
                const categoryData = shopCategories.find((c) => c.name === cat);
                const isSelected = category === cat;

                return (
                  <Stack key={cat} alignItems="center" spacing={1} sx={{ minWidth: 80 }}>
                    <Button
                      onClick={() => setCategory(cat)}
                      sx={{
                        width: 80,
                        height: 80,
                        p: 0,
                        borderRadius: 3,
                        overflow: "hidden",
                        border: isSelected ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                        bgcolor: "#ffffff",
                        boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
                      }}
                    >
                      {categoryData?.imageUrl ? (
                        <Box
                          component="img"
                          src={categoryData.imageUrl}
                          alt={cat}
                          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <MaterialIcon name="restaurant" size={28} />
                      )}
                    </Button>
                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: isSelected ? "#2563eb" : "#64748b" }}>
                      {cat}
                    </Typography>
                  </Stack>
                );
              })}
            </Box>
          </Stack>
        )}

        <Button
          fullWidth
          onClick={() => navigate("/all-stores")}
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 3,
            bgcolor: "#ffffff",
            border: "1px solid #e5e7eb",
            textTransform: "none",
            fontWeight: 700,
            color: "#475569",
            justifyContent: "space-between",
            "&:hover": { bgcolor: "#f8fafc" },
          }}
        >
          Hungry? Order now
          <MaterialIcon name="chevron_right" size={20} sx={{ color: "#94a3b8" }} />
        </Button>

        {!loading && (
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            <Typography sx={{ fontWeight: 800, color: "#1f2937", fontSize: "1.05rem", px: 0.5 }}>
              {category === "all" ? "Recommended for you" : `${category} picks`}
            </Typography>

            {visibleProducts.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  color: "#64748b",
                  fontWeight: 600,
                }}
              >
                No approved products yet for this category.
              </Paper>
            ) : (
              <Stack spacing={1.5}>
                {visibleProducts.slice(0, 20).map((product) => (
                  <Card
                    key={product.id}
                    sx={{
                      borderRadius: 3,
                      overflow: "hidden",
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
                    }}
                  >
                    <Stack direction="row" spacing={0} sx={{ minHeight: 112 }}>
                      <Box sx={{ width: 118, flexShrink: 0, bgcolor: "#f1f5f9" }}>
                        <CardMedia
                          component="img"
                          image={product.image || "/icons/icon-192x192.png"}
                          alt={product.name || "Product"}
                          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </Box>
                      <Stack spacing={0.5} sx={{ flex: 1, p: 1.5, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem" }} noWrap>
                          {product.name || "Product"}
                        </Typography>
                        <Typography sx={{ color: "#16a34a", fontWeight: 800, fontSize: "0.9rem" }}>
                          {currency(Number(product.price || 0))}
                        </Typography>
                        <Typography
                          sx={{
                            color: "#64748b",
                            fontSize: "0.78rem",
                            lineHeight: 1.35,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {product.description || "No description available."}
                        </Typography>
                        <Box sx={{ pt: 0.5 }}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              setSelectedProduct(product);
                              setQuantity(1);
                            }}
                            sx={{
                              textTransform: "none",
                              fontWeight: 700,
                              borderRadius: 2,
                              px: 1.6,
                              minWidth: 0,
                            }}
                          >
                            Add
                          </Button>
                        </Box>
                      </Stack>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        )}

        {/* Store Cards - Horizontal scroll for multiple stores */}
        {!loading && merchantList.length > 0 && (
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Typography sx={{ fontWeight: 800, color: "#1f2937", fontSize: "1.1rem", px: 0.5 }}>
              Featured Stores
            </Typography>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                overflowX: "auto",
                pb: 1,
                scrollBehavior: "smooth",
                "&::-webkit-scrollbar": { display: "none" },
                msOverflowStyle: "none",
                scrollbarWidth: "none",
              }}
            >
              {merchantList.map((merchant) => (
                <Card
                  key={merchant.id}
                  onClick={() => navigate(`/store/${merchant.id}`)}
                  sx={{
                    minWidth: 280,
                    maxWidth: 300,
                    borderRadius: 3,
                    overflow: "hidden",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 12px 28px rgba(59, 74, 107, 0.18)",
                      borderColor: "#3b4a6b",
                    },
                  }}
                >
                  <Box sx={{ position: "relative", height: 140, bgcolor: "#f1f5f9" }}>
                    <CardMedia
                      component="img"
                      image={merchant.coverImage || "/icons/icon-192x192.png"}
                      alt={merchant.storeName || "Store"}
                      sx={{ height: "100%", width: "100%", objectFit: "cover" }}
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Add to favorites logic here
                      }}
                      sx={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        bgcolor: "rgba(255,255,255,0.95)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        "&:hover": { bgcolor: "white" },
                      }}
                      aria-label="favorite"
                    >
                      <FavoriteBorderIcon sx={{ fontSize: 18, color: "#ef4444" }} />
                    </IconButton>
                  </Box>
                  
                  <Stack spacing={1.5} sx={{ p: 2 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "#1f2937" }} noWrap>
                      {merchant.storeName || "Shop"}
                    </Typography>
                    
                    {merchant.hours && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <AccessTimeIcon sx={{ fontSize: 16, color: "#3b4a6b" }} />
                        <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {merchant.hours}
                        </Typography>
                      </Stack>
                    )}
                    
                    {merchant.deliveryTime && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TimerIcon sx={{ fontSize: 16, color: "#3b4a6b" }} />
                        <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {merchant.deliveryTime}
                        </Typography>
                      </Stack>
                    )}
                    
                    {(merchant.deliveryRadiusKm || merchant.deliveryRatePerKm) && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <LocalShippingIcon sx={{ fontSize: 16, color: "#3b4a6b" }} />
                        <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }} noWrap>
                          {merchant.deliveryRatePerKm ? `₱${merchant.deliveryRatePerKm}/km` : "Free delivery"}
                          {merchant.deliveryRadiusKm ? ` • ${merchant.deliveryRadiusKm} km` : ""}
                        </Typography>
                      </Stack>
                    )}
                    
                    {merchant.location && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <LocationOnIcon sx={{ fontSize: 16, color: "#3b4a6b" }} />
                        <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }} noWrap>
                          {merchant.location}
                        </Typography>
                      </Stack>
                    )}

                    <Box
                      sx={{
                        mt: 1,
                        pt: 1.5,
                        borderTop: "1px solid #e5e7eb",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <MaterialIcon name="star" size={16} filled sx={{ color: "#fbbf24" }} />
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#1f2937" }}>
                          4.8
                        </Typography>
                        <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                          (120+)
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: "#7c3aed" }}>
                        View Store →
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              ))}
            </Box>
          </Stack>
        )}

      </Container>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct && !cart.find((item) => item.id === selectedProduct?.id)} onClose={() => setSelectedProduct(null)} fullWidth maxWidth="xs">
        {selectedProduct && (
          <>
            <DialogTitle>{selectedProduct.name}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <CardMedia
                  component="img"
                  image={selectedProduct.image || "/icons/icon-192x192.png"}
                  alt={selectedProduct.name}
                  sx={{ borderRadius: 1, maxHeight: 200, objectFit: "cover" }}
                />
                <Typography variant="h6" fontWeight={700}>
                  {currency(Number(selectedProduct.price || 0))}
                </Typography>
                <Typography variant="body2">{selectedProduct.description || "No description."}</Typography>
                <MuiTextField
                  label="Quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  fullWidth
                  inputProps={{ min: 1, max: Number(selectedProduct.stock || 0) }}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedProduct(null)}>Cancel</Button>
              <Button variant="contained" onClick={addToCart}>
                Add to Cart
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog
        open={cartDialogOpen}
        onClose={() => setCartDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Your Cart ({cart.length})</DialogTitle>
        <DialogContent dividers>
          {cart.length === 0 ? (
            <Typography variant="body1">Your cart is empty.</Typography>
          ) : (
            <Stack spacing={2}>
              {cart.map((item) => (
                <Stack key={item.id} direction="row" spacing={1.5} alignItems="center">
                  <Box
                    component="img"
                    src={item.image || "/icons/icon-192x192.png"}
                    alt={item.name}
                    sx={{ width: 64, height: 64, borderRadius: 1, objectFit: "cover", bgcolor: "#eee" }}
                  />
                  <Stack flex={1} spacing={0.5} minWidth={0}>
                    <Typography variant="subtitle2" noWrap>{item.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {currency(Number(item.price || 0))}
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <IconButton
                        size="small"
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        sx={{ color: "#d32f2f" }}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography variant="body2" sx={{ minWidth: 30, textAlign: "center" }}>
                        {item.qty}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        sx={{ color: "#2e7d32" }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <Button size="small" color="error" onClick={() => removeFromCart(item.id)}>
                        Remove
                      </Button>
                    </Stack>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Typography flex={1} fontWeight={700} sx={{ px: 1 }}>
            Subtotal: {currency(cartTotal)}
          </Typography>
          <Button onClick={() => setCartDialogOpen(false)}>Close</Button>
          <Button variant="contained" disabled={cart.length === 0}>
            Checkout
          </Button>
        </DialogActions>
      </Dialog>

      {/* Location/Delivery Address Dialog - Bottom Sheet */}
      <ShopLocationDialog
        open={locationDialogOpen}
        onClose={() => setLocationDialogOpen(false)}
        savedAddresses={savedAddresses}
        onSelectAddress={handleSelectAddress}
        onAddAddress={handleLocationDialogAddAddress}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ width: "100%" }}>
          {snack.message}
        </Alert>
      </Snackbar>

      {/* Bottom Navigation */}
      <ShopBottomNav
        value={navValue}
        onChange={handleBottomNavChange}
        cartCount={cart.length}
      />
    </Box>
  );
}

