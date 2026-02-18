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
  Alert,
  Switch,
  LinearProgress,
  Snackbar,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth, db, storage } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
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


const motionCard = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 },
};

export default function AddProductPage() {
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState(localStorage.getItem("uid"));
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    description: "",
    taxable: false,
    trackInventory: true,
  });
  const [image, setImage] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });

  useEffect(() => {
    if (merchantId) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setMerchantId(user.uid);
      localStorage.setItem("uid", user.uid);
    });
    return unsub;
  }, [merchantId]);

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

    if (!merchantId) {
      setSnack({ open: true, severity: "error", message: "Not logged in" });
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "products"), {
        merchantId,
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim(),
        price: Number(formData.price),
        image: image?.url || "",
        taxable: formData.taxable,
        trackInventory: formData.trackInventory,
        status: "active",
        approvalStatus: "PENDING",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSnack({ open: true, severity: "success", message: "Product submitted for approval!" });
      setTimeout(() => navigate("/merchant/products"), 1500);
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Failed to create product" });
    }

    setSaving(false);
  };

  const handleRemoveImage = async () => {
    if (!image?.path) return;
    try {
      await deleteObject(ref(storage, image.path));
      setImage(null);
    } catch (err) {
      console.error(err);
    }
  };

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
        <Box sx={{ px: 2, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <IconButton onClick={() => navigate(-1)} sx={{ width: 32, height: 32 }}>
              <MaterialIcon name="close" size={20} />
            </IconButton>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
              Add New Product
            </Typography>
          </Box>
          <Box sx={{ width: 32 }} />
        </Box>
      </Paper>

      <Container maxWidth="sm">
        <Stack spacing={6} sx={{ py: 5 }}>
          {/* Image Upload */}
          <Box>
            <Box
              component="label"
              sx={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: 4,
                border: "2px dashed #cbd5e0",
                bgcolor: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                gap: 1.5,
                position: "relative",
                overflow: "hidden",
                transition: "all 0.2s",
                "&:hover": { borderColor: "#2b7cee", bgcolor: "#f0f7ff" },
              }}
            >
              {image ? (
                <>
                  <Box
                    component="img"
                    src={image.url}
                    alt="Product"
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <IconButton
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveImage();
                    }}
                    sx={{
                      position: "absolute",
                      bottom: 1,
                      right: 1,
                      width: 40,
                      height: 40,
                      bgcolor: "#2b7cee",
                      color: "white",
                      "&:hover": { bgcolor: "#2566c8" },
                    }}
                  >
                    <MaterialIcon name="edit" size={20} />
                  </IconButton>
                </>
              ) : (
                <>
                  <MaterialIcon name="add_a_photo" size={48} />
                  <Box sx={{ textAlign: "center" }}>
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b" }}>
                      Add Product Photo
                    </Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8", mt: 0.5 }}>
                      Recommended size: 1080x1080px
                    </Typography>
                  </Box>
                </>
              )}
              <input hidden type="file" accept="image/*" onChange={handleImageSelect} />
            </Box>
            {imageUploading && (
              <Box sx={{ mt: 1.5 }}>
                <LinearProgress variant="determinate" value={imageProgress} />
                <Typography variant="caption" color="text.secondary">
                  {imageProgress}%
                </Typography>
              </Box>
            )}
          </Box>

          {/* Form Fields */}
          <Stack spacing={4} component="form" onSubmit={handleSubmit}>
            {/* Basic Info */}
            <Stack spacing={3}>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", mb: 1 }}>
                  Product Name
                </Typography>
                <TextField
                  fullWidth
                  placeholder="e.g. Organic Gala Apples"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      bgcolor: "#f8fafc",
                      "&:hover fieldset": { borderColor: "#2b7cee" },
                    },
                  }}
                />
              </Box>

              {/* Category & Price Grid */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", mb: 1 }}>
                    Category
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    SelectProps={{
                      native: true,
                    }}
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
                    Price ($)
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    placeholder="0.00"
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
                  Product Description
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Describe your product details, origin, and benefits..."
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

            {/* Settings */}
            <Box>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", mb: 2 }}>
                Inventory & Settings
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  bgcolor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <Box sx={{ p: 2, borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <MaterialIcon name="receipt_long" />
                    <Typography sx={{ fontWeight: 600 }}>Taxable Item</Typography>
                  </Box>
                  <Switch
                    checked={formData.taxable}
                    onChange={(e) => setFormData({ ...formData, taxable: e.target.checked })}
                    size="small"
                  />
                </Box>
                <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <MaterialIcon name="inventory_2" />
                    <Typography sx={{ fontWeight: 600 }}>Track Inventory</Typography>
                  </Box>
                  <Switch
                    checked={formData.trackInventory}
                    onChange={(e) => setFormData({ ...formData, trackInventory: e.target.checked })}
                    size="small"
                  />
                </Box>
              </Paper>
            </Box>

            {/* Info Alert */}
            <Alert
              icon={<MaterialIcon name="info" />}
              severity="warning"
              sx={{ borderRadius: 2 }}
            >
              New products require admin approval before going live on your store. This usually takes 1-2 business days.
            </Alert>

            {/* Submit Button */}
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
              {saving ? "Submitting..." : "Submit for Approval"}
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