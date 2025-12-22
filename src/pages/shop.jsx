import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Stack,
  Typography,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField as MuiTextField,
  Container,
  IconButton,
  Skeleton,
  Snackbar,
  Alert,
  Avatar,
} from "@mui/material";
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Store as StoreIcon,
  ShoppingCart as CartIcon,
} from "@mui/icons-material";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import ShopTopNav from "../components/ShopTopNav";
import ShopBottomNav from "../components/ShopBottomNav";
import ShopLocationDialog from "../components/ShopLocationDialog";

const currency = (n) =>
  typeof n === "number"
    ? `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "₱0.00";

const stockBadge = (stock) => {
  const s = Number(stock || 0);
  if (s <= 0) return { label: "Out of stock", color: "#d32f2f" };
  if (s <= 5) return { label: "Low stock", color: "#ef6c00" };
  return { label: "In stock", color: "#2e7d32" };
};

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
  const fetchedMerchants = useRef(new Set());
  const lastScrollY = useRef(0);
  const categoryToNav = (cat) => {
    if (!cat) return "none";
    const lookup = {
      Food: "food",
      Grocery: "grocery",
      Leisure: "leisure",
    };
    return lookup[cat] || "none";
  };
  const navToCategory = {
    food: "Food",
    grocery: "Grocery",
    leisure: "Leisure",
  };
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

  useEffect(() => {
    setNavValue(categoryToNav(category));
  }, [category]);

  // Derived: categories
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => p.category && set.add(p.category));
    return ["all", ...Array.from(set)];
  }, [products]);

  // Filter/search
  const filtered = useMemo(() => {
    let list = [...products];

    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((p) => (p.name || "").toLowerCase().includes(s));
    }

    if (category !== "all") {
      list = list.filter((p) => p.category === category);
    }

    return list;
  }, [products, search, category]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0),
    [cart]
  );

  const handleBottomNavChange = (value) => {
    if (!value) return;
    setNavValue(value);

    if (navToCategory[value]) {
      setCategory(navToCategory[value]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (value === "cart") {
      setCartDialogOpen(true);
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
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5", pb: 12 }}>
      <ShopTopNav
        search={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        headerHidden={headerHidden}
        locationText={locationText}
        locationSubtext={locationSubtext}
        adHidden={adHidden}
        onLocationClick={() => setLocationDialogOpen(true)}
        onBackClick={() => navigate("/member/dashboard")}
      />

      <Container maxWidth="sm" sx={{ pt: 2 }}>
        {/* Store Header - Show first merchant's store info */}
        {!loading && products.length > 0 && merchants[products[0]?.merchantId] && (
          <Card sx={{ mb: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden", borderRadius: 1 }}>
            {merchants[products[0].merchantId]?.coverImage && (
              <CardMedia
                component="img"
                image={merchants[products[0].merchantId].coverImage}
                alt="Store cover"
                sx={{ height: 120, objectFit: "cover" }}
              />
            )}
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Avatar
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: "#1976d2",
                      mt: merchants[products[0].merchantId]?.coverImage ? -4 : 0,
                    }}
                  >
                    <StoreIcon />
                  </Avatar>
                  <Stack flex={1} spacing={0.5}>
                    <Typography variant="h6" fontWeight="bold">
                      {merchants[products[0].merchantId]?.storeName || "Shop"}
                    </Typography>
                    {merchants[products[0].merchantId]?.storeDesc && (
                      <Typography variant="body2" color="#607d8b">
                        {merchants[products[0].merchantId].storeDesc}
                      </Typography>
                    )}
                    {merchants[products[0].merchantId]?.hours && (
                      <Typography variant="caption" color="#90a4ae">
                        Hours: {merchants[products[0].merchantId].hours}
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Search & Filter */}
        <Card sx={{ mb: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <CardContent>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>{c === "all" ? "All Categories" : c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {loading && (
          <>
            {[...Array(6)].map((_, i) => (
              <Card key={i} sx={{ mb: 1.5 }}>
                <CardContent>
                  <Stack direction="row" spacing={2}>
                    <Skeleton variant="rectangular" width={100} height={100} sx={{ borderRadius: 1 }} />
                    <Stack spacing={1} flex={1}>
                      <Skeleton variant="text" width="80%" />
                      <Skeleton variant="text" width="50%" />
                      <Skeleton variant="text" width="60%" />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {!loading && filtered.length === 0 && (
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                No products found
              </Typography>
              <Typography variant="body2" color="#607d8b">
                Try adjusting your search or filter.
              </Typography>
            </CardContent>
          </Card>
        )}

        {!loading && filtered.map((p) => {
          const badge = stockBadge(p.stock);
          const inCart = cart.find((item) => item.id === p.id);
          return (
            <Card key={p.id} sx={{ mb: 1.5, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <CardContent>
                <Stack direction="row" spacing={2}>
                  <CardMedia
                    component="img"
                    image={p.image || "/icons/icon-192x192.png"}
                    alt={p.name}
                    sx={{ width: 100, height: 100, borderRadius: 1.5, objectFit: "cover", bgcolor: "#eee" }}
                  />
                  <Stack spacing={1} flex={1} minWidth={0}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>{p.name}</Typography>
                    <Typography variant="caption" color="#607d8b">{p.category || "Uncategorized"}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Chip size="small" label={currency(Number(p.price || 0))} sx={{ bgcolor: "#e3f2fd" }} />
                      <Chip size="small" label={badge.label} sx={{ bgcolor: badge.color, color: "#fff" }} />
                    </Stack>
                    {inCart ? (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <IconButton
                          size="small"
                          onClick={() => updateQty(p.id, inCart.qty - 1)}
                          sx={{ color: "#d32f2f" }}
                        >
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                        <Typography variant="body2" sx={{ minWidth: 30, textAlign: "center" }}>
                          {inCart.qty}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => updateQty(p.id, inCart.qty + 1)}
                          sx={{ color: "#2e7d32" }}
                          disabled={Number(p.stock || 0) <= inCart.qty}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          onClick={() => removeFromCart(p.id)}
                        >
                          Remove
                        </Button>
                      </Stack>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CartIcon />}
                        onClick={() => setSelectedProduct(p)}
                        disabled={Number(p.stock || 0) <= 0}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        Add to Cart
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
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
      / >

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

