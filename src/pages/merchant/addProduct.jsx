import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  TextField,
  Button,
  Stack,
  InputAdornment,
  MenuItem,
  IconButton,
  Snackbar,
  Alert,
  Chip,
  Divider,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Container,
} from "@mui/material";
import {
  PhotoCamera,
  Delete,
  Save,
  Category as CategoryIcon,
  Add,
  Close,
  CheckCircle,
  Inventory,
  AttachMoney,
  Description,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import MobileAppShell from "../../components/MobileAppShell";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const motionCard = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 },
};

export default function AddProductPage() {
  const merchantId = localStorage.getItem("uid");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [stock, setStock] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({
    open: false,
    severity: "success",
    message: "",
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("categories") || "[]");
    setCategories(stored);
  }, []);

  const validateForm = () => {
    const errors = {};
    
    if (!name.trim()) errors.name = "Product name is required";
    if (!category) errors.category = "Category is required";
    if (!price || Number(price) <= 0) errors.price = "Valid price is required";
    if (stock && Number(stock) < 0) errors.stock = "Stock cannot be negative";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const normalizePriceInput = (val) => val.replace(/[^0-9.]/g, "");

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;

    if (categories.includes(trimmed)) {
      setSnack({
        open: true,
        severity: "warning",
        message: "Category already exists",
      });
      return;
    }

    const updated = [...categories, trimmed];
    setCategories(updated);
    localStorage.setItem("categories", JSON.stringify(updated));
    setCategory(trimmed);
    setNewCategory("");
    setCategoryDialogOpen(false);
    
    setSnack({
      open: true,
      severity: "success",
      message: "Category added successfully",
    });
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

    if (!validateForm()) {
      setSnack({
        open: true,
        severity: "error",
        message: "Please fix the form errors",
      });
      return;
    }

    setSaving(true);
    setUploadProgress(0);

    try {
      let imageUrl = "";

      if (imageFile) {
        setUploadProgress(30);
        const storageRef = ref(
          storage,
          `products/${merchantId}/${Date.now()}_${imageFile.name}`
        );
        await uploadBytes(storageRef, imageFile);
        setUploadProgress(60);
        imageUrl = await getDownloadURL(storageRef);
        setUploadProgress(80);
      }

      await addDoc(collection(db, "products"), {
        merchantId,
        name: name.trim(),
        category,
        description: description.trim(),
        price: Number(price),
        stock: stock ? Number(stock) : 0,
        image: imageUrl,
        status: "active",
        createdAt: serverTimestamp(),
      });

      setUploadProgress(100);
      
      setSnack({
        open: true,
        severity: "success",
        message: "🎉 Product added successfully!",
      });

      setTimeout(() => {
        handleReset();
        setUploadProgress(0);
      }, 1000);
    } catch (err) {
      console.error(err);
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to add product. Please try again.",
      });
      setUploadProgress(0);
    }

    setSaving(false);
  };

  return (
    <MobileAppShell title="Add New Product">
      <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5", pb: 2, pt: 2 }}>
        <Container maxWidth="sm" sx={{ pb: 12 }}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ mb: 3, textAlign: "center" }}>
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: "#1976d2",
                  margin: "0 auto 16px",
                  boxShadow: "0 4px 12px rgba(25, 118, 210, 0.2)",
                }}
              >
                <Inventory sx={{ fontSize: 32 }} />
              </Avatar>
              <Typography variant="h5" fontWeight="bold" gutterBottom color="#263238">
                Create Your Product
              </Typography>
              <Typography variant="body2" color="#546e7a">
                Fill in the details to add a new product to your store
              </Typography>
            </Box>
          </motion.div>

          {/* Progress Bar */}
          {saving && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress}
                sx={{
                  bgcolor: "#e0e0e0",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: "#1976d2",
                  },
                }}
              />
              <Typography variant="caption" color="#546e7a" sx={{ mt: 0.5 }}>
                {uploadProgress < 30 && "Preparing..."}
                {uploadProgress >= 30 && uploadProgress < 60 && "Uploading image..."}
                {uploadProgress >= 60 && uploadProgress < 80 && "Processing..."}
                {uploadProgress >= 80 && "Finalizing..."}
              </Typography>
            </Box>
          )}

          {/* Image Upload Section */}
          <motion.div {...motionCard}>
            <Card sx={{ mb: 2, overflow: "visible", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", bgcolor: "white" }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" fontWeight={600} color="#263238">
                    📸 Product Image
                  </Typography>
                  
                  {imagePreview ? (
                    <Box sx={{ position: "relative" }}>
                      <CardMedia
                        component="img"
                        height="200"
                        image={imagePreview}
                        alt="Product preview"
                        sx={{ borderRadius: 2, objectFit: "cover" }}
                      />
                      <IconButton
                        sx={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          bgcolor: "#d32f2f",
                          color: "white",
                          "&:hover": { bgcolor: "#c62828" },
                        }}
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                      >
                        <Close />
                      </IconButton>
                    </Box>
                  ) : (
                    <Button
                      component="label"
                      variant="outlined"
                      fullWidth
                      startIcon={<PhotoCamera />}
                      sx={{
                        height: 120,
                        borderStyle: "dashed",
                        borderWidth: 2,
                        borderColor: "#90caf9",
                        color: "#1976d2",
                        bgcolor: "#e3f2fd",
                        "&:hover": {
                          borderColor: "#1976d2",
                          bgcolor: "#bbdefb",
                        },
                      }}
                    >
                      Upload Product Image
                      <input
                        hidden
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </motion.div>

          {/* Product Details Form */}
          <motion.div {...motionCard} transition={{ delay: 0.1 }}>
            <Card sx={{ mb: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", bgcolor: "white" }}>
              <CardContent>
              <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
                <Typography variant="subtitle1" fontWeight={600} color="#263238">
                  📝 Product Details
                </Typography>

                <TextField
                  label="Product Name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formErrors.name) setFormErrors({ ...formErrors, name: null });
                  }}
                  required
                  fullWidth
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                  placeholder="e.g., Premium Coffee Beans"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "white",
                    },
                  }}
                />

                <Box>
                  <TextField
                    select
                    label="Category"
                    fullWidth
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      if (formErrors.category) setFormErrors({ ...formErrors, category: null });
                    }}
                    required
                    error={!!formErrors.category}
                    helperText={formErrors.category || "Select or create a category"}
                  >
                    {categories.length === 0 && (
                      <MenuItem disabled>No categories yet</MenuItem>
                    )}
                    {categories.map((cat) => (
                      <MenuItem key={cat} value={cat}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          width="100%"
                        >
                          <span>{cat}</span>
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
                        </Stack>
                      </MenuItem>
                    ))}
                  </TextField>

                  <Button
                    fullWidth
                    variant="text"
                    startIcon={<Add />}
                    onClick={() => setCategoryDialogOpen(true)}
                    sx={{ mt: 1 }}
                  >
                    Add New Category
                  </Button>
                </Box>

                <TextField
                  label="Description"
                  multiline
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your product..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Description />
                      </InputAdornment>
                    ),
                  }}
                />

                <Divider />

                <Typography variant="subtitle1" fontWeight={600} color="#263238">
                  💰 Pricing & Inventory
                </Typography>

                <TextField
                  label="Price"
                  value={price}
                  onChange={(e) => {
                    setPrice(normalizePriceInput(e.target.value));
                    if (formErrors.price) setFormErrors({ ...formErrors, price: null });
                  }}
                  required
                  fullWidth
                  error={!!formErrors.price}
                  helperText={formErrors.price}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AttachMoney />₱
                      </InputAdornment>
                    ),
                  }}
                  placeholder="0.00"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "white",
                    },
                  }}
                />

                <TextField
                  label="Stock Quantity"
                  type="number"
                  value={stock}
                  onChange={(e) => {
                    setStock(e.target.value);
                    if (formErrors.stock) setFormErrors({ ...formErrors, stock: null });
                  }}
                  fullWidth
                  error={!!formErrors.stock}
                  helperText={formErrors.stock || "Leave empty for unlimited stock"}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Inventory />
                      </InputAdornment>
                    ),
                  }}
                  placeholder="100"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "white",
                    },
                  }}
                />

                <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleReset}
                    disabled={saving}
                    sx={{
                      borderColor: "#78909c",
                      color: "#546e7a",
                      "&:hover": {
                        borderColor: "#546e7a",
                        bgcolor: "#eceff1",
                      },
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    startIcon={saving ? null : <Save />}
                    disabled={saving}
                    sx={{
                      py: 1.5,
                      fontWeight: 600,
                      bgcolor: "#1976d2",
                      "&:hover": {
                        bgcolor: "#1565c0",
                      },
                      boxShadow: "0 4px 12px rgba(25, 118, 210, 0.3)",
                    }}
                  >
                    {saving ? "Saving..." : "Save Product"}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </motion.div>

        {/* Preview Card */}
        <AnimatePresence>
          {(name || price || imagePreview) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card 
                sx={{ 
                  bgcolor: "#1976d2", 
                  color: "white",
                  boxShadow: "0 4px 16px rgba(25, 118, 210, 0.4)",
                }}
              >
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CheckCircle />
                      <Typography variant="subtitle2">Preview</Typography>
                    </Stack>
                    <Typography variant="h6" fontWeight="bold">
                      {name || "Your Product Name"}
                    </Typography>
                    {category && (
                      <Chip
                        label={category}
                        size="small"
                        sx={{ width: "fit-content", bgcolor: "rgba(255,255,255,0.2)" }}
                      />
                    )}
                    <Typography variant="h5" fontWeight="bold">
                      ₱{price ? Number(price).toLocaleString() : "0.00"}
                    </Typography>
                    {stock && (
                      <Typography variant="caption">
                        Stock: {stock} units
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        </Container>
      </Box>

      {/* Category Dialog */}
      <Dialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CategoryIcon />
            <span>Add New Category</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Category Name"
            fullWidth
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") handleAddCategory();
            }}
            placeholder="e.g., Beverages, Snacks"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddCategory}
            variant="contained"
            disabled={!newCategory.trim()}
          >
            Add Category
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </MobileAppShell>
  );
}