import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  InputAdornment,
  MenuItem,
  IconButton,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  PhotoCamera,
  Delete,
  AddShoppingCart,
  Category as CategoryIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import MobileAppShell from "../../components/MobileAppShell";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const motionPaper = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.45, ease: "easeOut" },
};

export default function AddProductPage() {
  const merchantId = localStorage.getItem("uid");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [stock, setStock] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("categories") || "[]");
    setCategories(stored);
  }, []);

  const glassStyle = {
    background: "rgba(255,255,255,0.15)",
    backdropFilter: "blur(14px)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.3)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  };

  const normalizePriceInput = (val) => val.replace(/[^0-9.]/g, "");

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;

    if (categories.includes(trimmed)) {
      return setSnack({
        open: true,
        severity: "warning",
        message: "Category already exists",
      });
    }

    const updated = [...categories, trimmed];
    setCategories(updated);
    localStorage.setItem("categories", JSON.stringify(updated));
    setNewCategory("");
  };

  const handleDeleteCategory = (cat) => {
    const updated = categories.filter((c) => c !== cat);
    setCategories(updated);
    localStorage.setItem("categories", JSON.stringify(updated));
    if (category === cat) setCategory("");
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setName("");
    setCategory("");
    setNewCategory("");
    setPrice("");
    setDescription("");
    setStock("");
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !category || !price) {
      return setSnack({
        open: true,
        severity: "error",
        message: "Please fill all required fields",
      });
    }

    setSaving(true);

    try {
      let imageUrl = "";

      if (imageFile) {
        const storageRef = ref(
          storage,
          `products/${merchantId}/${Date.now()}_${imageFile.name}`
        );
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "products"), {
        merchantId,
        name: name.trim(),
        category,
        description: description.trim(),
        price: Number(price),
        stock: stock ? Number(stock) : null,
        image: imageUrl,
        createdAt: serverTimestamp(),
      });

      setSnack({
        open: true,
        severity: "success",
        message: "Product added successfully",
      });

      handleReset();
    } catch (err) {
      console.error(err);
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to add product",
      });
    }

    setSaving(false);
  };

  return (
    <MobileAppShell title="Add Product">
      <motion.div {...motionPaper}>
        <Grid container spacing={2}>
          {/* FORM */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3, ...glassStyle }}>
              <Stack spacing={2} component="form" onSubmit={handleSubmit}>
                <TextField
                  label="Product Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                <Stack direction="row" spacing={1}>
                  <TextField
                    select
                    label="Category"
                    fullWidth
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    {categories.length === 0 && (
                      <MenuItem disabled>No categories</MenuItem>
                    )}
                    {categories.map((cat) => (
                      <MenuItem key={cat} value={cat}>
                        {cat}
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(cat);
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </MenuItem>
                    ))}
                  </TextField>

                  <IconButton
                    onClick={handleAddCategory}
                    disabled={!newCategory.trim()}
                  >
                    <CategoryIcon />
                  </IconButton>
                </Stack>

                <TextField
                  label="New Category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />

                <TextField
                  label="Description"
                  multiline
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <TextField
                  label="Price"
                  value={price}
                  onChange={(e) =>
                    setPrice(normalizePriceInput(e.target.value))
                  }
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">₱</InputAdornment>
                    ),
                  }}
                />

                <TextField
                  label="Stock"
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />

                {/* IMAGE */}
                <Stack direction="row" spacing={2}>
                  <Button component="label" startIcon={<PhotoCamera />}>
                    Upload Image
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </Button>

                  {imagePreview && (
                    <Button
                      color="error"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </Stack>

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<AddShoppingCart />}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Add Product"}
                </Button>
              </Stack>
            </Paper>
          </Grid>

          {/* PREVIEW */}
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3, ...glassStyle }}>
              <Typography fontWeight={700}>
                {name || "Product Name"}
              </Typography>
              <Typography variant="body2">
                {category || "Category"}
              </Typography>
              <Typography variant="body2">
                {price ? `₱ ${Number(price).toLocaleString()}` : "₱ 0.00"}
              </Typography>

              {imagePreview && (
                <Box
                  component="img"
                  src={imagePreview}
                  alt="preview"
                  sx={{
                    width: "100%",
                    mt: 2,
                    borderRadius: 2,
                    objectFit: "cover",
                  }}
                />
              )}
            </Paper>
          </Grid>
        </Grid>
      </motion.div>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
      >
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </MobileAppShell>
  );
}