import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField as MuiTextField,
  Switch,
  FormControlLabel,
  Container,
  Snackbar,
  Alert,
  IconButton,
  CircularProgress,
  Drawer,
  useMediaQuery,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
} from "@mui/icons-material";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getStorage } from "firebase/storage";
import AppHeader from "../../components/AppHeader";
import AppBottomNav from "../../components/AppBottomNav";
import Topbar from "../../components/Topbar";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";
import bgImage from "../../assets/bg.jpg";

export default function AdminCategoryManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: "", displayInShop: true, image: null, imageUrl: "" });
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });
  const [uploadingImage, setUploadingImage] = useState(false);
  const isMobile = useMediaQuery("(max-width:900px)");
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);
  const fileInputRef = useRef(null);
  const storage = getStorage();

  // Load categories from Firestore
  useEffect(() => {
    let unsubscribe;
    let isMounted = true;
    
    const loadCategories = async () => {
      try {
        unsubscribe = onSnapshot(
          collection(db, "shopCategories"),
          (snap) => {
            if (!isMounted) return;
            
            try {
              const data = snap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }));
              setCategories(data);
              setLoading(false);
            } catch (err) {
              console.error("Error processing categories data:", err);
              if (isMounted) {
                setSnack({ open: true, severity: "error", message: "Failed to process categories" });
              }
            }
          },
          (err) => {
            // Ignore Firestore persistence errors
            if (err?.code === "failed-precondition" || err?.message?.includes("INTERNAL ASSERTION FAILED")) {
              console.warn("Firestore persistence issue (non-critical):", err.message);
              if (isMounted) {
                setLoading(false);
              }
              return;
            }
            
            console.error("Error loading categories:", err);
            if (isMounted) {
              setSnack({ open: true, severity: "error", message: "Failed to load categories" });
              setLoading(false);
            }
          }
        );
      } catch (err) {
        console.error("Error setting up categories listener:", err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCategories();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (err) {
          console.warn("Error unsubscribing from categories:", err);
        }
      }
    };
  }, []);

  const handleOpenDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        displayInShop: category.displayInShop !== false,
        image: null,
        imageUrl: category.imageUrl || "",
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", displayInShop: true, image: null, imageUrl: "" });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setFormData({ name: "", displayInShop: true, image: null, imageUrl: "" });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }));
    }
  };

  const uploadImage = async (file, categoryName) => {
    try {
      if (!file) {
        throw new Error("No file selected");
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `categories/${categoryName}-${Date.now()}.${fileExt}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      
      return downloadUrl;
    } catch (err) {
      console.error("Image upload error:", err);
      throw new Error(`Image upload failed: ${err.message}`);
    }
  };

  const handleSaveCategory = async () => {
    if (!formData.name.trim()) {
      setSnack({ open: true, severity: "warning", message: "Please enter a category name" });
      return;
    }

    try {
      let imageUrl = formData.imageUrl;

      // Upload new image if selected
      if (formData.image) {
        try {
          setUploadingImage(true);
          imageUrl = await uploadImage(formData.image, formData.name);
        } catch (uploadErr) {
          console.error("Image upload error:", uploadErr);
          setSnack({ open: true, severity: "error", message: "Failed to upload image" });
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      const categoryData = {
        name: formData.name,
        displayInShop: formData.displayInShop,
        imageUrl: imageUrl,
        updatedAt: new Date(),
      };

      const categoryId = editingCategory?.id || formData.name.toLowerCase().replace(/\s+/g, "-");

      try {
        await setDoc(doc(db, "shopCategories", categoryId), categoryData, { merge: true });
      } catch (dbErr) {
        if (dbErr?.message?.includes("INTERNAL ASSERTION FAILED")) {
          console.warn("Firestore persistence issue, retrying...");
          // Retry once on persistence error
          await new Promise(resolve => setTimeout(resolve, 1000));
          await setDoc(doc(db, "shopCategories", categoryId), categoryData, { merge: true });
        } else {
          throw dbErr;
        }
      }

      setSnack({
        open: true,
        severity: "success",
        message: `Category "${formData.name}" ${editingCategory ? "updated" : "created"} successfully`,
      });

      handleCloseDialog();
    } catch (err) {
      console.error("Error saving category:", err);
      setSnack({ open: true, severity: "error", message: "Failed to save category. Please try again." });
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!window.confirm(`Delete category "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "shopCategories", id));
      setSnack({ open: true, severity: "success", message: `Category "${name}" deleted successfully` });
    } catch (err) {
      console.error("Error deleting category:", err);
      setSnack({ open: true, severity: "error", message: "Failed to delete category. Please try again." });
    }
  };

  const handleToggleDisplay = async (id, currentValue) => {
    try {
      await setDoc(doc(db, "shopCategories", id), { displayInShop: !currentValue }, { merge: true });
      setSnack({ 
        open: true, 
        severity: "success", 
        message: `Category ${!currentValue ? "displayed" : "hidden"} in shop` 
      });
    } catch (err) {
      console.error("Error toggling category display:", err);
      setSnack({ open: true, severity: "error", message: "Failed to update category visibility" });
    }
  };

  return (
    <Box sx={{ 
      minHeight: "100vh", 
      bgcolor: "#f5f5f5", 
      pb: { xs: 12, sm: 12, md: 12 },
      backgroundImage: `url(${bgImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      position: "relative",
      "&::before": {
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.1)",
        zIndex: 0,
      },
    }}>
      <Box sx={{ position: "relative", zIndex: 1 }}>
        <AppHeader />
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {!isMobile && (
        <Box sx={{ zIndex: 5 }}>
          <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        </Box>
      )}

      {isMobile && (
        <>
          <AdminSidebarToggle onClick={handleToggleSidebar} />
          <Drawer
            anchor="left"
            open={sidebarOpen}
            onClose={handleToggleSidebar}
            ModalProps={{ keepMounted: true }}
            PaperProps={{
              sx: {
                background: "transparent",
                boxShadow: "none",
              },
            }}
          >
            <AppBottomNav layout="sidebar" open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
          </Drawer>
        </>
      )}

      <Container maxWidth="md" sx={{ pt: 4, pb: 4, position: "relative", zIndex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight="bold" color="#fff">
            Shop Categories
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            size="small"
          >
            Add Category
          </Button>
        </Stack>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary">No categories found. Create one to get started.</Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {categories.map((category) => (
              <Card key={category.id} sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {/* Category Image */}
                    <Box
                      sx={{
                        width: 100,
                        height: 100,
                        bgcolor: "#eee",
                        borderRadius: 1.5,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {category.imageUrl ? (
                        <img
                          src={category.imageUrl}
                          alt={category.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <ImageIcon sx={{ color: "#bbb", fontSize: 40 }} />
                      )}
                    </Box>

                    {/* Category Info */}
                    <Stack flex={1} spacing={1}>
                      <Typography variant="h6" fontWeight="bold">
                        {category.name}
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={category.displayInShop !== false}
                            onChange={() =>
                              handleToggleDisplay(category.id, category.displayInShop)
                            }
                          />
                        }
                        label={
                          category.displayInShop !== false
                            ? "Displayed in shop"
                            : "Hidden from shop"
                        }
                      />
                      {category.updatedAt && (
                        <Typography variant="caption" color="text.secondary">
                          Last updated:{" "}
                          {new Date(category.updatedAt.toDate?.() || category.updatedAt).toLocaleDateString()}
                        </Typography>
                      )}
                    </Stack>

                    {/* Actions */}
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenDialog(category)}
                        title="Edit"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteCategory(category.id, category.name)}
                        title="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Container>

      {/* Add/Edit Category Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {editingCategory ? "Edit Category" : "Add New Category"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <MuiTextField
              label="Category Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              fullWidth
              placeholder="e.g., Electronics, Clothing, Food"
              disabled={uploadingImage}
            />

            {/* Image Upload */}
            <Box>
              <Box
                sx={{
                  width: "100%",
                  height: 150,
                  bgcolor: "#f5f5f5",
                  borderRadius: 1.5,
                  border: "2px dashed #ccc",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 200ms ease",
                  "&:hover": {
                    bgcolor: "#efefef",
                    borderColor: "#1976d2",
                  },
                  position: "relative",
                  overflow: "hidden",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {formData.image || formData.imageUrl ? (
                  <Box
                    component="img"
                    src={formData.image ? URL.createObjectURL(formData.image) : formData.imageUrl}
                    alt="preview"
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <Stack alignItems="center" spacing={1}>
                    <ImageIcon sx={{ fontSize: 40, color: "#ccc" }} />
                    <Typography variant="body2" color="text.secondary">
                      Click to upload category image
                    </Typography>
                  </Stack>
                )}
                {uploadingImage && (
                  <CircularProgress
                    size={40}
                    sx={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                )}
              </Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: "none" }}
                disabled={uploadingImage}
              />
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.displayInShop}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, displayInShop: e.target.checked }))
                  }
                />
              }
              label="Display in shop"
              disabled={uploadingImage}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={uploadingImage}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveCategory}
            disabled={uploadingImage}
          >
            {uploadingImage ? <CircularProgress size={24} /> : editingCategory ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

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

    </Box>
  );
}
