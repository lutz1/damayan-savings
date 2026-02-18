import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  IconButton,
  Divider,
  Switch,
  LinearProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../../firebase";
import BottomNav from "../../components/BottomNav";

const MaterialIcon = ({ name, size = 24, filled = false }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: `${size}px`,
      fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
    }}
  >
    {name}
  </span>
);

export default function EditProductPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const merchantId = localStorage.getItem("uid");

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    sku: "",
    price: "",
    description: "",
    available: true,
    promotion: false,
    discountPercentage: "",
  });
  const [image, setImage] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "shopCategories"),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data().name)
          .filter(Boolean)
          .sort();
        setCategories(list);
      },
      (err) => {
        console.error("Categories listener error:", err);
        setSnack({ open: true, severity: "error", message: "Unable to load categories" });
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!productId) return;

    const loadProduct = async () => {
      try {
        const docSnap = await getDoc(doc(db, "products", productId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            name: data.name || "",
            category: data.category || "",
            sku: data.sku || "",
            price: data.price || "",
            description: data.description || "",
            available: data.available !== false,
            promotion: data.promotion || false,
            discountPercentage: data.discountPercentage || "",
          });
          if (data.image) {
            setImage({ url: data.image });
          }
        }
      } catch (err) {
        console.error(err);
        setSnack({ open: true, severity: "error", message: "Failed to load product" });
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId]);

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setSnack({ open: true, severity: "warning", message: "Please select a valid image" });
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
          if (image?.path) {
            try {
              await deleteObject(ref(storage, image.path));
            } catch (_) {}
          }
          setImage({ url, path: task.snapshot.ref.fullPath });
          setImageUploading(false);
        }
      );
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Upload error" });
      setImageUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.category || !formData.price) {
      setSnack({ open: true, severity: "error", message: "Please fill all required fields" });
      return;
    }

    setSaving(true);

    try {
      const updateData = {
        name: formData.name.trim(),
        category: formData.category,
        sku: formData.sku.trim(),
        price: Number(formData.price),
        description: formData.description.trim(),
        available: formData.available,
        promotion: formData.promotion,
        discountPercentage: formData.promotion ? Number(formData.discountPercentage) : 0,
        updatedAt: serverTimestamp(),
      };

      if (image?.url) {
        updateData.image = image.url;
      }

      await updateDoc(doc(db, "products", productId), updateData);
      setSnack({ open: true, severity: "success", message: "Product updated successfully!" });
      setTimeout(() => navigate("/merchant/products"), 1500);
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Failed to update product" });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ textAlign: "center" }}>
          <LinearProgress sx={{ my: 2 }} />
          <Typography>Loading product...</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "white", pb: 28 }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <Box sx={{ px: 2, py: 2, display: "flex", alignItems: "center" }}>
          <IconButton onClick={() => navigate(-1)} sx={{ width: 32, height: 32, mr: 1 }}>
            <MaterialIcon name="arrow_back_ios" size={18} />
          </IconButton>
          <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", flex: 1, textAlign: "center", pr: 5 }}>
            Edit Product Details
          </Typography>
        </Box>
      </Paper>

      <Container maxWidth="sm">
        <Stack spacing={6} sx={{ py: 4 }}>
          {/* Image Section */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <Box
              component="label"
              sx={{
                position: "relative",
                cursor: "pointer",
              }}
            >
              <Box
                component="img"
                src={image?.url || "/icons/icon-192x192.png"}
                alt="Product"
                sx={{
                  width: 160,
                  height: 160,
                  borderRadius: 3,
                  objectFit: "cover",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  border: "4px solid white",
                }}
              />
              <IconButton
                onClick={(e) => e.stopPropagation()}
                component="label"
                sx={{
                  position: "absolute",
                  bottom: -8,
                  right: -8,
                  width: 40,
                  height: 40,
                  bgcolor: "#2b7cee",
                  color: "white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  "&:hover": { bgcolor: "#2566c8" },
                }}
              >
                <MaterialIcon name="photo_camera" size={20} />
                <input hidden type="file" accept="image/*" onChange={handleImageSelect} />
              </IconButton>
            </Box>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "#94a3b8" }}>
              Product Image
            </Typography>
            {imageUploading && (
              <Box sx={{ width: "100%", maxWidth: 200 }}>
                <LinearProgress variant="determinate" value={imageProgress} />
                <Typography variant="caption" color="text.secondary">
                  {imageProgress}%
                </Typography>
              </Box>
            )}
          </Box>

          {/* Form */}
          <Stack spacing={4} component="form" onSubmit={handleSubmit}>
            {/* Basic Info */}
            <Stack spacing={3}>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", mb: 1 }}>
                  Product Name
                </Typography>
                <TextField
                  fullWidth
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      bgcolor: "#f8fafc",
                    },
                  }}
                />
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", mb: 1 }}>
                    SKU
                  </Typography>
                  <TextField
                    fullWidth
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        bgcolor: "#f8fafc",
                      },
                    }}
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", mb: 1 }}>
                    Price ($)
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        bgcolor: "#f8fafc",
                      },
                    }}
                  />
                </Box>
              </Box>

              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", mb: 1 }}>
                  Category
                </Typography>
                <TextField
                  select
                  fullWidth
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  SelectProps={{ native: true }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      bgcolor: "#f8fafc",
                    },
                  }}
                >
                  <option value="">Select...</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </TextField>
              </Box>

              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", mb: 1 }}>
                  Description
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      bgcolor: "#f8fafc",
                    },
                  }}
                />
              </Box>
            </Stack>

            {/* Availability Settings */}
            <Box>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", mb: 2 }}>
                Settings
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  bgcolor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <Box sx={{ p: 3, borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <MaterialIcon name="inventory_2" size={20} sx={{ color: "#2b7cee" }} />
                    <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>Availability</Typography>
                  </Box>
                  <Switch
                    checked={formData.available}
                    onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                    size="small"
                  />
                </Box>

                <Box sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <MaterialIcon name="sell" size={20} sx={{ color: "#f59e0b" }} />
                      <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>Set Promotion</Typography>
                    </Box>
                    <Switch
                      checked={formData.promotion}
                      onChange={(e) => setFormData({ ...formData, promotion: e.target.checked })}
                      size="small"
                    />
                  </Box>

                  {formData.promotion && (
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: "#fef3c7",
                        border: "1px solid #fcd34d",
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#65350f", flex: 1 }}>
                        Discount Percentage
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <TextField
                          type="number"
                          value={formData.discountPercentage}
                          onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                          inputProps={{ min: 0, max: 100, step: 1 }}
                          sx={{
                            width: 60,
                            "& .MuiOutlinedInput-root": {
                              height: 32,
                              borderRadius: 1,
                            },
                            "& input": {
                              textAlign: "center",
                              fontSize: "0.875rem",
                            },
                          }}
                        />
                        <Typography sx={{ fontWeight: 700, color: "#2b7cee", fontSize: "0.875rem" }}>%</Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Box>

            {/* Update Button */}
            <Button
              type="submit"
              fullWidth
              disabled={saving || imageUploading}
              sx={{
                py: 2,
                bgcolor: "#2b7cee",
                color: "white",
                fontWeight: 700,
                fontSize: "1rem",
                borderRadius: 2,
                boxShadow: "0 4px 12px rgba(43, 124, 238, 0.3)",
                "&:hover": { bgcolor: "#2566c8" },
              }}
            >
              {saving ? "Updating..." : "Update Product"}
            </Button>
          </Stack>
        </Stack>
      </Container>

      {/* Bottom Nav */}
      <BottomNav />

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
    </Box>
  );
}
