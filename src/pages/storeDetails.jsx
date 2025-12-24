import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Drawer,
  Button,
  IconButton,
  Grid,
  Stack,
  Typography,
  Snackbar,
  Alert,
} from "@mui/material";
import { Add as AddIcon, Remove as RemoveIcon } from "@mui/icons-material";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import StoreTopNav from "../components/StoreTopNav";

const formatPrice = (value) =>
  typeof value === "number"
    ? `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "₱0.00";

export default function StoreDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cart") || "[]");
    } catch {
      return [];
    }
  });
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => navigate(-1), 300);
  };

  useEffect(() => {
    const loadStore = async () => {
      try {
        const snap = await getDoc(doc(db, "merchants", id));
        if (snap.exists()) {
          setStore({ id, ...snap.data() });
        }
      } catch (err) {
        console.error("Failed to load store", err);
      } finally {
        setLoading(false);
      }
    };
    loadStore();
  }, [id]);

  useEffect(() => {
    setProductsLoading(true);

    const productsQuery = query(
      collection(db, "products"),
      where("merchantId", "==", id),
      where("status", "==", "active")
    );

    const unsub = onSnapshot(
      productsQuery,
      (snap) => {
        const list = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setProducts(list);
        setProductsLoading(false);
      },
      (err) => {
        console.error("Failed to load products", err);
        setProductsLoading(false);
      }
    );

    return unsub;
  }, [id]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f5f5f5",
        animation: isExiting ? "slideOutRight 0.3s ease-out forwards" : "slideInRight 0.3s ease-out",
        "@keyframes slideInRight": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "@keyframes slideOutRight": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
      }}
    >
      <StoreTopNav store={store} loading={loading} onBack={handleBack} />

      {/* Scrollable Content */}
      <Box sx={{ pt: 55, px: 0, pb: 16 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ mt: 4 }}>
            <CircularProgress />
          </Stack>
        ) : !store ? (
          <Typography variant="body1" sx={{ textAlign: "center", mt: 5 }}>
            Store not found
          </Typography>
        ) : (
          <Stack spacing={3}>
            <Card sx={{ mt: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", borderRadius: 2 }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6" fontWeight={700}>
                    Products
                  </Typography>

                  {productsLoading ? (
                    <Stack alignItems="center" sx={{ py: 3 }}>
                      <CircularProgress size={28} />
                    </Stack>
                  ) : products.length === 0 ? (
                    <Typography variant="body2" color="#607d8b">
                      No products available for this store yet.
                    </Typography>
                  ) : (
                    <Grid container spacing={2}>
                      {products.map((product) => (
                        <Grid item xs={12} key={product.id}>
                          <Card sx={{ overflow: "hidden", borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", height: 130 }}>
                            <Stack direction="row" alignItems="stretch" spacing={0} sx={{ height: "100%" }}>
                              <CardContent sx={{ flex: 1, p: 1.5, display: "flex", flexDirection: "column" }}>
                                <Stack spacing={0.5} sx={{ flex: 1 }}>
                                  <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                                    {product.name || "Product"}
                                  </Typography>
                                  <Typography variant="body2" color="#2e7d32" fontWeight={700}>
                                    {formatPrice(Number(product.price || 0))}
                                  </Typography>
                                  <Typography variant="body2" color="#607d8b" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>
                                    {product.description || "No description available."}
                                  </Typography>
                                </Stack>
                              </CardContent>
                              <Box sx={{ width: 120, position: "relative", bgcolor: "#eee", flexShrink: 0 }}>
                                <Box
                                  component="img"
                                  src={product.image || "/icons/icon-192x192.png"}
                                  alt={product.name || "Product"}
                                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                                <IconButton
                                  aria-label="order"
                                  onClick={() => {
                                    setSelectedProduct(product);
                                    setQuantity(1);
                                  }}
                                  sx={{
                                    position: "absolute",
                                    right: 6,
                                    bottom: 6,
                                    bgcolor: "#007aff",
                                    color: "#fff",
                                    "&:hover": { bgcolor: "#0062cc" },
                                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                                  }}
                                  size="small"
                                >
                                  <AddIcon />
                                </IconButton>
                              </Box>
                            </Stack>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}
      </Box>

      {/* Bottom-Sheet Order Panel */}
      <Drawer
        anchor="bottom"
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            p: 2,
          },
        }}
      >
        <Stack spacing={1.5}>
          <Stack spacing={1.5} direction="row" alignItems="center">
            <Box sx={{ width: 96, height: 72, bgcolor: "#eee", borderRadius: 1, overflow: "hidden" }}>
              <Box
                component="img"
                src={selectedProduct?.image || "/icons/icon-192x192.png"}
                alt={selectedProduct?.name || "Product"}
                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </Box>
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>{selectedProduct?.name}</Typography>
              <Typography variant="body2" color="#2e7d32" fontWeight={700}>
                {formatPrice(Number(selectedProduct?.price || 0))}
              </Typography>
              <Typography variant="body2" color="#607d8b">
                {selectedProduct?.description || "No description available."}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton aria-label="decrease" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <RemoveIcon />
              </IconButton>
              <Typography variant="subtitle1" fontWeight={700} sx={{ minWidth: 28, textAlign: "center" }}>
                {quantity}
              </Typography>
              <IconButton aria-label="increase" onClick={() => setQuantity((q) => q + 1)}>
                <AddIcon />
              </IconButton>
            </Stack>

            <Button
              variant="contained"
              onClick={() => {
                const item = selectedProduct;
                if (!item) return;
                const existing = cart.find((c) => c.id === item.id);
                let next;
                if (existing) {
                  next = cart.map((c) => (c.id === item.id ? { ...c, qty: (c.qty || 0) + quantity } : c));
                } else {
                  next = [
                    ...cart,
                    {
                      id: item.id,
                      name: item.name,
                      price: item.price,
                      image: item.image,
                      qty: quantity,
                    },
                  ];
                }
                setCart(next);
                try {
                  localStorage.setItem("cart", JSON.stringify(next));
                } catch {}
                setSnack({ open: true, severity: "success", message: `${item.name} added to cart!` });
                setSelectedProduct(null);
              }}
            >
              Add {formatPrice(Number(selectedProduct?.price || 0) * quantity)}
            </Button>
          </Stack>
        </Stack>
      </Drawer>

      {/* Sticky Cart Bar */}
      {cart.length > 0 && (
        <Box sx={{ position: "fixed", bottom: 12, left: 12, right: 12, zIndex: 1050 }}>
          <Card sx={{ borderRadius: 999, boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Cart • {cart.reduce((sum, i) => sum + Number(i.qty || 0), 0)} items
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" fontWeight={700}>
                  {formatPrice(cart.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.qty || 0), 0))}
                </Typography>
                <Button variant="contained" size="small" onClick={() => navigate('/cart')}>View Cart</Button>
              </Stack>
            </Stack>
          </Card>
        </Box>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: "100%" }}>
          {snack.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}
