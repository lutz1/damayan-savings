import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Typography,
  Divider,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";

const formatPrice = (value) =>
  typeof value === "number"
    ? `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "₱0.00";

export default function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cart") || "[]");
    } catch {
      return [];
    }
  });
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });

  const saveCart = (newCart) => {
    setCart(newCart);
    try {
      localStorage.setItem("cart", JSON.stringify(newCart));
    } catch (err) {
      console.error("Failed to save cart", err);
    }
  };

  const updateQty = (id, qty) => {
    if (qty < 1) {
      removeItem(id);
      return;
    }
    const newCart = cart.map((item) => (item.id === id ? { ...item, qty } : item));
    saveCart(newCart);
  };

  const removeItem = (id) => {
    const newCart = cart.filter((item) => item.id !== id);
    saveCart(newCart);
    setSnack({ open: true, severity: "info", message: "Item removed from cart" });
  };

  const clearCart = () => {
    saveCart([]);
    setSnack({ open: true, severity: "info", message: "Cart cleared" });
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      setSnack({ open: true, severity: "warning", message: "Your cart is empty" });
      return;
    }
    // TODO: Implement checkout flow (payment, order creation, etc.)
    setSnack({ open: true, severity: "success", message: "Checkout coming soon!" });
  };

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  const deliveryFee = 0; // TODO: Calculate based on store/location
  const total = subtotal + deliveryFee;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5", pb: 20 }}>
      <AppBar position="fixed" sx={{ bgcolor: "#435272ff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate(-1)} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 1 }}>
            My Cart
          </Typography>
          {cart.length > 0 && (
            <Button color="inherit" onClick={clearCart} sx={{ textTransform: "none" }}>
              Clear All
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ pt: 10, pb: 4 }}>
        {cart.length === 0 ? (
          <Stack alignItems="center" spacing={2} sx={{ mt: 8 }}>
            <Typography variant="h6" color="#607d8b">
              Your cart is empty
            </Typography>
            <Button variant="contained" onClick={() => navigate("/shop")}>
              Browse Products
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {cart.map((item) => (
              <Card key={item.id} sx={{ borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                <CardContent sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: 1,
                        overflow: "hidden",
                        bgcolor: "#eee",
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        component="img"
                        src={item.image || "/icons/icon-192x192.png"}
                        alt={item.name || "Product"}
                        sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </Box>

                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {item.name || "Product"}
                      </Typography>
                      <Typography variant="body2" color="#2e7d32" fontWeight={700}>
                        {formatPrice(Number(item.price || 0))}
                      </Typography>

                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <IconButton
                            size="small"
                            onClick={() => updateQty(item.id, (item.qty || 1) - 1)}
                            aria-label="decrease"
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <Typography variant="body2" fontWeight={700} sx={{ minWidth: 24, textAlign: "center" }}>
                            {item.qty || 1}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => updateQty(item.id, (item.qty || 1) + 1)}
                            aria-label="increase"
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Stack>

                        <Box sx={{ flex: 1 }} />

                        <Typography variant="subtitle2" fontWeight={700}>
                          {formatPrice(Number(item.price || 0) * Number(item.qty || 1))}
                        </Typography>

                        <IconButton
                          size="small"
                          onClick={() => removeItem(item.id)}
                          aria-label="remove"
                          sx={{ color: "#d32f2f" }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}

            <Card sx={{ borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", mt: 2 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
                  Order Summary
                </Typography>

                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="#607d8b">
                      Subtotal ({cart.reduce((sum, i) => sum + Number(i.qty || 0), 0)} items)
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {formatPrice(subtotal)}
                    </Typography>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="#607d8b">
                      Delivery Fee
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {formatPrice(deliveryFee)}
                    </Typography>
                  </Stack>

                  <Divider sx={{ my: 1 }} />

                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle1" fontWeight={700}>
                      Total
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="#2e7d32">
                      {formatPrice(total)}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}
      </Container>

      {cart.length > 0 && (
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: "#fff",
            borderTop: "1px solid #e0e0e0",
            p: 2,
            boxShadow: "0 -2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <Container maxWidth="sm">
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Stack>
                <Typography variant="caption" color="#607d8b">
                  Total
                </Typography>
                <Typography variant="h6" fontWeight={700} color="#2e7d32">
                  {formatPrice(total)}
                </Typography>
              </Stack>
              <Button
                variant="contained"
                size="large"
                onClick={handleCheckout}
                sx={{
                  flex: 1,
                  maxWidth: 200,
                  bgcolor: "#007aff",
                  "&:hover": { bgcolor: "#0062cc" },
                  textTransform: "none",
                  fontWeight: 700,
                }}
              >
                Proceed to Checkout
              </Button>
            </Stack>
          </Container>
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
