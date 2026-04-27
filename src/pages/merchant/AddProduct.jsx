import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardMedia,
  Stack,
  Container,
  Paper,
  TextField,
  LinearProgress,
  Alert,
  Snackbar,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../../firebase";
import MerchantBottomNav from "./components/MerchantBottomNav";

// Material Symbols Icon Component
const MaterialIcon = ({ name, filled = false, weight = 400, size = 24, sx = {} }) => (
  <span
    className="material-symbols-outlined"
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}`,
      lineHeight: 1,
      fontFamily: "Material Symbols Outlined",
      ...sx,
    }}
  >
    {name}
  </span>
);

const AddProduct = () => {
  const navigate = useNavigate();
  const merchantId = auth.currentUser?.uid || null;
  const [product, setProduct] = useState({
    name: "",
    price: "",
    stock: "",
    description: "",
    category: "",
    sku: "",
    image: "",
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setSnack({ open: true, severity: "warning", message: "Please select an image file" });
      return;
    }

    try {
      setImageUploading(true);
      setImageProgress(0);
      const storageRef = ref(storage, `products/${merchantId}/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setImageProgress(pct);
        },
        (err) => {
          console.error(err);
          setSnack({ open: true, severity: "error", message: "Image upload failed" });
          setImageUploading(false);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setProduct((p) => ({ ...p, image: url }));
          setSnack({ open: true, severity: "success", message: "Image uploaded" });
          setImageUploading(false);
        }
      );
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Image upload error" });
      setImageUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!product.name?.trim()) {
      setSnack({ open: true, severity: "warning", message: "Product name is required" });
      return;
    }
    if (!product.price || Number(product.price) <= 0) {
      setSnack({ open: true, severity: "warning", message: "Price must be greater than 0" });
      return;
    }
    if (!product.stock || Number(product.stock) < 0) {
      setSnack({ open: true, severity: "warning", message: "Stock must be 0 or higher" });
      return;
    }

    try {
      setSubmitting(true);
      await addDoc(collection(db, "products"), {
        merchantId,
        name: product.name.trim(),
        price: Number(product.price),
        stock: Number(product.stock),
        description: product.description.trim() || "",
        category: product.category.trim() || "",
        sku: product.sku.trim() || "",
        image: product.image || "",
        status: "active",
        approvalStatus: "PENDING",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSnack({ open: true, severity: "success", message: "Product created! Awaiting admin approval." });
      setTimeout(() => navigate("/merchant/products"), 1500);
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Failed to create product" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#f6f7f8",
        display: "flex",
        justifyContent: "center",
        pb: 12,
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
      }}
    >
      <Container
        maxWidth="sm"
        disableGutters
        sx={{
          bgcolor: "white",
          minHeight: "100dvh",
          boxShadow: { sm: "0 0 40px rgba(0,0,0,0.1)" },
        }}
      >
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            bgcolor: "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ px: 2, py: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
            <Button
              onClick={() => navigate("/merchant/products")}
              sx={{
                width: 32,
                height: 32,
                minWidth: "auto",
                p: 0,
                bgcolor: "#f8fafc",
                color: "#64748b",
                "&:hover": { bgcolor: "#e2e8f0" },
              }}
            >
              <MaterialIcon name="arrow_back_ios" size={18} />
            </Button>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
              Add Product
            </Typography>
          </Box>
        </Paper>

        {/* Form */}
        <Box sx={{ px: 2, pt: 2, pb: 2 }}>
          <Stack spacing={2.5}>
            {/* Image Upload */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: "#0f172a" }}>
                Product Image
              </Typography>
              <Card
                elevation={0}
                sx={{ p: 2, bgcolor: "#fafafa", border: "1px solid #e2e8f0" }}
              >
                {product.image ? (
                  <Stack spacing={1.5}>
                    <CardMedia
                      component="img"
                      image={product.image}
                      alt={product.name}
                      sx={{
                        width: "100%",
                        height: 160,
                        borderRadius: "12px",
                        objectFit: "cover",
                        bgcolor: "#eee",
                      }}
                    />
                    <Button
                      color="error"
                      variant="outlined"
                      fullWidth
                      disabled={imageUploading}
                      onClick={() => setProduct((p) => ({ ...p, image: "" }))}
                    >
                      Change Image
                    </Button>
                  </Stack>
                ) : (
                  <Button
                    variant="outlined"
                    component="label"
                    disabled={imageUploading}
                    fullWidth
                    sx={{ py: 2 }}
                  >
                    {imageUploading ? "Uploading..." : "Upload Image"}
                    <input hidden type="file" accept="image/*" onChange={handleImageSelect} />
                  </Button>
                )}
                {imageUploading && (
                  <Box sx={{ mt: 1.5 }}>
                    <LinearProgress variant="determinate" value={imageProgress} />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      {imageProgress}%
                    </Typography>
                  </Box>
                )}
              </Card>
            </Box>

            {/* Product Name */}
            <TextField
              label="Product Name *"
              fullWidth
              required
              value={product.name}
              onChange={(e) => setProduct((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g., Premium Coffee Beans"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                },
              }}
            />

            {/* SKU */}
            <TextField
              label="SKU / Product Code"
              fullWidth
              value={product.sku}
              onChange={(e) => setProduct((p) => ({ ...p, sku: e.target.value }))}
              placeholder="e.g., SKU-001"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                },
              }}
            />

            {/* Category */}
            <TextField
              label="Category"
              fullWidth
              value={product.category}
              onChange={(e) => setProduct((p) => ({ ...p, category: e.target.value }))}
              placeholder="e.g., Beverages, Food, Electronics"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                },
              }}
            />

            {/* Price and Stock Row */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="Price (₱) *"
                type="number"
                fullWidth
                required
                value={product.price}
                onChange={(e) => setProduct((p) => ({ ...p, price: e.target.value }))}
                placeholder="0.00"
                inputProps={{ step: "0.01", min: "0" }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "8px",
                  },
                }}
              />
              <TextField
                label="Stock Quantity *"
                type="number"
                fullWidth
                required
                value={product.stock}
                onChange={(e) => setProduct((p) => ({ ...p, stock: e.target.value }))}
                placeholder="0"
                inputProps={{ min: "0" }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "8px",
                  },
                }}
              />
            </Stack>

            {/* Description */}
            <TextField
              label="Description"
              multiline
              rows={4}
              fullWidth
              value={product.description}
              onChange={(e) => setProduct((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe your product, features, and benefits..."
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                },
              }}
            />

            {/* Info Alert */}
            <Alert severity="info" sx={{ borderRadius: "8px" }}>
              Your product will be reviewed by an admin before it appears on the store.
            </Alert>

            {/* Buttons */}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate("/merchant/products")}
                disabled={submitting || imageUploading}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                fullWidth
                onClick={handleSubmit}
                disabled={submitting || imageUploading}
                sx={{ bgcolor: "#2b7cee" }}
              >
                {submitting ? "Creating..." : "Create Product"}
              </Button>
            </Stack>
          </Stack>
        </Box>

        {/* Snackbar */}
        <Snackbar
          open={snack.open}
          autoHideDuration={3000}
          onClose={() => setSnack({ ...snack, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={snack.severity} variant="filled">
            {snack.message}
          </Alert>
        </Snackbar>

        <MerchantBottomNav activePath="/merchant/add-product" />
      </Container>
    </Box>
  );
};

export default AddProduct;
