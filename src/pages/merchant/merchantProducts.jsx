import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  IconButton,
  Chip,
  Stack,
  Container,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Switch,
  LinearProgress,
  Alert,
  Snackbar,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db, storage } from "../../firebase";
import BottomNav from "../../components/BottomNav";

// Material Symbols Icon Component
const MaterialIcon = ({ name, filled = false, weight = 400, size = 24, sx = {} }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}`,
      ...sx,
    }}
  >
    {name}
  </span>
);

const MerchantProducts = () => {
  const navigate = useNavigate();
  const merchantId = localStorage.getItem("uid");
  const [products, setProducts] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all"); // all, approved, pending
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });

  useEffect(() => {
    if (!merchantId) return;

    const unsubProducts = onSnapshot(
      query(
        collection(db, "products"),
        where("merchantId", "==", merchantId),
        orderBy("updatedAt", "desc")
      ),
      (snap) => setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Products listener error:", err);
        setSnack({ open: true, severity: "error", message: "Unable to load products list" });
      }
    );

    return () => unsubProducts();
  }, [merchantId]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.status !== "deleted");

    if (searchQuery.trim()) {
      const s = searchQuery.trim().toLowerCase();
      list = list.filter((p) => (p.name || "").toLowerCase().includes(s));
    }

    if (filterStatus === "approved") {
      list = list.filter((p) => p.approvalStatus === "APPROVED" || p.status === "active");
    } else if (filterStatus === "pending") {
      list = list.filter((p) => p.approvalStatus === "PENDING" || p.status === "pending");
    }

    return list.sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const bTime = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }, [products, filterStatus, searchQuery]);

  const getWorkflowStatus = (product) => {
    const approval = product.approvalStatus || "PENDING";
    if (approval === "APPROVED") return { label: "LIVE", color: "green", icon: "check_circle" };
    if (approval === "REJECTED") return { label: "REJECTED", color: "red", icon: "cancel" };
    return { label: "PENDING", color: "amber", icon: "schedule" };
  };

  const getWorkflowTimeline = (product) => {
    const events = [];

    if (product.createdAt) {
      events.push({
        icon: "check_circle",
        label: "Merchant: Item Submitted",
        timestamp: product.createdAt,
        completed: true,
      });
    }

    if (product.approvalStatus === "APPROVED") {
      events.push({
        icon: "check_circle",
        label: "Admin: Content Approved",
        timestamp: product.approvedAt || product.updatedAt,
        completed: true,
      });
    } else if (product.approvalStatus === "PENDING") {
      events.push({
        icon: "schedule",
        label: "Admin: Reviewing Details",
        timestamp: null,
        completed: false,
      });
    } else if (product.approvalStatus === "REJECTED") {
      events.push({
        icon: "cancel",
        label: "Admin: Changes Required",
        timestamp: product.updatedAt,
        completed: true,
      });
    }

    return events;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Pending";
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleEditProduct = (product) => {
    setEditingProduct({ ...product });
  };

  const handleToggleActive = (product) => {
    const next = product.status === "active" ? "inactive" : "active";
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, status: next } : p))
    );
    updateDoc(doc(db, "products", product.id), {
      status: next,
      updatedAt: serverTimestamp(),
    }).catch(() => setSnack({ open: true, severity: "error", message: "Failed to update" }));
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? You can't undo this.`)) return;

    try {
      if (product.image) {
        try {
          await deleteObject(ref(storage, product.image));
        } catch (e) {}
      }
      await updateDoc(doc(db, "products", product.id), {
        status: "deleted",
        image: "",
        updatedAt: serverTimestamp(),
      });
      setSnack({ open: true, severity: "success", message: "Product deleted" });
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Failed to delete product" });
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setSnack({ open: true, severity: "warning", message: "Please select an image file" });
      return;
    }

    if (!editingProduct) return;

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
          const prev = editingProduct?.image;
          if (prev) {
            try {
              await deleteObject(ref(storage, prev));
            } catch (_) {}
          }
          setEditingProduct((p) => ({ ...p, image: url }));
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

  const handleSaveProduct = async () => {
    if (!editingProduct?.id) return;
    try {
      await updateDoc(doc(db, "products", editingProduct.id), {
        name: (editingProduct.name || "").trim(),
        price: Number(editingProduct.price || 0),
        stock: Number(editingProduct.stock || 0),
        description: (editingProduct.description || "").trim(),
        image: editingProduct.image || "",
        category: editingProduct.category || "",
        updatedAt: serverTimestamp(),
      });
      setEditingProduct(null);
      setSnack({ open: true, severity: "success", message: "Product updated successfully" });
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Failed to update product" });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f6f7f8",
        display: "flex",
        justifyContent: "center",
        pb: 12,
      }}
    >
      <Container
        maxWidth="sm"
        disableGutters
        sx={{
          bgcolor: "white",
          minHeight: "100vh",
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
          <Box sx={{ px: 2, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <IconButton
                onClick={() => navigate(-1)}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: "#f8fafc",
                  color: "#64748b",
                }}
              >
                <MaterialIcon name="arrow_back_ios" size={18} />
              </IconButton>
              <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
                Product Workflow
              </Typography>
            </Box>
            <Button
              onClick={() => navigate("/merchant/add-product")}
              sx={{
                width: 40,
                height: 40,
                minWidth: "auto",
                borderRadius: "50%",
                bgcolor: "#2b7cee",
                color: "white",
                p: 0,
                boxShadow: "0 4px 12px rgba(43, 124, 238, 0.3)",
                "&:hover": { bgcolor: "#2566c8" },
              }}
            >
              <MaterialIcon name="add" size={20} filled />
            </Button>
          </Box>

          {/* Search */}
          <Box sx={{ px: 2, pb: 1.5 }}>
            <TextField
              fullWidth
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{
                "& input": { fontSize: "0.875rem" },
              }}
            />
          </Box>

          {/* Filter Tabs */}
          <Box sx={{ px: 2, pb: 2, display: "flex", gap: 1 }}>
            {[
              { label: "All", value: "all" },
              { label: "Approved", value: "approved" },
              { label: "Pending", value: "pending" },
            ].map((tab) => (
              <Button
                key={tab.value}
                onClick={() => setFilterStatus(tab.value)}
                sx={{
                  flex: 1,
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  py: 1,
                  borderRadius: "8px",
                  textTransform: "none",
                  ...(filterStatus === tab.value
                    ? {
                        bgcolor: "#2b7cee",
                        color: "white",
                      }
                    : {
                        bgcolor: "#f1f5f9",
                        color: "#64748b",
                        border: "1px solid #e2e8f0",
                      }),
                }}
              >
                {tab.label}
              </Button>
            ))}
          </Box>
        </Paper>

        {/* Product Cards */}
        <Box sx={{ px: 2, pt: 2, pb: 2 }}>
          {filtered.length === 0 ? (
            <Box
              sx={{
                py: 6,
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              <MaterialIcon name="inventory" size={48} sx={{ color: "#cbd5e1" }} />
              <Typography sx={{ mt: 2 }}>No products found</Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {filtered.map((product) => {
                const workflowStatus = getWorkflowStatus(product);
                const events = getWorkflowTimeline(product);

                return (
                  <Card
                    key={product.id}
                    sx={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      overflow: "hidden",
                    }}
                  >
                    {/* Product Header */}
                    <Box sx={{ p: 2, display: "flex", gap: 2, justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Box sx={{ position: "relative", flexShrink: 0 }}>
                        <CardMedia
                          component="img"
                          image={product.image || "/icons/icon-192x192.png"}
                          alt={product.name}
                          sx={{
                            width: 80,
                            height: 80,
                            borderRadius: "12px",
                            objectFit: "cover",
                            bgcolor: "#eee",
                            grayscale: workflowStatus.color === "green" ? 0 : 0.5,
                          }}
                        />
                        <Box
                          sx={{
                            position: "absolute",
                            top: -8,
                            right: -8,
                            bgcolor: workflowStatus.color === "green" ? "#10b981" : 
                                     workflowStatus.color === "amber" ? "#f59e0b" : "#ef4444",
                            color: "white",
                            px: 1,
                            py: 0.5,
                            borderRadius: "9999px",
                            fontSize: "0.625rem",
                            fontWeight: 700,
                            border: "2px solid white",
                            ring: "2px",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          }}
                        >
                          {workflowStatus.label}
                        </Box>
                      </Box>

                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
                            {product.name}
                          </Typography>
                          <Switch
                            checked={product.status === "active"}
                            onChange={() => handleToggleActive(product)}
                            size="small"
                          />
                        </Box>
                        <Typography sx={{ fontSize: "0.875rem", color: "#64748b", mt: 0.5 }}>
                          SKU: {product.sku || "N/A"} • ₱{Number(product.price || 0).toFixed(2)}
                        </Typography>
                        <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8", mt: 0.5 }}>
                          Stock: {product.stock || 0}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}>
                          <MaterialIcon
                            name={workflowStatus.icon}
                            size={16}
                            sx={{
                              color:
                                workflowStatus.color === "green"
                                  ? "#10b981"
                                  : workflowStatus.color === "amber"
                                  ? "#f59e0b"
                                  : "#ef4444",
                            }}
                          />
                          <Typography
                            sx={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              color:
                                workflowStatus.color === "green"
                                  ? "#10b981"
                                  : workflowStatus.color === "amber"
                                  ? "#f59e0b"
                                  : "#ef4444",
                            }}
                          >
                            {workflowStatus.color === "green"
                              ? "Live on Store"
                              : workflowStatus.color === "amber"
                              ? "Waiting for Admin"
                              : "Changes Required"}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Workflow Timeline */}
                    <Box
                      sx={{
                        bgcolor: "rgba(15, 23, 42, 0.02)",
                        px: 2,
                        py: 2,
                        borderTop: "1px solid #e2e8f0",
                        position: "relative",
                        "&::before": {
                          content: '""',
                          position: "absolute",
                          left: "20px",
                          top: 0,
                          bottom: 0,
                          width: "2px",
                          bgcolor: "#e2e8f0",
                          zIndex: 0,
                        },
                      }}
                    >
                      <Stack spacing={1.5} sx={{ position: "relative", zIndex: 1, pl: 4 }}>
                        {events.map((event, idx) => (
                          <Box key={idx} sx={{ display: "flex", gap: 1.5 }}>
                            <Box
                              sx={{
                                position: "absolute",
                                left: 0,
                                top: "6px",
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                bgcolor:
                                  event.completed && event.icon === "check_circle"
                                    ? "#10b981"
                                    : event.completed && event.icon === "cancel"
                                    ? "#ef4444"
                                    : "#f59e0b",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "4px solid rgba(255, 255, 255, 0.8)",
                                zIndex: 10,
                              }}
                            >
                              <MaterialIcon
                                name={event.icon}
                                size={12}
                                sx={{ color: "white" }}
                              />
                            </Box>
                            <Box>
                              <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a" }}>
                                {event.label}
                              </Typography>
                              {event.timestamp ? (
                                <Typography
                                  sx={{
                                    fontSize: "0.625rem",
                                    color: "#94a3b8",
                                  }}
                                >
                                  {formatDate(event.timestamp)}
                                </Typography>
                              ) : (
                                <Typography
                                  sx={{
                                    fontSize: "0.625rem",
                                    color: "#f59e0b",
                                    fontWeight: 600,
                                  }}
                                >
                                  Pending
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    </Box>

                    {/* Actions */}
                    <Box sx={{ px: 2, py: 2, display: "flex", gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        onClick={() => handleEditProduct(product)}
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          borderRadius: "8px",
                        }}
                      >
                        Edit
                      </Button>
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => handleDeleteProduct(product)}
                        sx={{ flexShrink: 0 }}
                      >
                        <MaterialIcon name="delete" size={20} />
                      </IconButton>
                    </Box>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Box>

        <BottomNav />

        {/* Edit Product Dialog */}
        <Dialog
          open={Boolean(editingProduct)}
          onClose={() => setEditingProduct(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Edit Product</DialogTitle>
          <DialogContent dividers>
            {editingProduct ? (
              <Stack spacing={2} sx={{ mt: 1 }}>
                {/* Image Upload */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    Product Image
                  </Typography>
                  <Card
                    elevation={0}
                    sx={{ p: 1, bgcolor: "#fafafa", border: "1px solid #e2e8f0" }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <CardMedia
                        component="img"
                        image={editingProduct.image || "/icons/icon-192x192.png"}
                        alt={editingProduct.name}
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: "8px",
                          objectFit: "cover",
                          bgcolor: "#eee",
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Button
                          variant="outlined"
                          component="label"
                          disabled={imageUploading}
                          fullWidth
                        >
                          {imageUploading ? "Uploading..." : "Change Image"}
                          <input hidden type="file" accept="image/*" onChange={handleImageSelect} />
                        </Button>
                        {editingProduct.image && (
                          <Button
                            color="error"
                            variant="text"
                            disabled={imageUploading}
                            fullWidth
                            sx={{ mt: 1 }}
                            onClick={async () => {
                              try {
                                await deleteObject(ref(storage, editingProduct.image));
                                setEditingProduct((s) => ({ ...s, image: "" }));
                                setSnack({ open: true, severity: "success", message: "Image removed" });
                              } catch (err) {
                                setSnack({ open: true, severity: "error", message: "Failed to remove image" });
                              }
                            }}
                          >
                            Remove Image
                          </Button>
                        )}
                      </Box>
                    </Stack>
                    {imageUploading && (
                      <Box sx={{ mt: 1 }}>
                        <LinearProgress variant="determinate" value={imageProgress} />
                        <Typography variant="caption" color="text.secondary">
                          {imageProgress}%
                        </Typography>
                      </Box>
                    )}
                  </Card>
                </Box>

                <TextField
                  label="Product Name"
                  fullWidth
                  value={editingProduct.name || ""}
                  onChange={(e) =>
                    setEditingProduct((p) => ({ ...p, name: e.target.value }))
                  }
                />
                <TextField
                  label="Category"
                  fullWidth
                  value={editingProduct.category || ""}
                  onChange={(e) =>
                    setEditingProduct((p) => ({ ...p, category: e.target.value }))
                  }
                />
                <TextField
                  label="Price"
                  type="number"
                  fullWidth
                  value={editingProduct.price || ""}
                  onChange={(e) =>
                    setEditingProduct((p) => ({ ...p, price: e.target.value }))
                  }
                />
                <TextField
                  label="Stock"
                  type="number"
                  fullWidth
                  value={editingProduct.stock || ""}
                  onChange={(e) =>
                    setEditingProduct((p) => ({ ...p, stock: e.target.value }))
                  }
                />
                <TextField
                  label="Description"
                  multiline
                  rows={3}
                  fullWidth
                  value={editingProduct.description || ""}
                  onChange={(e) =>
                    setEditingProduct((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                />
              </Stack>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingProduct(null)} disabled={imageUploading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveProduct}
              disabled={imageUploading}
              sx={{ bgcolor: "#2b7cee" }}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

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
      </Container>
    </Box>
  );
};

export default MerchantProducts;
